var express = require('express')
var fs = require('fs')
var _ = require('lodash')
var async = require('async')
var path = require('path')
var moment = require('moment')
var mongoose = require('mongoose')
var schema = require('./schema')
var Program = schema.Program
var User = schema.User
var Account = schema.Account
var InvoiceRow = schema.InvoiceRow
var ChangeLog = schema.ChangeLog
var Provider = schema.Provider
var ProviderMetadata = schema.ProviderMetadata
var ClassificationCriteria = schema.ClassificationCriteria
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var kieku = require('./kieku')
var programExport = require('./program-export')
var classificationUtils = require('../shared/classification-utils')
var xml = require('./xml-import')
var sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD)
var builder = require('xmlbuilder')
var bcrypt = require('bcrypt')
var CronJob = require('cron').CronJob
var providerUtils = require('./provider-utils')
var multer  = require('multer')
var providerImport = require('./provider-import')
var csrf = require('csurf')
var buildRevision = fs.readFileSync(__dirname + '/../build.revision', 'utf-8')
var validation = require('./validation')
var srvUtils = require('./server-utils')
var env = require('./env').get()
var testEnvEmailQueue = []

express.static.mime.define({ 'text/xml': ['xsd'] })

var app = express()

app.use(rejectNonHttpMethods)
app.use(nocache)
app.use(forceSSL)
app.use(express.compress())
app.use(express.json())
app.use(setupUrlEncodedBodyParser())
app.use(express.cookieParser(process.env.COOKIE_SALT || 'secret'))
app.use(buildRevisionCheck)
app.use(setupCsrfMiddleware())
app.use(setCsrfTokenCookie)
app.use(authenticate)
app.use(express.static(path.join(__dirname, '../client')))
app.use('/shared', express.static(path.join(__dirname, '../shared')))
app.use(multer({ dest: '/tmp/', limits: { fileSize:5000000, files:1 } }))

app.post('/login', function(req, res, next) {
  var username = req.body.username
  var password = req.body.password
  if (!username || !password) return res.send(403)
  User.findOne({ username: username.toUpperCase(), password: {$exists: true}, active: true }, function(err, user) {
    if (err) return next(err)
    if (!user) return res.send(403)
    if (user.certificateEndDate && moment(user.certificateEndDate).isBefore(moment()) ) {
      user.update({ active: false }, respond(res, next, 403))
    } else {
      user.checkPassword(password, function(err, ok) {
        if (err) return next(err)
        if (!ok) return res.send(403)
        logUserIn(req, res, user)
        res.send({})
      })
    }
  })
})

function logUserIn(req, res, user) {
  var weekInMs = 604800000
  res.cookie('user', {
    _id: user._id.toString(),
    username: user.username,
    name: user.name,
    role: user.role,
    email: _.first(user.emails),
    employerName: utils.getProperty(user, 'employers.0.name')
  }, { maxAge: weekInMs, signed: true })
  saveChangeLogEntry(_.merge(user, { ip: getIpAddress(req) }), null, 'login')
}

app.post('/logout', function(req, res, next) {
  res.clearCookie('user')
  res.send({})
})

app.post('/forgot-password', function(req, res, next) {
  var username = req.body.username
  if (!username) return res.send(403)
  User.findOne({ username: username.toUpperCase(), active: true }, function(err, user) {
    if (err) return next(err)
    if (!user) return res.send(403)
    if (_.isEmpty(user.emails)) {
      console.log(user.username + ' has no email address')
      return res.send(500)
    }
    var subject = 'Salasanan uusiminen / Förnya lösenordet'
    srvUtils.getTemplate('reset-password-email.tpl.html', function(err, tpl) {
      if (err) return next(err)
      if (user.resetHash) {
        sendHashLinkViaEmail(user, subject, tpl, respond(res, next, {}))
      } else {
        createAndSaveHash(user, function(err) {
          if (err) return next(err)
          sendHashLinkViaEmail(user, subject, tpl, respond(res, next, {}))
        })
      }
    })
  })
})

function sendHashLinkViaEmail(user, subject, template, callback) {
  var url = env.hostname + '/reset-password.html#' + user.resetHash
  var emailData = {
    recipients: user.emails,
    subject: subject,
    body: _.template(template, { link: url, username: user.username })
  }
  sendEmail(emailData, user, callback)
}

function createAndSaveHash(user, callback) {
  bcrypt.genSalt(1, function (err, s) {
    user.resetHash = new Buffer(s, 'base64').toString('hex')
    user.save(callback)
  })
}

app.get('/check-reset-hash/:hash', function(req, res, next) {
  User.findOne({ resetHash: req.params.hash, active: true }).lean().exec(function(err, user) {
    if (err) return next(err)
    if (!user) return res.send(403)
    if (user.password) return res.send({ name: user.name })
    res.send({ newUser: true, name: user.name })
  })
})

app.post('/reset-password', function(req, res, next) {
  var resetHash = req.body.resetHash
  if (resetHash) {
    User.findOne({ resetHash: resetHash, active: true }, function (err, user) {
      if (err) return next(err)
      if (!user) return res.send(403)
      user.password = req.body.password
      user.resetHash = null
      user.save(function (err, user) {
        if (err) return next(err)
        logUserIn(req, res, user)
        res.send({})
      })
    })
  } else {
    return res.send(403)
  }
})


app.post('/program/excel/export', function(req, res, next) {

  var data = JSON.parse(req.body.post_data)

  var isUser = data.user ? true : false
  var isKavi = isUser ? utils.hasRole(data.user, 'kavi') : false
  var fields = isKavi ? null : { 'classifications.comments': 0 }
  fields = isUser ? fields : Program.publicFields

  var queryParams = {
    "page": data.page,
    "isUser": isUser,
    "isKavi": isKavi,
    "fields": fields,
    "user": data.user,
    "q": data.q,
    "searchFromSynopsis": data.searchFromSynopsis,
    "agelimits": data.agelimits,
    "warnings": data.warnings,
    "filters": data.filters,
    "registrationDateRange": data.registrationDateRange,
    "userRole": utils.getProperty(req, 'user.role'),
    "classifier": data.classifier,
    "reclassified": data.reclassified,
    "reclassifiedBy": data.reclassifiedBy,
    "ownClassificationsOnly": data.ownClassificationsOnly,
    "showDeleted": data.showDeleted,
    "buyer": data.buyer
  }

  var query = constructQuery(queryParams)
  var sortBy = query.classifications ? '-classifications.0.registrationDate' : 'name'
  
  sendOrExport(query, queryParams, sortBy, false, res, next)
})


app.get('/programs/search/:q?', function(req, res, next) {

  var page = req.query.page || 0
  var isUser = req.user ? true : false
  var isKavi = isUser ? utils.hasRole(req.user, 'kavi') : false
  var fields = isKavi ? null : { 'classifications.comments': 0 }
  fields = isUser ? fields : Program.publicFields

  var queryParams = {
    "page": page,
    "isUser": isUser,
    "isKavi": isKavi,
    "fields": fields,
    "user": req.user,
    "q": req.params.q,
    "searchFromSynopsis": req.query.searchFromSynopsis == 'true',
    "agelimits": req.query.agelimits,
    "warnings": req.query.warnings,
    "filters": req.query.filters,
    "registrationDateRange": req.query.registrationDateRange,
    "userRole": utils.getProperty(req, 'user.role'),
    "classifier": req.query.classifier,
    "reclassified": req.query.reclassified == 'true',
    "reclassifiedBy": req.query.reclassifiedBy,
    "ownClassificationsOnly": req.query.ownClassificationsOnly == 'true',
    "showDeleted": req.query.showDeleted == 'true',
    "buyer": req.query.buyer,
    "directors": req.query.directors
  }

  var query = constructQuery(queryParams)
  var sortBy = query.classifications ? '-classifications.0.registrationDate' : 'name'
  
  sendOrExport(query, queryParams, sortBy, true, res, next)
})

function sendOrExport(query, queryData, sortBy, sendJSONResponse, res, next){

  var isAdminUser = utils.hasRole(queryData.user, 'root')
  var showClassificationAuthor = isAdminUser

  if (sendJSONResponse) {
    Program.find(query, queryData.fields).skip(queryData.page * 100).limit(100).sort(sortBy).lean().exec(function(err, docs) {
      if (err) return next(err)

      if(!queryData.isKavi) docs.forEach(function (doc) { removeOtherUsersComments(doc.classifications, queryData.user) })

      if (queryData.page == 0) {
        Program.count(query, function(err, count) {
          res.send({ count: count, programs: docs })
        })
      } else {
        res.send({ programs: docs })
      }
    })
  } else {
    Program.find(query, queryData.fields).limit(5000).exec().then(function(docs){

      var result = programExport.constructProgramExportData(docs, showClassificationAuthor)
      var filename = 'kavi_luokittelut.xlsx'
      res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      res.send(result)
    })
  }
}

function constructReclassifiedByQuery(reclassified, reclassifiedBy) {
  var reclassifiedByQuery = {}
  if (reclassified) {
    reclassifiedByQuery = {$and: []}
    reclassifiedByQuery.$and.push({"classifications.isReclassification": {$eq: true}})    // At least one reclassification in the classifications list 
    if (reclassifiedBy == 2) reclassifiedByQuery.$and.push({"classifications.authorOrganization": {$exists: true}})
    if (reclassifiedBy == 3) reclassifiedByQuery.$and.push({"classifications.authorOrganization": {$exists: false}})
  }
  return reclassifiedByQuery
}

function constructQuery(queryData) {
  var mainQuery = {$and: []}

  //isUser, isKavi, user, qstring, fromSynopsis, agelimits, warnings, filters, registrationDateRange, userRole, classifier, reclassified, reclassifiedBy, ownClassificationsOnly, showDeleted
  mainQuery.$and.push(constructTypeClassificationQuery(queryData.user))
  mainQuery.$and.push(constructNameQueries(queryData.q, queryData.searchFromSynopsis))
  mainQuery.$and.push(agelimitQuery(queryData.agelimits))
  mainQuery.$and.push(warningsQuery(queryData.warnings))
  mainQuery.$and.push(constructProgramTypeFilter(queryData.filters))
  mainQuery.$and.push(constructDirectorFilter(queryData.directors))
  mainQuery.$and.push(constructDateRangeQuery(queryData.registrationDateRange))
  mainQuery.$and.push(getQueryUserRoleDependencies(queryData.user ? queryData.user._id : undefined, queryData.userRole))
  mainQuery.$and.push(constructClassifierQuery(queryData.classifier, queryData.reclassified))
  mainQuery.$and.push(constructReclassifiedByQuery(queryData.reclassified, queryData.reclassifiedBy))
  mainQuery.$and.push(constructBuyerQuery(queryData.buyer))

  if(queryData.isUser) mainQuery.$and.push(constructOwnClassifications(queryData.ownClassificationsOnly, queryData.user._id))
  mainQuery.$and.push(constructDeletedQuery(queryData.showDeleted))

  mainQuery.$and = _.filter(mainQuery.$and, function (andItem) { return !_.isEmpty(andItem)})

  return mainQuery
}
  
  function constructTypeClassificationQuery(user){
    return user ? {} : {$or: [{programType: 2}, {classifications:{$exists: true, $nin: [[]]}}]}
  }

function constructDeletedQuery(showDeleted){
  var deleted = {deleted: { $ne: true }}
  if (showDeleted) {
    deleted = { deleted: true }
  }

  return deleted
}

function constructBuyerQuery(buyer){
  var buyers = {}
  if (buyer){
    buyers = { 'classifications': { $elemMatch: { 'buyer._id': buyer }}}
  }
  return buyers
}

function constructOwnClassifications(ownClassifications, userid){
  var owns = {}
  if (ownClassifications){
    owns = { classifications: { $elemMatch: { 'author._id': userid }}}
  }

  return owns
}

function constructProgramTypeFilter(filters){
  var filt = {}

  var filters = filters || []
  if (filters.length > 0) filt = ({"programType": { $in: filters }})

  return filt
}

function toSearchTermQuery(string, primaryField, secondaryField, fromBeginning) {
  var searchString = (string || '').trim()
  var parts = searchString.match(/"[^"]*"|[^ ]+/g)
  if (!parts) return undefined
  return parts.reduce(function(result, s) {
    if (/^".+"$/.test(s)) {
      var withoutQuotes = s.substring(1, s.length - 1)
      if (s.indexOf(' ') == -1) {
        return addToAll(result, primaryField, withoutQuotes)
      } else {
        return addToAll(result, primaryField, new RegExp(utils.escapeRegExp(withoutQuotes), "i"))
      }
    } else {
      return addToAll(result, secondaryField, new RegExp((fromBeginning ? '^' : '') + utils.escapeRegExp(s), "i"))
    }
  }, {})

  function addToAll(obj, key, value) {
    if (!obj[key]) obj[key] = { $all: [] }
    obj[key].$all.push(value)
    return obj
  }
}

function agelimitQuery(agelimits) {
  var limits = {}
  if (agelimits && !_.isEmpty(agelimits)) {
    var agelimitsIn = { $in: agelimits.map(function(s) { return parseInt(s) }) }
    limits = ({$or: [{ 'classifications.0.agelimit': agelimitsIn }, { 'episodes.agelimit': agelimitsIn }]})
  }

  return limits
}

function warningsQuery(w) {
  var warnings = {}

  if (w && !_.isEmpty(w)) {
    var warnings = { $all: w }
    warnings = ({ $or: [{ 'classifications.0.warnings': warnings }, { 'episodes.warnings': warnings } ] })
  }

  return warnings
}

  function constructClassifierQuery(classifier) {
    var classifierQuery = {}
    if (classifier) {
      classifierQuery = {"classifications.author._id": classifier}
    }
    return classifierQuery
  }

function constructDirectorFilter(directors) {
  if (directors && directors.length > 0) {
    return {directors: {$in: directors.split(',')}}
  }
  return {}
}

function constructDateRangeQuery(registrationDateRange) {
  var dtQuery = {}
  if (registrationDateRange) {
    var range = utils.parseDateRange(registrationDateRange)
    dtQuery = {classifications: {$elemMatch: {registrationDate: {$gte: range.begin.toDate(), $lt: range.end.toDate()}} }}
  }
  return dtQuery
}

function constructNameQueries(terms, useSynopsis){
  var nameQuery = {}

  var nameQueries = toSearchTermQuery(terms, 'fullNames', 'allNames', true)
  if (nameQueries) {
    if (parseInt(terms) == terms) {
      nameQuery = ({$or: [nameQueries, { sequenceId: terms }]})
    } else {
      nameQuery = ({$or: [nameQueries]})
    }
  }

  if(useSynopsis) {
    var synopsisQueries = toSearchTermQuery(terms, 'synopsis', 'synopsis')
    if(synopsisQueries) nameQuery.$or.push(synopsisQueries)
  }

  return nameQuery
}

function getQueryUserRoleDependencies(userid, role){
  var roleQuery = {}
  var ObjectId = mongoose.Types.ObjectId

  if (role === 'trainee') roleQuery = ({$or: [{'createdBy.role': {$ne: 'trainee'}}, {'createdBy._id': ObjectId(userid)}]})
  if (role === 'user') roleQuery = ({ 'createdBy.role': { $ne: 'trainee' }})

  return roleQuery
}

app.get('/episodes/:seriesId', function(req, res, next) {
  var fields = !req.user ? {'classifications.author': 0, 'classifications.authorOrganization': 0, 'classifications.buyer': 0, 'classifications.billing': 0, 'classifications.comments': 0, 'classifications.userComments': 0, draftClassifications: 0 }
    : utils.hasRole(req.user, 'kavi') ? {} : {'classifications.comments': 0}
  var query = { deleted: { $ne:true }, 'series._id': req.params.seriesId }
  if (!req.user) query.classifications = { $exists: true, $nin: [[]] }
  Program.find(query, fields).sort({ season:1, episode:1 }).lean().exec(function (err, docs) {
    if (err) return next(err)
    else {
      docs.forEach(function (doc) { removeOtherUsersComments(doc.classifications, req.user)  })
      res.send(docs)
    }
  })
})

app.get('/programs/drafts', function(req, res, next) {
  Program.find({ draftsBy: req.user._id, deleted: { $ne:true } }, { name:1, draftClassifications:1 }).lean().exec(function(err, programs) {
    if (err) return next(err)
    res.send(programs.map(function(p) {
      return {_id: p._id, name: p.name, creationDate: p.draftClassifications[req.user._id].creationDate}
    }))
  })
})

app.get('/programs/recent', function(req, res, next) {
  var ObjectId = mongoose.Types.ObjectId
  Program.aggregate({$match: { "classifications.author._id": ObjectId(req.user._id), deleted: { $ne: true } }})
    .unwind("classifications")
    .project({"registrationDate": "$classifications.registrationDate"})
    .sort('-registrationDate')
    .limit(1)
    .exec(function(err, recents) {
      if (err) return next(err)
      async.map(recents, function(p, callback) {
        return Program.findById(p._id, function (err, program) {
          if (!err) removeOtherUsersComments(program.classifications, req.user)
          callback(err, program)
        })
      }, respond(res, next))
    })
})

function removeOtherUsersComments(classifications, user) {
  if (classifications) return classifications.forEach(function (c) {
    if (!utils.hasRole(user, 'kavi')) {
      c.comments = ''
      if (!user || !c.author || user.username !== c.author.username) {
        c.userComments = ''
      }
    }
  })
}

app.delete('/programs/drafts/:id', function(req, res, next) {
  var pull = { draftsBy: req.user._id }
  var unset = utils.keyValue('draftClassifications.' + req.user._id, "")
  Program.findByIdAndUpdate(req.params.id, { $pull: pull, $unset: unset }, function(err, p) {
    if (err) return next(err)
    if (p.classifications.length == 0 && p.draftsBy.length == 0) {
      softDeleteAndLog(p, req.user, respond(res, next))
    } else {
      res.send(p)
    }
  })
})

app.get('/programs/:id', function(req, res, next) {
  Program.findById(req.params.id).lean().exec(respond(res, next))
})

app.post('/programs/new', function(req, res, next) {
  var programType = parseInt(req.body.programType)
  if (!enums.util.isDefinedProgramType(programType)) return res.send(400)
  var p = new Program({ programType: programType, sentRegistrationEmails: [], createdBy: {_id: req.user._id, username: req.user.username, name: req.user.name, role: req.user.role}})
  var draftClassification = p.newDraftClassification(req.user)
  var origProgram = req.body.origProgram
  if (origProgram) {
    var fieldsToCopy = ['series', 'country', 'year', 'productionCompanies', 'genre', 'directors', 'actors']
    _.forEach(fieldsToCopy, function (field) { p[field] = origProgram[field] })
    if (origProgram.classifications.length > 0) {
      draftClassification.buyer = undefined
      draftClassification.billing = undefined
      draftClassification.format = origProgram.classifications[0].format
    }
    if (enums.util.isTrailer(origProgram)) {
      p.synopsis = origProgram.synopsis

    }
  }
  p.save(function(err, program) {
    if (err) return next(err)
    logCreateOperation(req.user, program)
    res.send(program)
  })
})

function currentPrices() {
  var pricesExistingYear = _.find(_.range(moment().year(), 2015, -1), function (y) { return process.env['PRICES_' + y] != undefined })
  if (!pricesExistingYear) console.warn('Cannot find prices from config variable, using (possibly outdated) defaults')
  return pricesExistingYear ? JSON.parse(process.env['PRICES_' + pricesExistingYear]) : enums.defaultPrices
}

app.post('/programs/:id/register', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)

    var newClassification = program.draftClassifications[req.user._id]
    if (!newClassification) return res.send(409)

    newClassification.status = 'registered'
    newClassification.author = { _id: req.user._id, name: req.user.name, username: req.user.username }
    if (newClassification.isReclassification && !utils.hasRole(req.user, 'kavi')) {
      newClassification.reason = 4
    }
    Program.updateClassificationSummary(newClassification)

    program.draftClassifications = {}
    program.draftsBy = []
    program.classifications.unshift(newClassification)
    program.classifications.sort(function (c1, c2) { return c2.registrationDate - c1.registrationDate })
    program.markModified('draftClassifications')
    program.preventSendingEmail = req.body.preventSendingEmail

    populateSentRegistrationEmailAddresses(program, function (err, program) {
      if (err) return next(err)
      verifyTvSeriesExistsOrCreate(program, req.user, function(err) {
        if (err) return next(err)
        program.save(function(err) {
          if (err) return next(err)
          updateTvSeriesClassification(program, function(err) {
            if (err) return next(err)
            addInvoicerows(newClassification, function(err) {
              if (err) return next(err)
              sendRegistrationEmail(function(err) {
                if (err) return next(err)
                updateMetadataIndexesForNewProgram(program, function() {
                  logUpdateOperation(req.user, program, { 'classifications': { new: 'Luokittelu rekisteröity' } })
                  return res.send(program)
                })
              })
            })
          })
        })
      })
    })

    function updateMetadataIndexesForNewProgram(program, callback) {
      if (program.classifications.length > 1) return callback()
      updateMetadataIndexes(program, callback)
    }

    function addInvoicerows(currentClassification, callback) {
      if (utils.hasRole(req.user, 'root')) return process.nextTick(callback)

      var seconds = classificationUtils.durationToSeconds(currentClassification.duration)

      if (classificationUtils.isReclassification(program, currentClassification)) {
        if (enums.isOikaisupyynto(currentClassification.reason) && enums.authorOrganizationIsKavi(currentClassification)) {
          InvoiceRow.fromProgram(program, 'reclassification', seconds, currentPrices().reclassificationFee).save(callback)
        } else if (!utils.hasRole(req.user, 'kavi')) {
          InvoiceRow.fromProgram(program, 'registration', seconds, currentPrices().registrationFee).save(callback)
        } else {
          callback()
        }
      } else {
        InvoiceRow.fromProgram(program, 'registration', seconds, currentPrices().registrationFee).save(function(err, saved) {
          if (err) return next(err)
          if (utils.hasRole(req.user, 'kavi')) {
            // duraation mukaan laskutus
            var classificationPrice = classificationUtils.price(program, seconds, currentPrices())
            InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback)
          } else {
            callback()
          }
        })
      }
    }

    function populateSentRegistrationEmailAddresses(program, callback) {
      if (utils.hasRole(req.user, 'root') && program.preventSendingEmail) return process.nextTick(callback.bind(null, null, program))
      program.populateSentRegistrationEmailAddresses(function(err, program) {
        if (err) return callback(err)
        var valid = validation.registration(program.toObject(), newClassification, req.user)
        if (!valid.valid) {
          return res.send(400, "Invalid program. Field: " + valid.field)
        }
        callback(null, program)
      })
    }

    function sendRegistrationEmail(callback) {
      if (utils.hasRole(req.user, 'root') && program.preventSendingEmail) return process.nextTick(callback)
      sendEmail(classificationUtils.registrationEmail(program, newClassification, req.user, env.hostname), req.user, callback)
    }
  })
})

app.post('/programs/:id/classification', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) next(err)
    if (program.classifications.length > 0) return res.send(400)
    program.deleted = false
    program.newDraftClassification(req.user)
    program.save(respond(res, next))
  })
})

app.post('/programs/:id/reclassification', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) next(err)
    if (!classificationUtils.canReclassify(program, req.user)) return res.send(400)
    program.deleted = false
    program.newDraftClassification(req.user)
    program.populateSentRegistrationEmailAddresses(function(err) {
      program.save(respond(res, next))
    })
  })
})

app.post('/programs/:id/categorization', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)
    var oldSeries = program.toObject().series
    var watcher = watchChanges(program, req.user, Program.excludedChangeLogPaths)
    var updates = _.merge(_.pick(req.body, ['programType', 'series', 'episode', 'season']), {deleted: false})
    watcher.applyUpdates(updates)
    if (!enums.util.isTvEpisode(program)) {
      program.series = program.episode = program.season = undefined
    }
    verifyTvSeriesExistsOrCreate(program, req.user, function(err) {
      if (err) return next(err)
      program.populateAllNames(function(err) {
        if (err) return next(err)
        watcher.saveAndLogChanges(function(err, program) {
          if (err) return next(err)
          updateTvSeriesClassification(program, function(err) {
            if (err) return next(err)
            updateTvSeriesClassificationIfEpisodeRemovedFromSeries(program, oldSeries, respond(res, next, program))
          })
        })
      })
    })
  })
})

app.post('/programs/:id', requireRole('root'), function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)
    var oldSeries = program.toObject().series
    var watcher = watchChanges(program, req.user, Program.excludedChangeLogPaths)
    watcher.applyUpdates(_.merge(req.body, {deleted: false}))
    program.classifications.forEach(function(c) {
      if (enums.authorOrganizationIsElokuvalautakunta(c) || enums.authorOrganizationIsKuvaohjelmalautakunta(c) || enums.authorOrganizationIsKHO(c)) {
        c.reason = undefined
        c.buyer = undefined
        c.billing = undefined
      }
      Program.updateClassificationSummary(c) })
    verifyTvSeriesExistsOrCreate(program, req.user, function(err) {
      if (err) return next(err)
      program.populateAllNames(function(err) {
        if (err) return next(err)
        updateTvEpisodeAllNamesOnParentNameChange(program, function(err) {
          if (err) return next(err)
          watcher.saveAndLogChanges(function(err, program) {
            if (err) return next(err)
            updateMetadataIndexes(program, function() {
              updateTvSeriesClassification(program, function(err) {
                if (err) return next(err)
                updateTvSeriesClassificationIfEpisodeRemovedFromSeries(program, oldSeries, function (err) {
                  if (err) return next(err)
                  updateInvoicerows(program, respond(res, next, program))
                })
              })
            })
          })
        })
      })
    })
  })

  function updateTvEpisodeAllNamesOnParentNameChange(parent, callback) {
    if (!enums.util.isTvSeriesName(parent)) return callback()
    if (!parent.hasNameChanges()) return callback()
    Program.find({ 'series._id': parent._id }).exec(function(err, episodes) {
      if (err) return callback(err)
      async.forEach(episodes, function(e, callback) { e.populateAllNames(parent, callback) }, function() {
        async.forEach(episodes, function(e, callback) { e.save(callback) }, callback)
      })
    })
  }
})

app.post('/programs/autosave/:id', function(req, res, next) {
  Program.findOne({ _id: req.params.id, draftsBy: req.user._id }, function(err, program) {
    if (err) return next(err)
    if (!program) return res.send(409)
    if (!isValidUpdate(req.body, program, req.user)) return res.send(400)
    watchChanges(program, req.user).applyUpdates(req.body)
    program.verifyAllNamesUpToDate(function(err) {
      if (err) return next(err)
      program.save(respond(res, next))
    })
  })

  function isValidUpdate(update, p, user) {
    var allowedFields = allowedAutosaveFields(p, user)
    return _.every(Object.keys(update), function(updateField) {
      return _.any(allowedFields, function(allowedField) {
        return allowedField[allowedField.length-1] == '*'
          ? updateField.indexOf(allowedField.substring(0, allowedField.length-1)) == 0
          : updateField == allowedField
      })
    })
  }

  function allowedAutosaveFields(p, user) {
    var programFields = ['name', 'nameFi', 'nameSv', 'nameOther', 'country', 'year', 'productionCompanies', 'genre', 'legacyGenre', 'directors', 'actors', 'synopsis', 'gameFormat', 'season', 'episode', 'series*']
    var classificationFields = ['buyer', 'billing', 'format', 'duration', 'safe', 'criteria', 'warningOrder', 'registrationDate', 'registrationEmailAddresses', 'comments', 'userComments', 'criteriaComments*', 'kaviType']
    var kaviReclassificationFields = ['authorOrganization', 'publicComments', 'reason']
    if (p.classifications.length == 0) {
      return programFields.concat(classificationFields.map(asDraftField))
    } else {
      return utils.hasRole(user, 'kavi')
        ? classificationFields.concat(kaviReclassificationFields).map(asDraftField)
        : classificationFields.map(asDraftField)
    }
    function asDraftField(s) { return 'draftClassifications.'+user._id+'.'+s }
  }
})

app.delete('/programs/:id', requireRole('root'), function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)
    softDeleteAndLog(program, req.user, function(err, program) {
      if (err) return next(err)
      InvoiceRow.removeProgram(program, function (err) {
        if (err) return next(err)
        updateTvSeriesClassification(program, respond(res, next, program))
      })
    })
  })
})

app.delete('/programs/:programId/classification/:classificationId', requireRole('root'), function(req, res, next) {
  var classificationId = req.params.classificationId
  Program.findById(req.params.programId, function(err, program) {
    if (err) return next(err)
    var watcher = watchChanges(program, req.user, ['deletedClassifications', 'sentRegistrationEmailAddresses'])
    var classification = program.classifications.id(classificationId)
    program.classifications.pull(classificationId)
    program.deletedClassifications.push(classification)
    program.populateSentRegistrationEmailAddresses(function(err) {
      if (err) return next(err)
      watcher.saveAndLogChanges(function(err) {
        if (err) return next(err)
        if (program.classifications.length === 0) InvoiceRow.removeProgram(program, function (err) {
          if (err) return next(err)
          updateTvSeriesClassification(program, respond(res, next, program))
        })
        else updateTvSeriesClassification(program, respond(res, next, program))
      })
    })
  })
})

app.get('/series/search', function(req, res, next) {
  var q = { programType: 2, deleted: { $ne: true } }
  var parts = toMongoArrayQuery(req.query.q)
  if (parts) q.allNames = parts
  Program.find(q, { name: 1 }).lean().limit(20).sort('name').exec(function(err, data) {
    if (err) return next(err)
    res.send(_.map(data, function(d) { return { _id: d._id, name: d.name[0] } }))
  })
})

app.get('/accounts/access/:id', function(req, res, next) {
  if (utils.hasRole(req.user, 'kavi')) {
    res.send({access: true})
  } else {
    Account.findById(req.params.id, function(err, account) {
      res.send({access: err === null && account.users.id(req.user._id) !== null})
    })
  }
})

app.put('/accounts/:id', requireRole('kavi'), function(req, res, next) {
  if (!utils.hasRole(req.user, 'root')) delete req.body.apiToken
  Account.findById(req.params.id, function(err, account) {
    if (err) return next(err)
    updateAndLogChanges(account, req.body, req.user, respond(res, next))
  })
})

app.post('/accounts', requireRole('kavi'), function(req, res, next) {
  if (!utils.hasRole(req.user, 'root')) delete req.body.apiToken
  new Account(req.body).save(function(err, account) {
    if (err) return next(err)
    logCreateOperation(req.user, account)
    res.send(account)
  })
})

app.delete('/accounts/:id', requireRole('root'), function(req, res, next) {
  Account.findById(req.params.id, function (err, account) {
    if (err) return next(err)
    softDeleteAndLog(account, req.user, respond(res, next))
  })
})

app.get('/accounts', requireRole('kavi'), function(req, res, next) {
  var selectedRoles = req.query.roles
  var query = selectedRoles ? { roles: { $all: selectedRoles }} : {}
  Account.find(_.merge(query, { deleted: { $ne: true }})).lean().exec(respond(res, next))
})

app.get('/subscribers', requireRole('kavi'), function(req, res, next) {
  var selectedRoles = req.query.roles
  var query = _.isEmpty(selectedRoles)
    ? { roles: { $in: ['Classifier', 'Subscriber'] }}
    : { roles: { $all: selectedRoles }}
  Account.find(_.merge(query, { deleted: { $ne: true }})).lean().exec(respond(res, next))
})

app.get('/providers/unapproved', requireRole('kavi'), function(req, res, next) {
  Provider.find({deleted: false, active: false, registrationDate: { $exists: false }}, '', respond(res, next))
})

app.get('/providers', requireRole('kavi'), function(req, res, next) {
  Provider.aggregate([
    {$match: {deleted: false, registrationDate: { $exists: true }}},
    {$redact: {$cond: {
      if: {$and: [{$not: '$locations'}, {$eq: ['$deleted', true]}]},
      then: '$$PRUNE', else: '$$DESCEND'}}}
  ], respond(res, next))
})

app.post('/providers', requireRole('kavi'), function(req, res, next) {
  new Provider(utils.merge(req.body, { deleted: false, active: false, creationDate: new Date() })).save(function(err, provider) {
    if (err) return next(err)
    logCreateOperation(req.user, provider)
    res.send(provider)
  })
})

app.put('/providers/:id/active', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.id, function(err, provider) {
    if (err) return next(err)
    var isFirstActivation = !provider.registrationDate
    var newActive = !provider.active
    var updates = {active: {old: provider.active, new: newActive}}
    provider.active = newActive
    if (isFirstActivation) {
      var now = new Date()
      provider.registrationDate = now
      updates.registrationDate = {old: undefined, new: now}
      _.select(provider.locations, function(l) {
        return !l.deleted && l.active
      }).forEach(function(l) {
        l.registrationDate = now
        var updates = {registrationDate: {old: undefined, new: now}}
        saveChangeLogEntry(req.user, l, 'update', {targetCollection: 'providerlocations', updates: updates})
      })
    }
    saveChangeLogEntry(req.user, provider, 'update', {updates: updates})
    provider.save(function(err, saved) {
      if (isFirstActivation) {
        var provider = saved.toObject()
        var providerHasEmails = !_.isEmpty(provider.emailAddresses)
        if (providerHasEmails) {
          providerUtils.registrationEmail(provider, env.hostname, logErrorOrSendEmail(req.user))
        }
        sendProviderLocationEmails(provider)
        var withEmail = providerUtils.payingLocationsWithEmail(provider.locations)
        var withoutEmail = providerUtils.payingLocationsWithoutEmail(provider.locations)
        return res.send({
          active: true,
          wasFirstActivation: true,
          emailSent: providerHasEmails,
          locationsWithEmail: withEmail,
          locationsWithoutEmail: withoutEmail
        })
      }
      res.send({active: saved.active, wasFirstActivation: false})
    })
  })

  function sendProviderLocationEmails(provider) {
    _.select(provider.locations, function(l) {
      return !l.deleted && l.isPayer && l.active && l.emailAddresses.length > 0
    }).forEach(function(l) {
      providerUtils.registrationEmailProviderLocation(utils.merge(l, {provider: provider}), env.hostname, logErrorOrSendEmail(req.user))
    })
  }
})

app.put('/providers/:id', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.id, function(err, provider) {
    if (err) return next(err)
    updateAndLogChanges(provider, req.body, req.user, respond(res, next))
  })
})

app.delete('/providers/:id', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.id, function (err, provider) {
    if (err) return next(err)
    softDeleteAndLog(provider, req.user, respond(res, next))
  })
})

app.get('/providers/metadata', requireRole('kavi'), function(req, res, next) {
  ProviderMetadata.getAll(respond(res, next))
})

app.post('/providers/yearlyBilling/kieku', requireRole('kavi'), function(req, res, next) {
  Provider.getForBilling(function(err, data) {
    var year = moment().year()
    var accountRows = getProviderBillingRows(data)
    var result = kieku.createYearlyProviderRegistration(year, accountRows)
    res.setHeader('Content-Disposition', 'attachment; filename=kieku_valvontamaksut_vuosi' + moment().year() + '.xlsx')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ProviderMetadata.setYearlyBillingCreated(new Date(), function() {
      res.send(result)
    })
  })
})

app.post('/providers/billing/kieku', requireRole('kavi'), function(req, res, next) {
  var dateFormat = 'DD.MM.YYYY'
  var dates = { begin: moment(req.body.begin, dateFormat), end: moment(req.body.end, dateFormat), inclusiveEnd: moment(req.body.end, dateFormat).add(1, 'day') }
  var dateRangeQ = { $gte: dates.begin, $lt: dates.inclusiveEnd }
  var registrationDateFilters = { $or: [
    { registrationDate: dateRangeQ },
    { 'locations.registrationDate': dateRangeQ }
  ]}
  Provider.getForBilling(registrationDateFilters, function(err, data) {
    if (err) return next(err)

    data.providers = _(data.providers).map(function(p) {
      p.locations = _.filter(p.locations, function(l) { return utils.withinDateRange(l.registrationDate, dates.begin, dates.inclusiveEnd) })
      return p
    }).reject(function(p) { return _.isEmpty(p.locations) }).value()

    data.locations = _.filter(data.locations, function(l) { return utils.withinDateRange(l.registrationDate, dates.begin, dates.inclusiveEnd) })

    var accountRows = getProviderBillingRows(data)
    var result = kieku.createProviderRegistration(accountRows)
    var filename = 'kieku_valvontamaksut_' + dates.begin.format(dateFormat) + '-' + dates.end.format(dateFormat) + '.xlsx'
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ProviderMetadata.setPreviousMidYearBilling(new Date(), dates.begin, dates.end, function() {
      res.send(result)
    })
  })
})

app.get('/providers/yearlyBilling/info', requireRole('kavi'), function(req, res, next) {
  Provider.getForBilling(function(err, data) {
    if (err) return next(err)

    var providers = _.groupBy(data.providers, function(p) { return _.isEmpty(p.emailAddresses) ? 'noMail' : 'withMail' })
    var locations = _.groupBy(data.locations, function(p) { return _.isEmpty(p.emailAddresses) ? 'noMail' : 'withMail' })

    res.json({
      providerCount: providers.withMail ? providers.withMail.length : 0,
      locationCount: locations.withMail ? locations.withMail.length : 0,
      providersWithoutMail: providers.noMail ? providers.noMail : [],
      locationsWithoutMail: locations.noMail ? locations.noMail : []
    })
  })
})

app.post('/providers/yearlyBilling/sendReminders', requireRole('kavi'), function(req, res, next) {
  Provider.getForBilling(function(err, data) {
    if (err) return next(err)

    _(data.providers).reject(function(p) { return _.isEmpty(p.emailAddresses) }).forEach(function(p) {
      providerUtils.yearlyBillingProviderEmail(p, env.hostname, logErrorOrSendEmail(req.user))
    })
    _(data.locations).reject(function(l) { return _.isEmpty(l.emailAddresses) }).forEach(function(l) {
      providerUtils.yearlyBillingProviderLocationEmail(l, env.hostname, logErrorOrSendEmail(req.user))
    })

    ProviderMetadata.setYearlyBillingReminderSent(new Date(), respond(res, next))
  })
})

app.get('/providers/billing/:begin/:end', requireRole('kavi'), function(req, res, next) {
  var format = 'DD.MM.YYYY'

  var beginMoment = moment(req.params.begin, format)
  var endMoment = moment(req.params.end, format).add(1, 'day')
  var dates = {
    $gte: beginMoment,
    $lt: endMoment
  }

  var terms = {
    active: true, deleted: false,
    $or: [
      { registrationDate: dates },
      { 'locations.registrationDate': dates }
    ]
  }

  Provider.find(terms).lean().exec(function(err, providers) {
    if (err) return next(err)
    _.forEach(providers, function(provider) {
      provider.locations = _(provider.locations)
        .filter({ active: true, deleted: false })
        .filter(function(l) { return utils.withinDateRange(l.registrationDate, beginMoment, endMoment) })
        .sortBy('name').value()
    })
    res.send(_.filter(providers, function(provider) { return !_.isEmpty(provider.locations) }))
  })
})

app.get('/providers/:id', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.id).lean().exec(function(err, provider) {
    if (err) return next(err)
    provider.locations = _(provider.locations).filter({ deleted: false }).sortBy('name').value()
    res.send(provider)
  })
})

app.put('/providers/:pid/locations/:lid/active', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.pid, function(err, provider) {
    if (err) return next(err)
    var location = provider.locations.id(req.params.lid)
    var firstActivation = isFirstActivation(provider, location)
    var updates = {}
    if (firstActivation) {
      location.registrationDate = new Date()
      updates.registrationDate = {old: undefined, new: location.registrationDate}
    }
    location.active = !location.active

    updates.active = {old: !location.active, new: location.active}
    saveChangeLogEntry(req.user, location, 'update', {targetCollection: 'providerlocations', updates: updates})

    provider.save(function(err, saved) {
      if (firstActivation) {
        sendRegistrationEmails(saved.toObject(), location.toObject(), respond(res, next))
      } else {
        res.send({active: location.active, wasFirstActivation: false, registrationDate: location.registrationDate})
      }
    })
  })

  function sendRegistrationEmails(provider, location, callback) {
    if (location.isPayer && !_.isEmpty(location.emailAddresses)) {
      // a paying location provider: send email to location
      providerUtils.registrationEmailProviderLocation(utils.merge(location, {provider: provider}), env.hostname, logErrorOrSendEmail(req.user))
      callback(null, {active: true, wasFirstActivation: true, emailSent: true, registrationDate: location.registrationDate})
    } else if (!location.isPayer && !_.isEmpty(provider.emailAddresses)) {
      // email the provider
      var providerData = _.clone(provider)
      providerData.locations = [location]
      providerUtils.registrationEmail(providerData, env.hostname, logErrorOrSendEmail(req.user))
      callback(null, {active: true, wasFirstActivation: true, emailSent: true, registrationDate: location.registrationDate})
    } else {
      // location is the payer, but the location has no email addresses
      // or the provider has no email addresses
      callback(null, {active: true, wasFirstActivation: true, emailSent: false, registrationDate: location.registrationDate})
    }
  }

  function isFirstActivation(provider, location) {
    return provider.registrationDate && !location.active && !location.registrationDate
  }
})

app.put('/providers/:pid/locations/:lid', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.pid, function(err, provider) {
    var flatUpdates = utils.flattenObject(req.body)
    var location = provider.locations.id(req.params.lid)
    var watcher = watchChanges(location, req.user)
    _.forEach(flatUpdates, function(value, key) { location.set(key, value) })
    provider.save(respond(res, next))
    saveChangeLogEntry(req.user, location, 'update', {updates: watcher.getChanges(), targetCollection: 'providerlocations'})
  })
})

app.post('/providers/:id/locations', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.id, function(err, p) {
    if (err) return next(err)
    var active = !p.registrationDate
    p.locations.push(utils.merge(req.body, { deleted: false, active: active }))
    p.save(function(err, p) {
      if (err) return next(err)
      logCreateOperation(req.user, _.last(p.locations))
      res.send(_.last(p.locations))
    })
  })
})

app.delete('/providers/:pid/locations/:lid', requireRole('kavi'), function(req, res, next) {
  Provider.findById(req.params.pid, function(err, provider) {
    if (err) return next(err)
    var location = provider.locations.id(req.params.lid)
    location.deleted = true
    saveChangeLogEntry(req.user, location, 'delete')
    provider.save(respond(res, next))
  })
})

app.get('/accounts/search', function(req, res, next) {
  var roles = req.query.roles ? req.query.roles.split(',') : []
  var q = { roles: { $in: roles }, deleted: { $ne: true }}
  if (!utils.hasRole(req.user, 'kavi')) {
    q['users._id'] = req.user._id
  }
  if (req.query.q && req.query.q.length > 0) q.name = new RegExp("^" + utils.escapeRegExp(req.query.q), 'i')
  Account.find(q, { _id:1, name:1 }).sort('name').limit(50).lean().exec(respond(res, next))
})

app.get('/accounts/:id/emailAddresses', function(req, res, next) {
  Account.findById(req.params.id, { emailAddresses: 1, users: 1 }).exec(function(err, account) {
    if (err) return next(err)
    if (!account) return res.send(404)
    if (!utils.hasRole(req.user, 'kavi') && !account.users.id(req.user._id)) return res.send(400)
    res.send({ _id: account._id, emailAddresses: account.emailAddresses })
  })
})

app.get('/users', requireRole('root'), function(req, res, next) {
  var roleFilters = req.query.roles
  var activeFilter = req.query.active ? req.query.active === 'true' : false
  var filters = _.merge({}, roleFilters ? { role: { $in: roleFilters }} : {}, activeFilter ? {active: true} : {})
  User.find(filters, User.noPrivateFields).sort('name').lean().exec(respond(res, next))
})

app.get('/users/search', requireRole('kavi'), function(req, res, next) {
  var regexp = new RegExp(utils.escapeRegExp(req.query.q), 'i')
  var q = { $or:[{ name: regexp }, { username: regexp }] }
  User.find(q, 'name username active').limit(50).sort('name').lean().exec(respond(res, next))
})

app.get('/users/exists/:username', requireRole('root'), function(req, res, next) {
  var q = (req.params.username || '').toUpperCase()
  User.findOne({ username: q }, { _id:1 }).lean().exec(function(err, user) {
    if (err) return next(err)
    res.send({ exists: !!user })
  })
})

app.post('/users/new', requireRole('root'), function(req, res, next) {
  var hasRequiredFields = (req.body.username != '' && req.body.emails[0].length > 0 && req.body.name != '')
  if (!hasRequiredFields || !utils.isValidUsername(req.body.username)) return res.send(400)
  req.body.username = req.body.username.toUpperCase()
  new User(req.body).save(function(err, user) {
    if (err) return next(err)
    createAndSaveHash(user, function(err) {
      if (err) return next(err)
      logCreateOperation(req.user, user)
      var subject = 'Käyttäjätunnuksen aktivointi / Aktivering av användarnamn'
      srvUtils.getTemplate('user-created-email.tpl.html', function(err, tpl) {
        if (err) return next(err)
        sendHashLinkViaEmail(user, subject, tpl, respond(res, next, user))
      })
    })
  })
})

app.post('/users/:id', requireRole('root'), function(req, res, next) {
  User.findById(req.params.id, function (err, user) {
    var updates = _.omit(req.body, 'username', 'emekuId', 'role', 'password', 'resetHash', 'certExpiryReminderSent')
    updateAndLogChanges(user, updates, req.user, function(err, saved) {
      if (err) return next(err)
      var cleaned = saved.toObject()
      User.privateFields.forEach(function(key) { delete cleaned[key] })
      res.send(cleaned)
    })
  })
})

app.get('/users/names/:names', requireRole('kavi'), function(req, res, next) {
  User.find({ username: {$in: req.params.names.toUpperCase().split(',')}}, 'name username active').lean().exec(function(err, users) {
    if (err) return next(err)
    var result = {}
    users.forEach(function(user) { result[user.username] = { name: user.name, active: user.active } })
    res.send(result)
  })
})

app.get('/apiToken', requireRole('root'), function(req, res, next) {
  bcrypt.genSalt(1, function(err, s) {
    if (err) return next(err)
    res.send({ apiToken: new Buffer(s, 'base64').toString('hex') })
  })
})

app.get('/actors/search', queryNameIndex('Actor'))
app.get('/directors/search', queryNameIndex('Director'))
app.get('/productionCompanies/search', queryNameIndex('ProductionCompany'))

app.get('/emails/search', function(req, res, next) {
  var terms = asTerms(req.query.q)
  async.parallel([loadUsers, loadAccounts], function(err, results) {
    if (err) return next(err)
    res.send(_(results).flatten().sortBy('name').value())
  })

  function loadUsers(callback) {
    var q = { $or: [ { name: terms }, { 'emails.0': terms } ], 'emails.0': { $exists: true }, deleted: { $ne:true } }
    User.find(q, { name: 1, emails:1 }).sort('name').limit(25).lean().exec(function(err, res) {
      if (err) return callback(err)
      callback(null, res.map(function(u) { return { id: u.emails[0], name: u.name, role: 'user' } }))
    })
  }
  function loadAccounts(callback) {
    var q = { $or: [ { name: terms }, { 'emailAddresses.0': terms } ], 'emailAddresses.0': { $exists: true }, roles: 'Subscriber', deleted: { $ne:true } }
    Account.find(q, { name: 1, emailAddresses: 1 }).sort('name').limit(25).lean().exec(function(err, res) {
      if (err) return callback(err)
      callback(null, res.map(function(a) { return { id: a.emailAddresses[0], name: a.name, role: 'account' } }))
    })
  }

  function asTerms(q) {
    var words = (q || '').trim().toLowerCase()
    return words ? { $all: words.split(/\s+/).map(asRegex) } : undefined
  }
  function asRegex(s) {
    return new RegExp('(^|\\s|\\.|@)' + utils.escapeRegExp(s), 'i')
  }
})

app.get('/invoicerows/:begin/:end', requireRole('kavi'), function(req, res, next) {
  var range = utils.parseDateRange(req.params)
  InvoiceRow.find({registrationDate: {$gte: range.begin, $lt: range.end}}).sort('registrationDate').lean().exec(respond(res, next))
})

app.post('/kieku', requireRole('kavi'), function(req, res, next) {
  var dates = { begin: req.body.begin, end: req.body.end }
  var invoiceIds = req.body.invoiceId
  if (!Array.isArray(invoiceIds)) invoiceIds = [invoiceIds]
  InvoiceRow.find({ _id: { $in: invoiceIds }}).sort('registrationDate').lean().exec(function(err, rows) {
    var accountIds = _(rows).map(function(i) { return i.account._id.toString() }).uniq().value()
    Account.find({ _id: { $in: accountIds } }).lean().exec(function(err, accounts) {
      var accountMap = _.indexBy(accounts, '_id')

      function accountId(row) { return row.account._id }
      function toNamedTuple(pair) { return { account: accountMap[pair[0]], rows: pair[1] } }
      function accountName(tuple) { return tuple.account.name }

      var data = _(rows).groupBy(accountId).pairs().map(toNamedTuple).sortBy(accountName).value()
      var result = kieku.createClassificationRegistration(dates, data)
      res.setHeader('Content-Disposition', 'attachment; filename=kieku-'+dates.begin+'-'+dates.end+'.xlsx')
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.send(result)
    })
  })
})

app.post('/xml/v1/programs/:token', authenticateXmlApi, function(req, res, next) {
  var now = new Date()
  var account = { _id: req.account._id, name: req.account.name }
  var root = builder.create("ASIAKAS")
  req.resume()
  var xmlDoc = ""
  req.on('data', function(chunk) { xmlDoc += chunk })
  req.on('end', function() {
    var doc = { xml: xmlDoc.toString('utf-8'), date: now, account: account }
    new schema.XmlDoc(doc).save(function(err) {
      if (err) console.error(err)
    })
  })

  xml.readPrograms(req, function(err, programs) {
    if (programs.length == 0) {
      writeError('Yhtään kuvaohjelmaa ei voitu lukea', root)
      return res.send(root.end({ pretty: true, indent: '  ', newline: '\n' }))
    }

    async.eachSeries(programs, handleXmlProgram, function(err) {
      if (err) {
        writeError('Järjestelmävirhe: ' + err, root)
        console.error(err)
      }
      res.set('Content-Type', 'application/xml');
      res.send(err ? 500 : 200, root.end({ pretty: true, indent: '  ', newline: '\n' }))
    })
  })

  function writeError(err, parent) {
    parent.ele('VIRHE', err)
  }

  function handleXmlProgram(data, callback) {
    var program = data.program
    var ele = root.ele('KUVAOHJELMA')
    ele.ele('ASIAKKAANTUNNISTE', program.externalId)

    if (data.errors.length > 0) {
      return writeErrAndReturn(data.errors)
    }

    if (!utils.isValidYear(program.year)) {
      return writeErrAndReturn("Virheellinen vuosi: " + program.year)
    }

    program.customersId = { account: req.account._id, id: program.externalId }
    Program.findOne(utils.flattenObject({ customersId: program.customersId })).exec(function(err, existingProgram) {
      if (err) return callback(err)

      if (existingProgram && !existingProgram.deleted && existingProgram.classifications.length > 0) {
        return writeErrAndReturn("Luokiteltu kuvaohjelma on jo olemassa asiakkaan tunnisteella: " + program.externalId)
      }

      verifyValidAuthor(program, function (err) {
        if (err) return callback(err)
        verifyParentProgram(program, function (err) {
          if (err) return callback(err)
          ele.ele('STATUS', 'OK')
          var p = new Program(program)
          if (existingProgram) {
            existingProgram.series = program.series
            _.each(existingProgram.classifications, function (p) { existingProgram.deletedClassifications.push(p) })
            existingProgram.classifications = program.classifications
            existingProgram.createdBy = program.createdBy
            existingProgram.deleted = false
            p = existingProgram
          }
          p.classifications[0].status = 'registered'
          p.classifications[0].creationDate = now
          p.classifications[0].registrationDate = now
          p.classifications[0].billing = account
          p.classifications[0].buyer = account
          p.classifications[0].isReclassification = false
          Program.updateClassificationSummary(p.classifications[0])
          p.populateAllNames(function (err) {
            if (err) return callback(err)
            p.save(function (err) {
              if (err) return callback(err)
              existingProgram ? logUpdateOperation(req.user, p, { 'classifications': { new: p.classifications } }) : logCreateOperation(req.user, p)
              updateTvSeriesClassification(p, function(err) {
                if (err) return callback(err)
                var seconds = classificationUtils.durationToSeconds(_.first(p.classifications).duration)
                InvoiceRow.fromProgram(p, 'registration', seconds, currentPrices().registrationFee).save(function (err, saved) {
                  if (err) return callback(err)
                  updateActorAndDirectorIndexes(p, callback)
                })
              })
            })
          })
        })
      })
    })

    function verifyValidAuthor(program, callback) {
      var username = program.classifications[0].author.name.toUpperCase()
      var user = _.find(req.account.users, { username: username })
      if (user) {
        User.findOne({ username: username, active: true }, { _id: 1, username: 1, name: 1, role: 1 }).lean().exec(function(err, doc) {
          if (err) return callback(err)
          if (doc) {
            program.classifications[0].author = { _id: doc._id, username: doc.username, name: doc.name }
            program.createdBy = { _id: doc._id, username: doc.username, name: doc.name, role: doc.role }
            return callback()
          } else {
            return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + username)
          }
        })
      } else {
        return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + username)
      }
    }

    function verifyParentProgram(program, callback) {
      if (!enums.util.isTvEpisode(program)) return callback()
      var parentName = program.parentTvSeriesName.trim()
      Program.findOne({ programType: 2, name: parentName, deleted: { $ne: true } }, function(err, parent) {
        if (err) return callback(err)
        if (!parent) {
          var user = _.merge({ ip: req.user.ip }, program.createdBy)
          createParentProgram(program, { name:[parentName] }, user, callback)
        } else {
          program.series = { _id: parent._id, name: parent.name[0] }
          callback()
        }
      })
    }

    function writeErrAndReturn(errors) {
      ele.ele('STATUS', 'VIRHE')
      if (!_.isArray(errors)) errors = [errors]
      errors.forEach(function(msg) { writeError(msg, ele) })
      callback()
    }
  }
})

app.get('/changelogs/:documentId', requireRole('root'), function(req, res, next) {
  ChangeLog.find({ documentId: req.params.documentId }).sort({ date: -1 }).lean().exec(respond(res, next))
})

app.get('/environment', function(req, res) {
  res.set('Content-Type', 'text/javascript')
  res.send('var APP_ENVIRONMENT = "' + app.get('env') + '";')
})

app.post('/files/provider-import', function(req, res, next) {
  if (_.isEmpty(req.files) || !req.files.providerFile) return res.send(400)
  if (req.files.providerFile.truncated) return res.send(400)
  providerImport.import(req.files.providerFile.path, function(err, provider) {
    if (err) return res.send({ error: err })
    var providerData = utils.merge(provider, {message: req.body.message ? req.body.message : undefined})
    new schema.Provider(providerData).save(function(err, saved) {
      res.send({
        message: 'Ilmoitettu tarjoaja sekä ' + provider.locations.length + ' tarjoamispaikkaa.'
      })
    })
  })
})

app.get('/report/:name', requireRole('root'), function(req, res, next) {
  var range = utils.parseDateRange(req.query)
  var reports = require('./reports')
  reports[req.params.name](range, respond(res, next))
})

app.get('/classification/criteria', function (req, res, next) {
  if (!req.user) res.send([])
  else ClassificationCriteria.find({}, respond(res, next))
})

app.post('/classification/criteria/:id', requireRole('root'), function (req, res, next) {
  var id = parseInt(req.params.id)
  ClassificationCriteria.findOneAndUpdate({ id: id }, {
    $set: {id: id, fi: req.body.fi, sv: req.body.sv, date: new Date() }
  }, {upsert: true}, respond(res, next))
})

app.get('/agelimit/:q?', function (req, res, next) {
  var types = _.map(enums.programType, function (t) { return t.type } )
  var filtersByType = _.map(req.query.type ? _.isArray(req.query.type) ? req.query.type : [req.query.type] : [], function (t) { return types.indexOf(t) })
  var queryParams = {
    "q": req.params.q,
    "filters": filtersByType
  }
  var q = constructQuery(queryParams)
  var count = req.query.count ? parseInt(req.query.count) : undefined

  function asCriteria(program) {
    function firstTrimmedFrom(origList) {
      return origList && origList.length > 0 ? origList[0].trim() : undefined
    }
    function trimmedList(origList) {
      return origList && origList.length > 0 ? _.remove(origList.map(function (p) { return p && p.trim().length > 0 ? p.trim() : undefined }), undefined) : undefined
    }
    var classsification = enums.util.isTvSeriesName(program) ? program.episodes : program.classifications[0] || {}
    var agelimit = classsification.agelimit || classsification.legacyAgeLimit || 0
    var countryCode = trimmedList(program.country)
    var durationInSeconds = classificationUtils.durationToSeconds(classsification.duration)
    return {
      id: program.sequenceId,
      type: enums.programType[program.programType].type,
      name: firstTrimmedFrom(program.name),
      nameFi: firstTrimmedFrom(program.nameFi),
      nameSv: firstTrimmedFrom(program.nameSv),
      nameOthers: trimmedList(program.nameOthers),
      series: enums.util.isTvEpisode(program) && program.series && program.series.name ? program.series.name.trim() : undefined,
      season: enums.util.isTvEpisode(program) ? program.season : undefined,
      episode: enums.util.isTvEpisode(program) ? program.episode : undefined,
      country: countryCode ? countryCode.map(function (c) { return { code: c, name: enums.countries[c] } }) : undefined,
      year: isNaN(program.year) ? undefined : parseInt(program.year),
      directors: trimmedList(program.directors),
      productionCompanies: trimmedList(program.productionCompanies),
      duration: classsification.duration,
      durationInSeconds: durationInSeconds > 0 ? durationInSeconds : undefined,
      agelimit: agelimit > 0 ? agelimit : undefined,
      warnings: trimmedList(classsification.warnings)
    }
  }

  Program.find(q, Program.publicFields).limit(100).sort('name').lean().exec(function (err, docs) {
    if (err) return next(err)
    res.send(_.take(docs, count || docs.length).map(asCriteria))
  })
})

if (env.isTest) {
  app.get('/emails/latest', function(req, res) { res.send(_.last(testEnvEmailQueue)) })
}

// Error handler
app.use(function(err, req, res, next) {
  console.error(err.stack || err)
  res.status(err.status || 500)
  res.send({ message: err.message || err })
})

function createParentProgram(program, data, user, callback) {
  var parent = new Program(_.merge({ programType: 2, createdBy: {_id: user._id, username: user.username, name: user.name, role: user.role} }, data))
  parent.populateAllNames(function(err) {
    if (err) return callback(err)
    parent.save(function(err, saved) {
      if (err) return callback(err)
      logCreateOperation(user, parent)
      program.series = { _id: saved._id, name: saved.name[0] }
      callback()
    })
  })
}

var checkExpiredCerts = new CronJob('0 */30 * * * *', function() {
  User.find({ $and: [
    { certificateEndDate: { $lt: new Date() }},
    { active: true},
    {'emails.0': { $exists: true }}
  ]}, function(err, users) {
    if (err) throw err
    users.forEach(function(user) {
      user.update({ active: false }, function(err) {
        if (err) return logError(err)
        logUpdateOperation({ username: 'cron', ip: 'localhost' }, user, { active: { old: user.active, new: false } })
      })
      sendEmail({
        recipients: [ user.emails[0] ],
        subject: 'Luokittelusertifikaattisi on vanhentunut',
        body: '<p>Luokittelusertifikaattisi on vanhentunut ja sisäänkirjautuminen tunnuksellasi on estetty.<br/>' +
          '<p>Lisätietoja voit kysyä KAVI:lta: <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>' +
          '<p>Terveisin,<br/>KAVI</p>'
      }, user, logError)
    })
  })
})

var checkCertsExpiringSoon = new CronJob('0 */30 * * * *', function() {
  User.find({ $and: [
    { certificateEndDate: { $lt: moment().add(6, 'months').toDate(), $gt: new Date() }},
    { active: true},
    {'emails.0': { $exists: true }},
    { $or: [
      { certExpiryReminderSent: { $exists: false }},
      { certExpiryReminderSent: { $lt: moment().subtract(1, 'months').toDate() }}]}
  ]}, function(err, users) {
    if (err) throw err
    users.forEach(function(user) {
      sendEmail({
        recipients: [ user.emails[0] ],
        subject: 'Luokittelusertifikaattisi on vanhentumassa',
        body: '<p>Oikeutesi luokitella kuvaohjelmia päättyy ' + moment(user.certificateEndDate).format('DD.MM.YYYY') +
              '. Jos haluat jatkaa kuvaohjelmien luokittelua tämän jälkeen, ilmoittaudu kuvaohjelmaluokittelijoiden kertauskoulutukseen.<br />' +
              'Lisätietoja: <a href="https://kavi.fi/fi/meku/kuvaohjelmat/luokittelu/kertauskoulutus">https://kavi.fi/fi/meku/kuvaohjelmat/luokittelu/kertauskoulutus</a> tai <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>' +

              '<p>Din rätt att klassificera bildprogram upphör att gälla den ' + moment(user.certificateEndDate).format('DD.MM.YYYY') +
              '. Om du vill fortsätta att klassificera bildprogram därefter, ska du anmäla dig till en repetitionsutbildning för klassificerare av bildprogram.<br />' +
              'Mer information: <a href="https://kavi.fi/sv/enheten-mediefostran-och-bildprogram/repetitionsutbildning">https://kavi.fi/sv/enheten-mediefostran-och-bildprogram/repetitionsutbildning</a> eller <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>'+

              '<p>Terveisin,<br />' +
              'Kansallinen audiovisuaalinen instituutti /<br />' +
              'National Audiovisual Institute, Finland</p>'
      }, user, function(err) {
        if (err) console.error(err)
        else user.update({ certExpiryReminderSent: new Date() }, logError)
      })
    })
  })
})

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

function authenticate(req, res, next) {
  var optionalList = ['GET:/programs/search/', 'POST:/program/excel/export', 'GET:/episodes/', 'GET:/directors/search', 'GET:/agelimit/', 'GET:/classification/criteria']
  var url = req.method + ':' + req.path
  if (url == 'GET:/') return next()
  if (isWhitelisted(req)) return next()
  var isOptional =  _.any(optionalList, function(p) { return url.indexOf(p) == 0 })
  var cookie = req.signedCookies.user
  if (cookie) {
    req.user = cookie
    req.user.ip = getIpAddress(req)
    return next()
  } else if (isOptional) {
    return next()
  } else {
    return res.send(403)
  }
}

function authenticateXmlApi(req, res, next) {
  req.pause()
  Account.findOne({apiToken: req.params.token}).lean().exec(function(err, data) {
    if (data) {
      req.account = data
      req.user = {username: 'xml-api', ip: getIpAddress(req)}
      return next()
    } else {
      res.send(403)
    }
  })
}

function rejectNonHttpMethods(req, res, next) {
  if (['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].indexOf(req.method) === -1) res.send(405)
  else next()
}

function forceSSL(req, res, next) {
  // trust the proxy (Heroku) about X-Forwarded-Proto
  if (env.forceSSL && req.headers['x-forwarded-proto'] !== 'https') {
    if (req.method === 'GET') {
      return res.redirect(301, 'https://' + req.get('host') + req.originalUrl)
    } else {
      return res.send(403, "Please use HTTPS")
    }
  } else {
    return next()
  }
}

function buildRevisionCheck(req, res, next) {
  var entryPoints = ['/', '/public.html', '/index.html', '/register-provider.html', '/reset-password.html', 'classification-criteria/.html']
  if (_.contains(entryPoints, req.path)) {
    res.cookie('build.revision', buildRevision)
  } else if (req.xhr && req.path != '/templates.html') {
    var clientRevision = req.cookies['build.revision']
    if (!clientRevision || clientRevision != buildRevision) {
      return res.send(418)
    }
  }
  next()
}

function setupUrlEncodedBodyParser() {
  var parser = express.urlencoded({ parameterLimit: Infinity, arrayLimit: Infinity })
  return function(req, res, next) {
    return isUrlEncodedBody(req) ? parser(req, res, next) : next()
  }
}

function setupCsrfMiddleware() {
  var csrfMiddleware = csrf({ cookie: { httpOnly: true, secure: env.forceSSL, signed: true } })
  return function(req, res, next) {
    if (isWhitelisted(req)) {
      return next()
    } else {
      return csrfMiddleware(req, res, next)
    }
  }
}

function setCsrfTokenCookie(req, res, next) {
  if (req.csrfToken && req.method === 'GET') {
    var csrf = req.csrfToken()
    res.cookie('_csrf_token', csrf)
  }
  next()
}

function requireRole(role) {
  return function(req, res, next) {
    if (!utils.hasRole(req.user, role)) return res.send(403)
    else return next()
  }
}

function logErrorOrSendEmail(user) {
  return function(err, email) {
    if (err) return console.error(err)
    sendEmail(email, user, logError)
  }
}

function sendEmail(opts, user, callback) {
  var email = new sendgrid.Email({ from: opts.from || 'no-reply@kavi.fi', subject: opts.subject, html: opts.body })
  if (process.env.EMAIL_TO != undefined) {
    email.to = process.env.EMAIL_TO
  } else if (process.env.NODE_ENV === 'training') {
    email.to = user.email || user.emails[0]
  } else {
    opts.recipients.forEach(function(to) { email.addTo(to) })
  }

  if (env.sendEmail || process.env.EMAIL_TO != undefined) {
    sendgrid.send(email, callback)
  } else if (env.isTest) {
    testEnvEmailQueue.push(email)
    return callback()
  } else {
    console.log('email (suppressed) to: ', opts.recipients, email)
    return callback()
  }
}

function updateActorAndDirectorIndexes(program, callback) {
  schema.Actor.updateWithNames(program.actors, function() {
    schema.Director.updateWithNames(program.directors, callback)
  })
}
function updateMetadataIndexes(program, callback) {
  schema.ProductionCompany.updateWithNames(program.productionCompanies, function() {
    updateActorAndDirectorIndexes(program, callback)
  })
}

function queryNameIndex(schemaName) {
  return function(req, res, next) {
    var q = {}
    var parts = toMongoArrayQuery(req.query.q)
    if (parts) q.parts = parts
    schema[schemaName].find(q, { name: 1 }).limit(100).sort('name').lean().exec(function(err, docs) {
      if (err) return next(err)
      res.send(_.pluck(docs || [], 'name'))
    })
  }
}

function toMongoArrayQuery(string) {
  var words = (string || '').trim().toLowerCase()
  return words ? { $all: words.match(/"[^"]*"|[^ ]+/g).map(toTerm) } : undefined

  function toTerm(s) {
    if (/^".+"$/.test(s)) {
      return s.substring(1, s.length - 1)
    } else {
      return new RegExp('^' + utils.escapeRegExp(s))
    }
  }
}

function respond(res, next, overrideData) {
  return function(err, data) {
    if (err) return next(err)
    res.send(overrideData || data)
  }
}

function updateTvSeriesClassificationIfEpisodeRemovedFromSeries(program, previousSeries, callback) {
  if (previousSeries && previousSeries._id && String(previousSeries._id) != String(program.series._id)) {
    Program.updateTvSeriesClassification(previousSeries._id, callback)
  } else {
    callback()
  }
}

function updateInvoicerows(program, callback) {
  InvoiceRow.find({'program': program._id}, function (err, invoiceRows) {
    if (err) return next(err)
    var billing = program.classifications.length > 0 ? program.classifications[0].billing : undefined
    async.forEach(invoiceRows, function(invoiceRow, callback) {
      if (invoiceRow.name !== program.name || (billing && invoiceRow.account.name !== billing.name)) {
        invoiceRow.name = program.name
        if (billing) {
          invoiceRow.account._id = billing._id
          invoiceRow.account.name = billing.name
        }
        invoiceRow.save(callback)
      } else callback()
    },function (err) {
      if (err) return callback(err)
      callback()
    })
  })

}

function updateTvSeriesClassification(program, callback) {
  if (!enums.util.isTvEpisode(program)) return callback()
  var seriesId = program.series && program.series._id
  if (!seriesId) return callback()
  Program.updateTvSeriesClassification(seriesId, callback)
}

function verifyTvSeriesExistsOrCreate(program, user, callback) {
  if (enums.util.isTvEpisode(program) && !!program.series.name && program.series._id == null) {
    var draft = program.series.draft || {}
    var data = {
      name: [draft.name || program.series.name],
      nameFi: draft.nameFi ? [draft.nameFi] : [],
      nameSv: draft.nameSv ? [draft.nameSv] : [],
      nameOther: draft.nameOther ? [draft.nameOther] : []
    }
    createParentProgram(program, data, user, callback)
  } else {
    if (program.series) program.series.draft = {}
    return callback()
  }
}

function getProviderBillingRows(data) {
  var accountRows = []

  data.providers.forEach(function(provider) {
    var account = _.omit(provider, 'locations')
    var rows = _(provider.locations).filter({ isPayer: false }).map(function(l) {
      return _.map(l.providingType, function(p) {
        return utils.merge(l, { providingType: p, price: enums.providingTypePrices[p] * 100 })
      })
    }).flatten().value()
    accountRows.push({ account: account, rows: rows })
  })

  data.locations.forEach(function(location) {
    var rows = _.map(location.providingType, function(p) {
      return utils.merge(location, { providingType: p, price: enums.providingTypePrices[p] * 100 })
    })
    accountRows.push({ account: location, rows: rows })
  })
  return accountRows
}

function logError(err) {
  if (err) console.error(err)
}

function watchChanges(document, user, excludedLogPaths) {
  var oldObject = document.toObject()
  return { applyUpdates: applyUpdates, saveAndLogChanges: saveAndLogChanges, getChanges: getChanges }

  function applyUpdates(updates) {
    var flatUpdates = utils.flattenObject(updates)
    _.forEach(flatUpdates, function(value, key) { document.set(key, value) })
  }

  function saveAndLogChanges(callback) {
    var changedPaths = document.modifiedPaths().filter(isIncludedLogPath)
    document.save(function(err, saved) {
      if (err) return callback(err)
      log(changedPaths, oldObject, saved, callback)
    })
  }

  function getChanges() {
    var changedPaths = document.modifiedPaths().filter(isIncludedLogPath)
    return asChanges(changedPaths, oldObject, document)
  }

  function isIncludedLogPath(p) {
    return document.isDirectModified(p) && document.schema.pathType(p) != 'nested' && !_.contains(excludedLogPaths, p)
  }

  function log(changedPaths, oldObject, updatedDocument, callback) {
    var changes = asChanges(changedPaths, oldObject, updatedDocument)
    logUpdateOperation(user, updatedDocument, changes)
    callback(undefined, updatedDocument)
  }

  function asChanges(changedPaths, oldObject, updatedDocument) {
    var newObject = updatedDocument.toObject()
    return _(changedPaths).map(asChange).zipObject().valueOf()

    function asChange(path) {
      var newValue = utils.getProperty(newObject, path)
      var oldValue = utils.getProperty(oldObject, path)
      if (_.isEqual(newValue, oldValue) || (oldValue == null && newValue === "")) return []
      return [ path.replace(/\./g, ','), { new: newValue, old: oldValue } ]
    }
  }
}

function updateAndLogChanges(document, updates, user, callback) {
  var watcher = watchChanges(document, user)
  watcher.applyUpdates(updates)
  watcher.saveAndLogChanges(callback)
}

function softDeleteAndLog(document, user, callback) {
  document.deleted = true
  document.save(function(err, document) {
    if (err) return callback(err)
    saveChangeLogEntry(user, document, 'delete')
    callback(undefined, document)
  })
}

function saveChangeLogEntry(user, document, operation, operationData) {
  var data = {
    user: { _id: user._id, username: user.username, ip: user.ip },
    date: new Date(),
    operation: operation,
    targetCollection: document ? document.constructor.modelName : undefined,
    documentId: document ? document._id : undefined
  }
  if (operationData) {
    _.merge(data, operationData)
  }
  new ChangeLog(data).save(logError)
}

function logCreateOperation(user, document) {
  saveChangeLogEntry(user, document, 'create')
}

function logUpdateOperation(user, document, updates) {
  saveChangeLogEntry(user, document, 'update', { updates: updates })
}

function getIpAddress(req) {
  var ipAddr = req.headers['x-forwarded-for']
  if (ipAddr){
    var list = ipAddr.split(",")
    ipAddr = list[list.length-1]
  } else {
    ipAddr = req.connection.remoteAddress
  }
  return ipAddr
}

function isUrlEncodedBody(req) {
  var paths = ['POST:/program/excel/export', 'POST:/kieku', 'POST:/providers/billing/kieku', 'POST:/providers/yearlyBilling/kieku']
  return _.contains(paths, req.method + ':' + req.path)
}

function isWhitelisted(req) {
  var whitelist = [
    'GET:/index.html', 'GET:/public.html', 'GET:/templates.html', 'GET:/environment',
    'GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'GET:/xml/schema',
    'POST:/login', 'POST:/logout', 'POST:/xml', 'POST:/forgot-password', 'GET:/reset-password.html',
    'POST:/reset-password', 'GET:/check-reset-hash', 'POST:/files/provider-import',
    'GET:/register-provider.html', 'GET:/KAVI-tarjoajaksi-ilmoittautuminen.xls', 'GET:/KAVI-koulutus-tarjoajaksi-ilmoittautuminen.xls',
    'GET:/upgrade-browser.html', 'GET:/emails/latest'
  ]
  var url = req.method + ':' + req.path
  return _.any(whitelist, function(p) { return url.indexOf(p) == 0 })
}

if (env.isDev) {
  var liveReload = require('express-livereload')
  liveReload(app, { watchDir: path.join(__dirname, '../client') })
}

var server

var start = exports.start = function(callback) {
  mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)
  checkExpiredCerts.start()
  checkCertsExpiringSoon.start()
  server = app.listen(process.env.PORT || env.port, callback)
}

var shutdown = exports.shutdown = function(callback) {
  mongoose.disconnect(function() {
    server.close(function() {
      callback()
    })
  })
}

if (!module.parent) {
  start(function(err) {
    if (err) throw err
    console.log('['+env.name+'] Listening on port ' + server.address().port)
  })
}

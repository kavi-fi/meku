var express = require('express')
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
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var proe = require('../shared/proe')
var classificationUtils = require('../shared/classification-utils')
var xml = require('./xml-import')
var sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
var builder = require('xmlbuilder')
var bcrypt = require('bcrypt')
var CronJob = require('cron').CronJob

express.static.mime.define({ 'text/xml': ['xsd'] })

var app = express()

app.use(express.compress())
app.use(express.json())
app.use(nocache)
app.use(express.cookieParser(process.env.COOKIE_SALT || 'secret'))
app.use(authenticate)
app.use(express.static(path.join(__dirname, '../client')))
app.use('/shared', express.static(path.join(__dirname, '../shared')))

mongoose.connect(process.env.MONGOHQ_URL || 'mongodb://localhost/meku')

app.post('/login', function(req, res, next) {
  var username = req.body.username
  var password = req.body.password
  if (!username || !password) return res.send(403)
  User.findOne({ username: username, password: {$exists: true}, active: true }, function(err, user) {
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
  User.findOne({ username: username, active: true }, function(err, user) {
    if (err) return next(err)
    if (!user) return res.send(403)
    if (_.isEmpty(user.emails)) {
      console.log(user.username + ' has no email address')
      return res.send(500)
    }
    var subject = 'Salasanan uusiminen'
    var text = '<p>Hei,<br/>' +
      'uusiaksesi salasanasi seuraa oheista linkkiä <a href="<%- link %>"><%- link %></a>, ' +
      'ja kirjoita mieleisesi salasana sille annettuihin kenttiin ja paina "tallenna salasana"-painiketta.</p>' +
      '<p>Jos sinulla on ongelmia salasanan tai käyttäjätunnuksen kanssa, ' +
      'ota yhteyttä Kuvaohjelmien luokittelujärjestelmän ylläpitoon: <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>' +
      '<p>Terveisin,<br/>KAVI</p>'

    if (user.resetHash) {
      sendHashLinkViaEmail(user, subject, text, respond(res, next, {}))
    } else {
      createAndSaveHash(user, function(err) {
        if (err) return next(err)
        sendHashLinkViaEmail(user, subject, text, respond(res, next, {}))
      })
    }
  })
})

function sendHashLinkViaEmail(user, subject, text, callback) {
  var url = getHostname() + '/reset-password.html#' + user.resetHash
  var emailData = {
    recipients: user.emails,
    subject: subject,
    body: _.template(text, { link: url }),
    sendInTraining: true
  }
  sendEmail(emailData, callback)
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

app.get('/programs/search/:q?', function(req, res, next) {
  if (req.user) {
    var fields = utils.hasRole(req.user, 'kavi') ? null : { 'classifications.comments': 0 }
    search({}, fields, req, res, next)
  } else {
    search({ $or: [{ 'classifications.0': { $exists: true } }, { programType:2 }] }, Program.publicFields, req, res, next)
  }
})

function search(extraQueryTerms, responseFields, req, res, next) {
  var page = req.query.page || 0
  var filters = req.query.filters || []
  Program.find(query(extraQueryTerms), responseFields).skip(page * 100).limit(100).sort('name').lean().exec(respond(res, next))

  function query(extraQueryTerms) {
    var ObjectId = mongoose.Types.ObjectId
    var terms = req.params.q
    var q = _.merge({ deleted: { $ne:true } }, extraQueryTerms)
    var and = []
    if (utils.getProperty(req, 'user.role') === 'trainee') and.push({$or: [{'createdBy.role': {$ne: 'trainee'}}, {'createdBy._id': ObjectId(req.user._id)}]})
    var nameQuery = toMongoArrayQuery(terms)
    if (nameQuery) {
      if (nameQuery.$all.length == 1 && parseInt(terms) == terms) {
        and.push({$or: [{ allNames:nameQuery }, { sequenceId: terms }]})
      } else {
        and.push({allNames: nameQuery})
      }
    }
    if (filters.length > 0) q.programType = { $in: filters }
    if (and.length > 0) q.$and = and
    return q
  }
}

app.get('/episodes/:seriesId', function(req, res, next) {
  Program.find({ deleted: { $ne:true }, 'series._id': req.params.seriesId }).sort({ season:1, episode:1 }).lean().exec(respond(res, next))
})

app.get('/programs/drafts', function(req, res, next) {
  Program.find({ draftsBy: req.user._id }, { name:1, draftClassifications:1 }).lean().exec(function(err, programs) {
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
        return Program.findById(p._id, callback)
      }, respond(res, next))
    })
})

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
  p.newDraftClassification(req.user)
  p.save(function(err, program) {
    if (err) return next(err)
    logCreateOperation(req.user, program)
    res.send(program)
  })
})

app.post('/programs/:id/register', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)

    var newClassification = program.draftClassifications[req.user._id]
    if (!newClassification) return res.send(409)

    newClassification.registrationDate = new Date()
    newClassification.status = 'registered'
    newClassification.author = { _id: req.user._id, name: req.user.name, username: req.user.username }

    program.draftClassifications = {}
    program.draftsBy = []
    program.classifications.unshift(newClassification)
    program.markModified('draftClassifications')

    populateSentRegistrationEmailAddresses(newClassification, program, function(err, program) {
      if (err) return next(err)
      verifyTvSeriesExistsOrCreate(program, req.user, function(err) {
        if (err) return next(err)
        program.save(function(err) {
          if (err) return next(err)
          updateTvSeriesClassification(program, function(err) {
            if (err) return next(err)
            addInvoicerows(newClassification, function(err) {
              if (err) return next(err)
              sendEmail(classificationUtils.registrationEmail(program, newClassification, req.user, getHostname()), function(err) {
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

    function populateSentRegistrationEmailAddresses(classification, program, callback) {
      if (classification.buyer) {
        Account.findById(classification.buyer._id, 'emailAddresses', function(err, buyer) { 
          if (err) return callback(err)
          populate(buyer.emailAddresses, callback)
        })
      } else {
        populate([], callback)
      }

      function populate(buyerEmails, callback) {
        var classifier = req.user.email
        var manual = classification.registrationEmailAddresses
        var newEmails = _.uniq(program.sentRegistrationEmailAddresses
          .concat(manual)
          .concat(buyerEmails)
          .concat([classifier]))
        program.sentRegistrationEmailAddresses = newEmails
        callback(null, program)
      }
    }

    function addInvoicerows(currentClassification, callback) {
      var seconds = durationToSeconds(currentClassification.duration)

      if (classificationUtils.isReclassification(program, currentClassification)) {
        if (enums.isOikaisupyynto(currentClassification.reason) && enums.authorOrganizationIsKavi(currentClassification)) {
          InvoiceRow.fromProgram(program, 'reclassification', seconds, 74 * 100).save(callback)
        } else if (!utils.hasRole(req.user, 'kavi')) {
          InvoiceRow.fromProgram(program, 'registration', seconds, 725).save(callback)
        } else {
          callback()
        }
      } else {
        InvoiceRow.fromProgram(program, 'registration', seconds, 725).save(function(err, saved) {
          if (err) return next(err)
          if (utils.hasRole(req.user, 'kavi')) {
            // duraation mukaan laskutus
            var classificationPrice = classificationUtils.price(program, seconds)
            InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback)
          } else {
            callback()
          }
        })
      }
    }
  })
})

app.post('/programs/:id/reclassification', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) next(err)
    if (!classificationUtils.canReclassify(program, req.user)) return res.send(400)
    program.newDraftClassification(req.user)
    program.save(respond(res, next))
  })
})

app.post('/programs/:id/categorization', requireRole('kavi'), function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)
    var watcher = watchChanges(program, req.user, Program.excludedChangeLogPaths)
    var updates = _.pick(req.body, ['programType', 'series', 'episode', 'season'])
    watcher.applyUpdates(updates)
    verifyTvSeriesExistsOrCreate(program, req.user, function(err) {
      if (err) return next(err)
      program.populateAllNames(function(err) {
        if (err) return next(err)
        watcher.saveAndLogChanges(function(err, program) {
          if (err) return next(err)
          updateTvSeriesClassification(program, function(err) {
            if (err) return next(err)
            res.send(program)
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
    watcher.applyUpdates(req.body)
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
                if (oldSeries && oldSeries._id && String(oldSeries._id) != String(program.series._id)) {
                  Program.updateTvSeriesClassification(oldSeries._id, respond(res, next, program))
                } else {
                  res.send(program)
                }
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
    var programFields = ['name.0', 'nameFi.0', 'nameSv.0', 'nameOther.0', 'country', 'year', 'productionCompanies', 'genre', 'legacyGenre', 'directors', 'actors', 'synopsis', 'gameFormat', 'season', 'episode', 'series*']
    var classificationFields = ['buyer', 'billing', 'format', 'duration', 'safe', 'criteria', 'warningOrder', 'registrationEmailAddresses', 'comments', 'criteriaComments*']
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
      updateTvSeriesClassification(program, respond(res, next, program))
    })
  })
})

app.get('/series/search', function(req, res, next) {
  var q = { programType: 2 }
  var parts = toMongoArrayQuery(req.query.q)
  if (parts) q.allNames = parts
  Program.find(q, { name: 1 }).lean().limit(20).sort('name').exec(function(err, data) {
    if (err) return next(err)
    res.send(_.map(data, function(d) { return { _id: d._id, name: d.name[0] } }))
  })
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
  User.find(filters).lean().exec(respond(res, next))
})

app.get('/users/search', requireRole('kavi'), function(req, res, next) {
  var regexp = new RegExp("^" + utils.escapeRegExp(req.query.q), 'i')
  var q = { $or:[{ name: regexp }, { username: regexp }] }
  User.find(q).sort('name').lean().exec(respond(res, next))
})

app.delete('/users/:id', requireRole('root'), function(req, res, next) {
  User.findByIdAndRemove(req.params.id, respond(res, next))
})

app.get('/users/exists/:username', requireRole('root'), function(req, res, next) {
  User.findOne({ username: req.params.username }, { _id:1 }).lean().exec(function(err, user) {
    if (err) return next(err)
    res.send({ exists: !!user })
  })
})

app.post('/users/new', requireRole('root'), function(req, res, next) {
  var hasRequiredFields = (req.body.username != '' && req.body.emails[0].length > 0 && req.body.name != '')
  if (!hasRequiredFields || !utils.isValidUsername(req.body.username)) return res.send(400)
  new User(req.body).save(function(err, user) {
    if (err) return next(err)
    createAndSaveHash(user, function(err) {
      if (err) return next(err)
      logCreateOperation(req.user, user)
      var subject = 'Käyttäjätunnuksen aktivointi'
      var text = '<p>Hei,<br/>' +
        'Olet saanut käyttäjätunnuksen Kuvaohjelmien luokittelu- ja rekisteröintijärjestelmään.</p>' +
        '<p>Aktivoi käyttäjätunnus oheisesta linkistä <a href="<%- link %>"><%- link %></a>, ' +
        'ja kirjoita mieleisesi salasana sille annettuihin kenttiin.<br/>' +
        'Salasanan tallentamisen jälkeen kirjaudut automaattisesti sisään järjestelmään.</p>' +
        '<p>Jos unohdat salasanasi, voit uusia sen sisäänkirjautumisikkunan kautta:<br/>' +
        'Anna käyttäjätunnus ja paina "unohdin salasanani" -painiketta.</p>' +
        '<p>Jos sinulla on ongelmia salasanan tai käyttäjätunnuksen kanssa, ' +
        'ota yhteyttä Kuvaohjelmien luokittelujärjestelmän ylläpitoon: <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>' +
        '<p>Terveisin,<br/>KAVI</p>'
      sendHashLinkViaEmail(user, subject, text, respond(res, next, user))
    })
  })
})

app.post('/users/:id', requireRole('root'), function(req, res, next) {
  User.findById(req.params.id, function (err, user) {
    updateAndLogChanges(user, req.body, req.user, respond(res, next))
  })
})

app.get('/users/names/:names', requireRole('kavi'), function(req, res, next) {
  User.find({username: {$in: req.params.names.split(',')}}, 'name username').lean().exec(function(err, names) {
    if (err) return next(err)
    var usernamesAsKeys = _.reduce(names, function(acc, user) {
      return _.merge(acc, utils.keyValue(user.username, user.name))
    }, {})
    res.send(usernamesAsKeys)
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

app.post('/proe', requireRole('kavi'), express.urlencoded(), function(req, res, next) {
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
      var result = proe(dates, data)
      res.setHeader('Content-Disposition', 'attachment; filename=proe-'+dates.begin+'-'+dates.end+'.txt')
      res.setHeader('Content-Type', 'text/plain')
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
    Program.findOne({ customersId: program.customersId }, { _id: 1 }).lean().exec(function(err, duplicate) {
      if (err) return callback(err)

      if (duplicate) {
        return writeErrAndReturn("Kuvaohjelma on jo olemassa asiakkaan tunnisteella: " + program.externalId)
      }

      verifyValidAuthor(program, function (err) {
        if (err) return callback(err)
        verifyParentProgram(program, function (err) {
          if (err) return callback(err)
          ele.ele('STATUS', 'OK')
          var p = new Program(program)
          p.classifications[0].status = 'registered'
          p.classifications[0].creationDate = now
          p.classifications[0].registrationDate = now
          p.classifications[0].billing = account
          p.classifications[0].buyer = account
          p.populateAllNames(function (err) {
            if (err) return callback(err)
            p.save(function (err) {
              if (err) return callback(err)
              logCreateOperation(req.user, p)
              updateTvSeriesClassification(p, function(err) {
                if (err) return callback(err)
                var seconds = durationToSeconds(_.first(p.classifications).duration)
                InvoiceRow.fromProgram(p, 'registration', seconds, 725).save(function (err, saved) {
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
      var username = program.classifications[0].author.name
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
      Program.findOne({ programType: 2, name: parentName }, function(err, parent) {
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

app.get('/environment', function(req, res, next) {
  res.json({ environment: app.get('env') })
})

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

if (isDev()) {
  var liveReload = require('express-livereload')
  liveReload(app, { watchDir: path.join(__dirname, '../client') })
}

var server = app.listen(process.env.PORT || 3000, function() {
  console.log('Listening on port ' + server.address().port)
})

var checkExpiredCerts = new CronJob('0 0 0 * * *', function() {
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
      }, logError)
    })
  })
})
checkExpiredCerts.start()

var checkCertsExpiringSoon = new CronJob('0 0 1 * * *', function() {
  User.find({ $and: [
    { certificateEndDate: { $lt: moment().add(3, 'months').toDate(), $gt: new Date() }},
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
        body: '<p>Luokittelusertifikaattisi on vanhentumassa ' + moment(user.certificateEndDate).format('DD.MM.YYYY') +
          '. Uusithan sertifikaattisi, jotta tunnustasi ei suljeta.</p>' +
          '<p>Lisätietoja voit kysyä KAVI:lta: <a href="mailto:meku@kavi.fi">meku@kavi.fi</a></p>' +
          '<p>Terveisin,<br/>KAVI</p>'
      }, function(err) {
        if (err) console.error(err)
        else user.update({ certExpiryReminderSent: new Date() }, logError)
      })
    })
  })
})
checkCertsExpiringSoon.start()

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

function authenticate(req, res, next) {
  var whitelist = [
    'GET:/index.html', 'GET:/public.html', 'GET:/templates.html',
    'GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'GET:/xml/schema',
    'POST:/login', 'POST:/logout', 'POST:/xml', 'POST:/forgot-password', 'GET:/reset-password.html',
    'POST:/reset-password', 'GET:/check-reset-hash'
  ]
  var optionalList = ['GET:/programs/search/', 'GET:/episodes/']

  var url = req.method + ':' + req.path
  if (url == 'GET:/') return next()
  var isWhitelistedPath = _.any(whitelist, function(p) { return url.indexOf(p) == 0 })
  if (isWhitelistedPath) return next()
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

function requireRole(role) {
  return function(req, res, next) {
    if (!utils.hasRole(req.user, role)) return res.send(403)
    else return next()
  }
}

function sendEmail(opts, callback) {
  var email = new sendgrid.Email({ from: 'no-reply@kavi.fi', subject: opts.subject, html: opts.body })
  opts.recipients.forEach(function(to) { email.addTo(to) })

  if (process.env.NODE_ENV === 'production' || (process.env.NODE_ENV === 'training' && opts.sendInTraining)) {
    sendgrid.send(email, callback)
  } else {
    console.log('email (suppressed): ', email)
    return callback()
  }
}

function isDev() {
  return process.env.NODE_ENV == undefined || process.env.NODE_ENV == 'development'
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

function durationToSeconds(duration) {
  if (!duration) return 0
  var parts = /(?:(\d+)?:)?(\d+):(\d+)$/.exec(duration)
    .slice(1).map(function (x) { return x === undefined ? 0 : parseInt(x) })
  return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2]
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
  return words ? { $all: words.split(/\s+/).map(toTerm) } : undefined

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

function logError(err) {
  if (err) console.error(err)
}

function watchChanges(document, user, excludedLogPaths) {
  var oldObject = document.toObject()
  return { applyUpdates: applyUpdates, saveAndLogChanges: saveAndLogChanges }

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

  function isIncludedLogPath(p) {
    return document.isDirectModified(p) && document.schema.pathType(p) != 'nested' && !_.contains(excludedLogPaths, p)
  }

  function log(changedPaths, oldObject, updatedDocument, callback) {
    var newObject = updatedDocument.toObject()
    var changes = _(changedPaths).map(asChange).zipObject().valueOf()
    logUpdateOperation(user, updatedDocument, changes)
    callback(undefined, updatedDocument)

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

function getHostname() {
  if (isDev()) return 'http://localhost:3000'
  else if (process.env.NODE_ENV === 'training') return 'https://meku-training.herokuapp.com'
  else return 'https://meku.herokuapp.com'
}

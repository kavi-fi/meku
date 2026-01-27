const express = require('express')
const fs = require('fs')
const _ = require('lodash')
const async = require('async')
const path = require('path')
const moment = require('moment')
const mongoose = require('mongoose')
const schema = require('./schema')
const Program = schema.Program
const User = schema.User
const Account = schema.Account
const InvoiceRow = schema.InvoiceRow
const ChangeLog = schema.ChangeLog
const Provider = schema.Provider
const ProviderMetadata = schema.ProviderMetadata
const ClassificationCriteria = schema.ClassificationCriteria
const enums = require('../shared/enums')
const utils = require('../shared/utils')
const kieku = require('./kieku')
const excelExport = require('./excel-export')
const classificationUtils = require('../shared/classification-utils')
const xml = require('./xml-import')
const sendgrid = require('@sendgrid/mail')
const builder = require('xmlbuilder')
const bcrypt = require('bcryptjs')
const CronJob = require('cron').CronJob
const providerUtils = require('./provider-utils')
const upload = require('multer')({dest: '/tmp/', limits: {fileSize: 5000000, files: 1}})
const providerImport = require('./provider-import')
const csrf = require('csurf')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const compression = require('compression')
const buildRevision = fs.readFileSync(path.join(__dirname, '/../build.revision'), 'utf-8')
const validation = require('./validation')
const srvUtils = require('./server-utils')
const env = require('./env').get()
const testEnvEmailQueue = []

sendgrid.setApiKey(process.env.SENDGRID_APIKEY)
express.static.mime.define({'text/xml': ['xsd']})

const app = express()

app.use(rejectNonHttpMethods)
app.use(nocache)
app.use(forceSSL)
app.use(compression())
app.use(bodyParser.json({limit: '10mb'}))
app.use(setupUrlEncodedBodyParser())
app.use(cookieParser(process.env.COOKIE_SALT || 'secret'))
app.use(buildRevisionCheck)
app.use(setupCsrfMiddleware())
app.use(setCsrfTokenCookie)
app.use(authenticate)
app.set('view engine', 'ejs');

app.get('/public.html', (req, res) => res.render('../client/public', {
  searchHelpPageUrl: process.env.SEARCH_HELP_PAGE_URL || 'https://kuvi.fi',
  disclaimerPageUrl: process.env.DISCLAIMER_PAGE_URL || 'https://kuvi.fi',
  lang: req.cookies.lang
}))

app.use(express.static(path.join(__dirname, '../client')))
app.use('/shared', express.static(path.join(__dirname, '../shared')))

app.post('/login', (req, res, next) => {
  const username = req.body.username
  const password = req.body.password
  if (!username || !password) return res.sendStatus(403)
  User.findOne({username: username.toUpperCase(), password: {$exists: true}, active: true}, (err, user) => {
    if (err) return next(err)
    if (!user) return res.sendStatus(403)
    if (user.certificateEndDate && moment(user.certificateEndDate).isBefore(moment())) {
      user.updateOne({active: false}, respond(res, next, 403))
    } else {
      user.checkPassword(password, (checkErr, ok) => {
        if (checkErr) return next(checkErr)
        if (!ok) return res.sendStatus(403)
        logUserIn(req, res, user)
        res.send({})
      })
    }
  })
})

function logUserIn (req, res, user) {
  const weekInMs = 604800000
  res.cookie('user', {
    _id: user._id.toString(),
    username: user.username,
    name: user.name,
    role: user.role,
    email: _.first(user.emails),
    employerName: utils.getProperty(user, 'employers.0.name')
  }, {maxAge: weekInMs, signed: true})
  saveChangeLogEntry(_.merge(user, {ip: getIpAddress(req)}), null, 'login')
}

app.post('/logout', (req, res) => {
  res.clearCookie('user')
  res.send({})
})

app.post('/forgot-password', (req, res, next) => {
  const username = req.body.username
  if (!username) return res.sendStatus(403)
  User.findOne({username: username.toUpperCase(), active: true}, (err, user) => {
    if (err) return next(err)
    if (!user) return res.sendStatus(403)
    if (_.isEmpty(user.emails)) {
      console.log(user.username + ' has no email address')
      return res.sendStatus(500)
    }
    const subject = 'Salasanan uusiminen / Förnya lösenordet'
    srvUtils.getTemplate('reset-password-email.tpl.html', (templErr, tpl) => {
      if (templErr) return next(templErr)
      if (user.resetHash) {
        sendHashLinkViaEmail(user, subject, tpl, respond(res, next, {}))
      } else {
        createAndSaveHash(user, (hashErr) => {
          if (hashErr) return next(hashErr)
          sendHashLinkViaEmail(user, subject, tpl, respond(res, next, {}))
        })
      }
    })
  })
})

function sendHashLinkViaEmail (user, subject, template, callback) {
  const url = env.hostname + '/reset-password.html#' + user.resetHash
  const emailData = {
    recipients: user.emails,
    subject: subject,
    body: _.template(template)({link: url, username: user.username})
  }
  sendEmail(emailData, user, callback)
}

function createAndSaveHash (user, callback) {
  bcrypt.genSalt(1, (saltErr, s) => {
    if (saltErr) return callback(saltErr)
    user.resetHash = Buffer.from(s, 'base64').toString('hex')
    user.save(callback)
  })
}

app.get('/check-reset-hash/:hash', (req, res, next) => {
  User.findOne({resetHash: req.params.hash, active: true}).lean().exec((err, user) => {
    if (err) return next(err)
    if (!user) return res.sendStatus(403)
    if (user.password) return res.send({name: user.name})
    res.send({newUser: true, name: user.name})
  })
})

app.post('/reset-password', (req, res, next) => {
  const resetHash = req.body.resetHash
  if (resetHash) {
    User.findOne({resetHash: resetHash, active: true}, (err, userToResetPassword) => {
      if (err) return next(err)
      if (!userToResetPassword) return res.sendStatus(403)
      userToResetPassword.password = req.body.password
      userToResetPassword.resetHash = null
      userToResetPassword.save((saveErr, user) => {
        if (saveErr) return next(saveErr)
        logUserIn(req, res, user)
        res.send({})
      })
    })
  } else {
    return res.sendStatus(403)
  }
})

app.get('/fixedKaviRecipients', (req, res) => {
  res.send(schema.fixedKaviRecipients())
})

function programFields (req, isUser, isKavi) {
  const fields = isKavi ? null : {'classifications.comments': 0}
  return isUser ? fields : Program.publicFields
}

function searchQueryParams (req, data) {
  const isUser = !!req.user
  const isKavi = utils.hasRole(req.user, 'kavi')
  return {
    page: parseInt(data.page),
    isUser: isUser,
    isKavi: isKavi,
    fields: programFields(req, isUser, isKavi),
    user: req.user,
    q: data.q,
    searchFromSynopsis: data.searchFromSynopsis === 'true',
    agelimits: data.agelimits,
    warnings: data.warnings,
    filters: data.filters,
    registrationDateRange: data.registrationDateRange,
    userRole: utils.getProperty(req, 'user.role'),
    classifier: data.classifier,
    reclassified: data.reclassified === 'true',
    reclassifiedBy: data.reclassifiedBy,
    ownClassificationsOnly: data.ownClassificationsOnly === 'true',
    showDeleted: isUser ? data.showDeleted === 'true' : false,
    showCount: data.showCount === 'true',
    sorted: data.sorted === 'true',
    buyer: data.buyer,
    directors: data.directors,
    sortBy: data.sortBy,
    sortOrder: data.sortOrder
  }
}

function processQuery (req, res, next, data, filename) {
  const queryParams = searchQueryParams(req, data)
  const query = constructQuery(queryParams)
  const sortByRegistrationDate = !!queryParams.registrationDateRange || !!queryParams.classifier || queryParams.agelimits || queryParams.warnings || queryParams.reclassified || queryParams.ownClassificationsOnly
  const sortOrder = queryParams.sortOrder === 'ascending' ? '' : '-'
  const sortedColumn = resolveColumnSort(queryParams.sortBy, sortOrder)
  const sortBy = sortedColumn ? `${sortOrder}${sortedColumn}` : queryParams.sorted ? sortByRegistrationDate ? '-classifications.0.registrationDate' : 'name' : ''
  sendOrExport(query, queryParams, sortBy, filename, req.cookies.lang || 'fi', res, next)
}

function resolveColumnSort (fieldName) {
  const fieldMapping = {
    col_name: 'name',
    col_duration: 'classifications.0.duration',
    col_type: 'programType',
    col_agelimit: 'agelimitForSorting'
  }
  return _.get(fieldMapping, fieldName, undefined)
}

app.post('/program/excel/export', (req, res, next) => {
  processQuery(req, res, next, JSON.parse(req.body.post_data), 'kuvi_luokittelut' + (req.body.csv === "1" ? '.csv' : '.xlsx'))
})

app.get('/programs/search/:q?', (req, res, next) => {
  processQuery(req, res, next, _.extend(req.query, {q: req.params.q}))
})

function sendOrExport (query, queryData, sortBy, filename, lang, res, next) {
  const showClassificationAuthor = utils.hasRole(queryData.user, 'root')

  if (filename) {
    Program.find(query, queryData.fields).limit(5000).sort(sortBy).lean().exec((err, docs) => {
      if (err) return next(err)
      const ext = filename.substring(filename.lastIndexOf('.'))
      const contentType = ext === '.csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const result = excelExport.constructProgramExportData(docs, showClassificationAuthor, ext, lang)
      res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
      res.setHeader('Content-Type', contentType)
      res.send(result)
    })
  } else {
    Program.find(query, queryData.fields).skip(queryData.page * 500).limit(500).sort(sortBy).lean().exec((err, docs) => {
      if (err) return next(err)

      replaceFearToAnxiety(docs)
      if (!queryData.isKavi) docs.forEach((doc) => removeOtherUsersComments(doc.classifications, queryData.user))

      if (queryData.page === 0 && queryData.showCount) {
        Program.countDocuments(query, (countErr, count) => res.send({count: count, programs: docs, err: countErr}))
      } else {
        res.send({programs: docs})
      }
    })
  }
}

function fearToAnxiety (w) {
  return w.replace(/^fear$/, 'anxiety')
}

function replaceFearToAnxiety (docs) {
  docs.forEach((doc) => {
    const classifications = enums.util.isTvSeriesName(doc) ? [doc.episodes] : doc.classifications
    classifications.forEach((classification) => {
      classification.warnings = classification.warnings ? classification.warnings.map(fearToAnxiety) : undefined
      classification.warningOrder = classification.warningOrder ? classification.warningOrder.map(fearToAnxiety) : undefined
    })
  })
}

function constructReclassifiedByQuery (reclassified, reclassifiedBy) {
  let reclassifiedByQuery = {}
  if (reclassified) {
    reclassifiedByQuery = {$and: []}
    reclassifiedByQuery.$and.push({"classifications.isReclassification": {$eq: true}}) // At least one reclassification in the classifications list

    if (reclassifiedBy === 2) reclassifiedByQuery.$and.push({"classifications.authorOrganization": {$exists: true}})
    if (reclassifiedBy === 3) reclassifiedByQuery.$and.push({"classifications.authorOrganization": {$exists: false}})
  }
  return reclassifiedByQuery
}

function constructQuery (queryData) {
  const mainQuery = {$and: []}

  mainQuery.$and.push(constructClassificationsExistQuery(queryData.user))
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
  mainQuery.$and.push(constructProductionYearQuery(queryData.year))

  if (queryData.isUser) mainQuery.$and.push(constructOwnClassifications(queryData.ownClassificationsOnly, queryData.user._id))
  mainQuery.$and.push(constructDeletedQuery(queryData.showDeleted))

  mainQuery.$and = _.filter(mainQuery.$and, (andItem) => !_.isEmpty(andItem))

  return mainQuery
}

function constructClassificationsExistQuery (user) {
  return user ? {} : {$or: [{$and: [{episodes: {$exists: true}}, {'episodes.count': {$gt: 0}}]}, {$and: [{classifications: {$exists: true}}, {'classifications.0': {$exists: true}}]}]}
}

function constructDeletedQuery (showDeleted) {
  if (showDeleted) return {deleted: true}
  return {deleted: {$ne: true}}
}

function constructBuyerQuery (buyer) {
  if (buyer) return {'classifications': {$elemMatch: {'buyer._id': buyer}}}
  return {}
}

function constructProductionYearQuery (year) {
  return year ? {year: year} : {}
}

function constructOwnClassifications (ownClassifications, userid) {
  if (ownClassifications) return {classifications: {$elemMatch: {'author._id': userid}}}
  return {}
}

function constructProgramTypeFilter (filters) {
  if (filters && filters.length > 0) return {"programType": {$in: filters}}
  return {}
}

function toSearchTermQuery (string, primaryField, secondaryField, fromBeginning, ignoreCase) {
  const searchString = (string || '').trim().toLowerCase()
  const parts = searchString.match(/"[^"]*"|[^ ]+/g)
  if (!parts) return undefined
  return parts.reduce((result, s) => {
    if ((/^".+"$/).test(s)) {
      const withoutQuotes = s.substring(1, s.length - 1)
      if (s.indexOf(' ') === -1) return addToAll(result, primaryField, withoutQuotes)
      return addToAll(result, primaryField, new RegExp(utils.escapeRegExp(withoutQuotes), ignoreCase ? 'i' : ''))
    }
    return addToAll(result, secondaryField, new RegExp((fromBeginning ? '^' : '') + utils.escapeRegExp(s), ignoreCase ? 'i' : ''))
  }, {})

  function addToAll (obj, key, value) {
    if (!obj[key]) obj[key] = {$all: []}
    obj[key].$all.push(value)
    return obj
  }
}

function agelimitQuery (agelimits) {
  if (agelimits && !_.isEmpty(agelimits)) {
    const agelimitsIn = {$in: agelimits.map((s) => parseInt(s))}
    return {$or: [{'classifications.0.agelimit': agelimitsIn}, {'episodes.agelimit': agelimitsIn}]}
  }
  return {}
}

function warningsQuery (w) {
  if (w && !_.isEmpty(w)) {
    const warnings = {$all: w}
    return {$or: [{'classifications.0.warnings': warnings}, {'episodes.warnings': warnings}]}
  }
  return {}
}

function constructClassifierQuery (classifier) {
  if (classifier) return {"classifications.author._id": classifier}
  return {}
}

function constructDirectorFilter (directors) {
  if (directors && directors.length > 0) {
    return {directors: {$in: directors.split(',')}}
  }
  return {}
}

function constructDateRangeQuery (registrationDateRange) {
  if (registrationDateRange) {
    const range = utils.parseDateRange(registrationDateRange)
    const registrationDate = {}
    if (range.begin) registrationDate.$gte = range.begin.toDate()
    if (range.end) registrationDate.$lt = range.end.toDate()
    return {classifications: {$elemMatch: {registrationDate: registrationDate}}}
  }
  return {}
}

function constructNameQueries (terms, useSynopsis) {
  const nameQueries = toSearchTermQuery(terms, 'fullNames', 'allNames', true, false)
  const finalQuery = terms && terms.match(/^\s*\d+\s*$/) !== null ? {$or: [nameQueries, {sequenceId: parseInt(terms)}]} : nameQueries
  if (useSynopsis) {
    const synopsisQueries = toSearchTermQuery(terms, 'synopsis', 'synopsis', false, true)
    if (synopsisQueries) return {$or: [finalQuery, synopsisQueries]}
  }
  return finalQuery
}

function getQueryUserRoleDependencies (userid, role) {
  const objectId = mongoose.Types.ObjectId
  if (role === 'trainee') return {$or: [{'createdBy.role': {$ne: 'trainee'}}, {'createdBy._id': objectId(userid)}]}
  if (role === 'user') return {'createdBy.role': {$ne: 'trainee'}}
  return {}
}

app.get('/episodes/:seriesId', (req, res, next) => {
  const query = {deleted: {$ne: true}, 'series._id': req.params.seriesId}
  if (!req.user) query.classifications = {$exists: true, $nin: [[]]}
  Program.find(query, programFields(req, !!req.user, utils.hasRole(req.user, 'kavi'))).sort({season: 1, episode: 1}).lean().exec((err, docs) => {
    if (err) return next(err)
    docs.forEach((doc) => { removeOtherUsersComments(doc.classifications, req.user) })
    res.send(docs)
  })
})

app.get('/programs/drafts', (req, res, next) => {
  if (!req.user) return res.sendStatus(403)
  Program.find({draftsBy: req.user._id, deleted: {$ne: true}}, {name: 1, draftClassifications: 1}).lean().exec((err, programs) => {
    if (err) return next(err)
    res.send(programs.map((p) => ({_id: p._id, name: p.name, creationDate: p.draftClassifications[req.user._id].creationDate})))
  })
})

app.get('/programs/recent', (req, res, next) => {
  if (!req.user) return res.sendStatus(403)
  const objectId = mongoose.Types.ObjectId
  Program.find({"classifications.author._id": objectId(req.user._id), deleted: {$ne: true}}).sort('-classifications.registrationDate').limit(1).lean().exec((err, program) => {
    if (err) next(err)
    else {
      removeOtherUsersComments(program.classifications, req.user)
      res.send(program)
    }
  })
})

function removeOtherUsersComments (classifications, user) {
  if (classifications) return classifications.forEach((c) => {
    if (!utils.hasRole(user, 'kavi')) {
      c.comments = ''
      if (!user || !c.author || user.username !== c.author.username) {
        c.userComments = ''
      }
    }
  })
}

app.delete('/programs/drafts/:id', (req, res, next) => {
  const pull = {draftsBy: req.user._id}
  const unset = utils.keyValue('draftClassifications.' + req.user._id, "")
  Program.findByIdAndUpdate(req.params.id, {$pull: pull, $unset: unset}, (err, p) => {
    if (err) return next(err)
    if (p.classifications.length === 0 && p.draftsBy.length === 0) {
      softDeleteAndLog(p, req.user, respond(res, next))
    } else {
      res.send(p)
    }
  })
})

app.get('/programs/:id', (req, res, next) => {
  Program.findById(req.params.id, programFields(req, !!req.user, utils.hasRole(req.user, 'kavi'))).lean().exec(respond(res, next))
})

app.post('/programs/new', (req, res, next) => {
  const programType = parseInt(req.body.programType)
  if (!enums.util.isDefinedProgramType(programType)) return res.sendStatus(400)
  const p = new Program({programType: programType, sentRegistrationEmails: [], createdBy: {_id: req.user._id, username: req.user.username, name: req.user.name, role: req.user.role}})
  const draftClassification = p.newDraftClassification(req.user)
  const origProgram = req.body.origProgram
  if (origProgram) {
    const seriesFieldsToCopy = ['series']
    const fieldsToCopy = ['country', 'year', 'productionCompanies', 'genre', 'directors', 'actors']
    _.forEach(fieldsToCopy, (field) => { p[field] = origProgram[field] })
    if (enums.util.isTvEpisode(p)) _.forEach(seriesFieldsToCopy, (field) => { p[field] = origProgram[field] })
    if (origProgram.classifications.length > 0) {
      draftClassification.buyer = undefined
      draftClassification.billing = undefined
      draftClassification.format = origProgram.classifications[0].format
    }
    if (enums.util.isTrailer(origProgram)) {
      p.synopsis = origProgram.synopsis

    }
  }
  p.save((err, program) => {
    if (err) return next(err)
    logCreateOperation(req.user, program)
    res.send(program)
  })
})

app.post('/programs/:id/register', (req, res, next) => {
  Program.findById(req.params.id, (findErr, program) => {
    if (findErr) return next(findErr)
    const newClassification = program.draftClassifications[req.user._id]
    if (!newClassification) return res.sendStatus(409)

    newClassification.status = 'registered'
    newClassification.author = {_id: req.user._id, name: req.user.name, username: req.user.username}
    if (newClassification.isReclassification && !utils.hasRole(req.user, 'kavi')) {
      newClassification.reason = 4
    }

    // prevent user and kavi role from registering classifications in the past
    if (!utils.hasRole(req.user, 'root')) {
      newClassification.registrationDate = new Date()
    }

    Program.updateClassificationSummary(newClassification)

    program.draftClassifications = {}
    program.draftsBy = []
    program.classifications.unshift(newClassification)
    program.classifications.sort((c1, c2) => c2.registrationDate - c1.registrationDate)
    program.markModified('draftClassifications')
    program.preventSendingEmail = req.body.preventSendingEmail

    populateSentRegistrationEmailAddresses(program, (err, p) => {
      if (err) return next(err)
      verifyTvSeriesExistsOrCreate(p, req.user, (existErr) => {
        if (existErr) return next(existErr)
        p.save((saveErr) => {
          if (saveErr) return next(saveErr)
          updateTvSeriesClassification(p, (updateErr) => {
            if (updateErr) return next(updateErr)
            addInvoicerows(newClassification, (invoiceErr) => {
              if (invoiceErr) return next(invoiceErr)
              sendRegistrationEmail((sendErr) => {
                if (sendErr) return next(sendErr)
                updateMetadataIndexesForNewProgram(p, () => {
                  logUpdateOperation(req.user, p, {'classifications': {new: 'Luokittelu rekisteröity'}})
                  return res.send(p)
                })
              })
            })
          })
        })
      })
    })

    function updateMetadataIndexesForNewProgram (p, callback) {
      if (p.classifications.length > 1) return callback()
      updateMetadataIndexes(p, callback)
    }

    function addInvoicerows(currentClassification, callback) {
      if (utils.hasRole(req.user, 'root')) return process.nextTick(callback);

      const seconds = classificationUtils.durationToSeconds(currentClassification.duration);

      if (classificationUtils.isReclassification(program, currentClassification)) {
        if (enums.isOikaisupyynto(currentClassification.reason) && enums.authorOrganizationIsKavi(currentClassification)) {
          return InvoiceRow.fromProgram(program, 'reclassification', seconds, srvUtils.currentPrices().reclassificationFee).save(callback);
        } else if (utils.hasRole(req.user, 'kavi')) {
          return callback();
        } else {
          return InvoiceRow.fromProgram(program, 'registration', seconds, srvUtils.currentPrices().registrationFee).save(callback);
        }
      }

      InvoiceRow.fromProgram(program, 'registration', seconds, srvUtils.currentPrices().registrationFee).save((saveErr) => {
        if (saveErr) return callback(saveErr);

        if (utils.hasRole(req.user, 'kavi')) {
          if (currentClassification.format === 'DCP') {
            const dcpFee = srvUtils.currentPrices().dcpClassificationFee;

            InvoiceRow.fromProgram(program, 'dcpClassification', 0, dcpFee).save((dcpErr) => {
              if (dcpErr) return callback(dcpErr);
              const classificationPrice = classificationUtils.price(program, seconds, srvUtils.currentPrices());
              InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback);
            });
          } else {
            const classificationPrice = classificationUtils.price(program, seconds, srvUtils.currentPrices());
            InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback);
          }
        } else {
          return callback();
        }
      });
    }

    function populateSentRegistrationEmailAddresses (prg, callback) {
      if (utils.hasRole(req.user, 'root') && prg.preventSendingEmail) return process.nextTick(callback.bind(null, null, prg))
      prg.populateSentRegistrationEmailAddresses((err, p) => {
        if (err) return callback(err)
        const valid = validation.registration(p.toObject(), newClassification, req.user)
        if (!valid.valid) {
          const msg = "Invalid program. Field: " + valid.field
          console.error(msg)
          return res.status(400).send(msg)
        }
        callback(null, p)
      })
    }

    function sendRegistrationEmail (callback) {
      if (utils.hasRole(req.user, 'root') && program.preventSendingEmail) return process.nextTick(callback)
      sendEmail(classificationUtils.registrationEmail(program, newClassification, req.user, env.hostname), req.user, callback)
    }
  })
})

app.post('/programs/:id/classification', (req, res, next) => {
  Program.findById(req.params.id, (err, program) => {
    if (err) next(err)
    if (program.classifications.length > 0) return res.sendStatus(400)
    program.deleted = false
    program.newDraftClassification(req.user)
    program.save(respond(res, next))
  })
})

app.post('/programs/:id/reclassification', (req, res, next) => {
  Program.findById(req.params.id, (err, program) => {
    if (err) return next(err)
    if (!classificationUtils.canReclassify(program, req.user)) return res.sendStatus(400)
    program.deleted = false
    program.newDraftClassification(req.user)
    program.populateSentRegistrationEmailAddresses((populateErr) => {
      if (populateErr) return next(populateErr)
      program.save(respond(res, next))
    })
  })
})

app.post('/programs/:id/categorization', (req, res, next) => {
  Program.findById(req.params.id, (err, program) => {
    if (err) return next(err)
    const oldSeries = program.toObject().series
    const watcher = watchChanges(program, req.user, Program.excludedChangeLogPaths)
    const updates = _.merge(_.pick(req.body, ['programType', 'series', 'episode', 'season']), {deleted: false})
    watcher.applyUpdates(updates)
    if (!enums.util.isTvEpisode(program)) {
      program.series = undefined
      program.episode = undefined
      program.season = undefined
    }
    verifyTvSeriesExistsOrCreate(program, req.user, (verifyErr) => {
      if (verifyErr) return next(verifyErr)
      program.populateAllNames((populateErr) => {
        if (populateErr) return next(populateErr)
        watcher.saveAndLogChanges((saveErr, p) => {
          if (saveErr) return next(saveErr)
          updateTvSeriesClassification(p, (updateErr) => {
            if (updateErr) return next(updateErr)
            updateTvSeriesClassificationIfEpisodeRemovedFromSeries(p, oldSeries, respond(res, next, p))
          })
        })
      })
    })
  })
})

app.post('/programs/:id', requireRole('root'), (req, res, next) => {
  Program.findById(req.params.id, (err, program) => {
    if (err) return next(err)
    const oldSeries = program.toObject().series
    const watcher = watchChanges(program, req.user, Program.excludedChangeLogPaths)
    watcher.applyUpdates(_.merge(req.body, {deleted: false}))
    program.classifications.forEach((c) => {
      if (enums.authorOrganizationIsElokuvalautakunta(c) || enums.authorOrganizationIsKuvaohjelmalautakunta(c) || enums.authorOrganizationIsKHO(c)) {
        c.reason = undefined
        c.buyer = undefined
        c.billing = undefined
      }
      Program.updateClassificationSummary(c)
    })
    verifyTvSeriesExistsOrCreate(program, req.user, (verifyErr) => {
      if (verifyErr) return next(verifyErr)
      program.populateAllNames((populateErr) => {
        if (populateErr) return next(populateErr)
        updateTvEpisodeAllNamesOnParentNameChange(program, (updateErr) => {
          if (updateErr) return next(updateErr)
          watcher.saveAndLogChanges((saveErr, p) => {
            if (saveErr) return next(saveErr)
            updateMetadataIndexes(p, () => {
              updateTvSeriesClassification(p, (updateSeriesClassificationErr) => {
                if (updateSeriesClassificationErr) return next(updateSeriesClassificationErr)
                updateTvSeriesClassificationIfEpisodeRemovedFromSeries(p, oldSeries, (updateEpisodeRemovedClassificationErr) => {
                  if (updateEpisodeRemovedClassificationErr) return next(updateEpisodeRemovedClassificationErr)
                  updateInvoicerows(p, respond(res, next, p))
                })
              })
            })
          })
        })
      })
    })
  })

  function updateTvEpisodeAllNamesOnParentNameChange (parent, callback) {
    if (!enums.util.isTvSeriesName(parent)) return callback()
    if (!parent.hasNameChanges()) return callback()
    Program.find({'series._id': parent._id}).exec((findErr, episodes) => {
      if (findErr) return callback(findErr)
      async.forEach(episodes, (e, cb) => e.populateAllNames(parent, cb), () => async.forEach(episodes, (e, cb) => e.save(cb), callback))
    })
  }
})

app.post('/programs/autosave/:id', (req, res, next) => {
  Program.findOne({_id: req.params.id, draftsBy: req.user._id}, (findErr, program) => {
    if (findErr) return next(findErr)
    if (!program) return res.sendStatus(409)
    if (!isValidUpdate(req.body, program, req.user)) return res.sendStatus(400)
    watchChanges(program, req.user).applyUpdates(req.body)
    program.verifyAllNamesUpToDate((verifyErr) => {
      if (verifyErr) return next(verifyErr)
      program.save(respond(res, next))
    })
  })

  function isValidUpdate (update, p, user) {
    const allowedFields = allowedAutosaveFields(p, user)
    return _.every(Object.keys(update), (updateField) => _.some(allowedFields, (allowedField) => (allowedField[allowedField.length - 1] === '*'
      ? updateField.indexOf(allowedField.substring(0, allowedField.length - 1)) === 0
      : updateField === allowedField)))
  }

  function allowedAutosaveFields (p, user) {
    const progFields = ['name', 'nameFi', 'nameSv', 'nameOther', 'country', 'year', 'productionCompanies', 'genre', 'legacyGenre', 'directors', 'actors', 'synopsis', 'gameFormat', 'season', 'episode', 'series*']
    const classificationFields = ['buyer', 'billing', 'format', 'duration', 'safe', 'criteria', 'warningOrder', 'registrationDate', 'registrationEmailAddresses', 'comments', 'userComments', 'criteriaComments*', 'kaviType', 'kaviDiaryNumber']
    const kaviReclassificationFields = ['authorOrganization', 'publicComments', 'reason']
    if (p.classifications.length === 0) return progFields.concat(classificationFields.map(asDraftField))
    return utils.hasRole(user, 'kavi')
      ? classificationFields.concat(kaviReclassificationFields).map(asDraftField)
      : classificationFields.map(asDraftField)

    function asDraftField (s) { return 'draftClassifications.' + user._id + '.' + s }
  }
})

app.delete('/programs/:id', requireRole('root'), (req, res, next) => {
  Program.findById(req.params.id, (err, program) => {
    if (err) return next(err)
    softDeleteAndLog(program, req.user, (deleteErr, p) => {
      if (deleteErr) return next(deleteErr)
      InvoiceRow.removeProgram(p, (removeErr) => {
        if (removeErr) return next(removeErr)
        updateTvSeriesClassification(p, respond(res, next, p))
      })
    })
  })
})

app.delete('/programs/:programId/classification/:classificationId', requireRole('root'), (req, res, next) => {
  const classificationId = req.params.classificationId
  Program.findById(req.params.programId, (err, program) => {
    if (err) return next(err)
    const watcher = watchChanges(program, req.user, ['deletedClassifications', 'sentRegistrationEmailAddresses'])
    const classification = program.classifications.id(classificationId)
    program.classifications.pull(classificationId)
    program.deletedClassifications.push(classification)
    program.populateSentRegistrationEmailAddresses((populateErr) => {
      if (populateErr) return next(populateErr)
      watcher.saveAndLogChanges((saveErr) => {
        if (saveErr) return next(saveErr)
        if (program.classifications.length === 0) InvoiceRow.removeProgram(program, (removeErr) => {
          if (removeErr) return next(removeErr)
          updateTvSeriesClassification(program, respond(res, next, program))
        })
        else updateTvSeriesClassification(program, respond(res, next, program))
      })
    })
  })
})

app.get('/series/search', (req, res, next) => {
  const q = {programType: 2, deleted: {$ne: true}}
  const parts = toMongoArrayQuery(req.query.q)
  if (parts) q.allNames = parts
  Program.find(q, {name: 1}).lean().limit(20).sort('name').exec((err, data) => {
    if (err) return next(err)
    res.send(_.map(data, (d) => ({_id: d._id, name: d.name[0]})))
  })
})

app.get('/accounts/access/:id', (req, res) => {
  if (utils.hasRole(req.user, 'kavi')) {
    res.send({access: true})
  } else {
    Account.findById(req.params.id, (err, account) => {
      res.send({access: !err && account.users.id(req.user._id) !== null})
    })
  }
})

app.put('/accounts/:id', requireRole('kavi'), (req, res, next) => {
  if (!utils.hasRole(req.user, 'root')) delete req.body.apiToken
  Account.findById(req.params.id, (err, account) => {
    if (err) return next(err)
    updateAndLogChanges(account, req.body, req.user, respond(res, next))
  })
})

app.post('/accounts', requireRole('kavi'), (req, res, next) => {
  if (!utils.hasRole(req.user, 'root')) delete req.body.apiToken
  new Account(req.body).save((err, account) => {
    if (err) return next(err)
    logCreateOperation(req.user, account)
    res.send(account)
  })
})

app.delete('/accounts/:id', requireRole('root'), (req, res, next) => {
  Account.findById(req.params.id, (err, account) => {
    if (err) return next(err)
    softDeleteAndLog(account, req.user, respond(res, next))
  })
})

app.get('/accounts', requireRole('kavi'), (req, res, next) => {
  const selectedRoles = req.query.roles
  const query = selectedRoles ? {roles: {$all: selectedRoles}} : {}
  Account.find(_.merge(query, {deleted: {$ne: true}})).lean().exec(respond(res, next))
})

app.get('/subscribers', requireRole('kavi'), (req, res, next) => {
  const selectedRoles = req.query.roles
  const query = _.isEmpty(selectedRoles)
    ? {roles: {$in: ['Classifier', 'Subscriber']}}
    : {roles: {$all: selectedRoles}}
  Account.find(_.merge(query, {deleted: {$ne: true}})).lean().exec(respond(res, next))
})

app.post('/subscribers/excel/export', (req, res, next) => {
  const regexp = new RegExp(utils.escapeRegExp(req.body.query), 'i')
  const q = _.isEmpty(req.body.query) ? {} : {name: regexp}
  const selectedRoles = _.compact(_.map(Object.keys(req.body), (key) => (req.body[key] === 'on' ? key : undefined)))
  const roleQuery = {roles: _.isEmpty(selectedRoles) ? {$in: ['Classifier', 'Subscriber']} : {$all: selectedRoles}}
  Account.find(_.merge(q, roleQuery, {deleted: {$ne: true}})).sort('name').lean().exec((err, data) => {
    if (err) return next(err)
    const result = excelExport.constructSubscriberExportData(data)
    const filename = 'subscribers' + (req.body.csv ? '.csv' : '.xlsx')
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(result)
  })
})

app.get('/providers/unapproved', requireRole('kavi'), (req, res, next) => {
  Provider.find({deleted: false, active: false, registrationDate: {$exists: false}}, '', respond(res, next))
})

app.get('/providers', requireRole('kavi'), (req, res, next) => {
  Provider.aggregate([
    {$match: {deleted: false, registrationDate: {$exists: true}}},
    {$redact: {$cond: {
      if: {$and: [{$not: '$locations'}, {$eq: ['$deleted', true]}]},
      then: '$$PRUNE', else: '$$DESCEND'}}}
  ], respond(res, next))
})

app.post('/providers/excel/export', (req, res, next) => {
  const regexp = new RegExp(utils.escapeRegExp(req.body.query), 'i')
  const q = _.isEmpty(req.body.query) ? {} : {$or: [{name: regexp}, {'locations.name': regexp}]}
  const k18 = req.body.k18 === 'on' ? {'locations.adultContent': true} : {}
  const providingTypeKeys = _.compact(_.map(Object.keys(enums.providingType), (key) => (req.body[key] === 'on' ? key : undefined)))
  const providingTypes = providingTypeKeys.length > 0 ? {'locations.providingType': {$in: providingTypeKeys}} : {}

  Provider.aggregate([
    {$match: q}, {$match: k18}, {$match: providingTypes},
    {$match: {deleted: false, registrationDate: {$exists: true}}},
    {$redact: {$cond: {
          if: {$and: [{$not: '$locations'}, {$eq: ['$deleted', true]}]},
          then: '$$PRUNE', else: '$$DESCEND'}}},
    {$sort: {name: 1}}
  ], (err, providers) => {
    if (err) return next(err)
    const providersFiltered = _.filter(providers, (provider) => {
      provider.locations = _.filter(provider.locations, (location) => (_.isEmpty(req.body.query) || regexp.test(location.name)) &&
        (providingTypeKeys.length === 0 || _.intersection(providingTypeKeys, location.providingType).length > 0))
      return !_.isEmpty(provider.locations)
    })

    const result = excelExport.constructProviderExportData(providersFiltered)
    const filename = 'providers' + (req.body.csv ? '.csv' : '.xlsx')
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(result)
  })
})

app.post('/providers', requireRole('kavi'), (req, res, next) => {
  new Provider(utils.merge(req.body, {deleted: false, active: false, creationDate: new Date()})).save((err, provider) => {
    if (err) return next(err)
    logCreateOperation(req.user, provider)
    res.send(provider)
  })
})

app.put('/providers/:id/active', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.id, (err, provider) => {
    if (err) return next(err)
    const isFirstActivation = !provider.registrationDate
    const newActive = !provider.active
    const updates = {active: {old: provider.active, new: newActive}}
    provider.active = newActive
    if (isFirstActivation) {
      const now = new Date()
      provider.registrationDate = now
      updates.registrationDate = {old: undefined, new: now}
      _.filter(provider.locations, (l) => !l.deleted && l.active).forEach((l) => {
        l.registrationDate = now
        const changeLogUpdates = {registrationDate: {old: undefined, new: now}}
        saveChangeLogEntry(req.user, l, 'update', {targetCollection: 'providerlocations', updates: changeLogUpdates})
      })
    }
    saveChangeLogEntry(req.user, provider, 'update', {updates: updates})
    provider.save((saveErr, saved) => {
      if (saveErr) return next(saveErr)
      if (isFirstActivation) {
        const savedProvider = saved.toObject()
        const providerHasEmails = !_.isEmpty(savedProvider.emailAddresses)
        if (providerHasEmails) {
          providerUtils.registrationEmail(savedProvider, env.hostname, logErrorOrSendEmail(req.user))
        }
        sendProviderLocationEmails(savedProvider)
        const withEmail = providerUtils.payingLocationsWithEmail(savedProvider.locations)
        const withoutEmail = providerUtils.payingLocationsWithoutEmail(savedProvider.locations)
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

  function sendProviderLocationEmails (provider) {
    _.filter(provider.locations, (l) => !l.deleted && l.isPayer && l.active && l.emailAddresses.length > 0).forEach((l) => {
      providerUtils.registrationEmailProviderLocation(utils.merge(l, {provider: provider}), env.hostname, logErrorOrSendEmail(req.user))
    })
  }
})

app.put('/providers/:id', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.id, (err, provider) => {
    if (err) return next(err)
    updateAndLogChanges(provider, req.body, req.user, respond(res, next))
  })
})

app.delete('/providers/:id', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.id, (err, provider) => {
    if (err) return next(err)
    softDeleteAndLog(provider, req.user, respond(res, next))
  })
})

app.get('/providers/metadata', requireRole('kavi'), (req, res, next) => {
  ProviderMetadata.getAll(respond(res, next))
})

app.post('/providers/yearlyBilling/kieku', requireRole('kavi'), (req, res, next) => {
  Provider.getForBilling((billingErr, data) => {
    if (billingErr) next(billingErr)
    const year = moment().year()
    const accountRows = getProviderBillingRows(data)
    const filename = 'kieku_valvontamaksut_vuosi' + moment().year() + (req.body.csv ? '.csv' : '.xlsx')
    const result = kieku.createYearlyProviderRegistration(filename, year, accountRows)
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ProviderMetadata.setYearlyBillingCreated(new Date(), () => res.send(result))
  })
})

app.post('/providers/billing/kieku', requireRole('kavi'), (req, res, next) => {
  const dateFormat = 'DD.MM.YYYY'
  const dates = {begin: moment(req.body.begin, dateFormat), end: moment(req.body.end, dateFormat), inclusiveEnd: moment(req.body.end, dateFormat).add(1, 'day')}
  const dateRangeQ = {$gte: dates.begin, $lt: dates.inclusiveEnd}
  const registrationDateFilters = {$or: [
    {registrationDate: dateRangeQ},
    {'locations.registrationDate': dateRangeQ}
  ]}
  Provider.getForBilling(registrationDateFilters, (err, data) => {
    if (err) return next(err)

    data.providers = _(data.providers).map((p) => {
      p.locations = _.filter(p.locations, (l) => utils.withinDateRange(l.registrationDate, dates.begin, dates.inclusiveEnd))
      return p
    }).reject((p) => _.isEmpty(p.locations)).value()

    data.locations = _.filter(data.locations, (l) => utils.withinDateRange(l.registrationDate, dates.begin, dates.inclusiveEnd))

    const accountRows = getProviderBillingRows(data)
    const filename = 'kieku_valvontamaksut_' + dates.begin.format(dateFormat) + '-' + dates.end.format(dateFormat) + (req.body.csv ? '.csv' : '.xlsx')
    const result = kieku.createProviderRegistration(filename, accountRows)
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ProviderMetadata.setPreviousMidYearBilling(new Date(), dates.begin, dates.end, () => {
      res.send(result)
    })
  })
})

app.get('/providers/yearlyBilling/info', requireRole('kavi'), (req, res, next) => {
  Provider.getForBilling((err, data) => {
    if (err) return next(err)

    const providers = _.groupBy(data.providers, (p) => (_.isEmpty(p.emailAddresses) ? 'noMail' : 'withMail'))
    const locations = _.groupBy(data.locations, (p) => (_.isEmpty(p.emailAddresses) ? 'noMail' : 'withMail'))

    res.json({
      providerCount: providers.withMail ? providers.withMail.length : 0,
      locationCount: locations.withMail ? locations.withMail.length : 0,
      providersWithoutMail: providers.noMail ? providers.noMail : [],
      locationsWithoutMail: locations.noMail ? locations.noMail : []
    })
  })
})

app.post('/providers/yearlyBilling/sendReminders', requireRole('kavi'), (req, res, next) => {
  Provider.getForBilling((err, data) => {
    if (err) return next(err)

    _(data.providers).reject((p) => _.isEmpty(p.emailAddresses)).value().forEach((p) => {
      providerUtils.yearlyBillingProviderEmail(p, env.hostname, logErrorOrSendEmail(req.user))
    })
    _(data.locations).reject((l) => _.isEmpty(l.emailAddresses)).value().forEach((l) => {
      providerUtils.yearlyBillingProviderLocationEmail(l, env.hostname, logErrorOrSendEmail(req.user))
    })

    ProviderMetadata.setYearlyBillingReminderSent(new Date(), respond(res, next))
  })
})

app.get('/providers/billing/:begin/:end', requireRole('kavi'), (req, res, next) => {
  const format = 'DD.MM.YYYY'

  const beginMoment = moment(req.params.begin, format)
  const endMoment = moment(req.params.end, format).add(1, 'day')
  const dates = {
    $gte: beginMoment,
    $lt: endMoment
  }

  const terms = {
    active: true, deleted: false,
    $or: [
      {registrationDate: dates},
      {'locations.registrationDate': dates}
    ]
  }

  Provider.find(terms).lean().exec((err, providers) => {
    if (err) return next(err)
    _.forEach(providers, (provider) => {
      provider.locations = _(provider.locations)
        .filter({active: true, deleted: false})
        .filter((l) => utils.withinDateRange(l.registrationDate, beginMoment, endMoment))
        .sortBy('name').value()
    })
    res.send(_.filter(providers, (provider) => !_.isEmpty(provider.locations)))
  })
})

app.get('/providers/:id', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.id).lean().exec((err, provider) => {
    if (err) return next(err)
    provider.locations = _(provider.locations).filter({deleted: false}).sortBy('name').value()
    res.send(provider)
  })
})

app.put('/providers/:pid/locations/:lid/active', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.pid, (err, provider) => {
    if (err) return next(err)
    const location = provider.locations.id(req.params.lid)
    const firstActivation = isFirstActivation(provider, location)
    const updates = {}
    if (firstActivation) {
      location.registrationDate = new Date()
      updates.registrationDate = {old: undefined, new: location.registrationDate}
    }
    location.active = !location.active

    updates.active = {old: !location.active, new: location.active}
    saveChangeLogEntry(req.user, location, 'update', {targetCollection: 'providerlocations', updates: updates})

    provider.save((saveErr, saved) => {
      if (saveErr) return next(saveErr)
      if (firstActivation) {
        sendRegistrationEmails(saved.toObject(), location.toObject(), respond(res, next))
      } else {
        res.send({active: location.active, wasFirstActivation: false, registrationDate: location.registrationDate})
      }
    })
  })

  function sendRegistrationEmails (provider, location, callback) {
    if (location.isPayer && !_.isEmpty(location.emailAddresses)) {
      // a paying location provider: send email to location
      providerUtils.registrationEmailProviderLocation(utils.merge(location, {provider: provider}), env.hostname, logErrorOrSendEmail(req.user))
      callback(null, {active: true, wasFirstActivation: true, emailSent: true, registrationDate: location.registrationDate})
    } else if (!location.isPayer && !_.isEmpty(provider.emailAddresses)) {
      // email the provider
      const providerData = _.clone(provider)
      providerData.locations = [location]
      providerUtils.registrationEmail(providerData, env.hostname, logErrorOrSendEmail(req.user))
      callback(null, {active: true, wasFirstActivation: true, emailSent: true, registrationDate: location.registrationDate})
    } else {

      /*
       * location is the payer, but the location has no email addresses
       * or the provider has no email addresses
       */
      callback(null, {active: true, wasFirstActivation: true, emailSent: false, registrationDate: location.registrationDate})
    }
  }

  function isFirstActivation (provider, location) {
    return provider.registrationDate && !location.active && !location.registrationDate
  }
})

app.put('/providers/:pid/locations/:lid', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.pid, (findErr, provider) => {
    if (findErr) return next(findErr)
    const flatUpdates = utils.flattenObject(req.body)
    const location = provider.locations.id(req.params.lid)
    const watcher = watchChanges(location, req.user)
    _.forEach(flatUpdates, (value, key) => location.set(key, value))
    provider.save(respond(res, next))
    saveChangeLogEntry(req.user, location, 'update', {updates: watcher.getChanges(), targetCollection: 'providerlocations'})
  })
})

app.post('/providers/:id/locations', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.id, (err, prov) => {
    if (err) return next(err)
    const active = !prov.registrationDate
    prov.locations.push(utils.merge(req.body, {deleted: false, active: active}))
    prov.save((saveErr, p) => {
      if (saveErr) return next(saveErr)
      logCreateOperation(req.user, _.last(p.locations))
      res.send(_.last(p.locations))
    })
  })
})

app.delete('/providers/:pid/locations/:lid', requireRole('kavi'), (req, res, next) => {
  Provider.findById(req.params.pid, (err, provider) => {
    if (err) return next(err)
    const location = provider.locations.id(req.params.lid)
    location.deleted = true
    saveChangeLogEntry(req.user, location, 'delete')
    provider.save(respond(res, next))
  })
})

app.get('/accounts/search', (req, res, next) => {
  const roles = req.query.roles ? req.query.roles.split(',') : []
  const q = {roles: {$in: roles}, deleted: {$ne: true}, inactive: {$ne: true}}
  if (!utils.hasRole(req.user, 'kavi')) {
    q['users._id'] = req.user._id
  }
  if (req.query.q && req.query.q.length > 0) q.name = new RegExp("^" + utils.escapeRegExp(req.query.q), 'i')
  Account.find(q, {_id: 1, name: 1}).sort('name').limit(parseInt(process.env.SELECT_DROPDOWN_SIZE || '50')).lean().exec(respond(res, next))
})

app.get('/accounts/:id/emailAddresses', (req, res, next) => {
  Account.findById(req.params.id, {emailAddresses: 1, users: 1}).exec((err, account) => {
    if (err) return next(err)
    if (!account) return res.sendStatus(404)
    if (!utils.hasRole(req.user, 'kavi') && !account.users.id(req.user._id)) return res.sendStatus(400)
    res.send({_id: account._id, emailAddresses: account.emailAddresses})
  })
})

app.get('/users', requireRole('root'), (req, res, next) => {
  const roleFilters = req.query.roles
  const activeFilter = req.query.active ? req.query.active === 'true' : false
  const filters = _.merge({}, roleFilters ? {role: {$in: roleFilters}} : {}, activeFilter ? {active: true} : {})
  User.find(filters, User.noPrivateFields).sort('name').lean().exec(respond(res, next))
})

app.get('/users/search', requireRole('kavi'), (req, res, next) => {
  const regexp = new RegExp(utils.escapeRegExp(req.query.q), 'i')
  const q = {$or: [{name: regexp}, {username: regexp}]}
  User.find(q, 'name username active').limit(parseInt(process.env.SELECT_DROPDOWN_SIZE || '50')).sort('name').lean().exec(respond(res, next))
})

app.get('/users/exists/:username', requireRole('root'), (req, res, next) => {
  const q = (req.params.username || '').toUpperCase()
  User.findOne({username: q}, {_id: 1}).lean().exec((err, user) => {
    if (err) return next(err)
    res.send({exists: !!user})
  })
})

app.post('/users/new', requireRole('root'), (req, res, next) => {
  const hasRequiredFields = !!req.body.username && req.body.emails[0].length > 0 && !!req.body.name
  if (!hasRequiredFields || !utils.isValidUsername(req.body.username)) return res.sendStatus(400)
  req.body.username = req.body.username.toUpperCase()
  new User(req.body).save((err, user) => {
    if (err) return next(err)
    createAndSaveHash(user, (saveErr) => {
      if (saveErr) return next(saveErr)
      logCreateOperation(req.user, user)
      const subject = 'Käyttäjätunnuksen aktivointi / Aktivering av användarnamn'
      srvUtils.getTemplate('user-created-email.tpl.html', (templErr, tpl) => {
        if (templErr) return next(templErr)
        sendHashLinkViaEmail(user, subject, tpl, respond(res, next, user))
      })
    })
  })
})

app.post('/sendemail/hearingrequest/classifier', requireRole('kavi'), (req, res, next) => {
  const vars = req.body
  User.findById(req.user._id, (err, user) => {
    if (err) return next(err)
    vars.hostName = env.hostname
    vars.classifierEmail = req.user.email
    vars.classifierPhone = user.phoneNumber
    vars.icons = classificationUtils.iconHtml(vars.programWarningSummary, 'fi', vars.hostName)
    srvUtils.getTemplateWithVars('reclassification-hearing-request-for-classifier.tpl.html', vars, (templErr, template) => {
      if (templErr) return next(templErr)
      const emailSubject = 'Asianosaisen kuuleminen kuvaohjelman luokittelun johdosta'
      const emailRecipients = [req.user.email]
      sendReclassificationHearingRequestEmails(req.user, emailRecipients, emailSubject, template, respond(res, next, {}))
    })
  })
})

app.post('/sendemail/hearingrequest/buyer', requireRole('kavi'), (req, res, next) => {
  const vars = req.body
  User.findById(req.user._id, (err, user) => {
    if (err) return next(err)
    vars.hostName = env.hostname
    vars.classifierEmail = req.user.email
    vars.classifierPhone = user.phoneNumber
    vars.icons = classificationUtils.iconHtml(vars.programWarningSummary, 'fi', vars.hostName)
    srvUtils.getTemplateWithVars('reclassification-hearing-request-for-buyer.tpl.html', vars, (templErr, template) => {
      if (templErr) return next(templErr)
      const emailSubject = 'Asianosaisen kuuleminen kuvaohjelman luokittelun johdosta'
      const emailRecipients = [req.body.buyerEmail]
      sendReclassificationHearingRequestEmails(req.user, emailRecipients, emailSubject, template, respond(res, next, {}))
    })
  })
})

app.post('/sendemail/materialrequest', requireRole('kavi'), (req, res, next) => {
  const vars = req.body
  User.findById(req.user._id, (err, user) => {
    if (err) return next(err)
    vars.hostName = env.hostname
    vars.classifierEmail = req.user.email
    vars.classifierPhone = user.phoneNumber
    vars.icons = classificationUtils.iconHtml(vars.programWarningSummary, 'fi', vars.hostName)
    srvUtils.getTemplateWithVars('reclassification-material-request.tpl.html', vars, (templErr, template) => {
      if (templErr) return next(templErr)
      const emailSubject = 'Materiaalin toimituspyyntö'
      const emailRecipients = [req.body.buyerEmail]
      sendReclassificationHearingRequestEmails(req.user, emailRecipients, emailSubject, template, respond(res, next, {}))
    })
  })
})

function sendReclassificationHearingRequestEmails(user, emailRecipients, emailSubject, template, callback) {
  const getBccBasedOnEnvironment = process.env.NODE_ENV === 'training'
      ? ['ville.sohn@kuvi.fi']
      : ['ville.sohn@kuvi.fi', 'hallinto@kuvi.fi'];

  const emailData = {
    recipients: emailRecipients,
    bcc: getBccBasedOnEnvironment,
    subject: emailSubject,
    body: _.template(template)({
    })
  }
  sendEmail(emailData, user, callback)
}

app.post('/users/:id', requireRole('root'), (req, res, next) => {
  User.findById(req.params.id, (err, user) => {
    if (err) return next(err)
    const updates = _.omit(req.body, 'username', 'emekuId', 'role', 'password', 'resetHash', 'certExpiryReminderSent')
    updateAndLogChanges(user, updates, req.user, (updateErr, saved) => {
      if (updateErr) return next(updateErr)
      const cleaned = saved.toObject()
      User.privateFields.forEach((key) => delete cleaned[key])
      res.send(cleaned)
    })
  })
})

app.get('/users/names/:names', requireRole('kavi'), (req, res, next) => {
  User.find({username: {$in: req.params.names.toUpperCase().split(',')}}, 'name username active').lean().exec((err, users) => {
    if (err) return next(err)
    const result = users.reduce((acc, user) => {
      acc[user.username] = {name: user.name, active: user.active}
      return acc
    }, {})
    res.send(result)
  })
})

app.post('/users/excel/export', requireRole('root'), (req, res, next) => {
  const regexp = new RegExp(utils.escapeRegExp(req.body.query), 'i')
  const q = _.isEmpty(req.body.query) ? {} : {$or: [{name: regexp}, {username: regexp}]}
  const roleFilters = _.compact(_.map(['user', 'kavi', 'root'], (k) => (req.body[k] === 'on' ? k : undefined)))
  const activeFilter = req.body.active === 'on'
  const filters = _.merge(q, _.isEmpty(roleFilters) ? {} : {role: {$in: roleFilters}}, activeFilter ? {active: true} : {})
  User.find(filters, User.noPrivateFields).sort('name').lean().exec((err, data) => {
    if (err) return next(err)
    const result = excelExport.constructUserExportData(data)
    const filename = 'users' + (req.body.csv ? '.csv' : '.xlsx')
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(result)
  })
})

app.get('/apiToken', requireRole('root'), (req, res, next) => {
  bcrypt.genSalt(1, (err, s) => {
    if (err) return next(err)
    res.send({apiToken: Buffer.from(s, 'base64').toString('hex')})
  })
})

app.get('/actors/search', queryNameIndex('Actor'))
app.get('/directors/search', queryNameIndex('Director'))
app.get('/productionCompanies/search', queryNameIndex('ProductionCompany'))

app.get('/emails/search', (req, res, next) => {
  const terms = asTerms(req.query.q)
  async.parallel([loadUsers, loadAccounts], (err, results) => {
    if (err) return next(err)
    res.send(_(results).flatten().sortBy('name').value())
  })

  function loadUsers (callback) {
    const q = {$or: [{name: terms}, {'emails.0': terms}], 'emails.0': {$exists: true}, deleted: {$ne: true}}
    User.find(q, {name: 1, emails: 1}).sort('name').limit(25).lean().exec((err, result) => {
      if (err) return callback(err)
      callback(null, result.map((u) => ({id: u.emails[0], name: u.name, role: 'user'})))
    })
  }

  function loadAccounts (callback) {
    const q = {$or: [ {name: terms}, {'emailAddresses.0': terms} ], 'emailAddresses.0': {$exists: true}, roles: 'Subscriber', deleted: {$ne: true}}
    Account.find(q, {name: 1, emailAddresses: 1}).sort('name').limit(25).lean().exec((err, result) => {
      if (err) return callback(err)
      callback(null, result.map((a) => ({id: a.emailAddresses[0], name: a.name, role: 'account'})))
    })
  }

  function asTerms (q) {
    const words = (q || '').trim().toLowerCase()
    return words ? {$all: words.split(/\s+/).map(asRegex)} : undefined
  }

  function asRegex (s) {
    return new RegExp('(^|\\s|\\.|@)' + utils.escapeRegExp(s), 'i')
  }
})

app.get('/invoicerows/:begin/:end', requireRole('kavi'), (req, res, next) => {
  const range = utils.parseDateRange(req.params)
  InvoiceRow.find({registrationDate: {$gte: range.begin, $lt: range.end}}).sort('registrationDate').lean().exec(respond(res, next))
})

app.post('/kieku', requireRole('kavi'), (req, res, next) => {
  const dates = {begin: req.body.begin, end: req.body.end}
  const invoiceIds = req.body.invoiceId
  const cond = invoiceIds ? {_id: {$in: Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds]}} : {}
  InvoiceRow.find(cond).sort('registrationDate').lean().exec((err, rows) => {
    if (err) return next(err)
    const accountIds = _(rows).map((i) => i.account._id.toString()).uniq().value()
    Account.find({_id: {$in: accountIds}}).lean().exec((findErr, accounts) => {
      if (findErr) return next(findErr)
      const accountMap = _.keyBy(accounts, '_id')
      function accountId (row) { return row.account._id }
      function toNamedTuple (pair) { return {account: accountMap[pair[0]], rows: _.sortBy(pair[1], ['type', 'name'])} }
      function accountName (tuple) { return tuple.account.name }

      const data = _(rows).groupBy(accountId).toPairs().map(toNamedTuple).sortBy(accountName).value()
      const filename = 'kieku-' + dates.begin + '-' + dates.end + (req.body.csv ? '.csv' : '.xlsx')
      const result = kieku.createClassificationRegistration(filename, dates, data)
      res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.send(result)
    })
  })
})

app.post('/xml/v1/programs/:token', authenticateXmlApi, (req, res) => {
  const now = new Date()
  const account = {_id: req.account._id, name: req.account.name}
  const root = builder.create("ASIAKAS")
  let xmlDoc = ""
  req.on('data', (chunk) => { xmlDoc += chunk; return undefined })
  req.on('end', () => {
    const doc = {xml: xmlDoc.toString('utf-8'), date: now, account: account}
    new schema.XmlDoc(doc).save((err) => {
      if (err) console.error(err)
    })
  })

  xml.readPrograms(req, (err, programs) => {
    if (err) return writeError('Järjestelmävirhe: ' + err, root)
    if (programs.length === 0) {
      writeError('Yhtään kuvaohjelmaa ei voitu lukea', root)
      return res.send(root.end({pretty: true, indent: '  ', newline: '\n'}))
    }

    async.eachSeries(programs, handleXmlProgram, (handleErr) => {
      if (handleErr) {
        writeError('Järjestelmävirhe: ' + handleErr, root)
      }
      res.set('Content-Type', 'application/xml');
      res.status(handleErr ? 500 : 200).send(root.end({pretty: true, indent: '  ', newline: '\n'}))
    })
  })
  req.resume()

  function writeError (err, parent) {
    console.error(err)
    parent.ele('VIRHE', err)
  }

  function handleXmlProgram (data, callback) {
    const program = data.program
    const ele = root.ele('KUVAOHJELMA')
    ele.ele('ASIAKKAANTUNNISTE', program.externalId)

    if (data.errors.length > 0) {
      return writeErrAndReturn(data.errors)
    }

    if (!utils.isValidYear(program.year)) {
      return writeErrAndReturn("Virheellinen vuosi: " + program.year)
    }

    program.customersId = {account: req.account._id, id: program.externalId}
    Program.findOne(utils.flattenObject({customersId: program.customersId})).exec((err, existingProgram) => {
      if (err) return callback(err)

      if (existingProgram && !existingProgram.deleted && existingProgram.classifications.length > 0) {
        return writeErrAndReturn("Luokiteltu kuvaohjelma on jo olemassa asiakkaan tunnisteella: " + program.externalId)
      }

      verifyValidAuthor(program, (verifyAuthErr) => {
        if (verifyAuthErr) return callback(verifyAuthErr)
        verifyParentProgram(program, (verifyErr) => {
          if (verifyErr) return callback(verifyErr)
          ele.ele('STATUS', 'OK')
          let prg = new Program(program)
          if (existingProgram) {
            existingProgram.series = program.series
            _.each(existingProgram.classifications, (p) => existingProgram.deletedClassifications.push(p))
            existingProgram.classifications = program.classifications
            existingProgram.createdBy = program.createdBy
            existingProgram.deleted = false
            prg = existingProgram
          }
          prg.classifications[0].status = 'registered'
          prg.classifications[0].creationDate = now
          prg.classifications[0].registrationDate = now
          prg.classifications[0].billing = account
          prg.classifications[0].buyer = account
          prg.classifications[0].isReclassification = false
          Program.updateClassificationSummary(prg.classifications[0])
          prg.populateAllNames((populateErr) => {
            if (populateErr) return callback(populateErr)
            prg.save((saveErr) => {
              if (saveErr) return callback(saveErr)
              existingProgram ? logUpdateOperation(req.user, prg, {'classifications': {new: prg.classifications}}) : logCreateOperation(req.user, prg)
              updateTvSeriesClassification(prg, (updateErr) => {
                if (updateErr) return callback(updateErr)
                const seconds = classificationUtils.durationToSeconds(_.first(prg.classifications).duration)
                InvoiceRow.fromProgram(prg, 'registration', seconds, srvUtils.currentPrices().registrationFee).save((invoiceErr) => {
                  if (invoiceErr) return callback(invoiceErr)
                  updateActorAndDirectorIndexes(prg, callback)
                })
              })
            })
          })
        })
      })
    })

    function verifyValidAuthor (p, cb) {
      const username = p.classifications[0].author.name.toUpperCase()
      const user = _.find(req.account.users, {username: username})
      if (user) {
        User.findOne({username: username, active: true}, {_id: 1, username: 1, name: 1, role: 1}).lean().exec((err, doc) => {
          if (err) return cb(err)
          if (doc) {
            p.classifications[0].author = {_id: doc._id, username: doc.username, name: doc.name}
            p.createdBy = {_id: doc._id, username: doc.username, name: doc.name, role: doc.role}
            return cb()
          }
          return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + username)
        })
      } else {
        return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + username)
      }
    }

    function verifyParentProgram (p, cb) {
      if (!enums.util.isTvEpisode(p)) return cb()
      const parentName = p.parentTvSeriesName.trim()
      Program.findOne({programType: 2, name: parentName, deleted: {$ne: true}}, (err, parent) => {
        if (err) return cb(err)
        if (parent) {
          p.series = {_id: parent._id, name: parent.name[0]}
          cb()
        } else {
          const user = _.merge({ip: req.user.ip}, p.createdBy)
          createParentProgram(p, {name: [parentName]}, user, cb)
        }
      })
    }

    function writeErrAndReturn (errors) {
      ele.ele('STATUS', 'VIRHE')
      const errorList = _.isArray(errors) ? errors : [errors]
      errorList.forEach((msg) => writeError(msg, ele))
      callback()
    }
  }
})

app.get('/changelogs/:documentId', requireRole('root'), (req, res, next) => {
  ChangeLog.find({documentId: req.params.documentId}).sort({date: -1}).lean().exec(respond(res, next))
})

app.get('/environment', (req, res) => {
  res.set('Content-Type', 'text/javascript')
  res.send('const APP_ENVIRONMENT = "' + app.get('env') + '";')
})

app.post('/files/provider-import', upload.single('providerFile'), (req, res) => {
  if (_.isEmpty(req.file) || !req.file.path) return res.sendStatus(400)
  if (req.file.truncated) return res.sendStatus(400)
  providerImport.import(req.file, (err, provider) => {
    if (err) return res.send({error: err})
    const providerData = utils.merge(provider, {message: req.body.message ? req.body.message : undefined})
    new schema.Provider(providerData).save((saveErr) => {
      if (saveErr) {
        console.error(saveErr)
        return res.send({error: saveErr})
      }
      res.send({message: 'Ilmoitettu tarjoaja sekä ' + provider.locations.length + ' tarjoamispaikkaa.'})
    })
  })
})

app.get('/report/:name', requireRole('root'), (req, res, next) => {
  const range = utils.parseDateRange(req.query)
  const reports = require('./reports')
  reports[req.params.name](range, respond(res, next))
})

app.get('/classification/criteria', (req, res, next) => {
  if (req.user) ClassificationCriteria.find({}, respond(res, next))
  else res.send([])
})

app.post('/classification/criteria/:id', requireRole('root'), (req, res, next) => {
  const id = parseInt(req.params.id)
  ClassificationCriteria.findOneAndUpdate({id: id}, {
    $set: {id: id, fi: req.body.fi, sv: req.body.sv, date: new Date()}
  }, {upsert: true, new: true}, respond(res, next))
})

app.get('/agelimit/:q?', (req, res, next) => {
  const types = _.map(enums.programType, (t) => t.type)
  const filtersByType = _.map(req.query.type ? _.isArray(req.query.type) ? req.query.type : [req.query.type] : [], (t) => types.indexOf(t))
  const queryParams = {
    "q": req.params.q,
    "filters": filtersByType,
    "directors": req.query.directors,
    "year": parseInt(req.query.year),
    "registrationDateRange": req.query.registrationDateRange
  }
  const q = constructQuery(queryParams)
  const count = req.query.count ? parseInt(req.query.count) : undefined

  function asCriteria (program) {
    function firstTrimmedFrom (origList) {
      return origList && origList.length > 0 ? origList[0].trim() : undefined
    }

    function trimmedList (origList) {
      return origList && origList.length > 0 ? _.compact(origList.map(_.trim)) : undefined
    }

    const classsification = enums.util.isTvSeriesName(program) ? program.episodes : program.classifications[0] || {}
    const agelimit = classsification.agelimit || classsification.legacyAgeLimit || 0
    const countryCode = trimmedList(program.country)
    const durationInSeconds = classificationUtils.durationToSeconds(classsification.duration)
    const programType = enums.programType[program.programType]
    let warnings = _.isEmpty(classsification.warningOrder) ? trimmedList(classsification.warnings) : trimmedList(classsification.warningOrder)
    if (programType && programType.type === 'series') {
      warnings = trimmedList(classsification.warnings)
    }
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
      country: countryCode ? countryCode.map((c) => ({code: c, name: enums.countries[c]})) : undefined,
      year: isNaN(program.year) ? undefined : parseInt(program.year),
      directors: trimmedList(program.directors),
      productionCompanies: trimmedList(program.productionCompanies),
      duration: classsification.duration,
      registrationDate: classsification.registrationDate ? moment(classsification.registrationDate.toISOString()).add(3, 'hours').toISOString().split('T')[0] : undefined,
      durationInSeconds: durationInSeconds > 0 ? durationInSeconds : undefined,
      agelimit: agelimit > 0 ? agelimit : undefined,
      warnings: warnings ? warnings.map(fearToAnxiety) : undefined,
      format: classsification.format
    }
  }

  Program.find(q, Program.publicFields).limit(100).sort('name').lean().exec((err, docs) => {
    if (err) return next(err)
    res.send(_.take(docs, count || docs.length).map(asCriteria))
  })
})

if (env.isTest) {
  app.get('/emails/latest', (req, res) => res.send(_.last(testEnvEmailQueue)))
}

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack || err)
  res.status(err.status || 500).send({message: err.message || err})
})

function createParentProgram (program, data, user, callback) {
  const parent = new Program(_.merge({programType: 2, createdBy: {_id: user._id, username: user.username, name: user.name, role: user.role}}, data))
  parent.populateAllNames((err) => {
    if (err) return callback(err)
    parent.save((saveErr, saved) => {
      if (saveErr) return callback(saveErr)
      logCreateOperation(user, parent)
      program.series = {_id: saved._id, name: saved.name[0]}
      callback()
    })
  })
}

const checkExpiredCerts = new CronJob('0 */30 * * * *', () => {
  User.find({$and: [
    {certificateEndDate: {$lt: new Date()}},
    {active: true},
    {'emails.0': {$exists: true}}
  ]}, (err, users) => {
    if (err) throw err
    users.forEach((user) => {
      user.updateOne({active: false}, (updateErr) => {
        if (updateErr) return logError(updateErr)
        logUpdateOperation({username: 'cron', ip: 'localhost'}, user, {active: {old: user.active, new: false}})
      })
      sendEmail({
        recipients: [user.emails[0]],
        subject: 'Luokittelusertifikaattisi on vanhentunut',
        body: '<p>Luokittelusertifikaattisi on vanhentunut ja sisäänkirjautuminen tunnuksellasi on estetty.<br/>' +
          '<p>Lisätietoja voit kysyä KUVI:lta: <a href="mailto:meku@kuvi.fi">meku@kuvi.fi</a></p>' +
          '<p>Terveisin,<br/>KUVI</p>'
      }, undefined, logError)
    })
  })
})

/**
 *  A cron job that fetches all the users that have an expiring certificate within 6 months or less, and to whom
 *  a reminder has not been sent for over a month. These users are then sent a reminder.
 */
const checkCertsExpiringSoon = new CronJob('0 */30 * * * *', () => {
  User.find({$and: [
    {certificateEndDate: {$lt: moment().add(6, 'months').toDate(), $gt: new Date()}},
    {active: true},
    {'emails.0': {$exists: true}},
    {$or: [
      {certExpiryReminderSent: {$exists: false}},
      {certExpiryReminderSent: {$lt: moment().subtract(1, 'months').toDate()}}]}
  ]}, (err, users) => {
    if (err) throw err
    users.forEach((user) => {
      sendEmail({
        recipients: [user.emails[0]],
        subject: 'Luokittelusertifikaattisi on vanhentumassa',
        body: '<p>Tämä on KUVIn kuvaohjelmaluokittelujärjestelmästä (IKLU) lähetetty automaattinen muistutusviesti luokitteluoikeutesi päättymisestä. Luokitteluoikeutesi päättyy ' + moment(user.certificateEndDate).format('DD.MM.YYYY') + '.</p>' +
          '<p>Jos haluat jatkaa kuvaohjelmien luokittelua, on sinun osallistuttava KUVIn järjestämään kertauskoulutukseen ennen luokitteluoikeutesi viimeistä voimassaolopäivää. Tietoja kertauskoulutuksesta: https://kavi.fi/koulutukset-ja-tapahtumat/ tai meku@kuvi.fi</p>' +
          '<p>Kun kertauskoulutus on suoritettu hyväksytysti, jatketaan luokittelijatunnuksen (käyttäjätunnuksen) voimassaoloaikaa viidellä vuodella.</p>' +
          '<p>Jos kertauskoulutusta ei suoriteta luokittelijaoikeuden voimassaoloaikana, tunnus lakkaa toimimasta voimassaoloajan päätyttyä. Voit uusia luokittelulupasi käymällä kertauskoulutuksen myös sen jälkeen, kun luokittelijaoikeutesi on ehtinyt päättyä.</p>' +
          '<p>Tähän viestiin ei tarvitse reagoida, jos olet jo ilmoittautunut kertauskoulutukseen, olet äskettäin osallistunut kertauskoulutukseen tai et halua uusia luokittelulupaasi.</p>' +
          '<p>Älä vastaa tähän viestiin, vaan lähetä mahdolliset kysymykset osoitteeseen meku@kuvi.fi</p>' +

          '<p>Detta är en automatisk påminnelse om att dina klassificeringsrättigheter upphör från KUVIs system för klassificering av bilder (IKLU). Dina klassificeringsrättigheter upphör ' + moment(user.certificateEndDate).format('DD.MM.YYYY') + '.</p>' +
          '<p>Om du vill fortsätta att klassificera bildprogram ska du delta i KUVIs fortbildning innan dina klassificeringsrättigheter går ut. Information om fortbildningen: https://kavi.fi/koulutukset-ja-tapahtumat/ tai meku@kuvi.fi.</p>' +
          '<p>Efter fortbildningen förlängs klassificeringsrättigheterna (användarnamnet) med fem år.</p>' +
          '<p>Om du inte slutför fortbildningen under klassificeringsrättigheternas giltighetstid slutar användarnamnet att fungera när giltighetstiden går ut.  Du kan fönya din behörighet genom att delta i fortbildningen även efter att din klassificeringsbehörighet upphört.</p>' +
          '<p>Du behöver inte reagera på detta meddelande om du redan anmält dig till fortbildning, nyligen har deltagit i fortbildning eller inte vill förnya din klassificeringsbehörighet.</p>' +
          '<p>Svara inte på detta meddelande, utan skicka eventuella frågor till meku@kuvi.fi.</p>'
      }, undefined, (sendErr) => {
        if (sendErr) console.error(sendErr)
        else user.updateOne({certExpiryReminderSent: new Date()}, logError)
      })
    })
  })
})

function nocache (req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

function authenticate (req, res, next) {
  const optionalList = ['GET:/programs/', 'POST:/program/excel/export', 'GET:/episodes/', 'GET:/classification/criteria']
  const url = req.method + ':' + req.path
  if (url === 'GET:/') return next()
  if (isWhitelisted(req)) return next()
  const isOptional = _.some(optionalList, (p) => url.indexOf(p) === 0)
  const cookie = req.signedCookies.user
  if (cookie) {
    req.user = cookie
    req.user.ip = getIpAddress(req)
    return next()
  } else if (isOptional) {
    return next()
  }
  return res.sendStatus(403)
}

function authenticateXmlApi (req, res, next) {
  req.pause()
  Account.findOne({apiToken: req.params.token}).lean().exec((err, data) => {
    if (err) console.error(err)
    if (data) {
      req.account = data
      req.user = {username: 'xml-api', ip: getIpAddress(req)}
      return next()
    }
    res.sendStatus(403)
  })
}

function rejectNonHttpMethods (req, res, next) {
  if (['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].indexOf(req.method) === -1) res.sendStatus(405)
  else next()
}

function forceSSL (req, res, next) {
  // trust the proxy (Heroku) about X-Forwarded-Proto
  if (env.forceSSL && req.headers['x-forwarded-proto'] !== 'https') {
    if (req.method === 'GET') return res.redirect(301, 'https://' + req.get('host') + req.originalUrl)
    return res.status(403).send("Please use HTTPS")
  }
  return next()
}

function buildRevisionCheck (req, res, next) {
  const entryPoints = ['/', '/public.html', '/index.html', '/register-provider.html', '/reset-password.html', 'classification-criteria/.html']
  if (_.includes(entryPoints, req.path)) {
    res.cookie('build.revision', buildRevision)
  } else if (req.xhr && req.path !== '/templates.html') {
    const clientRevision = req.cookies['build.revision']
    if (!clientRevision || clientRevision !== buildRevision) {
      return res.sendStatus(418)
    }
  }
  next()
}

function setupUrlEncodedBodyParser () {
  const parser = bodyParser.urlencoded({parameterLimit: Infinity, arrayLimit: Infinity, limit: '10mb', extended: false})
  return (req, res, next) => (isUrlEncodedBody(req) ? parser(req, res, next) : next())
}

function setupCsrfMiddleware () {
  const csrfMiddleware = csrf({cookie: {httpOnly: true, secure: env.forceSSL, signed: true}})
  return (req, res, next) => (isWhitelisted(req) ? next() : csrfMiddleware(req, res, next))
}

function setCsrfTokenCookie (req, res, next) {
  if (req.csrfToken && req.method === 'GET') res.cookie('_csrf_token', req.csrfToken())
  next()
}

function requireRole (role) {
  return (req, res, next) => (utils.hasRole(req.user, role) ? next() : res.sendStatus(403))
}

function logErrorOrSendEmail (user) {
  return (err, email) => (err ? logError(err) : sendEmail(email, user, logError))
}

function sendEmail (opts, user, callback) {
  const msg = {
    from: opts.from || 'no-reply@kavi.fi',
    to: opts.recipients,
    bcc: opts.bcc,
    subject: opts.subject,
    html: opts.body
  }
  if (process.env.EMAIL_TO !== undefined) {
    msg.to = process.env.EMAIL_TO
  } else if (process.env.NODE_ENV === 'training') {
    if (!user) return callback()
    msg.to = user.email || user.emails[0]
  }

  if (env.sendEmail || process.env.EMAIL_TO !== undefined) {
    sendgrid.send(msg, callback)
  } else if (env.isTest) {
    testEnvEmailQueue.push(msg)
    return callback()
  } else {
    console.log('email (suppressed) to: ', opts.recipients, msg)
    return callback()
  }
}

function updateActorAndDirectorIndexes (program, callback) {
  schema.Actor.updateWithNames(program.actors, () => {
    schema.Director.updateWithNames(program.directors, callback)
  })
}

function updateMetadataIndexes (program, callback) {
  schema.ProductionCompany.updateWithNames(program.productionCompanies, () => {
    updateActorAndDirectorIndexes(program, callback)
  })
}

function queryNameIndex (schemaName) {
  return (req, res, next) => {
    const q = {}
    const parts = toMongoArrayQuery(req.query.q)
    if (parts) q.parts = parts
    schema[schemaName].find(q, {name: 1}).limit(parseInt(process.env.SELECT_DROPDOWN_SIZE || '100')).sort('name').lean().exec((err, docs) => {
      if (err) return next(err)
      res.send(_.map(docs || [], 'name'))
    })
  }
}

function toMongoArrayQuery (string) {
  const words = (string || '').trim().toLowerCase()
  return words ? {$all: words.match(/"[^"]*"|[^ ]+/g).map(toTerm)} : undefined

  function toTerm (s) {
    if ((/^".+"$/).test(s)) return s.substring(1, s.length - 1)
    return new RegExp('^' + utils.escapeRegExp(s))
  }
}

function respond (res, next, overrideData) {
  return (err, data) => {
    if (err) return next(err)
    res.send(overrideData || data)
  }
}

function updateTvSeriesClassificationIfEpisodeRemovedFromSeries (program, previousSeries, callback) {
  if (previousSeries && previousSeries._id && String(previousSeries._id) !== String(program.series._id)) {
    Program.updateTvSeriesClassification(previousSeries._id, callback)
  } else {
    callback()
  }
}

function updateInvoicerows (program, callback) {
  InvoiceRow.find({'program': program._id}, (err, invoiceRows) => {
    if (err) return callback(err)
    const billing = program.classifications.length > 0 ? program.classifications[0].billing : undefined
    async.forEach(invoiceRows, (invoiceRow, cb) => {
      if (invoiceRow.name !== _.first(program.name) || billing && invoiceRow.account.name !== billing.name) {
        invoiceRow.name = _.first(program.name)
        if (billing) {
          invoiceRow.account._id = billing._id
          invoiceRow.account.name = billing.name
        }
        invoiceRow.save(cb)
      } else cb()
    }, callback)
  })
}

function updateTvSeriesClassification (program, callback) {
  if (!enums.util.isTvEpisode(program)) return callback()
  const seriesId = program.series && program.series._id
  if (!seriesId) return callback()
  Program.updateTvSeriesClassification(seriesId, callback)
}

function verifyTvSeriesExistsOrCreate (program, user, callback) {
  if (enums.util.isTvEpisode(program) && !!program.series.name && !program.series._id) {
    const series = program.series || {}
    const draft = series.draft || {}
    const data = {
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

function getProviderBillingRows (data) {
  const accountRows = []

  data.providers.forEach((provider) => {
    const account = _.omit(provider, 'locations')
    const rows = _(provider.locations).filter({isPayer: false}).map((l) => _.map(l.providingType, (p) => utils.merge(l, {providingType: p, price: enums.providingTypePrices[p] * 100}))).flatten().value()
    accountRows.push({account: account, rows: rows})
  })

  data.locations.forEach((location) => {
    const rows = _.map(location.providingType, (p) => utils.merge(location, {providingType: p, price: enums.providingTypePrices[p] * 100}))
    accountRows.push({account: location, rows: rows})
  })
  return accountRows
}

function logError (err) {
  if (err) console.error(err)
}

function watchChanges (document, user, excludedLogPaths) {
  const oldObject = document.toObject()
  return {applyUpdates: applyUpdates, saveAndLogChanges: saveAndLogChanges, getChanges: getChanges}

  function applyUpdates (updates) {
    const flatUpdates = utils.flattenObject(updates)
    _.forEach(flatUpdates, (value, key) => document.set(key, value))
  }

  function saveAndLogChanges (callback) {
    const changedPaths = document.modifiedPaths().filter(isIncludedLogPath)
    document.save((err, saved) => {
      if (err) return callback(err)
      log(changedPaths, oldObject, saved, callback)
    })
  }

  function getChanges () {
    const changedPaths = document.modifiedPaths().filter(isIncludedLogPath)
    return asChanges(changedPaths, oldObject, document)
  }

  function isIncludedLogPath (p) {
    return document.isDirectModified(p) && document.schema.pathType(p) !== 'nested' && !_.includes(excludedLogPaths, p)
  }

  function log (changedPaths, oldDocument, updatedDocument, callback) {
    const changes = asChanges(changedPaths, oldDocument, updatedDocument)
    logUpdateOperation(user, updatedDocument, changes)
    callback(undefined, updatedDocument)
  }

  function asChanges (changedPaths, oldDocument, updatedDocument) {
    const newObject = updatedDocument.toObject()
    return _.zipObject(_(changedPaths).map(asPath).value(), _(changedPaths).map(asChange).value())

    function asPath (p) {
      return p.replace(/\./g, ',')
    }

    function asChange (p) {
      const newValue = utils.getProperty(newObject, p)
      const oldValue = utils.getProperty(oldDocument, p)
      if (_.isEqual(newValue, oldValue) || !oldValue && newValue === "") return []
      return {new: newValue, old: oldValue}
    }
  }
}

function updateAndLogChanges (document, updates, user, callback) {
  const watcher = watchChanges(document, user)
  watcher.applyUpdates(updates)
  watcher.saveAndLogChanges(callback)
}

function softDeleteAndLog (document, user, callback) {
  document.deleted = true
  document.save((err, doc) => {
    if (err) return callback(err)
    saveChangeLogEntry(user, doc, 'delete')
    callback(undefined, doc)
  })
}

function saveChangeLogEntry (user, document, operation, operationData) {
  const data = {
    user: {_id: user._id, username: user.username, ip: user.ip},
    date: new Date(),
    operation: operation,
    targetCollection: document ? document.constructor.modelName : undefined,
    documentId: document ? document._id : undefined
  }
  if (operationData) {
    _.merge(data, operationData)
  }
  new ChangeLog(data).save(logError)
}

function logCreateOperation (user, document) {
  saveChangeLogEntry(user, document, 'create')
}

function logUpdateOperation (user, document, updates) {
  saveChangeLogEntry(user, document, 'update', {updates: updates})
}

function getIpAddress (req) {
  const ipAddr = req.headers['x-forwarded-for']
  if (ipAddr) {
    const list = ipAddr.split(",")
    return list[list.length - 1]
  }
  return req.connection.remoteAddress
}

function isUrlEncodedBody (req) {
  const paths = ['POST:/.*/excel/export', 'POST:/kieku', 'POST:/providers/.*[Bb]illing/kieku']
  return _.some(_.map(paths, (p) => new RegExp(p).test(req.method + ':' + req.path)))
}

function isWhitelisted (req) {
  const whitelist = [
    'GET:/index.html', 'GET:/favicon.ico', 'GET:/robots.txt', 'GET:/public.html', 'GET:/templates.html', 'GET:/environment',
    'GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'GET:/xml/schema', 'GET:/apple-touch-icon',
    'POST:/login', 'POST:/logout', 'POST:/xml', 'POST:/forgot-password', 'GET:/reset-password.html',
    'POST:/reset-password', 'GET:/check-reset-hash', 'POST:/files/provider-import',
    'GET:/register-provider.html', 'GET:/KAVI-tarjoajaksi-ilmoittautuminen.xls', 'GET:/KAVI-koulutus-tarjoajaksi-ilmoittautuminen.xls',
    'GET:/upgrade-browser.html', 'GET:/emails/latest', 'GET:/directors/search', 'GET:/agelimit/'
  ]
  const url = req.method + ':' + req.path
  return _.some(whitelist, (p) => url.indexOf(p) === 0)
}

if (env.isDev) {
  const livereload = require('livereload')
  const server = livereload.createServer()
  server.watch(path.join(__dirname, '../client'))
}

let server

exports.start = function (callback) {
  mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl, {useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false, retryWrites: false, keepAlive: 300000, useUnifiedTopology: true})
    .then(() => {
      checkExpiredCerts.start()
      checkCertsExpiringSoon.start()
      server = app.listen(process.env.PORT || env.port, callback)
    })
    .catch((err) => callback(err))
}

exports.shutdown = function (callback) {
  mongoose.disconnect(() => server.close(callback))
}

if (!module.parent) {
  exports.start((err) => {
    if (err) throw err
    console.log('[' + env.name + '] Listening on port ' + server.address().port)
  })
}

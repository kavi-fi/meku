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
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var proe = require('../shared/proe')
var classification = require('../shared/classification')
var xml = require('./xml-import')
var sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
var builder = require('xmlbuilder')

express.static.mime.define({ 'text/xml': ['xsd'] })

var app = express()

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
  User.findOne({ username: username, active: { $ne: false } }, function(err, user) {
    if (err) return next(err)
    if (!user) return res.send(403)
    user.checkPassword(password, function(err, ok) {
      if (err) return next(err)
      if (!ok) return res.send(403)
      res.cookie('user', {
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        email: _.first(user.emails)
      }, { signed: true })
      res.send({})
    })
  })
})

app.post('/logout', function(req, res, next) {
  res.clearCookie('user')
  res.send({})
})

app.get('/programs/search/:q?', function(req, res, next) {
  var page = req.query.page || 0
  var filters = req.query.filters || []
  Program.find(query()).skip(page * 100).limit(100).sort('name').exec(respond(res, next))

  function query() {
    var q = { deleted: { $ne:true } }
    var nameQuery = toMongoArrayQuery(req.params.q)
    if (nameQuery) q.allNames = nameQuery
    if (filters.length > 0) q.programType = { $in: filters }
    return q
  }
})

app.get('/programs/:id', function(req, res, next) {
  Program.findById(req.params.id, respond(res, next))
})

app.post('/programs/new', function(req, res, next) {
  var programType = parseInt(req.body.programType)
  if (!enums.util.isDefinedProgramType(programType)) return res.send(400)

  var data = { classifications: [classification.createNew(req.user)], programType: programType }
  new Program(data).save(respond(res, next))
})

app.post('/programs/:id/register', function(req, res, next) {
  Program.findById(req.params.id, function(err, program) {
    if (err) return next(err)

    program.classifications[0].registrationDate = new Date()
    program.classifications[0].status = 'registered'
    program.classifications[0].author = { _id: req.user._id, name: req.user.name }

    verifyTvSeries(program, function(err) {
      if (err) return next(err)
      program.save(function(err) {
        if (err) return next(err)
        addInvoicerows(function(err, _) {
          if (err) return next(err)
          sendEmail(classification.registrationEmail(program, req.user), function(err) {
            if (err) return next(err)
            updateMetadataIndexes(program, function() {
              return res.send(program)
            })
          })
        })
      })
    })

    function verifyTvSeries(program, callback) {
      if (!enums.util.isTvEpisode(program)) return callback()
      createParentProgram(program, program.series.name.trim(), callback)
    }

    function addInvoicerows(callback) {
      var currentClassification = _.first(program.classifications)
      var seconds = durationToSeconds(currentClassification.duration)

      if (classification.isReclassification(program)) {
        // reclassification fee only when "Oikaisupyyntö" and KAVI is the classifier
        if (currentClassification.reason === 3 && currentClassification.authorOrganization === 1) {
          InvoiceRow.fromProgram(program, 'reclassification', seconds, 74 * 100).save(callback)
        } else {
          callback(null)
        }
      } else {
        InvoiceRow.fromProgram(program, 'registration', seconds, 725).save(function(err, saved) {
          if (err) return next(err)
          if (utils.hasRole(req.user, 'kavi')) {
            // duraation mukaan laskutus
            var classificationPrice = classification.price(program, seconds)
            InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback)
          } else {
            callback(null)
          }
        })
      }
    }

  })
})

app.post('/programs/:id/reclassification', function(req, res, next) {
  // create new program.classifications
  Program.findById(req.params.id, function(err, program) {
    if (err) next(err)
    getRegistrationEmailsFromPreviousClassification(program, function(err, emails) {
      if (err) return next(err)
      var newClassification = classification.createNew(req.user)
      newClassification.registrationEmailAddresses = emails
      program.classifications = [newClassification].concat(program.classifications)
      program.save(respond(res, next))
    })
  })

  function getRegistrationEmailsFromPreviousClassification(program, callback) {
    var ids = _.uniq(_.reduce(program.classifications, function(acc, c) {
      return acc.concat(c.buyer && c.buyer._id ? [c.buyer._id] : []).concat(c.billing && c.billing._id ? [c.billing._id] : [])
    }, []))

    if (ids.length > 0) {
      Account.find({_id: {$in: ids}}).select('emailAddresses').exec(function(err, accounts) {
        if (err) return callback(err)
        var emails = _(accounts).map(function(a) { return a.emailAddresses }).flatten()
          .map(function(e) { return {email: e, manual: false}}).value()
        callback(null, emails)
      })
    } else {
      callback(null, [])
    }
  }

})

app.post('/programs/:id', function(req, res, next) {
  Program.findByIdAndUpdate(req.params.id, req.body, null, function(err, program) {
    if (err) return next(err)
    program.populateAllNames(function(err) {
      if (err) return next(err)
      program.save(respond(res, next))
    })
  })
})

app.get('/series/search/:query', function(req, res, next) {
  var q = { programType: 2 }
  var parts = toMongoArrayQuery(req.params.query)
  if (parts) q.allNames = parts
  Program.find(q, { name: 1 }).lean().limit(20).sort('name').exec(function(err, data) {
    if (err) return next(err)
    res.send(_.map(data, function(d) { return { _id: d._id, name: d.name[0] } }))
  })
})

app.get('/accounts/search/:query', function(req, res, next) {
  var roles = req.query.roles ? req.query.roles.split(',') : []
  Account.find({name: new RegExp("^" + req.params.query, 'i'), roles: { $in: roles }}).limit(20).exec(respond(res, next))
})

app.get('/accounts/:id', function(req, res, next) {
  Account.findById(req.params.id, respond(res, next))
})

app.get('/actors/search/:query', queryNameIndex('Actor'))
app.get('/directors/search/:query', queryNameIndex('Director'))
app.get('/productionCompanies/search/:query', queryNameIndex('ProductionCompany'))

app.get('/invoicerows/:begin/:end', function(req, res, next) {
  var format = "DD.MM.YYYY"
  var begin = moment(req.params.begin, format)
  var end = moment(req.params.end, format).add('days', 1)
  InvoiceRow.find({registrationDate: {$gte: begin, $lt: end}}).sort('registrationDate').exec(respond(res, next))
})

app.post('/proe', express.urlencoded(), function(req, res, next) {
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

    function verifyValidAuthor(program, callback) {
      var userName = program.classifications[0].author.name
      var user = _.find(req.account.users, { name: userName })
      if (user) {
        program.classifications[0].author._id = user._id
        User.findOne({ username: userName, active: true }, { _id: 1 }).lean().exec(function(err, doc) {
          if (err) return callback(err)
          if (doc) {
            return callback()
          } else {
            return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + userName)
          }
        })
      } else {
        return writeErrAndReturn("Virheellinen LUOKITTELIJA: " + userName)
      }
    }

    function verifyParentProgram(program, callback) {
      if (!enums.util.isTvEpisode(program)) return callback()
      var parentName = program.parentTvSeriesName.trim()
      Program.findOne({ programType: 2, name: parentName }, function(err, parent) {
        if (err) return callback(err)
        if (!parent) {
          createParentProgram(program, parentName, callback)
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

function createParentProgram(program, parentName, callback) {
  var parent = new Program({ programType: 2, name: [parentName] })
  parent.populateAllNames(function(err) {
    if (err) return callback(err)
    parent.save(function(err, saved) {
      if (err) return callback(err)
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

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

function authenticate(req, res, next) {
  var whitelist = ['GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'GET:/xml/schema', 'POST:/login', 'POST:/logout', 'POST:/xml']
  var url = req.method + ':' + req.path
  if (url == 'GET:/') return next()
  var isWhitelistedPath = _.any(whitelist, function(p) { return url.indexOf(p) == 0 })
  if (isWhitelistedPath) return next()
  var cookie = req.signedCookies.user
  if (cookie) {
    req.user = cookie
    return next()
  }
  return res.send(403)
}

function authenticateXmlApi(req, res, next) {
  req.pause()
  Account.findOne({apiToken: req.params.token}).lean().exec(function(err, data) {
    if (data) {
      req.account = data
      return next()
    } else {
      res.send(403)
    }
  })
}

function sendEmail(data, callback) {
  var email = new sendgrid.Email({ from: 'no-reply@kavi.fi', subject: data.subject, html: data.body })
  data.recipients.forEach(function(to) { email.addTo(to) })

  if (process.env.NODE_ENV === 'production') {
    sendgrid.send(email, callback)
  } else {
    console.log('email (suppressed): ', email)
    return callback()
  }
}

function isDev() {
  return process.env.NODE_ENV == undefined || process.env.NODE_ENV == 'dev'
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
    var parts = toMongoArrayQuery(req.params.query)
    if (parts) q.parts = parts
    schema[schemaName].find(q, { name: 1 }).limit(100).sort('name').exec(function(err, docs) {
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

function respond(res, next) {
  return function(err, data) {
    if (err) return next(err)
    res.send(data)
  }
}

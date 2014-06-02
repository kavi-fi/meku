var express = require('express')
var _ = require('lodash')
var async = require('async')
var path = require('path')
var mongoose = require('mongoose')
var schema = require('./schema')
var Program = schema.Program
var User = schema.User
var Account = schema.Account
var InvoiceRow = schema.InvoiceRow
var enums = require('../shared/enums')
var utils = require('../shared/utils')
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

app.get('/programs/search/:q?', function(req, res) {
  var page = req.query.page || 0
  var filters = req.query.filters || []
  Program.find(query()).skip(page * 100).limit(100).sort('name').exec(function(err, results) {
    res.send(results)
  })

  function query() {
    var q = { deleted: { $ne:true } }
    var nameQuery = toMongoArrayQuery(req.params.q)
    if (nameQuery) q['all-names'] = nameQuery
    if (filters.length > 0) q['program-type'] = { $in: filters }
    return q
  }
})

app.get('/programs/:id', function(req, res) {
  Program.findById(req.params.id, function(err, program) { res.send(program) })
})

app.post('/programs/new', function(req, res, next) {
  var programType = parseInt(req.body['program-type'])
  if (!enums.util.isDefinedProgramType(programType)) return res.send(400)

  var data = { classifications: [classification.createNew(req.user)], 'program-type': programType }
  new Program(data).save(function(err, program) {
    if (err) return next(err)
    return res.send(program)
  })
})

app.post('/programs/:id/register', function(req, res, next) {
  var data = {
    'classifications.0.registration-date': new Date(),
    'classifications.0.status': 'registered',
    'classifications.0.author': { _id: req.user._id, name: req.user.name }
  }
  Program.findByIdAndUpdate(req.params.id, data, null, function(err, program) {
    if (err) return next(err)

    function addInvoicerows(callback) {
      var currentClassification = _.first(program.classifications)
      var parts = /(?:(\d+)?:)?(\d+):(\d+)$/.exec(currentClassification.duration)
        .slice(1).map(function (x) { return x === undefined ? 0 : parseInt(x) })
      var seconds = (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2]

      if (classification.isReclassification(program)) {
        // reclassification fee only when "Oikaisupyyntö" and KAVI is the classifier
        if (currentClassification.reason === 2 && currentClassification.authorOrganization === 1) {
          InvoiceRow.fromProgram(program, 'reclassification', seconds, 74 * 100).save(callback)
        } else {
          callback(null)
        }
      } else {
        InvoiceRow.fromProgram(program, 'registration', seconds, 725).save(function(err, saved) {
          if (err) return next(err)
          if (req.user.role === 'kavi') {
            // duraation mukaan laskutus
            var classificationPrice = classification.classificationPrice(parseInt(seconds))
            InvoiceRow.fromProgram(program, 'classification', seconds, classificationPrice).save(callback)
          } else {
            callback(null)
          }
        })
      }
    }

    addInvoicerows(function(err, _) {
      if (err) return next(err)
      sendEmail(classification.registrationEmail(program, req.user), function(err) {
        if (err) return next(err)
        updateActorAndDirectorIndexes(program, function() {
          return res.send(program)
        })
      })
    })
  })
})

app.post('/programs/:id/reclassification', function(req, res, next) {
  // create new program.classifications
  Program.findById(req.params.id, function(err, program) {
    if (err) next(err)
    program.classifications = [classification.createNew(req.user)].concat(program.classifications)
    program.save(function(err, saved) {
      if (err) next(err)
      res.send(saved)
    })
  })
})

app.post('/programs/:id', function(req, res, next) {
  Program.findByIdAndUpdate(req.params.id, req.body, null, function(err, program) {
    if (err) return next(err)
    program.populateAllNames(function(err) {
      if (err) return next(err)
      program.save(function(err) {
        if (err) return next(err)
        return res.send(program)
      })
    })
  })
})

app.get('/accounts/search/:query', function(req, res, next) {
  var roles = req.query.roles ? req.query.roles.split(',') : []
  Account.find({name: new RegExp("^" + req.params.query, 'i'), roles: { $in: roles }}).limit(20).exec(function(err, data) {
    return res.send(data)
  })
})

app.get('/accounts/:id', function(req, res, next) {
  Account.findById(req.params.id, function(err, account) { res.send(account) })
})

app.get('/actors/search/:query', queryNameIndex('Actor'))
app.get('/directors/search/:query', queryNameIndex('Director'))

app.post('/xml/v1/programs/:token', function(req, res, next) {
  xml.readPrograms(req, function(err, programs) {
    var root = builder.create("ASIAKAS")
    async.eachSeries(programs, function(data, callback) {
      var program = data.program
      var ele = root.ele('KUVAOHJELMA')
      ele.ele('ASIAKKAANTUNNISTE', program.customerId)
      ele.ele('STATUS', data.errors.length > 0 ? 'VIRHE' : 'OK')
      data.errors.forEach(function(msg) {
        var error = ele.ele('VIRHE')
        error.ele('KOODI', 'N/A')
        error.ele('SELITYS', msg)
      })
      
      if (data.errors.length == 0) {
        var now = new Date()
        var p = new Program(program)
        p.classifications[0].status = 'registered'
        p.classifications[0]['creation-date'] = now
        p.populateAllNames(function(err) {
          if (err) return next(err)
          p.save(function(err, saved) {
            if (err) return next(err)
            callback()
          })
        })
      } else {
        callback()
      }

    }, function(err) {
      if (err) throw new Error(err)
      res.set('Content-Type', 'application/xml');
      res.send(root.end({ pretty: true, indent: '  ', newline: '\n' }))
    })
  })
})

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
  var whitelist = ['GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'POST:/login', 'POST:/logout', 'POST:/xml']
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

function queryNameIndex(schemaName) {
  return function(req, res) {
    var q = {}
    var parts = toMongoArrayQuery(req.params.query)
    if (parts) q.parts = parts
    schema[schemaName].find(q, { name: 1 }).limit(100).sort('name').exec(function(err, docs) {
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

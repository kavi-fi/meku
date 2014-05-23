var express = require('express')
var _ = require('lodash')
var path = require('path')
var mongoose = require('mongoose')
var schema = require('./schema')
var Movie = schema.Movie
var User = schema.User
var Account = schema.Account
var InvoiceRow = schema.InvoiceRow
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var classification = require('../shared/classification')
var sendgrid  = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

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
      res.cookie('user', { _id: user._id.toString(), username: user.username, name: user.name, role: user.role }, { signed: true })
      res.send({})
    })
  })
})

app.post('/logout', function(req, res, next) {
  res.clearCookie('user')
  res.send({})
})

app.get('/movies/search/:q?', function(req, res) {
  var page = req.query.page || 0
  var filters = req.query.filters || []
  Movie.find(query()).skip(page * 100).limit(100).sort('name').exec(function(err, results) {
    res.send(results)
  })

  function query() {
    var q = { deleted: { $ne:true } }
    var words = (req.params.q || '').trim().toLowerCase()
    if (words != '') {
      q['all-names'] = { $all: words.split(/\s+/).map(toTerm) }
    }
    if (filters.length > 0) {
      q['program-type'] = { $in: filters }
    }
    return q
  }

  function toTerm(s) {
    if (/^".+"$/.test(s)) {
      return s.substring(1, s.length - 1)
    } else {
      return new RegExp('^' + utils.escapeRegExp(s))
    }
  }
})

app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  var programType = parseInt(req.body['program-type'])
  if (!enums.util.isDefinedProgramType(programType)) return res.send(400)

  var data = { classifications: [classification.createNew(req.user)], 'program-type': programType }
  new Movie(data).save(function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.post('/movies/:id/register', function(req, res, next) {
  var data = {
    'classifications.0.registration-date': new Date(),
    'classifications.0.status': 'registered',
    'classifications.0.author': { _id: req.user._id, name: req.user.name }
  }

  Movie.findByIdAndUpdate(req.params.id, data, null, function(err, movie) {
    if (err) return next(err)
    InvoiceRow.create({
      account: movie.billing,
      type: 'registration',
      movie: movie._id,
      name: movie.name,
      duration: movie.duration,
      'registration-date': movie.classifications[0]['registration-date'],
      price: 700
    }, function(err, saved) {
      if (err) return next(err)

      if (process.env.NODE_ENV === 'production') {
        var data = classification.registrationEmail(movie, req.user)
        var email = new sendgrid.Email({
          from    : 'no-reply@kavi.fi',
          subject : data.subject,
          text    : data.body
        })
        data.recipients.forEach(function(to) {
          email.addTo(to)
        })
        sendgrid.send(email, function(err, json) {
          if (err) next(err)
        });
      }

      return res.send(movie)
    })
  })
})

app.post('/movies/:id/reclassification', function(req, res, next) {
  // create new movie.classifications
  Movie.findById(req.params.id, function(err, movie) {
    if (err) next(err)
    movie.classifications = [classification.createNew(req.user)].concat(movie.classifications)
    movie.save(function(err, saved) {
      if (err) next(err)
      res.send(saved)
    })
  })
})

app.post('/movies/:id', function(req, res, next) {
  Movie.findByIdAndUpdate(req.params.id, req.body, null, function(err, movie) {
    if (err) return next(err)
    movie.populateAllNames(function(err) {
      if (err) return next(err)
      movie.save(function(err) {
        if (err) return next(err)
        return res.send(movie)
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

app.get('/actors/search/:query', function(req, res, next) {
  Movie.aggregate([
    {$unwind: '$actors'},
    {$match: {actors: new RegExp("\\b" + req.params.query, 'i')}},
    {$project: {actors: 1}},
    {$group: {_id: "$actors"}}
  ]).exec(function(err, data) {
      return res.send(data.reduce(function(acc, doc) {
        return acc.concat([doc._id])
      }, []))
    })
})

app.get('/directors/search/:query', function(req, res, next) {
  if (req.params.query.length < 3) return res.send([])
  else {
    Movie.aggregate([
      {$unwind: '$directors'},
      {$match: {directors: new RegExp("\\b" + req.params.query, 'i')}},
      {$project: {directors: 1}},
      {$group: {_id: "$directors"}}
    ]).exec(function(err, data) {
        return res.send(data.reduce(function(acc, doc) {
          return acc.concat([doc._id])
        }, []))
      })
  }
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
  var whitelist = ['GET:/vendor/', 'GET:/shared/', 'GET:/images/', 'GET:/style.css', 'GET:/js/', 'POST:/login', 'POST:/logout']
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

function isDev() {
  return process.env.NODE_ENV == undefined || process.env.NODE_ENV == 'dev'
}

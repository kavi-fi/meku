var express = require('express')
var _ = require('lodash')
var path = require('path')
var mongoose = require('mongoose')
var schema = require('./schema')
var Movie = schema.Movie
var Account = schema.Account
var InvoiceRow = schema.InvoiceRow
var enums = require('../shared/enums')
var utils = require('../shared/utils')

var app = express()

app.use(express.json())

mongoose.connect('mongodb://localhost/meku')

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
  var data = {
    classifications: [{ 'creation-date':new Date(), status: 'in_process' }],
    'program-type': req.body['program-type'] || 0,
    'production-companies': [],
    actors: []
  }

  new Movie(data).save(function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.post('/movies/:id/register', function(req, res, next) {
  var data = {
    'classifications.0.registration-date': new Date(),
    'classifications.0.status': 'registered'
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
      price: 700,
    }, function(err, saved) {
      if (err) return next(err)
      return res.send(movie)
    })
  })
})

app.post('/movies/:id', function(req, res, next) {
  Movie.findByIdAndUpdate(req.params.id, req.body, null, function(err, movie) {
    if (err) return next(err)
    movie.populateAllNames()
    movie.save(function(err) {
      if (err) return next(err)
      return res.send(movie)
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

app.use(nocache)
app.use(express.static(path.join(__dirname, '../client')))
app.use('/shared', express.static(path.join(__dirname, '../shared')))

if (process.env.NODE_ENV === 'dev') {
  var liveReload = require('express-livereload')
  liveReload(app, { watchDir: path.join(__dirname, '../client') })
}


var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

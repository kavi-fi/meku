var express = require('express')
var _ = require('lodash')
var path = require('path')
var mongoose = require('mongoose')
var liveReload = require('express-livereload')
var schema = require('./schema')
var Movie = schema.Movie
var Account = schema.Account
var InvoiceRow = schema.InvoiceRow
var enums = require('../shared/enums')

var app = express()

app.use(express.json())

mongoose.connect('mongodb://localhost/meku')

app.get('/movies/search/:page/:q?', function(req, res) {
  var page = req.params.page || 0
  Movie.find(query()).skip(page * 100).limit(100).sort('name').exec(function(err, results) {
    res.send(results)
  })

  function query() {
    var q = (req.params.q || '').trim().toLowerCase().split(/\s+/)
    if (q.length == 1 && q[0] == '') return { 'name': /^a/i }
    var regexps = q.map(function(s) { return new RegExp('^' + escapeRegExp(s)) })
    return { 'all-names': { $all: regexps } }
  }
})

app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  new Movie({ classifications: [{ 'creation-date':new Date(), status: 'in_process' }], 'production-companies': [], actors: [] }).save(function(err, movie) {
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

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
}

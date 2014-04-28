var express = require('express')
var path = require('path')
var mongoose = require('mongoose')
var liveReload = require('express-livereload')
var schema = require('./schema')
var Movie = schema.Movie
var Account = schema.Account

var app = express()

app.use(express.json())

mongoose.connect('mongodb://localhost/meku')

app.get('/movies/search/:q', function(req, res) {
  var q = req.params.q
  var regexp = new RegExp("\\b" + q, 'i')
  Movie.find({ $or: [ { name: regexp }, { 'name-fi': regexp }, { 'name-sv': regexp } ] }, { name:1, 'name-fi':1, 'name-sv': 1 }, function(err, results) {
    res.send(results)
  })
})


app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  new Movie({ classifications: [{}], 'production-companies': [], actors: [] }).save(function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.post('/movies/:id', function(req, res, next) {
  Movie.findByIdAndUpdate(req.params.id, req.body, null, function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.get('/production-companies/:query', function(req, res, next) {
  Movie.aggregate([
      { $unwind: '$production-companies'},
      { $match: { 'production-companies': new RegExp("^" + req.params.query, 'i') } },
      { $project: { 'production-companies': 1 } },
      { $group: {_id: '$production-companies' } }
    ]).exec(function(err, data) {
      return res.send(data.reduce(function(acc, doc) {
        return acc.concat([doc._id])
      }, []))
    })
})

app.get('/accounts/:query', function(req, res, next) {
  Account.find({name: new RegExp("^" + req.params.query, 'i')}).limit(20).exec(function(err, data) {
    return res.send(data)
  })
})

app.get('/actors/:query', function(req, res, next) {
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

app.get('/directors/:query', function(req, res, next) {
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

app.use(express.static(path.join(__dirname, '../client')))

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})


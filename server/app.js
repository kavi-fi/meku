var express = require('express')
var path = require('path')
var mongoose = require('mongoose')
var liveReload = require('express-livereload')
var schema = require('./schema')
var Movie = schema.Movie
var ProductionCompany = schema.ProductionCompany

var app = express()

app.use(express.json())

mongoose.connect('mongodb://localhost/meku')

app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  new Movie({ classifications: [{}], 'production-companies': [] }).save(function(err, movie) {
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

app.get('/production-companies', function(req, res, next) {
  ProductionCompany.find({}, function(err, all) {
    if (err) return next(err)
    return res.send(all)
  })
})

app.get('/production-companies/:query', function(req, res, next) {
  ProductionCompany.find({name: new RegExp("^" + req.params.query, 'i')}).limit(20).exec(function(err, data) {
    return res.send(data)
  })
})

app.use(express.static(path.join(__dirname, '../client')))

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})


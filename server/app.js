var express = require('express')
var path = require('path')
var mongoose = require('mongoose')
var liveReload = require('express-livereload')

var app = express()

app.use(express.json())

mongoose.connect('mongodb://localhost/meku')

var classification = {
  author: String,
  buyer: String,
  billing: String,
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number]
}
var Movie = mongoose.model('movies', {
  name: String,
  'name-fi': String,
  'name-sv': String,
  country: String,
  year: Number,
  'production-companies': [String],
  genre: String,
  directors: [String],
  actors: [String],
  synopsis: String,
  classifications: [classification]
})

app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  new Movie({ classifications: [{}] }).save(function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.post('/movies/:id', function(req, res, next) {
  Movie.findByIdAndUpdate(req.params.id, req.body, null, function(err) {
    if (err) return next(err)
    return res.send({})
  })
})

app.use(express.static(path.join(__dirname, '../client')))

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})
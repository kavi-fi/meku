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
  criteria: [Number],
  comments: {}
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

var ProductionCompany = mongoose.model('production_companies', {
  name: String
})

app.get('/movies/:id', function(req, res) {
  Movie.findById(req.params.id, function(err, movie) { res.send(movie) })
})

app.post('/movies/new', function(req, res, next) {
  new Movie({ classifications: [{}], 'production-companies': [""] }).save(function(err, movie) {
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

app.get('/production_companies', function(req, res, next) {
  ProductionCompany.find({}, function(err, all) {
    if (err) return next(err)
    return res.send(all)
  })
})

app.use(express.static(path.join(__dirname, '../client')))

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
  importProductionCompanies()
})

function importProductionCompanies() {
  ProductionCompany.remove({}, function(err) { })

  // update production companies
  var fs = require('fs')
  fs.readFile(path.join(__dirname, '../data/meku-production-companies-samples.txt'), {encoding: 'utf8'}, function(err, data) {
    if (err) throw err;

    var companies = data.split('\n').filter(function (x) { return x.length > 0 })

    companies.forEach(function(name) {
      new ProductionCompany({name: name}).save(function(err, comp) {
        if (err) throw err
      })
    })
  })
}

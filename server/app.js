var express = require('express')
var path = require('path')
var mongoose = require('mongoose')
var liveReload = require('express-livereload')

var app = express()

mongoose.connect('mongodb://localhost/meku')
var Movie = mongoose.model('movies', { name: String })

app.post('/movies/new', function(req, res, next) {
  (new Movie()).save(function(err, movie) {
    if (err) return next(err)
    return res.send(movie)
  })
})

app.use(express.static(path.join(__dirname, '../client')))

liveReload(app, { watchDir: path.join(__dirname, '../client') })

var server = app.listen(3000, function() {
  console.log('Listening on port ' + server.address().port)
})
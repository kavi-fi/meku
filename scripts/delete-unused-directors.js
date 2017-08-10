// Usage: [MONGOHQ_URL=...] node ./ldelete-unused-directors.js
//
// It takes about 100 seconds to run the script remotely over 200000 programs (85000 directors, 25000 unique)

var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var Program = schema.Program
var Director = schema.Director
var _ = require('lodash')
var suspicious = 0
var deleted = 0

function isSuspicious(name) {
  return name.length < 6 || name.split(' ').length < 2 || _.find(name.split(' '), function (n) { return n.length < 3 }) != undefined
}

mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)

var directors = []
var programStream = Program.find({deleted: {$ne: true}}, {directors: 1}).stream()

programStream.on('data', function (data) {
  directors = directors.concat(data.directors)
})

programStream.on('error', function (err) {
  console.error('Error: ' + err)
})

programStream.on('close', function () {
  console.info('Directors on programs', directors.length)
  directors = _.uniq(directors)
  console.info('Unique directors on programs', directors.length)
  var directorStream = Director.find({}, {_id:1,name:1}).stream()

  directorStream.on('data', function (director) {
    if (!_.includes(directors, director.name)) {
      directorStream.pause()
      Director.remove({name: director.name}, function (err) {
        if (err) console.error(err)
        else {
          console.info('Removed unused: ' + director.name)
          deleted++
        }
        directorStream.resume()
      })
    } else if (isSuspicious(director.name)) {
      console.info('Suspicious (not removed): "' + director.name + '"')
      suspicious++
    }
  })

  directorStream.on('error', function (err) {
    console.error('Error: ' + err)
  })

  directorStream.on('close', function () {
    console.info('Deleted: ' + deleted)
    console.info('Suspicious: ' + suspicious)
    mongoose.disconnect()
  })
})

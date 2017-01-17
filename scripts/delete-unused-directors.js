// Usage: [MONGOHQ_URL=...] node ./ldelete-unused-directors.js

var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var Program = schema.Program
var Director = schema.Director
var _ = require('lodash')
var count = 0
var suspicious = 0
var deleted = 0

function isSuspicious(name) {
  return name.length < 6 || name.split(' ').length < 2 || _.find(name.split(' '), function (n) { return n.length < 3 }) != undefined
}

mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)

Director.count({}, function (err, total) {
  if (err) return console.error(err)

  var stream = Director.find({}).stream()

  stream.on('data', function (director) {
    stream.pause()
    Program.find({deleted: {$ne: true}, directors: {$in: [director.name]}}, function (err, data) {
      if (err) console.error(err)
      if (++count % 100 == 0) console.info('Processed ' + count + '/' + total)
      if (data.length == 0) {
        Director.remove({name: director.name}, function (err) {
          if (err) console.error(err)
          else {
            console.info('Removed unused: ' + director.name)
            deleted++
          }
          stream.resume()
        })
      } else if (isSuspicious(director.name)) {
        console.info('Suspicious (not removed): ' + director.name)
        suspicious++
        stream.resume()
      } else {
        stream.resume()
      }
    })
  })

  stream.on('error', function (err) {
    console.error('Error: ' + err)
  })

  stream.on('close', function () {
    console.info('Deleted: ' + deleted)
    console.info('Suspicious: ' + suspicious)
    mongoose.disconnect()
  })
})


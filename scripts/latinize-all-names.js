// Usage: [MONGOHQ_URL=...] node ./latinize-all-names.js

var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var async = require('async')
var _ = require('lodash')
var latinize = require('latinize')
var Program = schema.Program
var count = 0

mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)

var stream = Program.find({deleted:{$ne: true}}).stream()
stream.on('data', function (program) {
  var allNames = program.allNames
  var latinizedNames = _.map(allNames, function (word) { return latinize(word) })
  var newAllNames = _.union(allNames, latinizedNames)
  if (allNames.length !== newAllNames.length) {
    stream.pause()
    program.populateAllNames(function (err) {
      if (err) console.info(err)
      else program.save(function (err, p) {
        if (err) console.error(err)
        else {
          count++
          if (count % 100 === 0) console.info('Saved: ' + count)
        }
      })
      stream.resume()
    })
  }
})

stream.on('error', function (err) {
  console.error('Error: ' + err)
})

stream.on('close', function () {
  console.info('done')
  mongoose.disconnect()
})

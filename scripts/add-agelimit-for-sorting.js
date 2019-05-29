// Usage: [MONGOHQ_URL=...] node ./add-agelimit-for-sorting.js

var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var Program = schema.Program
var enums = require('../shared/enums')

mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl, {bufferCommands: false})

var stream = Program.find({agelimitForSorting: {$exists: 0}}).cursor()

stream.on('data', function (program) {
    var agelimitForSorting = enums.util.isTvSeriesName(program) ? program.series.agelimit : program.classifications && program.classifications.length > 0 ? program.classifications[0].agelimit : 0
    stream.pause()
    program.agelimitForSorting = agelimitForSorting
    program.save(function (err) {
        if (err) console.error(err)
        stream.resume()
    })
})

stream.on('error', function (err) {
    console.error('Error: ' + err)
})

stream.on('close', function () {
    console.info('done')
    setTimeout(() => mongoose.disconnect(), 5000)
})

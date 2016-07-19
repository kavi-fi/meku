// Usage: [MONGOHQ_URL=...] node ./update-classification-warnings-series.js  

var env = require('../server/env').get()
var mongoose = require('mongoose')
var schema = require('../server/schema')
var Program = schema.Program
var count = 0
mongoose.connect(process.env.MONGOHQ_URL || env.mongoUrl)
var counter = 0
var stream = Program.find({programType: 2, deleted: {$ne: true}}).stream()
stream.on('data', function (program) {
    stream.pause()
    Program.updateTvSeriesClassification(program._id, function () {
        count++
        if (count % 100 === 0) console.info('Saved: ' + count)
        stream.resume()
    })
})
stream.on('error', function (err) {
    console.error('Error: ' + err)
})
stream.on('close', function () {
    console.info('done')
    mongoose.disconnect()
})     

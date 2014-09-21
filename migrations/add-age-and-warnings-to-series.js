var async = require('async')
var schema = require('../server/schema')
var u = require('./util')
var tick = u.progressMonitor(10)

u.connectMongoose()

schema.Program.find({ programType: 2 }, { _id:1 }).lean().exec(function(err, series) {
  async.eachLimit(_.pluck(series, '_id'), 10, function(id, callback) {
    tick()
    schema.Program.updateTvSeriesClassification(id, callback)
  }, u.done)
})

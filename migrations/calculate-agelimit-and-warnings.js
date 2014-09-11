var async = require('async')
var schema = require('../server/schema')
var u = require('./util')
var tick = u.progressMonitor()

u.mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/meku')

schema.Program.find({}).stream().pipe(u.consumer(each, u.done))

function each(p, callback) {
  tick()
  p.classifications.forEach(function(c) {
    schema.Program.updateClassificationSummary(c)
  })
  p.save(callback)
}


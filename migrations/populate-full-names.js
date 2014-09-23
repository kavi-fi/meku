var schema = require('../server/schema')
var u = require('./util')
var tick = u.progressMonitor()

u.connectMongoose()

schema.Program.find({}).stream().pipe(u.consumer(each, u.done))

function each(p, callback) {
  tick()
  p.populateAllNames(function(err) {
    if (err) return callback(err)
    p.save(callback)
  })
}

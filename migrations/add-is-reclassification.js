var schema = require('../server/schema')
var u = require('./util')
var tick = u.progressMonitor(10)

u.connectMongoose()

updateSingle(function(err) {
  if (err) throw err
  updateDual(function(err) {
    if (err) throw err
    updateRest(u.done)
  })
})

function updateSingle(callback) {
  schema.Program.update(
    { classifications: { $size: 1 } },
    { $set: { 'classifications.0.isReclassification': false } },
    { multi: true },
    callback
  )
}

function updateDual(callback) {
  schema.Program.update(
    { classifications: { $size: 2 } },
    { $set: { 'classifications.0.isReclassification': true, 'classifications.1.isReclassification': false } },
    { multi: true },
    callback
  )
}

function updateRest(callback) {
  schema.Program.find({ 'classifications.2': { $exists: true } }).stream().pipe(u.consumer(each, callback))

  function each(p, callback) {
    tick()
    p.classifications.forEach(function(c, index) {
      c.isReclassification = index < (p.classifications.length - 1)
    })
    p.save(callback)
  }
}
var stream = require('stream')
var mongoose = require('mongoose')

exports.mongoose = mongoose

exports.connectMongoose = function() {
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/meku')
}

exports.progressMonitor = function(num) {
  var ii = 0
  var tick = num || 250
  return function(char) {
    if (ii++ % tick == 0) process.stdout.write(char || '.')
  }
}
exports.consumer = function(onRow, callback) {
  var s = new stream.Writable({ objectMode: true })
  s._write = function(row, enc, cb) { onRow(row, cb) }
  s.on('finish', callback)
  return s
}

exports.done = function(err) {
  if (err) throw err
  mongoose.disconnect(function() {
    console.log('DONE.')
  })
}
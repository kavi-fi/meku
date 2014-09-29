var fs = require('fs')

exports.getTemplate = (function() {
  var templateCache = {}
  return function(filename, callback) {
    if (templateCache[filename]) {
      process.nextTick(callback.bind(null, null, templateCache[filename]))
      return
    }
    fs.readFile('./server/templates/' + filename, 'utf-8', function(err, data) {
      if (err) return callback(err)
      templateCache[filename] = data
      return callback(null, data)
    })
  }
})()

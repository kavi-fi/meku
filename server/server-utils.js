var fs = require('fs')
var _ = require('lodash')
var moment = require('moment')

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

exports.currentPrices = function currentPrices() {
  var pricesExistingYear = _.find(_.range(moment().year(), 2015, -1), function (y) { return process.env['PRICES_' + y] != undefined })
  if (!pricesExistingYear) console.warn('Cannot find prices from config variable, using (possibly outdated) defaults')
  return pricesExistingYear ? JSON.parse(process.env['PRICES_' + pricesExistingYear]) : enums.defaultPrices
}

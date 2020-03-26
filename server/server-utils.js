const fs = require('fs')
const _ = require('lodash')
const moment = require('moment')
const enums = require('../shared/enums')

exports.getTemplate = (function () {
  const templateCache = {}
  return function (filename, callback) {
    if (templateCache[filename]) {
      process.nextTick(callback.bind(null, null, templateCache[filename]))
      return
    }
    fs.readFile('./server/templates/' + filename, 'utf-8', (err, data) => {
      if (err) return callback(err)
      templateCache[filename] = data
      return callback(null, data)
    })
  }
})()

exports.currentPrices = function currentPrices() {
  const pricesExistingYear = _.find(_.range(moment().year(), 2015, -1), (y) => process.env['PRICES_' + y] !== undefined)
  if (!pricesExistingYear) console.warn('Cannot find prices from config variable, using (possibly outdated) defaults')
  return pricesExistingYear ? JSON.parse(process.env['PRICES_' + pricesExistingYear]) : enums.defaultPrices
}

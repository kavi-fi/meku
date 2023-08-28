const fs = require('fs')
const _ = require('lodash')
const moment = require('moment')
const enums = require('../shared/enums')

exports.getTemplate = (function () {
  const templateCache = {}
  console.log('1')
  return function (filename, callback) {
    if (templateCache[filename]) {
      console.log('2')
      process.nextTick(callback.bind(null, null, templateCache[filename]))
      return
    }
    console.log('3')
    fs.readFile('./server/templates/' + filename, 'utf-8', (err, data) => {
      if (err) return callback(err)
      console.log('4')
      templateCache[filename] = data
      return callback(null, data)
    })
  }
})()

// TODO JESSE: exports.getTemplateWithVars()
exports.getTemplateWithVars = (function() {
  console.log('Running server-utils.js: getTemplateWithVars')
  return function(templateName, vars, cb) {
    console.log('5')
    this.getTemplate(templateName, (templateError, tpl) => {
      console.log('Checking if template errors')
      if (templateError) return cb(templateError)
      console.log('No template errors')
      return cb(null, _.template(tpl)(vars))
    })
  }
})()

exports.currentPrices = function currentPrices() {
  const pricesExistingYear = _.find(_.range(moment().year(), 2015, -1), (y) => process.env['PRICES_' + y] !== undefined)
  if (!pricesExistingYear) console.warn('Cannot find prices from config variable, using (possibly outdated) defaults')
  return pricesExistingYear ? JSON.parse(process.env['PRICES_' + pricesExistingYear]) : enums.defaultPrices
}

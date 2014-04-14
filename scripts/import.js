var mongoose = require('mongoose')
var path = require('path')
var schema = require('../server/schema')
var async = require('async')
var ProductionCompany = schema.ProductionCompany
var Account = schema.Account

mongoose.connect('mongodb://localhost/meku')

async.series([importProductionCompanies, importAccounts], function() {
  mongoose.disconnect()
})


function importProductionCompanies(callback) {
  ProductionCompany.remove({}, function(err) { })

  // update production companies
  var fs = require('fs')
  fs.readFile(path.join(__dirname, '../data/meku-production-companies-samples.txt'), {encoding: 'utf8'}, function(err, data) {
    if (err) throw (err);

    var companies = data.split('\n').filter(function (x) { return x.length > 0 })

    async.each(companies, function(name, next) {
      new ProductionCompany({name: name}).save(next)
    }, callback)
  })
}

function importAccounts(callback) {
  Account.remove({}, function(err) { })

  var fs = require('fs')
  fs.readFile(path.join(__dirname, '../data/meku-production-companies-samples.txt'), {encoding: 'utf8'}, function(err, data) {
    if (err) throw err;

    var accounts = data.split('\n').filter(function (x) { return x.length > 0 })

    async.each(accounts, function(name, next) {
      new Account({name: name}).save(next)
    }, callback)
  })
}


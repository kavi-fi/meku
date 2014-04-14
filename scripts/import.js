var mongoose = require('mongoose')
var path = require('path')
var schema = require('../server/schema')
var async = require('async')
var ProductionCompany = schema.ProductionCompany

mongoose.connect('mongodb://localhost/meku')

importProductionCompanies(function() {
  mongoose.disconnect()
})


function importProductionCompanies(finish) {
  ProductionCompany.remove({}, function(err) { })

  // update production companies
  var fs = require('fs')
  fs.readFile(path.join(__dirname, '../data/meku-production-companies-samples.txt'), {encoding: 'utf8'}, function(err, data) {
    if (err) throw (err);

    var companies = data.split('\n').filter(function (x) { return x.length > 0 })

    async.each(companies, function(name, next) {
      new ProductionCompany({name: name}).save(next)
    }, finish)
  })
}


/*
  Attempt to map email addresses from an Excel worksheet to users in mongodb.

  Commands:
    logTotals: Output how many emailaddresses are found for users.
    logUpdates: Output update queries which can be run against a mongo instance.
*/
var _ = require('lodash')
var xlsx = require('xlsx')
var mongoose = require('mongoose')
var schema = require('../server/schema')

function readMongo(callback) {
  mongoose.connect('mongodb://localhost/meku')
  schema.User.find({}, { _id:0, emekuId:1, username:1, name:1, emails:1, active:1 }).lean().exec(function(err, users) {
    mongoose.disconnect()
    callback(err, users)
  })
}

function readExcel() {
  var sheet = xlsx.readFile(__dirname + '/luokittelijat-lista.xlsx').Sheets['luokittelijat-lista']
  return xlsx.utils.sheet_to_json(sheet).map(function(row, index) {
    return { firstname: row.ETUNIMI, lastname: row.SUKUNIMI, email:row.EMAIL, row:index }
  })
}

function combine(callback) {
  readMongo(function(err, mongoUsers) {
    if (err) return callback(err)
    var excelUsers = readExcel()
    var result = _(mongoUsers).map(function(mu) {
      var eu = _.find(excelUsers, byName(mu.name))
        || _.find(excelUsers, byEmail(mu.name))
      return eu ? { emekuId: mu.emekuId, username: mu.username, name: mu.name, email: eu.email, row: eu.row } : undefined
    }).compact().value()

    callback(null, result, mongoUsers, excelUsers)
  })

  function byName(name) {
    var loName = name.toLowerCase()
    return function(u) {
      if (!u.firstname || !u.lastname) return false
      return loName.indexOf(u.firstname.toLowerCase()) >= 0
        && loName.indexOf(u.lastname.toLowerCase()) >= 0
    }
  }
  function byEmail(name) {
    var nameParts = name.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'o').split(/\W+/)
    return function(u) {
      return _.all(nameParts, function(part) { return u.email.indexOf(part) >= 0 })
    }
  }
}

function logTotals() {
  combine(function(err, result, mongoUsers, excelUsers) {
    if (err) throw err
    var foundRows = _.pluck(result, 'row')
    var notFound = excelUsers.filter(function(eu) {
      return !_.contains(foundRows, eu.row)
    })
    console.log('Totals:' +
        '\n#excel '+excelUsers.length + '  #mongo '+mongoUsers.length +
        '\nfound  '+foundRows.length  + '  unmapped '+notFound.length
    )
    console.log('\nUnmapped: \n', _.pluck(notFound, 'email'))
  })
}

function logUpdates() {
  var template = "db.users.update({ username:'$1', 'emails.0': { $exists: false } }, { $set: { emails:['$2'] } })"
  combine(function(err, result) {
    if (err) throw err
    var queries = result.map(function(row) { return template.replace('$1', row.username).replace('$2', row.email) })
    console.log(queries.join('\n'))
  })
}


var cmd = process.argv[2]
if (!cmd) {
  console.error('Usage:\n  node '+process.argv[1]+' <logTotals|logUpdates>'); return;
}
var cmds = { logTotals: logTotals, logUpdates:logUpdates }
cmds[cmd]()




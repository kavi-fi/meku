var async = require('async')
var schema = require('../server/schema')
var u = require('./util').connectMongoose()

async.series([removeLegacy, updateFormats], u.done)

function removeLegacy(callback) {
  schema.Program.remove({ programType: 7, 'classifications.0.registrationDate': { $exists: false } }, callback)
}

function updateFormats(callback) {
  var changes = [
    ['PC (PC)', 'PC'],
    ['COIN (Kolikkopeli)', 'Kolikkopeli'],
    ['DVDTV (DVD TV-Games)', 'DVD TV-peli']
  ]
  async.eachSeries(changes, update, callback)

  function update(x, callback) {
    schema.Program.update({ programType: 7, gameFormat: x[0] }, { gameFormat:x[1] }, { multi: true }, callback)
  }
}

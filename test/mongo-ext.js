var async = require('async')
var mongoose = require('mongoose')
var schema = require('../server/schema')

function baseData() {
  var users = [
    new schema.User({username:'ROOT', active: true, password:'root', role:'root', name:'root', emails:['root@fake-meku.fi'] }),
    new schema.User({username:'KAVI', active: true, password:'kavi', role:'kavi', name:'kavi', emails:['kavi@fake-meku.fi'] }),
    new schema.User({username:'USER', active: true, password:'user', role:'user', name:'user', emails:['user@fake-meku.fi'] })
  ]
  var accounts = [
    new schema.Account({name: "DEMO tilaaja 1", roles: ['Subscriber'], emailAddresses: ['demo.1@email.org'], users: users, yTunnus: 'DEMO1' }),
    new schema.Account({name: "DEMO tilaaja 2", roles: ['Subscriber'], emailAddresses: ['demo.2@email.org'], users: users, yTunnus: 'DEMO2' }),
    new schema.Account({name: "DEMO tilaaja 3", roles: ['Subscriber', 'Classifier'], emailAddresses: ['demo.3@email.org'], users: users, yTunnus: 'DEMO3', apiToken: 'apiToken' })
  ]
  return users.concat(accounts)
}

function connectMongoose(callback) {
  schema.Program.findOne({}, { _id:1 }, callback)
}

function dropCollection(coll, callback) {
  mongoose.connection.db.dropCollection(coll, callback)
}

function wipe(done) {
  connectMongoose(function() {
    async.each(schema.models, function(m, callback) {
      m.collection.dropAllIndexes(function() {
        dropCollection(m.collection.name, function() { callback() })
      })
    }, done)
  })
}

exports.reset = function(done) {
  wipe(function(err) {
    if (err) return callback(err)
    async.forEachSeries(baseData(), function(obj, callback) { obj.save(callback) }, done)
  })
}

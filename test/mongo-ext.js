const async = require('async')
const mongoose = require('mongoose')
const schema = require('../server/schema')

function baseData() {
  const users = [
    new schema.User({username: 'ROOT', active: true, password: 'root', role: 'root', name: 'root', emails: ['root@fake-meku.fi']}),
    new schema.User({username: 'KAVI', active: true, password: 'kavi', role: 'kavi', name: 'kavi', emails: ['kavi@fake-meku.fi']}),
    new schema.User({username: 'USER', active: true, password: 'user', role: 'user', name: 'user', emails: ['user@fake-meku.fi']})
  ]
  const accounts = [
    new schema.Account({name: "DEMO tilaaja 1", roles: ['Subscriber'], emailAddresses: ['demo.1@email.org'], users: users, yTunnus: 'DEMO1'}),
    new schema.Account({name: "DEMO tilaaja 2", roles: ['Subscriber'], emailAddresses: ['demo.2@email.org'], users: users, yTunnus: 'DEMO2'}),
    new schema.Account({name: "DEMO tilaaja 3", roles: ['Subscriber', 'Classifier'], emailAddresses: ['demo.3@email.org'], users: users, yTunnus: 'DEMO3', apiToken: 'apiToken'})
  ]
  return users.concat(accounts)
}

function connectMongoose(callback) {
  schema.Program.findOne({}, {_id: 1}, callback)
}

function dropCollection(coll, callback) {
  mongoose.connection.db.dropCollection(coll, callback)
}

function wipe(done) {
  connectMongoose(() => {
    async.forEachSeries(schema.models, (m, callback) => {
      mongoose.connection.db.listCollections({name: m.collection.name}).next((err, coll) => {
        if (err) callback(err)
        else if (coll) dropCollection(coll.name, callback)
        else callback()
      })
    }, done)
  })
}

exports.reset = function(done) {
  wipe((err) => {
    if (err) return done(err)
    async.forEachSeries(baseData(), (obj, callback) => { obj.save(callback) }, done)
  })
}

exports.deleteProgram = function (name, callback) {
  schema.Program.update({name: name}, {$set: {deleted: true}}, {multi: true}, callback)
}

exports.removeClassifications = function (name, callback) {
  schema.Program.update({name: name}, {$set: {classifications: []}}, {multi: true}, callback)
}
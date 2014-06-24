var async = require('async')
var mongoose = require('mongoose')
var schema = require('../server/schema')

var jobs = process.argv.slice(2)
var fixtureData = readFixtureData()

mongoose.connect('mongodb://localhost/meku')

async.series([demoUsers, demoAccounts], function(err) {
  mongoose.disconnect(function() {
    console.log('> All done: ', err ? err : 'OK')
  })
})

function readFixtureData() {
  var env = process.env.NODE_ENV || 'development'
  return require('./data.' + env)
}

function demoUsers(callback) {
  async.forEach(fixtureData.users, function(u, callback) {
    new schema.User(u).save(callback)
  }, callback)
}

function demoAccounts(callback) {
  async.each(fixtureData.accounts, function(a, callback) {
    async.map(a.users, function(username, callback) {
      schema.User.findOne({ username: username }, null, function(err, user) {
        if (err) return callback(err)
        return callback(null, {_id: user._id, name: user.username})
      })
    }, function(err, users) {
      if (err) return callback(err)
      a.users = users
      new schema.Account(a).save(callback)
    })
  }, callback)
}


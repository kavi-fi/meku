var schema = require('../server/schema')
var u = require('./util')

u.connectMongoose()

schema.Account.update({}, { $pull: { users: { username: /^L.*$/ } } }, { multi: true }, u.done)
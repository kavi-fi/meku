var schema = require('../server/schema')
var u = require('./util').connectMongoose()

schema.Program.remove({ programType: 7, 'classifications.0.registrationDate': { $exists: false } }, u.done)

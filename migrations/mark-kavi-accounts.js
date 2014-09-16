var u = require('./util')
var async = require('async')
var schema = require('../server/schema')

u.mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/meku')

var kaviNames = [
  'Kansallinen audiovisuaalinen instituutti',
  'Kansallisen audiovisuaalisen instituutin mediakasvatus- ja kuvaohjelmayksikkö'
]
async.forEach(kaviNames, function(n, callback) { schema.Account.update({ name: n }, { isKavi: true }, callback) }, u.done)

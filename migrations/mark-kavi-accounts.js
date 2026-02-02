var u = require('./util')
var async = require('async')
var schema = require('../server/schema')

u.mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/meku')

var kaviNames = [
  'Taide- ja kulttuurivirasto',
  'Taide- ja kulttuuriviraston mediakasvatus ja ikärajat -osasto'
]
async.forEach(kaviNames, function(n, callback) { schema.Account.update({ name: n }, { isKavi: true }, callback) }, u.done)

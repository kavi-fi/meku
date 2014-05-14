var _ = require('lodash')
var mongoose = require('mongoose')
var Schema = mongoose.Schema

var address = { street: String, city: String, zip: String, country: String }

var classification = {
  'emeku-id': { type: String, index: true },
  author: {_id: mongoose.Schema.Types.ObjectId, name: String},
  buyer: {_id: mongoose.Schema.Types.ObjectId, name: String},
  billing: {_id: mongoose.Schema.Types.ObjectId, name: String},
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number],
  'criteria-comments': {},
  'warning-order': [String],
  'legacy-age-limit': String,
  'creation-date': Date,
  'registration-date': Date,
  'registration-email-addresses': [{email: String, manual: Boolean}],
  comments: String,
  status: String
}

var MovieSchema = new Schema({
  'emeku-id': { type: String, index: true },
  'all-names': { type: [String], index: true },
  name: { type: [String], index: true },
  'name-fi': [String],
  'name-sv': [String],
  'name-other': [String],
  deleted: Boolean,
  country: [String],
  year: String,
  'production-companies': {type: [String], index: true },
  genre: [String],
  'legacy-genre': [String],
  directors: {type: [String], index: true},
  actors: {type: [String], index: true},
  synopsis: String,
  classifications: [classification],
  'program-type': Number // enums.programType
})
MovieSchema.methods.populateAllNames = function() {
  var words = this.name.concat(this['name-fi']).concat(this['name-sv']).concat(this['name-other'])
  words = words.map(function(s) { return s.replace(/[\\.,]/g, ' ').replace(/(^|\W)["\\'\\(]/, '$1').replace(/["\\'\\)](\W|$)/, '$1').split(/\s+/) })
  this['all-names'] = _(words).flatten().invoke('toLowerCase').uniq().sort().value()
}

var Movie = exports.Movie = mongoose.model('movies', MovieSchema)

var Account = exports.Account = mongoose.model('accounts', {
  'emeku-id': String,
  name: {type: String, index: true},
  'billing-address': address,
  roles: [String],
  'email-addresses': [String]
})

var Provider = exports.Provider = mongoose.model('providers', {
  'emeku-id': String,
  name: String
})

var User = exports.User = mongoose.model('users', {
  'emeku-id': String,
  username: String,
  name: String,
  active: Boolean
})

var InvoiceRow = exports.InvoiceRow = mongoose.model('invoicerows', {
  account: {_id: mongoose.Schema.Types.ObjectId, name: String},
	type: String, // registration, classification or distributor fee
	movie: mongoose.Schema.Types.ObjectId,
	name: String,
	duration: String,
	'registration-date': Date,
	price: Number // eurocents
})

var models = exports.models = [Movie, Account, Provider, User, InvoiceRow]

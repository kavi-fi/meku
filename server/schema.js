var _ = require('lodash')
var utils = require('../shared/utils')
var bcrypt = require('bcrypt')
var mongoose = require('mongoose')
var Schema = mongoose.Schema
var bcryptSaltFactor = 12

var address = { street: String, city: String, zip: String, country: String }

var classification = {
  'emeku-id': { type: String, index: true },
  author: {_id: mongoose.Schema.Types.ObjectId, name: String},
  authorOrganization: Number,
  buyer: {_id: mongoose.Schema.Types.ObjectId, name: String},
  billing: {_id: mongoose.Schema.Types.ObjectId, name: String},
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number],
  'criteria-comments': {},
  'warning-order': [String],
  'legacy-age-limit': String,
  pegiWarnings: [String],
  'creation-date': Date,
  'registration-date': Date,
  'registration-email-addresses': [{email: String, manual: Boolean}],
  comments: String,
  publicComments: String,
  reason: Number,
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
  'program-type': Number, // enums.programType
  gameFormat: String,
  season: String, episode: String, series: { _id: mongoose.Schema.Types.ObjectId, name: String }
})

MovieSchema.methods.populateAllNames = function(callback) {
  var program = this
  if (program.series._id) {
    Movie.findById(program.series._id, { name:1, 'name-fi':1, 'name-sv': 1, 'name-other': 1 }, function(err, parent) {
      if (err) return callback(err)
      populate(program, concatNames(parent))
      callback()
    })
  } else {
    populate(program, [])
    process.nextTick(callback)
  }

  function populate(p, extraNames) {
    var words = concatNames(p).concat([utils.seasonEpisodeCode(p)]).concat(extraNames)
    words = words.map(function(s) { return (s + ' ' + s.replace(/[\\.,]/g, ' ').replace(/(^|\W)["\\'\\\[\\(]/, '$1').replace(/["\\'\\\]\\)](\W|$)/, '$1')).split(/\s+/) })
    p['all-names'] = _(words).flatten().invoke('toLowerCase').uniq().sort().value()
  }
  function concatNames(p) {
    return p.name.concat(p['name-fi']).concat(p['name-sv']).concat(p['name-other'])
  }
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

var UserSchema = new Schema({
  'emeku-id': String,
  emails: [String],
  username: { type: String, index: { unique: true } },
  password: String,
  role: String,
  name: String,
  active: Boolean
})

UserSchema.pre('save', function(next) {
  var user = this
  if (!user.isModified('password')) return next()
  bcrypt.genSalt(bcryptSaltFactor, function(err, salt) {
    if (err) return next(err)
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err)
      user.password = hash
      next()
    })
  })
})
UserSchema.methods.checkPassword = function(pwd, callback) {
  bcrypt.compare(pwd, this.password, function(err, ok) {
    if (err) return callback(err)
    callback(null, ok)
  })
}

var User = exports.User = mongoose.model('users', UserSchema)

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

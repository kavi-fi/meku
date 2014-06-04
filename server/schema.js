var _ = require('lodash')
var async = require('async')
var utils = require('../shared/utils')
var bcrypt = require('bcrypt')
var mongoose = require('mongoose')
var ObjectId = mongoose.Schema.Types.ObjectId
var Schema = mongoose.Schema
var bcryptSaltFactor = 12

var address = { street: String, city: String, zip: String, country: String }

var classification = {
  'emeku-id': { type: String, index: true },
  author: {_id: ObjectId, name: String},
  authorOrganization: Number,
  buyer: {_id: ObjectId, name: String},
  billing: {_id: ObjectId, name: String},
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

var ProgramSchema = new Schema({
  'emeku-id': { type: String, index: true },
  customersId: { account: ObjectId, id: String },
  'all-names': { type: [String], index: true },
  name: { type: [String], index: true },
  'name-fi': [String],
  'name-sv': [String],
  'name-other': [String],
  deleted: Boolean,
  country: [String],
  year: String,
  'production-companies': {type: [String], index: true },
  'legacy-production-companies': String,
  genre: [String],
  'legacy-genre': [String],
  directors: {type: [String], index: true},
  actors: {type: [String], index: true},
  synopsis: String,
  classifications: [classification],
  'program-type': Number, // enums.programType
  gameFormat: String,
  season: String, episode: String, series: { _id: ObjectId, name: String }
})
ProgramSchema.index({ 'customersId.account': 1, 'customersId.id': 1 })
ProgramSchema.methods.populateAllNames = function(callback) {
  var program = this
  if (program.series._id) {
    Program.findById(program.series._id, { name:1, 'name-fi':1, 'name-sv': 1, 'name-other': 1 }, function(err, parent) {
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

var Program = exports.Program = mongoose.model('programs', ProgramSchema)

var Account = exports.Account = mongoose.model('accounts', {
  'emeku-id': String,
  name: {type: String, index: true},
  'billing-address': address,
  roles: [String],
  'email-addresses': [String],
  users: { _id: ObjectId, name: String },
  apiToken: String
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

var InvoiceSchema = new Schema({
  account: {_id: ObjectId, name: String},
  type: String, // registration, classification or distributor fee
  program: ObjectId,
  name: String,
  duration: Number,
  'registration-date': Date,
  price: Number // eurocents
})

InvoiceSchema.statics.fromProgram = function(program, rowType, durationSeconds, price) {
  return new this({
    account: program.billing, type: rowType, program: program._id,
    name: program.name, duration: durationSeconds, price: price,
    'registration-date': program.classifications[0]['registration-date']
  })
}

var InvoiceRow = exports.InvoiceRow = mongoose.model('invoicerows', InvoiceSchema)

var XmlDoc = exports.XmlDoc = mongoose.model('xmldocs', new Schema({
  date: Date,
  xml: String,
  account: {_id: ObjectId, name: String}
}))

var namedIndex = { name: { type: String, index: { unique: true } }, parts: { type:[String], index: true } }
var DirectorSchema = new Schema(namedIndex, { _id: false, versionKey: false })
var ActorSchema = new Schema(namedIndex, { _id: false, versionKey: false })

function updateNamedIndex(array, callback) {
  var that = this
  var docs = array.map(function(s) { return { name: s, parts: _(s.toLowerCase().split(/\s+/)).uniq().sort().value() } })
  async.forEach(docs, updateDoc, callback)

  function updateDoc(doc, callback) {
    that.update({ name: doc.name }, doc, { upsert: true }, function(_err) { callback() })
  }
}

DirectorSchema.statics.updateWithNames = updateNamedIndex
var Director = exports.Director = mongoose.model('directors', DirectorSchema)
ActorSchema.statics.updateWithNames = updateNamedIndex
var Actor = exports.Actor = mongoose.model('actors', ActorSchema)

var models = exports.models = [Program, Account, Provider, User, InvoiceRow, XmlDoc, Director, Actor]

var _ = require('lodash')
var async = require('async')
var utils = require('../shared/utils')
var bcrypt = require('bcrypt')
var mongoose = require('mongoose')
var ObjectId = mongoose.Schema.Types.ObjectId
var Schema = mongoose.Schema
var bcryptSaltFactor = 12

var classification = {
  emekuId: { type: String, index: true },
  author: {_id: ObjectId, name: String},
  authorOrganization: Number,
  buyer: {_id: ObjectId, name: String},
  billing: {_id: ObjectId, name: String},
  format: String,
  duration: String, // for now matches a regexp in the client
  safe: Boolean,
  criteria: [Number],
  criteriaComments: {},
  warningOrder: [String],
  legacyAgeLimit: Number,
  creationDate: Date,
  registrationDate: Date,
  registrationEmailAddresses: [{email: String, manual: Boolean}],
  comments: String,
  publicComments: String,
  reason: Number,
  status: String
}

var ProgramSchema = new Schema({
  emekuId: { type: String, index: true },
  sequenceId: { type: Number, index: { unique: true } },
  customersId: { account: ObjectId, id: String },
  allNames: { type: [String], index: true },
  name: { type: [String], index: true },
  nameFi: [String],
  nameSv: [String],
  nameOther: [String],
  deleted: Boolean,
  country: [String],
  year: String,
  productionCompanies: [String],
  genre: [String],
  legacyGenre: [String],
  directors: {type: [String], index: true},
  actors: {type: [String], index: true},
  synopsis: String,
  classifications: [classification],
  draftClassifications: {}, // { userId:classification, userId:classification2 }
  programType: Number, // enums.programType
  gameFormat: String,
  season: String, episode: String,
  series: { _id: { type: ObjectId, index:true }, name: String },
  tvSeriesCriteria: [Number],
  tvSeriesLegacyAgeLimit: Number
})
ProgramSchema.index({ 'customersId.account': 1, 'customersId.id': 1 })
ProgramSchema.pre('save', ensureSequenceId('Program'))

ProgramSchema.statics.createNewClassification = function(user) {
  return {
    _id: mongoose.Types.ObjectId(),
    creationDate: new Date(),
    status: 'in_process',
    author: { _id: user._id, name: user.name },
    warningOrder: [], criteria: [], criteriaComments: {}, registrationEmailAddresses: []
  }
}
ProgramSchema.statics.updateTvSeriesClassification = function(seriesId, callback) {
  var fields = { classifications: { $slice: 1 } }
  Program.find({ 'series._id': seriesId, 'classifications.0': { $exists: true } }, fields).lean().exec(function(err, programs) {
    if (err) return callback(err)
    var classifications = programs.map(function(p) { return p.classifications[0] })
    var criteria = _(classifications).pluck('criteria').flatten().uniq().compact().value()
    var legacyAgeLimit = _(classifications).pluck('legacyAgeLimit').compact().max().value()
    if (legacyAgeLimit == Number.NEGATIVE_INFINITY) legacyAgeLimit = null
    Program.update({ _id: seriesId }, { tvSeriesCriteria: criteria, tvSeriesLegacyAgeLimit: legacyAgeLimit }, callback)
  })
}

ProgramSchema.methods.populateAllNames = function(callback) {
  var program = this
  if (program.series._id) {
    Program.findById(program.series._id, { name:1, nameFi:1, nameSv: 1, nameOther: 1 }, function(err, parent) {
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
    p.allNames = _(words).flatten().invoke('toLowerCase').uniq().sort().value()
  }
  function concatNames(p) {
    return p.name.concat(p.nameFi || []).concat(p.nameSv || []).concat(p.nameOther || [])
  }
}

var Program = exports.Program = mongoose.model('programs', ProgramSchema)

Program.publicFields = {
  emekuId:0, customersId:0, allNames:0, draftClassifications:0,
  'classifications.emekuId':0, 'classifications.author':0,
  'classifications.billing': 0, 'classifications.buyer': 0, 'classifications.registrationEmailAddresses':0,
  'classifications.authorOrganization': 0, 'classifications.reason': 0,
  'classifications.comments':0, 'classifications.criteriaComments':0
}

var AccountSchema = new Schema({
  emekuId: String,
  sequenceId: { type: Number, index: { unique: true } },
  name: {type: String, index: true},
  roles: [String],
  yTunnus: String,
  billing: { street: String, city: String, zip: String, country: String, language: String, invoiceText: String }, // lang in [FI,SV,EN]
  eInvoice: { address:String, operator:String },
  emailAddresses: [String],
  users: [{ _id: ObjectId, name: String }],
  apiToken: String
})
var Account = exports.Account = mongoose.model('accounts', AccountSchema)
AccountSchema.pre('save', ensureSequenceId('Account'))

var Provider = exports.Provider = mongoose.model('providers', {
  emekuId: String,
  name: String
})

var UserSchema = new Schema({
  emekuId: String,
  employers: [{_id: ObjectId, name: String}],
  emails: [String],
  phoneNumbers: [String],
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
  type: String, // registration, classification, reclassification or distributor fee
  program: ObjectId,
  programSequenceId: Number,
  name: String,
  duration: Number,
  registrationDate: {type: Date, index: true},
  price: Number // eurocents
})

InvoiceSchema.statics.fromProgram = function(program, rowType, durationSeconds, price) {
  var row = new this({
    type: rowType, program: program._id, programSequenceId: program.sequenceId,
    name: program.name, duration: durationSeconds, price: price,
    registrationDate: program.classifications[0].registrationDate
  })
  row.account = program.classifications[0].billing
  return row
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
var ProductionCompanySchema = new Schema(namedIndex, { _id: false, versionKey: false })

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

ProductionCompanySchema.statics.updateWithNames = updateNamedIndex
var ProductionCompany = exports.ProductionCompany = mongoose.model('productionCompanies', ProductionCompanySchema)

var SequenceSchema = new Schema({ _id:String, seq:Number }, { _id: false, versionKey: false })
SequenceSchema.statics.next = function(seqName, callback) {
  this.findOneAndUpdate({ _id: seqName }, { $inc: { seq: 1 } }, { new: true }, function(err, doc) {
    return callback(err, err ? null : doc.seq)
  })
}
var Sequence = exports.Sequence = mongoose.model('sequences', SequenceSchema)

var models = exports.models = [Program, Account, Provider, User, InvoiceRow, XmlDoc, Director, Actor, ProductionCompany, Sequence]

function ensureSequenceId(sequenceName) {
  return function(next) {
    var me = this
    if (me.sequenceId) return next()
    Sequence.next(sequenceName, function (err, seq) {
      if (err) return next(err)
      me.sequenceId = seq
      next()
    })
  }
}

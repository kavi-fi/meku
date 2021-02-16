const async = require('async')
const utils = require('../shared/utils')
const classificationUtils = require('../shared/classification-utils')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const enums = require('../shared/enums')
const latinize = require('latinize')
const _ = require('lodash')
const ObjectId = mongoose.Schema.Types.ObjectId
const Schema = mongoose.Schema
const bcryptSaltFactor = 12

const classification = {
  emekuId: {type: String, index: true},
  author: {_id: {type: ObjectId, index: true}, name: String, username: String},
  authorOrganization: Number,
  buyer: {_id: ObjectId, name: String},
  billing: {_id: ObjectId, name: String},
  format: String,
  duration: String, // matches a regexp on the client and server
  safe: Boolean,
  criteria: [Number],
  criteriaComments: {},
  warningOrder: [String],
  legacyAgeLimit: Number,
  creationDate: Date,
  registrationDate: {type: Date, index: true},
  registrationEmailAddresses: [String],
  comments: String,
  userComments: String,
  publicComments: String,
  reason: Number,
  kaviType: Number,
  kaviDiaryNumber: String,
  status: String,
  agelimit: Number,
  warnings: [String],
  isReclassification: Boolean
}

const ProgramSchema = new Schema({
  emekuId: {type: String, index: true},
  sequenceId: {type: Number, index: {unique: true}},
  customersId: {account: ObjectId, id: String},
  allNames: {type: [String], index: true},
  fullNames: {type: [String], index: true},
  name: {type: [String], index: true},
  nameFi: [String],
  nameSv: [String],
  nameOther: [String],
  deleted: {type: Boolean, index: true},
  country: [String],
  year: String,
  productionCompanies: [String],
  genre: [String],
  legacyGenre: [String],
  directors: [String],
  actors: [String],
  synopsis: String,
  classifications: [classification],
  deletedClassifications: [classification],
  draftsBy: {type: [ObjectId], index: true},
  draftClassifications: {}, // { userId:classification, userId:classification2 }
  programType: {type: Number, index: true}, // enums.programType
  gameFormat: String, // in programType == game(7)
  season: Number, episode: Number, // in programType == episode(3)
  series: {_id: {type: ObjectId, index: true}, name: String, draft: {name: String, nameFi: String, nameSv: String, nameOther: String}}, // in programType == episode(3)
  episodes: {count: Number, criteria: [Number], legacyAgeLimit: Number, agelimit: Number, warnings: [String], warningOrder: [String]}, // in programType == series(2)
  sentRegistrationEmailAddresses: [String],
  createdBy: {_id: ObjectId, name: String, username: String, role: String},
  agelimitForSorting: Number
})
ProgramSchema.set('versionKey', false)
ProgramSchema.index({'customersId.account': 1, 'customersId.id': 1})
ProgramSchema.pre('save', ensureSequenceId('Program'))
ProgramSchema.pre('save', function (done) {
  if (this.season === null) this.season = undefined
  done()
})

ProgramSchema.methods.newDraftClassification = function (user) {
  const objectId = mongoose.Types.ObjectId
  const draft = {
    _id: objectId(),
    creationDate: new Date(),
    registrationDate: new Date(),
    status: 'in_process',
    author: {_id: user._id, name: user.name, username: user.username},
    warningOrder: [], criteria: [], criteriaComments: {}, registrationEmailAddresses: [],
    isReclassification: this.classifications.length > 0
  }
  if (!this.draftClassifications) this.draftClassifications = {}
  this.draftClassifications[user._id] = draft
  this.draftsBy.push(user._id)
  this.markModified('draftClassifications')
  return draft
}

exports.fixedKaviRecipients = function () {
  const recipients = process.env.FIXED_KAVI_RECIPIENTS_ON_REGISTER ? process.env.FIXED_KAVI_RECIPIENTS_ON_REGISTER.split(',') : enums.fixedKaviRecipients
  return recipients.map((email) => email.trim())
}

ProgramSchema.methods.populateSentRegistrationEmailAddresses = function (callback) {
  const program = this
  async.parallel([loadAuthorEmails, loadBuyerEmails, loadFixedKaviUsers], (err, emails) => {
    if (err) return callback(err)
    const manual = _.map(program.classifications, 'registrationEmailAddresses')
    program.sentRegistrationEmailAddresses = _(emails.concat(manual)).flatten().compact().uniq().value()
    callback(null, program)
  })

  function loadAuthorEmails (cb) {
    load(User, uniqIds('author'), 'emails', (u) => (u.emails ? u.emails[0] : undefined), cb)
  }
  function loadBuyerEmails (cb) {
    load(Account, uniqIds('buyer'), 'emailAddresses', 'emailAddresses', cb)
  }
  function loadFixedKaviUsers (cb) {
    if (!program.classifications || program.classifications.length === 0 || !program.classifications[0].author) return cb(null, [])
    load(User, [program.classifications[0].author._id], 'role', (u) => u.role, (err, roles) => {
      if (err) return cb(err)
      const emails = roles && roles.length > 0 && roles[0] === 'kavi' ? exports.fixedKaviRecipients() : []
      cb(null, emails)
    })
  }
  function load (schema, ids, field, plucker, cb) {
    schema.find({_id: {$in: ids}}, field).lean().exec((err, docs) => {
      if (err) return cb(err)
      cb(null, _.flatten(_.map(docs, plucker)))
    })
  }
  function uniqIds (param) {
    const all = program.classifications.map((c) => (c[param] && c[param]._id ? String(c[param]._id) : undefined))
    return _(all).uniq().compact().value()
  }
}

ProgramSchema.statics.updateTvSeriesClassification = function (seriesId, callback) {
  const query = {'series._id': seriesId, deleted: {$ne: true}, classifications: {$exists: true, $nin: [[]]}}
  const fields = {classifications: {$slice: 1}}
  Program.find(query, fields).lean().exec((err, programs) => {
    if (err) return callback(err)
    const data = classificationUtils.aggregateClassification(programs)
    const summary = classificationUtils.summary(data)
    const episodeSummary = {
      count: programs.length, criteria: data.criteria, legacyAgeLimit: data.legacyAgeLimit,
      agelimit: summary.age, warnings: _.map(summary.warnings, 'category'), warningOrder: data.warningOrder
    }
    Program.updateOne({_id: seriesId}, {episodes: episodeSummary}, callback)
  })
}
ProgramSchema.statics.updateClassificationSummary = function (c) {
  const summary = classificationUtils.summary(c)
  c.agelimit = summary.age
  c.warnings = _.map(summary.warnings, 'category')
}
ProgramSchema.methods.hasNameChanges = function () {
  const namePaths = ['name', 'nameFi', 'nameSv', 'nameOther']
  return _.some(this.modifiedPaths(), (path) => _.includes(namePaths, path))
}

ProgramSchema.methods.verifyAllNamesUpToDate = function (callback) {
  if (!this.hasNameChanges()) return callback()
  this.populateAllNames(callback)
}

ProgramSchema.methods.populateAllNames = function (series, callback) {
  const cb = callback ? callback : series
  const ser = callback ? series : undefined
  const program = this
  if (program.series._id) {
    const seriesName = ser ? _.isArray(ser.name) ? ser.name[0] : ser.name : undefined
    if (seriesName && program.series.name !== seriesName) program.series.name = seriesName
    loadSeries((err, parent) => {
      if (err) return cb(err)
      populate(program, concatNames(parent))
      cb()
    })
  } else {
    populate(program, [])
    process.nextTick(cb)
  }

  function loadSeries (cb2) {
    if (series) return cb2(undefined, series)
    Program.findById(program.series._id, {name: 1, nameFi: 1, nameSv: 1, nameOther: 1}, cb2)
  }

  function populate (p, extraNames) {
    const initialNames = _.reject(concatNames(p), _.isEmpty)
    let words = _.reject(initialNames.concat([utils.seasonEpisodeCode(p)]).concat(extraNames), _.isEmpty)
    words = words.map((s) => (s + ' ' + s.replace(/[\\.,]/g, ' ').replace(/(^|\W)["'\\[(]/, '$1').replace(/["'\\\])](\W|$)/, '$1')).split(/\s+/))
    const latinizedWords = _.map(_.flatten(words), (word) => latinize(word))
    const latinizedInitialNames = _.map(initialNames, (word) => latinize(word))
    p.allNames = _(words.concat(latinizedWords)).flatten().invokeMap('toLowerCase').uniq().sort().value()
    p.fullNames = _(initialNames.concat(latinizedInitialNames)).invokeMap('toLowerCase').uniq().sort().value()
  }
  function concatNames (p) {
    return p.name.concat(p.nameFi || []).concat(p.nameSv || []).concat(p.nameOther || [])
  }
}

ProgramSchema.pre('save', function (next) {
  const episodeAgelimit = this.episodes ? this.episodes.agelimit : 0
  const ageLimit = this.classifications && this.classifications.length > 0 ? this.classifications[0].agelimit : 0
  this.agelimitForSorting = enums.util.isTvSeriesName(this) ? episodeAgelimit : ageLimit
  next()
})

const Program = mongoose.model('programs', ProgramSchema)

Program.excludedChangeLogPaths = ['allNames', 'fullNames']

Program.publicFields = {
  emekuId: 0, customersId: 0, allNames: 0, fullNames: 0, draftsBy: 0, draftClassifications: 0,
  createdBy: 0, sentRegistrationEmailAddresses: 0, deletedClassifications: 0,
  'classifications.emekuId': 0, 'classifications.author': 0,
  'classifications.billing': 0, 'classifications.buyer': 0,
  'classifications.registrationEmailAddresses': 0, 'classifications.kaviType': 0, 'classifications.kaviDiaryNumber': 0,
  'classifications.comments': 0, 'classifications.userComments': 0, 'classifications.criteriaComments': 0
}

exports.Program = Program

const address = {street: String, city: String, zip: String, country: String}

const AccountSchema = new Schema({
  emekuId: String,
  sequenceId: {type: Number},
  customerNumber: String,
  name: {type: String, index: true},
  roles: [String],
  yTunnus: String,
  ssn: String,
  address: address,
  billing: {address: address, language: String, invoiceText: String, customerNumber: String}, // lang in [FI,SV,EN]
  eInvoice: {address: String, operator: String},
  billingPreference: String, // '' || 'address' || 'eInvoice'
  emailAddresses: [String],
  users: [{_id: ObjectId, username: String}],
  apiToken: String,
  contactName: String,
  phoneNumber: String,
  isKavi: Boolean,
  deleted: Boolean,
  message: String
})
AccountSchema.pre('save', ensureSequenceId('Account'))
const Account = mongoose.model('accounts', AccountSchema)
exports.Account = Account

const ProviderLocationSchema = new Schema({
  emekuId: String,
  customerNumber: String,
  name: String,
  sequenceId: Number,
  address: {street: String, city: String, zip: String, country: String},
  contactName: String,
  phoneNumber: String,
  emailAddresses: [String],
  providingType: [String],
  registrationDate: Date,
  deleted: Boolean,
  active: Boolean,
  isPayer: Boolean,
  adultContent: Boolean,
  url: String,
  message: String
})

ProviderLocationSchema.pre('save', ensureSequenceId('Provider'))

const ProviderSchema = new Schema({
  emekuId: String,
  creationDate: Date,
  sequenceId: Number,
  registrationDate: Date,
  yTunnus: String,
  ssn: String,
  customerNumber: String,
  name: String,
  address: {street: String, city: String, zip: String, country: String},
  billing: {address: {street: String, city: String, zip: String}, invoiceText: String, customerNumber: String},
  eInvoice: {address: String, operator: String},
  billingPreference: String, // '' || 'address' || 'eInvoice'
  contactName: String,
  phoneNumber: String,
  emailAddresses: [String],
  language: String,
  deleted: Boolean,
  active: Boolean,
  message: String,
  locations: [ProviderLocationSchema]
})

ProviderSchema.pre('save', ensureSequenceId('Provider'))

ProviderSchema.statics.getForBilling = function (extraFilters, callback) {
  const filters = {active: true, deleted: false}
  if (callback) _.merge(filters, extraFilters)
  const cb = callback || extraFilters
  Provider.find(filters).lean().exec((err, providers) => {
    if (err) return cb(err)

    _.forEach(providers, (provider) => {
      provider.locations = _.filter(provider.locations, {active: true, deleted: false})
    })

    const providersForBilling = [], locationsForBilling = []
    providers.forEach((p) => {
      const providerClone = _.cloneDeep(p)
      delete providerClone.locations
      _(p.locations).filter({isPayer: true}).value().forEach((l) => {
        l.provider = providerClone
        locationsForBilling.push(l)
      })

      if (_.some(p.locations, {isPayer: false})) {
        providersForBilling.push(p)
      }
    })

    cb(null, {
      providers: providersForBilling,
      locations: locationsForBilling
    })
  })
}

const Provider = mongoose.model('providers', ProviderSchema)
exports.Provider = Provider

const ProviderMetadataSchema = new Schema({
  yearlyBillingReminderSent: Date,
  yearlyBillingCreated: Date,
  previousMidYearBilling: {created: Date, begin: Date, end: Date}
})
ProviderMetadataSchema.statics.getAll = function (callback) {
  ProviderMetadata.findOne((err, metadata) => {
    if (err) return callback(err)
    if (metadata) callback(undefined, metadata)
    else new ProviderMetadata().save(callback)
  })
}
ProviderMetadataSchema.statics.setYearlyBillingReminderSent = function (date, callback) {
  ProviderMetadata.getAll((err, metadata) => {
    if (err) return callback(err)
    metadata.yearlyBillingReminderSent = date
    metadata.save(callback)
  })
}
ProviderMetadataSchema.statics.setYearlyBillingCreated = function (date, callback) {
  ProviderMetadata.getAll((err, metadata) => {
    if (err) return callback(err)
    metadata.yearlyBillingCreated = date
    metadata.save(callback)
  })
}
ProviderMetadataSchema.statics.setPreviousMidYearBilling = function (created, begin, end, callback) {
  ProviderMetadata.getAll((err, metadata) => {
    if (err) return callback(err)
    metadata.previousMidYearBilling = {created: created, begin: begin, end: end}
    metadata.save(callback)
  })
}

const ProviderMetadata = mongoose.model('providermetadatas', ProviderMetadataSchema)
exports.ProviderMetadata = ProviderMetadata

const UserSchema = new Schema({
  emekuId: String,
  employers: [{_id: ObjectId, name: String}],
  emails: [String],
  phoneNumber: String,
  username: {type: String, index: {unique: true}},
  password: String,
  role: String, // user, kavi, root
  name: String,
  active: Boolean,
  resetHash: String,
  certificateStartDate: Date,
  certificateEndDate: Date,
  comment: String,
  certExpiryReminderSent: Date
})

UserSchema.pre('save', function (next) {
  const user = this
  if (!user.isModified('password')) return next()
  bcrypt.genSalt(bcryptSaltFactor, (err, salt) => {
    if (err) return next(err)
    bcrypt.hash(user.password, salt, (err2, hash) => {
      if (err2) return next(err2)
      user.password = hash
      next()
    })
  })
})

UserSchema.methods.checkPassword = function (pwd, callback) {
  bcrypt.compare(pwd, this.password, (err, ok) => {
    if (err) return callback(err)
    callback(null, ok)
  })
}

const User = mongoose.model('users', UserSchema)
User.privateFields = ['emekuId', 'password', 'resetHash']
User.noPrivateFields = {emekuId: 0, password: 0, resetHash: 0}
exports.User = User

const InvoiceSchema = new Schema({
  account: {_id: ObjectId, name: String},
  type: String, // registration, classification, reclassification or distributor fee
  program: ObjectId,
  programType: String,
  programSequenceId: Number,
  name: String,
  duration: Number,
  registrationDate: {type: Date, index: true},
  price: Number // eurocents
})

InvoiceSchema.statics.fromProgram = function (program, rowType, durationSeconds, price) {
  const row = new this({
    type: rowType, program: program._id, programSequenceId: program.sequenceId,
    name: _.first(program.name), programType: program.programType, duration: durationSeconds, price: price,
    registrationDate: program.classifications[0].registrationDate
  })
  row.account = program.classifications[0].billing
  return row
}

InvoiceSchema.statics.removeProgram = function (program, callback) {
  this.deleteOne({program: program._id}, callback)
}

const InvoiceRow = mongoose.model('invoicerows', InvoiceSchema)
exports.InvoiceRow = InvoiceRow

const XmlDoc = mongoose.model('xmldocs', new Schema({
  date: Date,
  xml: String,
  account: {_id: ObjectId, name: String}
}))

exports.XmlDoc = XmlDoc

const ChangeLog = mongoose.model('changelog', new Schema({
  user: {_id: ObjectId, username: String, ip: String},
  date: Date,
  operation: String,
  targetCollection: String,
  documentId: {type: ObjectId, index: true},
  updates: {}
}))

exports.ChangeLog = ChangeLog

const namedIndex = {name: {type: String, index: {unique: true}}, parts: {type: [String], index: true}}
const DirectorSchema = new Schema(namedIndex, {_id: false, versionKey: false})
const ActorSchema = new Schema(namedIndex, {_id: false, versionKey: false})
const ProductionCompanySchema = new Schema(namedIndex, {_id: false, versionKey: false})

function updateNamedIndex (array, callback) {
  const that = this
  const docs = array.map((s) => ({name: s, parts: _(s.toLowerCase().split(/\s+/)).uniq().sort().value()}))
  async.forEach(docs, updateDoc, callback)

  function updateDoc (doc, cb) {
    that.updateOne({name: doc.name}, doc, {upsert: true}, cb)
  }
}

DirectorSchema.statics.updateWithNames = updateNamedIndex
const Director = mongoose.model('directors', DirectorSchema)
exports.Director = Director

ActorSchema.statics.updateWithNames = updateNamedIndex
const Actor = mongoose.model('actors', ActorSchema)
exports.Actor = Actor

ProductionCompanySchema.statics.updateWithNames = updateNamedIndex
const ProductionCompany = mongoose.model('productionCompanies', ProductionCompanySchema)
exports.ProductionCompany = ProductionCompany

const SequenceSchema = new Schema({_id: String, seq: Number}, {_id: false, versionKey: false})
SequenceSchema.statics.next = function (seqName, callback) {
  this.findOneAndUpdate({_id: seqName}, {$inc: {seq: 1}}, {new: true}, (err, doc) => {
    if (doc) {
      return callback(err, err ? null : doc.seq)
    }
    new Sequence({_id: seqName, seq: 0}).save((err2) => callback(err2, err2 ? null : 0))
  })
}

const Sequence = mongoose.model('sequences', SequenceSchema)
exports.Sequence = Sequence

const ClassificationCriteriaSchema = new Schema({
  id: Number,
  category: String,
  age: Number,
  fi: {
    title: String,
    description: String
  },
  sv: {
    title: String,
    description: String
  },
  date: Date
})

const ClassificationCriteria = mongoose.model('classificationCriteria', ClassificationCriteriaSchema)
exports.ClassificationCriteria = ClassificationCriteria

  exports.models = [Program, Account, Provider, ProviderMetadata, User, InvoiceRow, XmlDoc, Director, Actor, ProductionCompany, Sequence, ChangeLog, ClassificationCriteria]

function ensureSequenceId (sequenceName) {
  return function (next) {
    const me = this
    if (me.sequenceId) return next()
    Sequence.next(sequenceName, (err, seq) => {
      if (err) return next(err)
      me.sequenceId = seq
      next()
    })
  }
}

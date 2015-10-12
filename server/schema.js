var async = require('async')
var utils = require('../shared/utils')
var classificationUtils = require('../shared/classification-utils')
var bcrypt = require('bcrypt')
var mongoose = require('mongoose')
var enums = require('../shared/enums')
var ObjectId = mongoose.Schema.Types.ObjectId
var Schema = mongoose.Schema
var bcryptSaltFactor = 12

var classification = {
  emekuId: { type: String, index: true },
  author: { _id: { type: ObjectId, index: true }, name: String, username: String },
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
  registrationDate: { type: Date, index: true },
  registrationEmailAddresses: [String],
  comments: String,
  publicComments: String,
  reason: Number,
  status: String,
  agelimit: Number,
  warnings: [String],
  isReclassification: Boolean
}

var ProgramSchema = new Schema({
  emekuId: { type: String, index: true },
  sequenceId: { type: Number, index: { unique: true } },
  customersId: { account: ObjectId, id: String },
  allNames: { type: [String], index: true },
  fullNames: { type:[String], index: true },
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
  directors: [String],
  actors: [String],
  synopsis: String,
  classifications: [classification],
  deletedClassifications: [classification],
  draftsBy: { type: [ObjectId], index: true },
  draftClassifications: {}, // { userId:classification, userId:classification2 }
  programType: { type: Number, index: true }, // enums.programType
  gameFormat: String, // in programType == game(7)
  season: Number, episode: Number, // in programType == episode(3)
  series: { _id: { type: ObjectId, index:true }, name: String, draft: { name: String, nameFi: String, nameSv: String, nameOther: String } }, // in programType == episode(3)
  episodes: { count: Number, criteria: [Number], legacyAgeLimit: Number, agelimit:Number, warnings:[String], warningOrder: [String] }, // in programType == series(2)
  sentRegistrationEmailAddresses: [String],
  createdBy: { _id: ObjectId, name: String, username: String, role: String }
})
ProgramSchema.set('versionKey', false)
ProgramSchema.index({ 'customersId.account': 1, 'customersId.id': 1 })
ProgramSchema.pre('save', ensureSequenceId('Program'))
ProgramSchema.pre('save', function(done) {
  if (this.season === null) this.season = undefined
  done()
})

ProgramSchema.methods.newDraftClassification = function(user) {
  var draft = {
    _id: mongoose.Types.ObjectId(),
    creationDate: new Date(),
    registrationDate: new Date(),
    status: 'in_process',
    author: { _id: user._id, name: user.name, username: user.username },
    warningOrder: [], criteria: [], criteriaComments: {}, registrationEmailAddresses: [],
    isReclassification: this.classifications.length > 0
  }
  if (!this.draftClassifications) this.draftClassifications = {}
  this.draftClassifications[user._id] = draft
  this.draftsBy.push(user._id)
  this.markModified('draftClassifications')
  return draft
}

ProgramSchema.methods.populateSentRegistrationEmailAddresses = function(callback) {
  var program = this
  async.parallel([loadAuthorEmails, loadBuyerEmails, loadFixedKaviUsers], function(err, emails) {
    if (err) return callback(err)
    var manual = _.pluck(program.classifications, 'registrationEmailAddresses')
    program.sentRegistrationEmailAddresses = _(emails.concat(manual)).flatten().compact().uniq().value()
    callback(null, program)
  })

  function loadAuthorEmails(callback) {
    load(User, uniqIds('author'), 'emails', function(u) { return u.emails ? u.emails[0] : undefined }, callback)
  }
  function loadBuyerEmails(callback) {
    load(Account, uniqIds('buyer'), 'emailAddresses', 'emailAddresses', callback)
  }
  function loadFixedKaviUsers(callback) {
    if (!program.classifications || program.classifications.length === 0 || !program.classifications[0].author) return callback(null, [])
    load(User, [program.classifications[0].author._id], 'role', function(u) { return u.role }, function (err, roles) {
      var emails = roles && roles.length > 0 && roles[0] === 'kavi' ? enums.fixedKaviRecipients : []
      callback(null, emails)
    })
  }
  function load(schema, ids, field, plucker, callback) {
    schema.find({ _id: { $in: ids } }, field).lean().exec(function(err, docs) {
      if (err) return callback(err)
      callback(null, _.map(docs, plucker))
    })
  }
  function uniqIds(param) {
    var all = program.classifications.map(function(c) { return c[param] && c[param]._id ? String(c[param]._id) : undefined })
    return _(all).uniq().compact().value()
  }
}

ProgramSchema.statics.updateTvSeriesClassification = function(seriesId, callback) {
  var query = { 'series._id': seriesId, deleted: { $ne: true } }
  var fields = { classifications: { $slice: 1 } }
  Program.find(query, fields).lean().exec(function(err, programs) {
    if (err) return callback(err)
    var data = classificationUtils.aggregateClassification(programs)
    var summary = classificationUtils.summary(data)
    var episodeSummary = {
      count: programs.length, criteria: data.criteria, legacyAgeLimit: data.legacyAgeLimit,
      agelimit: summary.age, warnings: _.pluck(summary.warnings, 'category'), warningOrder: data.warningOrder
    }
    Program.update({ _id: seriesId }, { episodes: episodeSummary }, callback)
  })
}
ProgramSchema.statics.updateClassificationSummary = function(classification) {
  var summary = classificationUtils.summary(classification)
  classification.agelimit = summary.age
  classification.warnings = _.pluck(summary.warnings, 'category')
}
ProgramSchema.methods.hasNameChanges = function() {
  var namePaths = ['name', 'nameFi', 'nameSv', 'nameOther']
  return _.any(this.modifiedPaths(), function(path) { return _.contains(namePaths, path) })
}

ProgramSchema.methods.verifyAllNamesUpToDate = function(callback) {
  if (!this.hasNameChanges()) return callback()
  this.populateAllNames(callback)
}

ProgramSchema.methods.populateAllNames = function(series, callback) {
  if (!callback) { callback = series; series = undefined }
  var program = this
  if (program.series._id) {
    if (series && program.series.name !== series.name) program.series.name = series.name
    loadSeries(function(err, parent) {
      if (err) return callback(err)
      populate(program, concatNames(parent))
      callback()
    })
  } else {
    populate(program, [])
    process.nextTick(callback)
  }

  function loadSeries(callback) {
    if (series) return callback(undefined, series)
    Program.findById(program.series._id, { name:1, nameFi:1, nameSv: 1, nameOther: 1 }, callback)
  }

  function populate(p, extraNames) {
    var initialNames = _.reject(concatNames(p), _.isEmpty)
    var words = _.reject(initialNames.concat([utils.seasonEpisodeCode(p)]).concat(extraNames), _.isEmpty)
    words = words.map(function(s) { return (s + ' ' + s.replace(/[\\.,]/g, ' ').replace(/(^|\W)["\\'\\\[\\(]/, '$1').replace(/["\\'\\\]\\)](\W|$)/, '$1')).split(/\s+/) })
    p.allNames = _(words).flatten().invoke('toLowerCase').uniq().sort().value()
    p.fullNames = _(initialNames).invoke('toLowerCase').uniq().sort().value()
  }
  function concatNames(p) {
    return p.name.concat(p.nameFi || []).concat(p.nameSv || []).concat(p.nameOther || [])
  }
}

var Program = exports.Program = mongoose.model('programs', ProgramSchema)

Program.excludedChangeLogPaths = ['allNames', 'fullNames']

Program.publicFields = {
  emekuId:0, customersId:0, allNames:0, fullNames:0, draftsBy: 0, draftClassifications:0,
  createdBy:0, sentRegistrationEmailAddresses:0, deletedClassifications: 0,
  'classifications.emekuId':0, 'classifications.author':0,
  'classifications.billing': 0, 'classifications.buyer': 0,
  'classifications.registrationEmailAddresses':0,
  'classifications.comments':0, 'classifications.criteriaComments':0
}
var address = { street: String, city: String, zip: String, country: String }

var AccountSchema = new Schema({
  emekuId: String,
  sequenceId: { type: Number, index: { unique: true } },
  customerNumber: String,
  name: {type: String, index: true},
  roles: [String],
  yTunnus: String,
  address: address,
  billing: { address: address, language: String, invoiceText: String, customerNumber: String }, // lang in [FI,SV,EN]
  eInvoice: { address:String, operator:String },
  billingPreference: String, // '' || 'address' || 'eInvoice'
  emailAddresses: [String],
  users: [{ _id: ObjectId, username: String }],
  apiToken: String,
  contactName: String,
  phoneNumber: String,
  isKavi: Boolean,
  deleted: Boolean,
  message: String
})
var Account = exports.Account = mongoose.model('accounts', AccountSchema)
AccountSchema.pre('save', ensureSequenceId('Account'))

var ProviderLocationSchema = new Schema({
  emekuId: String,
  customerNumber: String,
  name: String,
  sequenceId: Number,
  address: { street: String, city: String, zip: String, country: String },
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

var ProviderSchema = new Schema({
  emekuId: String,
  creationDate: Date,
  sequenceId: Number,
  registrationDate: Date,
  yTunnus: String,
  customerNumber: String,
  name: String,
  address: { street: String, city: String, zip: String, country: String },
  billing: { address: { street: String, city: String, zip: String }, invoiceText: String, customerNumber: String },
  eInvoice: { address:String, operator:String },
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

ProviderSchema.statics.getForBilling = function(extraFilters, callback) {
  var filters = { active: true, deleted: false }
  if (callback) _.merge(filters, extraFilters)
  else callback = extraFilters
  Provider.find(filters).lean().exec(function(err, providers) {
    if (err) return callback(err)

    _.forEach(providers, function(provider) {
      provider.locations = _.filter(provider.locations, { active: true, deleted: false })
    })

    var providersForBilling = [], locationsForBilling = []
    providers.forEach(function(p) {
      var providerClone = _.cloneDeep(p)
      delete providerClone.locations
      _(p.locations).filter({ isPayer: true }).forEach(function(l) {
        l.provider = providerClone
        locationsForBilling.push(l)
      })

      if (_.any(p.locations, { isPayer: false })) {
        providersForBilling.push(p)
      }
    })

    callback(null, {
      providers: providersForBilling,
      locations: locationsForBilling
    })
  })
}

var Provider = exports.Provider = mongoose.model('providers', ProviderSchema)

var ProviderMetadataSchema = new Schema({
  yearlyBillingReminderSent: Date,
  yearlyBillingCreated: Date,
  previousMidYearBilling: { created: Date, begin: Date, end: Date }
})
ProviderMetadataSchema.statics.getAll = function(callback) {
  ProviderMetadata.findOne(function(err, metadata) {
    if (err) return callback(err)
    if (!metadata) new ProviderMetadata().save(callback)
    else callback(undefined, metadata)
  })
}
ProviderMetadataSchema.statics.setYearlyBillingReminderSent = function(date, callback) {
  ProviderMetadata.getAll(function(err, metadata) {
    if (err) return callback(err)
    metadata.yearlyBillingReminderSent = date
    metadata.save(callback)
  })
}
ProviderMetadataSchema.statics.setYearlyBillingCreated = function(date, callback) {
  ProviderMetadata.getAll(function(err, metadata) {
    if (err) return callback(err)
    metadata.yearlyBillingCreated = date
    metadata.save(callback)
  })
}
ProviderMetadataSchema.statics.setPreviousMidYearBilling = function(created, begin, end, callback) {
  ProviderMetadata.getAll(function(err, metadata) {
    if (err) return callback(err)
    metadata.previousMidYearBilling = { created: created, begin: begin, end: end }
    metadata.save(callback)
  })
}

var ProviderMetadata = exports.ProviderMetadata = mongoose.model('providermetadatas', ProviderMetadataSchema)

var UserSchema = new Schema({
  emekuId: String,
  employers: [{_id: ObjectId, name: String}],
  emails: [String],
  phoneNumber: String,
  username: { type: String, index: { unique: true } },
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
User.privateFields = ['emekuId', 'password', 'resetHash']
User.noPrivateFields = { emekuId:0, password: 0, resetHash: 0 }

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

InvoiceSchema.statics.removeProgram = function (program, callback) {
  this.remove({program: program._id}, callback)
}

var InvoiceRow = exports.InvoiceRow = mongoose.model('invoicerows', InvoiceSchema)

var XmlDoc = exports.XmlDoc = mongoose.model('xmldocs', new Schema({
  date: Date,
  xml: String,
  account: {_id: ObjectId, name: String}
}))

var ChangeLog = exports.ChangeLog = mongoose.model('changelog', new Schema({
  user: {_id: ObjectId, username: String, ip: String},
  date: Date,
  operation: String,
  targetCollection: String,
  documentId: { type: ObjectId, index: true },
  updates: {}
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
    if (!doc) {
      new Sequence({ _id: seqName, seq: 0 }).save(function(err, doc) {
        return callback(err, err ? null : 0)
      })
    } else {
      return callback(err, err ? null : doc.seq)
    }
  })
}
var Sequence = exports.Sequence = mongoose.model('sequences', SequenceSchema)

var ClassificationCriteriaSchema = new Schema({
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

var ClassificationCriteria = exports.ClassificationCriteria = mongoose.model('classificationCriteria', ClassificationCriteriaSchema)

var models = exports.models = [Program, Account, Provider, ProviderMetadata, User, InvoiceRow, XmlDoc, Director, Actor, ProductionCompany, Sequence, ChangeLog, ClassificationCriteria]

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

var moment = require('moment')
var schema = require('./schema')
var utils = require('../shared/utils')

module.exports = {
  programType: programType,
  agelimit: agelimit,
  author: author,
  warnings: warnings,
  agelimitChanges: agelimitChanges,

  kaviAgelimit: kaviAgelimit,
  kaviAgelimitChanges: kaviAgelimitChanges,
  kaviAuthor: kaviAuthor,
  kaviReclassificationReason: kaviReclassificationReason,
  kaviDuration: kaviDuration,
  kaviClassificationList: kaviClassificationList
}

function programType(dateRange, callback) {
  var q = query(dateRange)
  schema.Program.aggregate()
    .match(q)
    .project({ _id:0, 'classifications.registrationDate':1, programType: 1 })
    .unwind('classifications')
    .match(q)
    .group({ _id: '$programType', value: { $sum: 1 } })
    .sort('_id')
    .exec(callback)
}

function agelimit(dateRange, callback) {
  var q = query(dateRange)
  schema.Program.aggregate()
    .match(q)
    .project({ _id: 0, 'classifications.agelimit': 1, 'classifications.registrationDate': 1 })
    .unwind('classifications')
    .match(q)
    .group({ _id: '$classifications.agelimit', value: { $sum: 1 } })
    .sort('_id')
    .exec(callback)
}

function author(dateRange, callback) {
  var q = query(dateRange)
  schema.Program.aggregate()
    .match(q)
    .project({ _id: 0, 'classifications.author.username': 1, 'classifications.registrationDate': 1 })
    .unwind('classifications')
    .match(q)
    .group({ _id: '$classifications.author.username', value: { $sum: 1 } })
    .sort('_id')
    .exec(callback)
}

function warnings(dateRange, callback) {
  var q = query(dateRange)
  schema.Program.aggregate()
    .match(q)
    .project({ _id: 0, 'classifications.warnings': 1, 'classifications.registrationDate': 1 })
    .unwind('classifications')
    .match(q)
    .group({ _id: '$classifications.warnings', value: { $sum: 1 } })
    .exec(function(err, docs) {
      if (err) return callback(err)
      var result = docs.reduce(categorize, [])
      callback(null, _.sortBy(result, '_id'))
    })

  function categorize(acc, doc) {
    var category = doc._id.length == 0 ? '-' : doc._id.length == 1 ? doc._id[0] : doc._id[0]+'+'
    var cell = _.find(acc, { _id: category })
    if (cell) {
      cell.value += doc.value
    } else {
      cell = { _id: category, value: doc.value }
      acc.push(cell)
    }
    return acc
  }
}

function agelimitChanges(dateRange, callback) {
  var fields = { _id: 0, 'classifications.registrationDate': 1, 'classifications.agelimit': 1 }
  var q = {
    'classifications.1': { $exists: true },
    'classifications.registrationDate': { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() }
  }
  schema.Program.find(q, fields).lean().exec(function(err, programs) {
    if (err) return callback(err)
    var result = _(programs).map(classificationsToAgelimitChange(dateRange)).flatten().compact().countBy().value()
    callback(null, result)
  })
}

function kaviAgelimit(dateRange, callback) {
  var q = query(dateRange)
  schema.User.find({ role: { $in:['kavi','admin'] } }, '_id').lean().exec(function(err, users) {
    if (err) return callback(err)
    schema.Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .match({ 'classifications.author._id': { $in: _.pluck(users, '_id')} })
      .group({ _id: '$classifications.agelimit', value: { $sum: 1 } })
      .sort('_id')
      .exec(callback)
  })
}

function kaviAgelimitChanges(dateRange, callback) {
  schema.User.find({ role: { $in:['kavi','admin'] } }, '_id').lean().exec(function(err, users) {
    if (err) return callback(err)
    var fields = { _id: 0, 'classifications.registrationDate': 1, 'classifications.agelimit': 1 }
    var q = {
      'classifications.1': { $exists: true },
      'classifications': { $elemMatch: {
        registrationDate: { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() },
        'author._id': { $in: _.pluck(users, '_id') }
      }}
    }
    schema.Program.find(q, fields).lean().exec(function(err, programs) {
      if (err) return callback(err)
      var result = _(programs).map(classificationsToAgelimitChange(dateRange)).flatten().compact().countBy().value()
      callback(null, result)
    })
  })
}

function kaviAuthor(dateRange, callback) {
  var q = query(dateRange)
  schema.User.find({ role: { $in:['kavi','admin'] } }, 'username').lean().exec(function(err, users) {
    if (err) return callback(err)
    schema.Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .match({ 'classifications.author._id': { $in: _.pluck(users, '_id')} })
      .group({ _id: '$classifications.author', value: { $sum: 1 } })
      .sort('_id.username')
      .project({ _id: { $concat : [ '$_id.name' , ' ', '$_id.username' ] }, value: 1 })
      .exec(callback)
  })
}

function kaviReclassificationReason(dateRange, callback) {
  var q = query(dateRange)
  schema.User.find({ role: { $in:['kavi','admin'] } }, '_id').lean().exec(function(err, users) {
    if (err) return callback(err)
    schema.Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .match({ 'classifications.author._id': { $in: _.pluck(users, '_id')} })
      .project({ reason:'$classifications.reason' })
      .group({ _id: '$reason', value: { $sum: 1 } })
      .exec(callback)
  })
}

function kaviDuration(dateRange, callback) {
  schema.User.find({ role: { $in:['kavi','admin'] } }, 'username').lean().exec(function(err, users) {
    if (err) return callback(err)
    var q = {
      'classifications.author._id' : { $in: _.pluck(users, '_id') },
      'classifications.registrationDate': { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() }
    }
    schema. Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .project({ name: '$name', value: '$classifications.duration', date: '$classifications.registrationDate', sequenceId: 1 })
      .sort('date')
      .exec(function(err, docs) {
        if (err) return callback(err)
        var result = docs.map(function(d) {
          return { _id: d.name[0] + ' [' + d.sequenceId + '] ' + moment(d.date).format('D.M.YYYY'), value: d.value }
        })
        callback(null, result)
      })
  })
}

function kaviClassificationList(dateRange, callback) {
  // NOTE: not implemented yet
  callback(null, ['not implemented yet'])
}

function query(range) {
  return { 'classifications.registrationDate': { $gte: range.begin.toDate(), $lt: range.end.toDate() } }
}

function classificationsToAgelimitChange(dateRange) {
  return function(p) {
    return p.classifications.map(function(c, ii) {
      if (ii < p.classifications.length - 1 && utils.withinDateRange(c.registrationDate, dateRange.begin, dateRange.end)) {
        var prev = p.classifications[ii+1]
        if (prev.agelimit == c.agelimit) return 'same'
        return c.agelimit > prev.agelimit ? 'up' : 'down'
      } else {
        return null
      }
    })
  }
}

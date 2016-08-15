var moment = require('moment')
var schema = require('./schema')
var utils = require('../shared/utils')
var classificationUtils = require('../shared/classification-utils')

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
  durations: durations,
  kaviDurations: kaviDurations,
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
    .project({ _id: 0, 'classifications.authorOrganization': 1, 'classifications.author.username': 1, 'classifications.registrationDate': 1 })
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
    callback(null, mapProgramsToAgeLimitChanges(dateRange, programs))
  })
}

function kaviAgelimit(dateRange, callback) {
  var q = query(dateRange)
  loadKaviUsers('_id', function(err, users) {
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
  loadKaviUsers('_id', function(err, users) {
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
      callback(null, mapProgramsToAgeLimitChanges(dateRange, programs))
    })
  })
}

function kaviAuthor(dateRange, callback) {
  var q = query(dateRange)
  loadKaviUsers('username', function(err, users) {
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
  loadKaviUsers('_id', function(err, users) {
    if (err) return callback(err)
    var q = {
      'classifications.registrationDate': { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() },
      'classifications.author._id': { $in: _.pluck(users, '_id') },
      'classifications.isReclassification': true
    }
    schema.Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .project({ reason:'$classifications.reason' })
      .group({ _id: '$reason', value: { $sum: 1 } })
      .exec(callback)
  })
}

function durations(dateRange, callback) {
  var q = { classifications: { $elemMatch: {
    registrationDate: { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() }
  }}}

  searchDurations(q, dateRange,
    function (author) { return true },
    function (index, program) { return program.programType },
    function (buyer) { return undefined },
    function (err, result) {
      err ? callback(err) : callback(null, Object.keys(result).map(function (k) { return {_id: k, count: result[k].count, value: result[k].duration }}))
    }
  )
}

function kaviDurations(dateRange, callback) {
  schema.Account.find({ isKavi: true}, '_id', function(err, accounts) {
    if (err) return callback(err)
    var kaviAccounts = _.pluck(accounts, '_id').map(function(objectId) { return String(objectId) })

    loadKaviUsers('_id', function(err, users) {
      if (err) return callback(err)

      var kaviAuthorIds = _.pluck(users, '_id').map(function(objectId) { return String(objectId) })
      var q = { classifications: { $elemMatch: {
        'author._id' : { $in: kaviAuthorIds },
        registrationDate: { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() }
      }}}

      searchDurations(q, dateRange,
        function (author) { return author && kaviAuthorIds.indexOf(String(author._id)) != -1 },
        function (index, program) { return index == program.classifications.length - 1 ? 'classifications' : 'reclassifications' },
        function (buyer) { return buyer ? kaviAccounts.indexOf(String(buyer._id)) == -1 ? 'other' : 'kavi' : 'unknown' },
        callback
      )
    })
  })

}

function searchDurations(q, dateRange, isValidAuthor, durationKey, buyerKey, callback) {
  var fields = {
    'programType': 1, 'classifications.author._id': 1, 'classifications.registrationDate': 1,
    'classifications.duration': 1, 'classifications.buyer': 1
  }
  schema.Program.find(q, fields).lean().exec(function(err, programs) {
    if (err) return callback(err)
    var result = programs.reduce(function (res, p) { return sumClassifications(res, p, dateRange, isValidAuthor, durationKey, buyerKey) }, {})
    return callback(null, result)
  })
}

function sumClassifications(result, p, dateRange, isValidAuthor, durationKey, buyerKey) {
  _(p.classifications).forEach(function(c, classificationIndex) {
    if (!isValidAuthor(c.author)) return
    if (!utils.withinDateRange(c.registrationDate, dateRange.begin, dateRange.end)) return

    var seconds = classificationUtils.durationToSeconds(c.duration)
    addTo(result, durationKey(classificationIndex, p), seconds)
    addTo(result, buyerKey(c.buyer), seconds)
  })
  return result
}

function addTo(obj, key, seconds) {
  if (key === undefined) return
  if (!obj[key]) obj[key] = { count:0, duration:0 }
  obj[key].count++
  obj[key].duration += seconds
}

function kaviClassificationList(dateRange, callback) {
  loadKaviUsers('username', function(err, users) {
    if (err) return callback(err)
    var q = {
      'classifications.author._id' : { $in: _.pluck(users, '_id') },
      'classifications.registrationDate': { $gte: dateRange.begin.toDate(), $lt: dateRange.end.toDate() }
    }
    schema.Program.aggregate()
      .match(q)
      .unwind('classifications')
      .match(q)
      .project({
        name:1, sequenceId:1, programType:1,
        duration: '$classifications.duration', date: '$classifications.registrationDate', author: '$classifications.author.username',
        authorOrganization: '$classifications.authorOrganization', isReclassification: '$classifications.isReclassification', comments: '$classifications.comments', buyer: '$classifications.buyer' })
      .sort('date')
      .exec(callback)
  })
}

function loadKaviUsers(returnFields, callback) {
  schema.User.find({ role: { $in:['kavi','root'] } }, returnFields).lean().exec(callback)
}

function query(range) {
  return { 'classifications.registrationDate': { $gte: range.begin.toDate(), $lt: range.end.toDate() } }
}

function mapProgramsToAgeLimitChanges(dateRange, programs) {
  return _(programs)
    .map(classificationsToAgelimitChange(dateRange)).flatten().compact().countBy()
    .pairs().map(function(arr) { return { _id:arr[0], value:arr[1] }}).value()
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

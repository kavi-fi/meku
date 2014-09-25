var _ = require('lodash')
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var classificationUtils = require('../shared/classification-utils')

var validation = {}

var Fail = validation.Fail = function Fail(field) {
  return {valid: false, field: field}
}

var Ok = validation.Ok = function Ok() {
  return {valid: true}
}

var bind = validation.bind = function bind(v, v2) {
  return function(p) {
    var res = v(p)
    if (!res.valid) return res
    else return v2(p)
  }
}

var all = validation.all = function(vs) {
  return _.reduce(arguments, bind, ok())
}

var ok = validation.ok = function ok() {
  return function(p) {
    return Ok()
  }
}

var requiredString = validation.requiredString = function requiredString(name) {
  return function(p) {
    if (p[name] && p[name].length > 0) return Ok()
    else return Fail(name)
  }
}

var requiredNumber = validation.requiredNumber = function requiredNumber(name) {
  return function(p) {
    if (_.has(p, name)) return Ok()
    else return Fail(name)
  }
}

var requiredArray = validation.requiredArray = function requiredArray(name) {
  return function(p) {
    var val = p[name]
    if (_.isArray(val) && !_.isEmpty(val) && val[0].length > 0) return Ok()
    else return Fail(name)
  }
}

var requiredRef = validation.requiredRef = function(name) {
  return function(p) {
    if (p[name] && p[name]._id) return Ok()
    else return Fail(name)
  }
}

function when(f, v) {
  return function(p) {
    if (f(p)) return v(p)
    else return Ok()
  }
}

function or(v1, v2) {
  return function(p) {
    var res = v1(p)
    if (res.valid) return res
    else return v2(p)
  }
}

function newSeries(p) {
  var series = p.series
  if (series.draft && series.draft.name && series.draft.name.length > 0
      && series.draft.nameFi && series.draft.nameFi.length > 0) {
    return Ok()
  } else {
    return Fail('series')
  }
}

function not(f) { return function(p) { return !f(p) }}

validation.program = all(
  requiredArray('name'),
  requiredArray('nameFi'),
  requiredString('year'),
  requiredArray('country'),
  requiredArray('productionCompanies'),
  when(not(enums.util.isGameType), requiredArray('directors')),
  when(enums.util.isGameType, requiredString('gameFormat')),
  when(enums.util.isTvEpisode, requiredNumber('episode')),
  when(enums.util.isTvEpisode, or(requiredRef('series'), newSeries)),
  requiredString('synopsis')
)

validation.classification = function(p, user) {
  return all(
    when(function(c) {
      return !isInternalReclassification(c) || enums.isOikaisupyynto(c.reason)
    }, all(
      requiredRef('buyer'),
      requiredRef('billing')
    )),
    when(isInternalReclassification, all(requiredNumber('authorOrganization'), requiredNumber('reason'))),
    when(or(isKavi, not(isGame)), requiredString('duration')),
    when(not(_.curry(classificationUtils.isReclassification)(p)), requiredArray('registrationEmailAddresses')),
    when(not(isGame), requiredString('format'))
  )

  function isGame() {
    return enums.util.isGameType(p)
  }

  function isKavi() {
    return utils.hasRole(user, 'kavi')
  }

  function isInternalReclassification(c) {
    return classificationUtils.isReclassification(p, c) && isKavi()
  }
}

validation.registration = function(program, classification, user) {
  function isReclassification() {
    return classificationUtils.isReclassification(program, classification)
  }

  return bind(when(not(isReclassification), validation.program), function() {
    return validation.classification(program, user)(classification)
  })(program)
}

module.exports = validation

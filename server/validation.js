var _ = require('lodash')
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var classificationUtils = require('../shared/classification-utils')

var validation = {}

validation.registration = function(program, classification, user) {
  function isReclassification() {
    return classificationUtils.isReclassification(program, classification)
  }

  return all(
    when(not(isReclassification), programV()),
    function() { return classificationV(program, user)(classification) }
  )(program)
}

function programV() {
  return all(
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
}

function classificationV(p, user) {
  return all(
    when(function(c) {
      return !isInternalReclassification(c) || enums.isOikaisupyynto(c.reason)
    }, all(
      requiredRef('buyer'),
      requiredRef('billing')
    )),
    arrayEach('registrationEmailAddresses', utils.isEmail),
    when(isInternalReclassification, all(requiredNumber('authorOrganization'), requiredNumber('reason'))),
    when(or(isKavi, not(isGame)), all(requiredString('duration'), check('duration', utils.isValidDuration))),
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

function Fail(field) {
  return {valid: false, field: field}
}

function Ok() {
  return {valid: true}
}

function bind(v, v2) {
  return function(p) {
    var res = v(p)
    if (!res.valid) return res
    else return v2(p)
  }
}

function all(vs) {
  return _.reduce(arguments, bind, ok())
}

function ok() {
  return function(p) {
    return Ok()
  }
}

function requiredString(name) {
  return function(p) {
    if (p[name] && p[name].length > 0) return Ok()
    else return Fail(name)
  }
}

function requiredNumber(name) {
  return function(p) {
    if (_.has(p, name)) return Ok()
    else return Fail(name)
  }
}

function requiredArray(name) {
  return function(p) {
    var val = p[name]
    if (_.isArray(val) && !_.isEmpty(val) && val[0].length > 0) return Ok()
    else return Fail(name)
  }
}

function arrayEach(name, f) {
  return function(p) {
    if (_.all(p[name], f)) return Ok()
    else return Fail(name)
  }
}

function requiredRef(name) {
  return function(p) {
    if (p[name] && p[name]._id) return Ok()
    else return Fail(name)
  }
}

function check(name, f) {
  return function(p) {
    if (f(p[name])) return Ok()
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

module.exports = validation

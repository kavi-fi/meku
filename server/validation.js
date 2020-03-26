const _ = require('lodash')
const enums = require('../shared/enums')
const utils = require('../shared/utils')
const classificationUtils = require('../shared/classification-utils')

const validation = {}

validation.registration = function (program, classification, user) {
  function isReclassification () {
    return classificationUtils.isReclassification(program, classification)
  }

  return all(
    when(not(isReclassification), programV()),
    () => classificationV(program, user)(classification)
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
    when((c) => !isInternalReclassification(c) || enums.isOikaisupyynto(c.reason), all(
      requiredRef('buyer'),
      requiredRef('billing')
    )),
    arrayEach('registrationEmailAddresses', utils.isEmail),
    when(isInternalReclassification, requiredNumber('authorOrganization')),
    when(and(isInternalReclassification, not(isAuthoredByEloKuvalautakuntaKuvaohjelmalautakuntaOrKHO)), requiredNumber('reason')),
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

  function isAuthoredByEloKuvalautakuntaKuvaohjelmalautakuntaOrKHO(c) {
    return enums.authorOrganizationIsElokuvalautakunta(c) || enums.authorOrganizationIsKuvaohjelmalautakunta(c) || enums.authorOrganizationIsKHO(c)
  }
}

function fail(field) {
  return {valid: false, field: field}
}

function success() {
  return {valid: true}
}

function bind(v, v2) {
  return function (p) {
    const res = v(p)
    if (!res.valid) return res
    return v2(p)
  }
}

function all() {
  return _.reduce(arguments, bind, ok())
}

function ok() {
  return function () {
    return success()
  }
}

function requiredString(name) {
  return function (p) {
    if (p[name] && p[name].length > 0) return success()
    return fail(name)
  }
}

function requiredNumber(name) {
  return function (p) {
    if (_.has(p, name)) return success()
    return fail(name)
  }
}

function requiredArray(name) {
  return function (p) {
    const val = p[name]
    if (_.isArray(val) && !_.isEmpty(val) && val[0].length > 0) return success()
    return fail(name)
  }
}

function arrayEach(name, f) {
  return function (p) {
    if (_.every(p[name], f)) return success()
    return fail(name)
  }
}

function requiredRef(name) {
  return function (p) {
    if (p[name] && p[name]._id) return success()
    return fail(name)
  }
}

function check(name, f) {
  return function (p) {
    if (f(p[name])) return success()
    return fail(name)
  }
}

function when(f, v) {
  return function (p) {
    if (f(p)) return v(p)
    return success()
  }
}

function and(v1, v2) {
  return function (p) {
    return v1(p) && v2(p)
  }
}

function or(v1, v2) {
  return function (p) {
    const res = v1(p)
    if (res.valid) return res
    return v2(p)
  }
}

function newSeries(p) {
  const series = p.series
  if (series && series.draft && series.draft.name && series.draft.name.length > 0
      && series.draft.nameFi && series.draft.nameFi.length > 0) {
    return success()
  }
    return fail('series')

}

function not(f) { return function (p) { return !f(p) } }

module.exports = validation

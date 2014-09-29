if (isNodeJs()) {
  var _ = require('lodash')
  var enums = require('./enums')
  var moment = require('moment')
}

var utils = {}

utils.dateFormat = 'D.M.YYYY'

utils.keyValue = function(key, value) {
  var data = {}
  data[key] = value
  return data
}

utils.showBoolean = function(b) {
  if (b) return "Kyllä"
  else return "Ei"
}

utils.escapeRegExp = function(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

utils.seasonEpisodeCode = function(p) {
  if (!enums.util.isTvEpisode(p)) return ''
  var ints = { season: parseInt(p.season), episode: parseInt(p.episode) }
  if (ints.season == p.season && ints.episode == p.episode) {
    return 'S' + pad(ints.season)+ 'E' + pad(ints.episode)
  } else if (!p.season && typeof ints.episode !== 'undefined' && ints.episode == p.episode) {
    return 'E' + ints.episode
  } else {
    var s = _.compact([p.season, p.episode]).join(' ')
    return s && '['+s+']' || s
  }

  function pad(i) { return i < 10 ? '0' + i : ''+i }
}

utils.isValidUsername = function(txt) {
  return !!txt && /^[0-9A-Za-z\u00C0-\u017F_]+$/.test(txt)
}

utils.isValidDuration = function(txt) {
  var m = /(?:(\d+)?:)(\d+):(\d+)$/.exec(txt)
  if (m) {
    var mins = parseInt(m[2])
    var seconds = parseInt(m[3])
    return mins < 60 && seconds < 60
  } else {
    return false
  }
}

utils.isEmail = function(txt) {
  var regexp = /^([A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+(\.[A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+)*)@(([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63})(\.([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63}))*\.[a-zA-Z0-9]{2,63})$/
  return regexp.test(txt)
}

utils.isValidYear = function(txt) {
  return /^\d{4}$/.test(txt) && parseInt(txt) > 1889
}

utils.isEmptyOrValidDate = function(txt) {
  return $.trim(txt) == '' || moment(txt, utils.dateFormat).isValid()
}

utils.secondsToDuration = function(seconds) {
  var hours   = Math.floor(seconds / 3600)
  var minutes = Math.floor((seconds - (hours * 3600)) / 60)
  var seconds = seconds - (hours * 3600) - (minutes * 60)

  if (hours   < 10) { hours   = "0"+hours }
  if (minutes < 10) { minutes = "0"+minutes }
  if (seconds < 10) { seconds = "0"+seconds }
  var time    = hours+':'+minutes+':'+seconds
  return time
}

utils.programDurationAsText = function(program) {
  var c = program.classifications[0]
  if (!c) return ''
  return utils.durationAsText(c.duration)
}

utils.durationAsText = function(duration) {
  if (!duration) return ''
  var match = duration.match(/(?:(\d+)?:)?(\d+):(\d+)$/)
  if (!match) return duration
  match.shift()
  return _(match).map(suffixify).compact().join(' ')

  function suffixify(x, ii) {
    if (!x) return x
    var int = parseInt(x)
    if (!int) return ''
    if (ii == 0) return int + '\u200At'
    if (ii == 1) return int + '\u200Amin'
    if (ii == 2) return int + '\u200As'
    return x
  }
}

utils.hasRole = function (user, role) {
  if (!user) return false
  var roles = enums.userRoles
  return roles[role].order >= roles[user.role].order
}

utils.asDateTime = function(date) {
  var df = 'D.M.YYYY [klo] H:mm'
  return date ? moment(date).format(df) : ''
}

utils.asDate = function(date) {
  return date ? moment(date).format(utils.dateFormat) : ''
}

utils.parseDateRange = function(obj) {
  var format = 'DD.MM.YYYY'
  return { begin:  moment(obj.begin, format), end: moment(obj.end, format).add(1, 'days') }
}

utils.withinDateRange = function(date, beginDate, endDate) {
  return date && beginDate && endDate && date.valueOf() >= beginDate.valueOf() && date.valueOf() < endDate.valueOf()
}

utils.getProperty = function(obj, prop) {
  var path = prop.split('.')
  // Retrieve nested properties like object.billing.address
  return _.reduce(path, function(res, pathElement) {
    if (res == null) return undefined
    return res[pathElement]
  }, obj)
}

utils.setValueForPath = function(path, property, value) {
  if (path.length === 1) {
    property[path[0]] = value
  } else {
    if (!property[path[0]]) {
      if (_.isNumber(path[0])) property[path[0]] = []
      else property[path[0]] = {}
    }
    utils.setValueForPath(_.rest(path), property[path[0]], value)
  }
}

// Flattens object like { a: 1, b: { c: 2, d: 4 }} to { a: 1, b.c: 2, b.d: 4 }. Only flattens plain objects.
utils.flattenObject = function flattenObject(deepObject) {
  var resultObject = {}
  _.forEach(deepObject, function(val, key) {
    if (_.isPlainObject(val)) {
      var flatInnerObject = flattenObject(val)
      _.forEach(flatInnerObject, function(innerVal, innerKey) {
        var flatKey = key + '.' + innerKey
        resultObject[flatKey] = innerVal
      })
    } else {
      resultObject[key] = val
    }
  })
  return resultObject
}

utils.merge = function merge(x, y) {
  return _.merge({}, x, y)
}

if (isNodeJs()) module.exports = utils

function isNodeJs() { return typeof module !== 'undefined' && module.exports }


if (isNodeJs()) {
  var _ = require('lodash')
  var enums = require('./enums')
}

var utils = {}

utils.dateFormat = 'D.M.YYYY'

utils.keyValue = function(key, value) {
  var data = {}
  data[key] = value
  return data
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

utils.isValidYear = function(txt) {
  return /^\d{4}$/.test(txt) && parseInt(txt) > 1889
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
  if (!c || !c.duration) return ''
  var match = c.duration.match(/(?:(\d+)?:)?(\d+):(\d+)$/)
  if (!match) return c.duration
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
  var roles = enums.userRoles
  if (!user) return false
  return roles[role].order >= roles[user.role].order
}

utils.asDateTime = function(date) {
  var df = 'D.M.YYYY [klo] H:mm'
  return date ? moment(date).format(df) : ''
}

utils.asDate = function(date) {
  return date ? moment(date).format(utils.dateFormat) : ''
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

if (isNodeJs()) module.exports = utils

function isNodeJs() { return typeof module !== 'undefined' && module.exports }


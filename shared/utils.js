(function (exports) {
  const _ = typeof window === 'undefined' ? require('lodash') : window._
  const moment = typeof window === 'undefined' ? require('moment') : window.moment
  const enums = typeof window === 'undefined' ? require('./enums') : window.enums

  exports.dateFormat = 'D.M.YYYY'

  exports.keyValue = function(key, value) {
    const data = {}
    data[key] = value
    return data
  }

  exports.fst = function fst(x) { return x[0] }
  exports.snd = function snd(x) { return x[1] }

  exports.showBoolean = function(b) {
    if (b) return "Kyllä"
    return "Ei"
  }

  exports.showBooleanSv = function(b) {
    if (b) return "Ja"
    return "Nej"
  }


  exports.escapeRegExp = function(str) {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")
  }

  exports.seasonEpisodeCode = function(p) {
    if (!enums.util.isTvEpisode(p)) return ''
    const ints = {season: parseInt(p.season), episode: parseInt(p.episode)}
    if (ints.season === p.season && ints.episode === p.episode) {
      return 'S' + pad(ints.season) + 'E' + pad(ints.episode)
    } else if (!p.season && typeof ints.episode !== 'undefined' && ints.episode === p.episode) {
      return 'E' + ints.episode
    }
    const s = _.compact([p.season, p.episode]).join(' ')
    return s && '[' + s + ']' || s


    function pad(i) { return i < 10 ? '0' + i : '' + i }
  }

  exports.isValidUsername = function(txt) {
    return !!txt && (/^[0-9A-Za-z\u00C0-\u017F_]+$/).test(txt)
  }

  exports.isValidDuration = function(txt) {
    const m = (/(?:(\d+)?:)(\d+):(\d+)$/).exec(txt)
    if (m) {
      const mins = parseInt(m[2])
      const seconds = parseInt(m[3])
      return mins < 60 && seconds < 60
    }
    return false

  }

  exports.isEmail = function(txt) {
    const regexp = /^([A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+(\.[A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+)*)@(([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63})(\.([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63}))*\.[a-zA-Z0-9]{2,63})$/
    return regexp.test(txt)
  }

  exports.isValidYear = function(txt) {
    return (/^\d{4}$/).test(txt) && parseInt(txt) > 1889
  }

  exports.isEmptyOrValidDate = function(txt) {
    return $.trim(txt) === '' || moment(txt, exports.dateFormat).isValid()
  }

  exports.secondsToDuration = function (seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds - hours * 3600) / 60)
    const sec = seconds - hours * 3600 - minutes * 60
    const format = function (n) { return _.takeRight("00" + n, 2).join('') }
    return format(hours) + ':' + format(minutes) + ':' + format(sec)
  }

  exports.programDurationAsText = function(program) {
    const c = program.classifications[0]
    if (!c) return ''
    return exports.durationAsText(c.duration)
  }

  exports.durationAsText = function(duration) {
    if (!duration) return ''
    const match = duration.match(/(?:(\d+)?:)?(\d+):(\d+)$/)
    if (!match) return duration
    match.shift()
    return _(match).map(suffixify).compact().join(' ')

    function suffixify(x, ii) {
      if (!x) return x
      const int = parseInt(x)
      if (!int) return ''
      if (ii === 0) return int + '\u200At'
      if (ii === 1) return int + '\u200Amin'
      if (ii === 2) return int + '\u200As'
      return x
    }
  }

  exports.hasRole = function (user, role) {
    if (!user) return false
    const roles = enums.userRoles
    return roles[role].order >= roles[user.role].order
  }

  exports.asDateTime = function(date) {
    const df = 'D.M.YYYY [klo] H:mm'
    return date ? moment(date).format(df) : ''
  }

  exports.asDate = function(date) {
    return date ? moment(date).format(exports.dateFormat) : ''
  }

  exports.parseDateRange = function(obj) {
    const format = 'DD.MM.YYYY'
    const dateRange = {}
    if (obj.begin) dateRange.begin = moment(obj.begin, format)
    if (obj.end) dateRange.end = moment(obj.end, format).add(1, 'days')
    return dateRange
  }

  exports.withinDateRange = function(date, beginDate, endDate) {
    return date && beginDate && endDate && date.valueOf() >= beginDate.valueOf() && date.valueOf() < endDate.valueOf()
  }

  exports.getProperty = function(obj, prop) {
    const path = prop.split('.')
    // Retrieve nested properties like object.billing.address
    return _.reduce(path, function(res, pathElement) {
      if (res === null || res === undefined) return undefined
      return res[pathElement]
    }, obj)
  }

  exports.setValueForPath = function(path, property, value) {
    if (path.length === 1) {
      property[path[0]] = value
    } else {
      if (!property[path[0]]) {
        if (_.isNumber(path[0])) property[path[0]] = []
        else property[path[0]] = {}
      }
      exports.setValueForPath(_.tail(path), property[path[0]], value)
    }
  }

// Flattens object like { a: 1, b: { c: 2, d: 4 }} to { a: 1, b.c: 2, b.d: 4 }. Only flattens plain objects.
  exports.flattenObject = function flattenObject(deepObject) {
    const resultObject = {}
    _.forEach(deepObject, function(val, key) {
      if (_.isPlainObject(val)) {
        const flatInnerObject = flattenObject(val)
        _.forEach(flatInnerObject, function(innerVal, innerKey) {
          const flatKey = key + '.' + innerKey
          resultObject[flatKey] = innerVal
        })
      } else {
        resultObject[key] = val
      }
    })
    return resultObject
  }

  exports.merge = function merge(x, y) {
    return _.merge({}, x, y)
  }
})(typeof exports === 'undefined' ? this.utils = {} : exports)



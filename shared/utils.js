if (isNodeJs()) {
  var _ = require('lodash')
  var enums = require('./enums')
}

var utils = {}

utils.keyValue = function(key, value) {
  var data = {}
  data[key] = value
  return data
}

utils.escapeRegExp = function(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

utils.seasonEpisodeCode = function(p) {
  if (!enums.util.isTvShow(p)) return ''
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
  return /(?:(\d+)?:)?(\d+):(\d+)$/.test(txt)
}

if (isNodeJs()) module.exports = utils

function isNodeJs() { return typeof module !== 'undefined' && module.exports }


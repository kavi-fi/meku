var utils = {}

utils.escapeRegExp = function(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = utils
}


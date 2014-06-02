var fs = require('fs'),
    xml = require('xml-object-stream'),
    enums = require('../shared/enums'),
    _ = require('lodash'),
    moment = require('moment'),
    utils = require('../shared/utils')

exports.readPrograms = function (body, callback) {
  var stream = xml.parse(body)
  var programs = []

  stream.each('KUVAOHJELMA', function(xml) {
    var p = validateProgram(xml)
    programs.push(p)
  })

  stream.on('end', function() {
    return callback(null, programs)
  })
}

var validateProgram = compose([
  optional('ASIAKKAANTUNNISTE', 'customerId'),
  required('ALKUPERAINENNIMI', 'name'),
  optional('SUOMALAINENNIMI', 'name-fi'),
  optional('RUOTSALAINENNIMI', 'name-sv'),
  optional('MUUNIMI', 'name-other'),
  optional('VALMISTUMISVUOSI', 'year'),
  map(optional('MAAT', 'country'), function(p) {
    return p.country ? {country: p.country.split(' ')} : {country: []}
  }),
  optional('TUOTANTOYHTIO', 'legacy-production-companies'),
  and(requiredAttr('TYPE', 'type'), function(xml) {
    var type = xml.$.TYPE
    if (_.has(enums.legacyProgramTypes, type)) return ok({'program-type': enums.legacyProgramTypes[type]})
    else return error("Virheellinen attribuutti: TYPE")
  }),
  required('SYNOPSIS', 'synopsis'),
  optional('TUOTANTOKAUSI', 'season'),
  optional('OSA', 'episode'),
  function(xml) {
    return ok({
      'legacy-genre': optionListToArray(xml.LAJIT).map(function(g) { return enums.legacyGenres[g] })
              .concat(optionListToArray(xml['TELEVISIO-OHJELMALAJIT']).map(function(g) { return enums.legacyTvGenres[g] }))
              .concat(optionListToArray(xml.PELINLAJIT))
    })
  },
  map(childrenByNameTo('OHJAAJA', 'directors'), function(p) { return {directors: p.directors.map(fullname) }}),
  map(childrenByNameTo('NAYTTELIJA', 'actors'), function(p) { return {actors: p.actors.map(fullname) }}),
  map(node('LUOKITTELU', 'classification', [
    and(requiredAttr('REKISTEROINTIPAIVA', 'registration-date'), function(xml) {
      var d = moment(xml.$.REKISTEROINTIPAIVA, "DD.MM.YYYY HH:mm:ss")
      if (d.isValid()) return ok({'registration-date': d.toDate()})
      else return error("Virheellinen aikaformaatti: " + 'REKISTEROINTIPAIVA')
    }),
    required('FORMAATTI', 'format'),
    required('KESTO', 'duration'),
    map(childrenByNameTo('VALITTUTERMI', 'criteria'), function(p) {
      var criteriaComments = _.object(p.criteria.map(function (c) {
        return [parseInt(c.$.KRITEERI), c.$.KOMMENTTI]
      }))
      return {safe: _.isEmpty(criteriaComments), criteria: _.keys(criteriaComments), 'criteria-comments': criteriaComments}
    })
  ]), function(p) { return {classifications: [p.classification]} })
])

// validator = Xml -> Result
// validation = validator -> (program -> validator) -> validator
function flatMap(validator, f) {
  return function(xml) {
    var res = validator(xml)
    var res2 = f(res.program)(xml)
    return {program: _.merge(_.cloneDeep(res.program), _.cloneDeep(res2.program)), errors: res.errors.concat(res2.errors)}
  }
}

function map(validator, f) {
  return function(xml) {
    var res = validator(xml)
    if (res.errors.length > 0) return res
    else return {program: f(res.program), errors: []}
  }
}

function compose(xs) {
  return _.reduce(xs, function(acc, f) {
    return flatMap(acc, function(_) { return f })
  }, ret({}))
}

function and(v1, v2) {
  return function(xml) {
    var res = v1(xml)
    if (res.errors.length == 0) {
      return v2(xml)
    } else {
      return res
    }
  }
}

function ok(program) {
  return {program: program, errors: []}
}
function error(msg) {
  return {program: {}, errors: [msg]}
}

function ret(program) {
  return function(xml) {
    return {program: program, errors: []}
  }
}

function required(name, toField) {
  return function(xml) {
    if (xml[name]) return ok(utils.keyValue(toField, xml[name].$text))
    else return error(["Pakollinen kenttä puuttuu: " + name])
  }
}

function requiredAttr(name, toField) {
  return function(xml) {
    if (xml.$[name]) return ok(utils.keyValue(toField, xml.$[name]))
    else return error("Pakollinen attribuutti puuttuu: " + name)
  }
}

function optional(field, toField) {
  return function(xml) {
    if (!xml[field] || !xml[field].$text || xml[field].$text.length == 0) return {program: utils.keyValue(toField, undefined), errors: []}
    else return {program: utils.keyValue(toField, xml[field].$text), errors: []}
  }
}

function childrenByNameTo(field, toField) {
  return function(xml) {
    return {
      program: utils.keyValue(toField, childrenByName(xml, field)),
      errors: []
    }
  }
}

function node(name, toField, validators) {
  return flatMap(required(name, toField), function(p) {
    return function (xml) {
      return _.reduce(validators, function(acc, f) {
        return flatMap(acc, function(_) { return map(f, function(p) { return utils.keyValue(toField, p)}) })
      }, ret(p))(xml[name])
    }
  })
}

function fullname(node) {
  return node.ETUNIMI.$text + ' ' + node.SUKUNIMI.$text
}
function childrenByName(root, name) {
  return root.$children.filter(function(e) { return e.$name == name })
}

function optionListToArray(field) {
  if (!field || field.$text.length == 0) return []
  var arr = field.$text.split(' ').map(function(s) { return s.replace(/[\^\s]/g, '')} )
  return _(arr).compact().uniq().value()
}


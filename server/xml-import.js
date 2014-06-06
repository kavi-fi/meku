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
    programs.push(validateProgram(xml))
  })

  stream.on('end', function() {
    return callback(null, programs)
  })
}

var validateProgram = compose([
  and(requiredAttr('TYPE', 'type'), function(xml) {
    var type = xml.$.TYPE
    if (_.has(enums.legacyProgramTypes, type)) return ok({ programType: enums.legacyProgramTypes[type] })
    else return error("Virheellinen attribuutti: TYPE")
  }),
  required('ASIAKKAANTUNNISTE', 'externalId'),
  required('ALKUPERAINENNIMI', 'name'),
  flatMap(requiredAttr('TYPE', 'type'), function(p) {
    var allButTvOrOther = ['01','02','03','04','06','07','08','10','11']
    if (_.contains(allButTvOrOther, p.type)) return required('SUOMALAINENNIMI', 'nameFi')
    else return optional('SUOMALAINENNIMI', 'nameFi')
  }),
  optional('RUOTSALAINENNIMI', 'nameSv'),
  optional('MUUNIMI', 'nameOther'),
  optional('JULKAISUVUOSI', 'year'),
  optional('VALMISTUMISVUOSI', 'year'),
  flatMap(optional('MAAT'), function(p) {
    var countries = p.MAAT ? p.MAAT.split(' ') : []
    return function(xml) {
      if (_.all(countries, _.curry(_.has)(enums.countries))) return ok({country: countries})
      else return error('Virheellinen MAAT kenttä: ' + countries)
    }
  }),
  map(childrenByNameTo('TUOTANTOYHTIO', 'productionCompanies'), function(p) { return { productionCompanies: p.productionCompanies.map(text) } }),
  required('SYNOPSIS', 'synopsis'),
  optional('TUOTANTOKAUSI', 'season'),
  optional('OSA', 'episode'),
  flatMap(requiredAttr('TYPE', 'type'), function(p) {
    return p.type == '03' ? required('ISANTAOHJELMA', 'parentTvSeriesName') : optional('ISANTAOHJELMA', 'parentTvSeriesName')
  }),
  map(compose([
    valuesInEnum('LAJIT', enums.legacyGenres),
    valuesInEnum('TELEVISIO-OHJELMALAJIT', enums.legacyTvGenres),
    valuesInList('PELINLAJIT', enums.legacyGameGenres)
  ]), function(p) {
    return { legacyGenre: p.LAJIT.concat(p['TELEVISIO-OHJELMALAJIT']).concat(p.PELINLAJIT) }
  }),
  map(childrenByNameTo('OHJAAJA', 'directors'), function(p) { return {directors: p.directors.map(fullname) }}),
  map(childrenByNameTo('NAYTTELIJA', 'actors'), function(p) { return {actors: p.actors.map(fullname) }}),
  map(required('LUOKITTELIJA', 'author'), function(p) { return { classifications: [{ author: { name: p.author } }] }}),
  map(node('LUOKITTELU', 'classification', [
    and(requiredAttr('REKISTEROINTIPAIVA', 'registrationDate'), function(xml) {
      var d = moment(xml.$.REKISTEROINTIPAIVA, "DD.MM.YYYY HH:mm:ss")
      if (d.isValid()) return ok({ registrationDate: d.toDate() })
      else return error("Virheellinen aikaformaatti: " + 'REKISTEROINTIPAIVA')
    }),
    mapError(or(
      and(required('FORMAATTI'), valueInList('FORMAATTI', enums.format, 'format')),
      and(required('PELIFORMAATTI'), valueInList('PELIFORMAATTI', enums.gameFormat, 'format'))
    ), function(errors) {
      return "FORMAATTI tai PELIFORMAATTI virheellinen"
    }),
    and(required('KESTO'), test('KESTO', utils.isValidDuration, "Virheellinen kesto", 'duration')),
    map(childrenByNameTo('VALITTUTERMI', 'criteria'), function(p) {
      var criteriaComments = _.object(p.criteria.map(function (c) {
        return [parseInt(c.$.KRITEERI), c.$.KOMMENTTI]
      }))
      return {safe: _.isEmpty(criteriaComments), criteria: _.keys(criteriaComments), criteriaComments: criteriaComments}
    })
  ]), function(p) { return {classifications: [p.classification], gameFormat: p.classification.gameFormat} })
])

// validator = Xml -> Result
// validation = validator -> (program -> validator) -> validator
function flatMap(validator, f) {
  return function(xml) {
    var res = validator(xml)
    var res2 = f(res.program)(xml)
    var errors = _(res.errors.concat(res2.errors)).flatten().uniq().value()
    return {program: _.merge(_.cloneDeep(res.program), _.cloneDeep(res2.program)), errors: errors}
  }
}

function map(validator, f) {
  return function(xml) {
    var res = validator(xml)
    if (res.errors.length > 0) return res
    else return {program: f(res.program), errors: []}
  }
}

function mapError(v, f) {
  return function(xml) {
    var res = v(xml)
    if (res.errors.length > 0) return error([f(res.errors)])
    else return res
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

function or(v1, v2) {
  return function(xml) {
    var res = v1(xml)
    if (res.errors.length > 0) {
      var res2 = v2(xml)
      console.log(res.errors)
      console.log(res2.errors)
      return {program: res2.program, errors: _.flatten(res.errors.concat(res2.errors))}
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
    toField = toField || name
    var val = xml[name]
    if (val && val.$text !== '' && val.$text !== undefined) return ok(utils.keyValue(toField, xml[name].$text))
    else return error(["Pakollinen kenttä puuttuu: " + name])
  }
}

function requiredNode(name, toField) {
  return function(xml) {
    toField = toField || name
    if (xml[name]) return ok(utils.keyValue(toField, xml[name].$text))
    else return error(["Pakollinen elementti puuttuu: " + name])
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
    toField = toField || field
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

function valuesInEnum(field, _enum) {
  return function(xml) {
    var values = optionListToArray(xml[field]).map(function(g) { return _enum[g] })
    if (_.all(values, function(v) { return v !== undefined })) return ok(utils.keyValue(field, values))
    else return error("Virheellinen kenttä " + field)
  }
}

function valuesInList(field, list) {
  return function(xml) {
    var values = optionListToArray(xml[field])
    var exists = values.map(_.curry(_.contains)(list))
    if (_.all(exists)) return ok(utils.keyValue(field, values))
    else return error("Virheellinen kenttä " + field)
  }
}

function valueInList(field, list) {
  return function(xml) {
    var value = xml[field].$text
    if (_.contains(list, value)) return ok(utils.keyValue(field, value))
    else return error("Virheellinen kenttä " + field)
  }
}

function node(name, toField, validators) {
  return flatMap(requiredNode(name, toField), function(p) {
    return function (xml) {
      return _.reduce(validators, function(acc, f) {
        return flatMap(acc, function(_) { return map(f, function(p) { return utils.keyValue(toField, p)}) })
      }, ret(p))(xml[name])
    }
  })
}

function test(field, f, msg, toField) {
  return function(xml) {
    var text = xml[field].$text
    if (f(text)) return ok(utils.keyValue(toField || field, text))
    else return error(msg + " " + text)
  }
}
function text(node) {
  return node.$text
}
function fullname(node) {
  return node.ETUNIMI.$text + ' ' + node.SUKUNIMI.$text
}
function childrenByName(root, name) {
  return root.$children.filter(function(e) { return e.$name == name })
}

function optionListToArray(field, sep) {
  sep = sep || ' '
  if (!field || field.$text.length == 0) return []
  var arr = field.$text.split(sep).map(function(s) { return s.replace(/[\^\s]/g, '')} )
  return _(arr).compact().uniq().value()
}


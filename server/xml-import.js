const XmlStream = require('xml-stream'),
    enums = require('../shared/enums'),
    _ = require('lodash'),
    utils = require('../shared/utils')

exports.readPrograms = function (body, callback) {
  const stream = new XmlStream(body)
  const programs = []

  stream.collect('TUOTANTOYHTIO')
  stream.collect('OHJAAJA')
  stream.collect('NAYTTELIJA')
  stream.collect('VALITTUTERMI')

  stream.on('error', (err) => {
    callback(err, [])
  })

  stream.on('endElement: KUVAOHJELMA', (xml) => {
    programs.push(validateProgram(xml))
  })

  stream.on('end', () => callback(null, programs))
}

const format = flatMap(requiredAttr('TYPE', 'type'), (p) => {
  const cls = _.curry(node)('LUOKITTELU', 'classification')
  if (p.type === '08') {
    return map(cls([and(required('PELIFORMAATTI'), valueInList('PELIFORMAATTI', enums.gameFormat, 'gameFormat'))]), (q) => ({gameFormat: q.classification.gameFormat}))
  }
    return cls([and(required('FORMAATTI'), valueInList('FORMAATTI', enums.format, 'format'))])

})

const validateProgram = map(compose([
  and(requiredAttr('TYPE', 'type'), (xml) => {
    const type = xml.$.TYPE
    if (type !== '05' && _.has(enums.legacyProgramTypes, type)) return ok({programType: enums.legacyProgramTypes[type]})
    return error("Virheellinen attribuutti: TYPE")
  }),
  required('ASIAKKAANTUNNISTE', 'externalId'),
  required('ALKUPERAINENNIMI', 'name'),
  flatMap(requiredAttr('TYPE', 'type'), (p) => {
    const allButTvOrOther = ['01', '02', '03', '04', '06', '07', '08', '10', '11']
    if (_.includes(allButTvOrOther, p.type)) return required('SUOMALAINENNIMI', 'nameFi')
    return optional('SUOMALAINENNIMI', 'nameFi')
  }),
  optional('RUOTSALAINENNIMI', 'nameSv'),
  optional('MUUNIMI', 'nameOther'),
  optional('JULKAISUVUOSI', 'year'),
  optional('VALMISTUMISVUOSI', 'year'),
  flatMap(optional('MAAT'), (p) => {
    const countries = p.MAAT ? p.MAAT.split(' ') : []
    return function () {
      if (_.every(countries, _.curry(_.has)(enums.countries))) return ok({country: countries})
      return error('Virheellinen MAAT kenttä: ' + countries)
    }
  }),
  map(childrenByNameTo('TUOTANTOYHTIO', 'productionCompanies'), (p) => ({productionCompanies: p.productionCompanies})),
  required('SYNOPSIS', 'synopsis'),
  flatMap(requiredAttr('TYPE', 'type'), (p) => (p.type === '03' ? and(optional('TUOTANTOKAUSI', 'season'), testOptional('TUOTANTOKAUSI', isInt, "Virheellinen TUOTANTOKAUSI", 'season')) : ret({}))),
  flatMap(requiredAttr('TYPE', 'type'), (p) => (p.type === '03' ? and(required('OSA'), test('OSA', isInt, "Virheellinen OSA", 'episode')) : ret({}))),
  flatMap(requiredAttr('TYPE', 'type'), (p) => (p.type === '03' ? required('ISANTAOHJELMA', 'parentTvSeriesName') : ret({}))),
  map(compose([
    valuesInEnum('LAJIT', enums.legacyGenres),
    valuesInEnum('TELEVISIO-OHJELMALAJIT', enums.legacyTvGenres),
    valuesInList('PELINLAJIT', enums.legacyGameGenres)
  ]), (p) => ({legacyGenre: p.LAJIT.concat(p['TELEVISIO-OHJELMALAJIT']).concat(p.PELINLAJIT)})),
  map(childrenByNameTo('OHJAAJA', 'directors'), (p) => ({directors: p.directors.map(fullname)})),
  map(childrenByNameTo('NAYTTELIJA', 'actors'), (p) => ({actors: p.actors.map(fullname)})),
  map(required('LUOKITTELIJA', 'author'), (p) => ({classification: {author: {name: p.author}}})),
  format,
  node('LUOKITTELU', 'classification', [
    and(required('KESTO'), test('KESTO', utils.isValidDuration, "Virheellinen kesto", 'duration')),
    flatMap(childrenByNameTo('VALITTUTERMI', 'criteria'), (p) => {
      const validCriteria = enums.classificationCriteria.map((x) => x.id)
      const errors = _.flatten(p.criteria.map((c) => and(requiredAttr('KRITEERI'), (xml) => {
          const criteria = parseInt(xml.$.KRITEERI)
          if (_.includes(validCriteria, criteria)) return ok({})
          return error('Virheellinen attribuutti KRITEERI ' + criteria)
        })(c).errors))
      if (errors.length > 0) return function () { return {program: {}, errors: errors} }
      const criteriaComments = _.zipObject(p.criteria.map((c) => c.$.KRITEERI), p.criteria.map((c) => c.$.KOMMENTTI))
      return function () { return ok({safe: _.isEmpty(criteriaComments), criteria: _.keys(criteriaComments), criteriaComments: criteriaComments}) }
    })
  ])
]), (p) => { p.classifications = [p.classification]; delete p.classification; return p })

/*
 * validator = Xml -> Result
 * validation = validator -> (program -> validator) -> validator
 */
function flatMap(validator, f) {
  return function (xml) {
    const res = validator(xml)
    const res2 = f(res.program)(xml)
    const errors = _(res.errors.concat(res2.errors)).flatten().uniq().value()
    return {program: _.merge(_.cloneDeep(res.program), _.cloneDeep(res2.program)), errors: errors}
  }
}

function flatMapAnd(validator, f) {
  return function (xml) {
    const res = validator(xml)
    if (res.errors.length === 0) {
      return f(res.program)(xml)
    }
      return res

  }
}

function map(validator, f) {
  return function (xml) {
    const res = validator(xml)
    if (res.errors.length > 0) return res
    return {program: f(res.program), errors: []}
  }
}

// eslint-disable-next-line no-unused-vars
function mapError(v, f) {
  return function (xml) {
    const res = v(xml)
    if (res.errors.length > 0) return error([f(res.errors)])
    return res
  }
}

function compose(xs) {
  return _.reduce(xs, (acc, f) => flatMap(acc, () => f), ret({}))
}

function and(v1, v2) {
  return function (xml) {
    const res = v1(xml)
    if (res.errors.length === 0) {
      return v2(xml)
    }
      return res

  }
}

// eslint-disable-next-line no-unused-vars
function or(v1, v2) {
  return function (xml) {
    const res = v1(xml)
    if (res.errors.length > 0) {
      return v2(xml)
    }
      return res

  }
}

function ok(program) {
  return {program: program, errors: []}
}
function error(msg) {
  return {program: {}, errors: [msg]}
}

function ret(program) {
  return function () {
    return {program: program, errors: []}
  }
}

function required(name, toField) {
  return function (xml) {
    const field = toField || name
    const val = xml[name]
    if (val && val !== '') return ok(utils.keyValue(field, val))
    return error(["Pakollinen kenttä puuttuu: " + name])
  }
}

function requiredNode(name, toField) {
  return function (xml) {
    const field = toField || name
    if (xml[name]) return ok(utils.keyValue(field, xml[name]))
    return error(["Pakollinen elementti puuttuu: " + name])
  }
}

function requiredAttr(name, toField) {
  return function (xml) {
    if (xml.$[name]) return ok(utils.keyValue(toField, xml.$[name]))
    return error("Pakollinen attribuutti puuttuu: " + name)
  }
}

function optional(fromField, toField) {
  return function (xml) {
    const field = toField || fromField
    if (!xml[fromField] || xml[fromField].length === 0) {
      return {program: {}, errors: []}
    }
      return {program: utils.keyValue(field, xml[fromField].trim()), errors: []}

  }
}

function childrenByNameTo(field, toField) {
  return function (xml) {
    return {
      program: utils.keyValue(toField, childrenByName(xml, field)),
      errors: []
    }
  }
}

function valuesInEnum(field, _enum) {
  return function (xml) {
    const values = optionListToArray(xml[field]).map((g) => _enum[g])
    if (_.every(values, (v) => v !== undefined)) return ok(utils.keyValue(field, values))
    return error("Virheellinen kenttä " + field)
  }
}

function valuesInList(field, list) {
  return function (xml) {
    const values = optionListToArray(xml[field])
    const exists = values.map(_.curry(_.includes)(list))
    if (_.every(exists)) return ok(utils.keyValue(field, values))
    return error("Virheellinen kenttä " + field)
  }
}

function valueInList(fromField, list, toField) {
  return function (xml) {
    const field = toField || fromField
    const value = xml[fromField]
    if (_.includes(list, value)) return ok(utils.keyValue(field, value))
    return error("Virheellinen kenttä " + fromField)
  }
}

// eslint-disable-next-line no-unused-vars
function attrInList(attr, list) {
  return function (xml) {
    const value = xml.$[attr]
    if (_.includes(list.map((x) => x.toString()), value)) return ok(utils.keyValue(attr, value))
    return error("Virheellinen arvo atribuutille " + attr + ": " + value)
  }
}

function node(name, toField, validators) {
  return flatMapAnd(requiredNode(name, toField), (p) => function (xml) {
      return _.reduce(validators, (acc, f) => flatMap(acc, () => map(f, (q) => utils.keyValue(toField, q))), ret(p))(xml[name])
    })
}

function test(field, f, msg, toField) {
  return function (xml) {
    const text = xml[field]
    if (f(text)) return ok(utils.keyValue(toField || field, text))
    return error(msg + " " + text)
  }
}

function testOptional(field, f, msg, toField) {
  return function (xml) {
    if (!xml[field]) return ok({})
    const text = xml[field]
    if (f(text)) return ok(utils.keyValue(toField || field, text))
    return error(msg + " " + text)
  }
}

function fullname(elem) {
  return elem.ETUNIMI + ' ' + elem.SUKUNIMI
}
function childrenByName(root, name) {
  return root[name] ? _.isArray(root[name]) ? root[name] : [root[name]] : []
}

function isInt(val) { return val.match(/\d+/) !== null }

function optionListToArray(field, sep) {
  const separator = sep || ' '
  if (!field || field.length === 0) return []
  const arr = field.split(separator).map((s) => s.replace(/[\^\s]/g, ''))
  return _(arr).compact().uniq().value()
}


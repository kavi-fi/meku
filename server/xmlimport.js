var fs = require('fs'),
    xml = require('xml-object-stream'),
    _ = require('lodash'),
    moment = require('moment'),
    utils = require('../shared/utils')

exports.readPrograms = function (body, callback) {
  var stream = xml.parse(body)
  var programs = []
  var validate = _.reduce([
    required('ALKUPERAINENNIMI', 'name'),
    optional('SUOMALAINENNIMI', 'name-fi'),
    optional('RUOTSALAINENNIMI', 'name-sv'),
    optional('MUUNIMI', 'name-other'),
    optional('VALMISTUMISVUOSI', 'year'),
    map(optional('MAAT', 'country'), function(p) { return p.country ? {country: p.country.split(' ')} : {country: []} }),
    optional('TUOTANTOYHTIO', 'legacy-production-companies'),
    map(requiredAttr('TYPE', 'type'), function(p) { return { 'program-type': legacyProgramTypes[p.type] }}),
    required('SYNOPSIS', 'synopsis'),
    optional('TUOTANTOKAUSI', 'season'),
    optional('OSA', 'episode'),
    function(xml) { return {
      program: {'legacy-genre': optionListToArray(xml.LAJIT).map(function(g) { return legacyGenres[g] })
          .concat(optionListToArray(xml['TELEVISIO-OHJELMALAJIT']).map(function(g) { return legacyTvGenres[g] }))
          .concat(optionListToArray(xml.PELINLAJIT))},
      errors: []
    }},
    map(childrenByNameTo('OHJAAJA', 'directors'), function(p) { return {directors: p.directors.map(fullname) }}),
    map(childrenByNameTo('NAYTTELIJA', 'actors'), function(p) { return {actors: p.actors.map(fullname) }}),
    node('LUOKITTELU', 'classification', [
      map(requiredAttr('REKISTEROINTIPAIVA', 'registration-date'), function(p) {
        return {'registration-date': moment(p['registration-date'], "DD.MM.YYYY HH:mm:ss").toDate()}
      }),
      required('FORMAATTI', 'format'),
      required('KESTO', 'duration'),
      map(childrenByNameTo('VALITTUTERMI', 'criteria'), function(p) {
        var criteriaComments = _.object(p.criteria.map(function (c) {
          return [parseInt(c.$.KRITEERI), c.$.KOMMENTTI]
        }))
        return {safe: _.isEmpty(criteriaComments), criteria: _.keys(criteriaComments), 'criteria-comments': criteriaComments}
      })
    ])
  ], function(acc, f) {
    return flatMap(acc, function(_) { return f })
  }, ret({}))

  stream.each('KUVAOHJELMA', function(program) {
    programs.push(validate(program))
  })

  stream.on('end', function() {
    callback(null, programs)
  })
}

// validator = Xml -> Result
// validation = validator -> (program -> validator) -> validator
function flatMap(validator, f) {
  return function(xml) {
    var res = validator(xml)
    var res2 = f(res.program)(xml)
    return {program: _.merge(res.program, res2.program), errors: res.errors.concat(res2.errors)}
  }
}

function map(validator, f) {
  return function(xml) {
    var res = validator(xml)
    if (res.errors.length > 0) return res
    else return {program: f(res.program), errors: []}
  }
}

function ret(program) {
  return function(xml) {
    return {program: program, errors: []}
  }
}

function required(name, toField) {
  return function(xml) {
    if (xml[name]) return {program: _.object([[toField, xml[name].$text]]), errors: []}
    else return {program: {}, errors: ["Pakollinen kenttä puuttuu: " + name]}
  }
}

function requiredAttr(name, toField) {
  return function(xml) {
    if (xml.$[name]) return {program: utils.keyValue(toField, xml.$[name]), errors: []}
    else return {program: {}, errors: ["Pakollinen attribuutti puuttuu: " + name]}
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
  var arr = field.$text.split(',').map(function(s) { return s.replace(/[\^\s]/g, '')} )
  return _(arr).compact().uniq().value()
}

var legacyGenres = {
  '1': 'Fiktio',
  '2': 'Animaatio',
  '3': 'Viihde',
  '4': 'Seksi / Erotiikka',
  '5': 'Dokumentti',
  '6': 'Lasten ohjelmat',
  '9': 'Muut',
  '1a': 'Romantiikka',
  '1b': 'Draama',
  '1c': 'Historiallinen näytelmä',
  '1d': 'Trilleri',
  '1e': 'Seikkailu',
  '1f': 'Western',
  '1g': 'Sota',
  '1h': 'Kauhu',
  '1j': 'Tieteisseikkailu',
  '1k': 'Toimintaelokuva',
  '1m': 'Fantasia',
  '1n': 'Komedia ja farssi',
  '3c': 'Musiikki',
  '5a': 'Opetus',
  '5b': 'Urheilu',
  '5c': 'Matkailu',
  '5d': 'Henkilödokumentti',
  '5e': 'Luontodokumentti',
  '6a': 'Lasten animaatio',
  '6b': 'Lasten fiktio',
  '6c': 'Muu lastenelokuva',
  '9a': 'Mainonta',
  '9c': 'Tietoisku',
  '9d': 'Kokeiluelokuva',
  '9e': 'Videotaide',
  '7a': 'Trailer',
  '7b': 'Extra'
}
var legacyTvGenres = {
  '2': 'Ajankohtaisohjelmat',
  '3': 'Asiaohjelmat/kulttuuri/lifestyle',
  '4': 'Urheilu',
  '5': 'Kotimainen fiktio',
  '6': 'Ulkomainen fiktio',
  '7': 'Elokuvat',
  '8': 'Lasten ohjelmat',
  '9': 'Opetus- ja tiedeohjelmat',
  '10': 'Viihde/kevyt musiikki/reality',
  '11': 'Muu musiikki',
  '12': 'Muut ohjelmat',
  '1.': 'Uutiset',
  '1.1': 'Vakiouutiset',
  '1.2': 'Muut uutislähetykset',
  '3.1': 'Asiaohjelmat/lifestyle',
  '3.2': 'Kulttuuriohjelmat',
  '4.1': 'Urheilu-uutiset',
  '4.2': 'Muu urheilu',
  '7.1': 'Kotimaiset elokuvat',
  '7.2': 'Ulkomaiset elokuvat',
  '12.1': 'Ostos-TV',
  '12.2': 'WWW (peliohjelmat, chatit)',
  '10.1': 'Kotimainen viihde/kevyt musiikki/reality',
  '10.2': 'Ulkomainen viihde/kevyt musiikki/reality',
  '13': 'Populaarikulttuuri'
}

var legacyProgramTypes = {
  '01': 1,       //'Kotimainen elokuva' -> movie
  '02': 1,       //'Ulkomainen elokuva' -> movie
  '02b': 0,    // 'TESTI' -> unknown
  '03': 3,       //'TV-sarjan jakso' -> tv
  '04': 3,       // 'Muu tv-ohjelma' -> tv
  '05': 2,       // 'TV-sarjan nimi' -> series
  '06': 5,       // 'Traileri' -> trailer
  '07': 4,       // 'Extra' -> extra
  '08': 6,       // 'Peli' -> game
  '10': 0,      // 'Yhteistuotanto' -> unknown
  '11': 7,      // 'PEGI hyväksytty peli' -> game
  '12': 0       // 'Muu kuvaohjelma' -> unknown
}

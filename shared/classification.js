if (typeof module !== 'undefined' && module.exports) {
  _ = require('lodash')
  enums = require('./enums')
}

(function(exports) {

var summary = exports.summary = function(program, classification) {
  if (enums.util.isPegiGame(program)) {
    return { pegi: true, age: classification['legacy-age-limit'], warnings: classification.pegiWarnings }
  } else {
    if (classification.safe) return { age:'S', warnings:[] }
    var maxAgeLimit = classificationAgeLimit(classification)
    var warnings = _(classification.criteria)
      .map(function(id) { return enums.classificationCriteria[id - 1] })
      .filter(function(c) { return c.age == maxAgeLimit })
      .map(function(c) { return c.category })
      .reduce(function(accum, c) { if (accum.indexOf(c) == -1) accum.push(c); return accum }, [])
    if (classification['warning-order'].length > 0) {
      var order = classification['warning-order']
      warnings = warnings.sort(function(a, b) {
        return order.indexOf(a) - order.indexOf(b)
      })
    }
    return { age: maxAgeLimit, warnings: warnings }
  }
}

var classificationText = function(classification) {
  var criteria = criteriaText(classification.warnings)
  if (classification.age === 'S') {
    return 'Kuvaohjelma on sallittu.'
  } else {
    return 'Kuvaohjelman ikäraja on ' + classification.age
         + ' vuotta ja ' + (classification.warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
         + criteria
  }
}

var criteriaText = exports.criteriaText = function(warnings) {
  return warnings.map(function(x) { return classificationCategory_FI[x] }).join(', ')
}

exports.registrationEmail = function(movie) {
  var subject = "Luokittelupäätös: <%- name %>, <%- year %>, <%- classificationShort %>"
  var text =
    "<%- date %>\n<%- buyer %>\n\n" +
    "Ilmoitus kuvaohjelman luokittelusta\n\n" +
    "Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö on <%- date %> tilauksestanne luokitellut kuvaohjelman <%- name %>. <%- classification %>.\n\n" +

    "Liitteet:\n" +
    "KAVIN mediakasvatus- ja kuvaohjelmayksikön päätös\n" +
    "Valitusosoitus\n"

    "Kansallinen audiovisuaalinen instituutti (KAVI)\n" +
    "Mediakasvatus- ja kuvaohjelmayksikkö"

  var now = new Date()
  var dateString = now.getDate() + '.' + (now.getMonth() + 1) + '.' + now.getFullYear()
  var classification = _.first(movie.classifications)
  var buyer = classification.buyer ? classification.buyer.name : ''
  var classificationSummary = summary(movie, classification)
  var recipients = classification['registration-email-addresses'].map(function(e) { return e.email })

  var data = {
    date: dateString,
    buyer: buyer,
    name: movie.name.join(', '),
    year: movie.year || '',
    classification: classificationText(classificationSummary),
    classificationShort: classificationSummary.age + ' ' + criteriaText(classificationSummary.warnings)
  }

  return {
    recipients: recipients,
    from: "no-reply@kavi.fi",
    subject: _.template(subject, data),
    body: _.template(text, data)
  }
}

})(typeof exports === 'undefined'? this['classification']={}: exports)



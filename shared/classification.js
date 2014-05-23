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
    var maxAgeLimit = ageLimit(classification)
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
         + criteria + '.'
  }
}

var criteriaText = exports.criteriaText = function(warnings) {
  return warnings.map(function(x) { return enums.classificationCategoriesFI[x] }).join(', ')
}

var status = exports.status = function (classification) {
  var df = 'D.M.YYYY [klo] H:mm'
  switch (classification.status) {
    case 'registered':
    case 'reclassification1':
    case 'reclassification3':
      return 'Rekisteröity '+moment(classification['registration-date']).format(df)
    case 'in_process':
      return 'Luonnos tallennettu '+moment(classification['creation-date']).format(df)
    default:
      return 'Unknown status: '+classification.status
  }
}

exports.fullStatus = function(classifications) {
  if (!classifications || classifications.length == 0) return ['Ei luokiteltu']
  if (classifications.length == 1) return [status(classifications[0])]
  var head = classifications[0]
  if (head.status == 'in_process') {
    return [status(classifications[1]), status(head)]
  } else {
    return [status(head)]
  }
}

exports.mostValid = function(classifications) {
  if (!classifications || classifications.length == 0) return undefined
  if (classifications.length == 1) return classifications[0]
  var head = classifications[0]
  if (head.status == 'in_process') {
    return classifications[1]
  } else {
    return head
  }

}

var ageLimit = exports.ageLimit = function(classification) {
  if (!classification) return '-'
  if (classification.safe) return 'S'
  if (classification.criteria.length == 0 && classification['legacy-age-limit']) return classification['legacy-age-limit']
  return _(classification.criteria)
    .map(function(id) { return enums.classificationCriteria[id - 1] })
    .pluck('age')
    .reduce(maxAge) || 'S'

  function maxAge(prev, curr) {
    if (curr == 'S') return prev
    if (prev == 'S') return curr
    return parseInt(curr) > prev ? curr : prev
  }
}

exports.registrationEmail = function(movie, user) {
  var linkOther = {
    url: "http://www.meku.fi/index.php?option=com_docman&task=doc_download&gid=3&Itemid=377&lang=fi",
    name: "Oikaisuvaatimusohje"
  }
  var linkKavi = {url: "http://www.meku.fi/", name: "Valitusosoitus"}

  var subject = "Luokittelupäätös: <%- name %>, <%- year %>, <%- classificationShort %>"
  var text =
    "<p><%- date %><br/><%- buyer %></p><p>Ilmoitus kuvaohjelman luokittelusta</p>" +
    ((user.role == 'kavi') ? "<p>Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö " : user.name) +
    ' on <%- date %> tilauksestanne luokitellut kuvaohjelman <%- name %>. <%- classification %></p>' +
    ((user.role == 'kavi') ? '<p>Perusteet: <%- publicComments %></p>' : '') +
    '<p>Liitteet:<br/><a href="<%- link.url %>"><%- link.name %></a></p>' +
    '<p>Kansallinen audiovisuaalinen instituutti (KAVI)<br/>' +
    'Mediakasvatus- ja kuvaohjelmayksikkö</p>'

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
    classificationShort: classificationSummary.age + ' ' + criteriaText(classificationSummary.warnings),
    link: (user.role == 'kavi') ? linkKavi : linkOther,
    publicComments: classification.publicComments
  }

  return {
    recipients: recipients,
    from: "no-reply@kavi.fi",
    subject: _.template(subject, data),
    body: _.template(text, data)
  }
}

exports.createNew = function(user) {
  return {
    'creation-date':new Date(),
    status: 'in_process',
    author: { _id: user._id, name: user.name }
  }
}

})(typeof exports === 'undefined'? this['classification']={}: exports)



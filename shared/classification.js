if (typeof module !== 'undefined' && module.exports) {
  _ = require('lodash')
  enums = require('./enums')
}

(function(exports) {

var summary = exports.summary = function(program, classification) {
  if (classification.safe) return { age:'S', warnings:[] }
  var maxAgeLimit = ageLimit(classification)
  var warnings = _(classification.criteria)
    .map(function(id) { return enums.classificationCriteria[id - 1] })
    .filter(function(c) { return c.age == maxAgeLimit })
    .map(function(c) { return {id: c.id, category: c.category} })
    .reduce(function(accum, c) { if (!_.some(accum, { category: c.category })) accum.push(c); return accum }, [])
  if (classification.warningOrder.length > 0) {
    var order = classification.warningOrder
    warnings = warnings.sort(function(a, b) {
      return order.indexOf(a.category) - order.indexOf(b.category)
    })
  }
  return { age: maxAgeLimit, warnings: warnings }
}

var classificationText = function(classification) {
  if (classification.age === 'S') {
    return 'Kuvaohjelma on sallittu.'
  } else {
    return 'Kuvaohjelman ikäraja on ' + classification.age
         + ' vuotta ja ' + (classification.warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
         + criteriaText(classification.warnings) + '.'
  }
}

var criteriaText = exports.criteriaText = function(warnings) {
  return warnings.map(function(x) { return enums.classificationCategoriesFI[x.category] + '(' + x.id + ')' }).join(', ')
}

var status = exports.status = function (classification) {
  switch (classification.status) {
    case 'registered':
    case 'reclassification1':
    case 'reclassification3':
      return 'Rekisteröity '+asDate(classification.registrationDate)
    case 'in_process':
      return 'Luonnos tallennettu '+asDate(classification.creationDate)
    default:
      return 'Unknown status: '+classification.status
  }

  function asDate(date) {
    var df = 'D.M.YYYY [klo] H:mm'
    return date ? moment(date).format(df) : ''
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

var isReclassification = exports.isReclassification = function(program) {
  return program.classifications.length > 1
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
  if (classification.criteria.length == 0 && classification.legacyAgeLimit) return classification.legacyAgeLimit
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

exports.registrationEmail = function(program, user) {
  var linkOther = { url: "https://kavi.fi/fi/meku/luokittelu/oikaisuvaatimusohje", name: "Oikaisuvaatimusohje" }
  var linkKavi = { url: "https://kavi.fi/fi/meku/luokittelu/valitusosoitus", name: "Valitusosoitus" }
  var subject = "Luokittelupäätös: <%= name %>, <%- year %>, <%- classificationShort %>"
  var text =
    "<p><%- date %><br/><%- buyer %></p><p>" +
    (isReclassification(program) ? "Ilmoitus kuvaohjelman uudelleenluokittelusta" : "Ilmoitus kuvaohjelman luokittelusta") + "</p>" +
    "<p>" + ((user.role == 'kavi') ? "Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö " : user.name) +
    ' on <%- date %> luokitellut kuvaohjelman <%- name %>. <%- classification %></p>' +
    ((user.role == 'kavi' && isReclassification(program)) ? '<p>Syy uudelleenluokittelulle: <%- reason %>. Perustelut: <%- publicComments %></p>' : '') +
    ((user.role == 'kavi') ? '<p>Lisätietoja erityisasiantuntija: <a href="mailto:<%- authorEmail %>"><%- authorEmail %></a></p>' : '') +
    '<p>Liitteet:<br/><a href="<%- link.url %>"><%- link.name %></a></p>' +
    '<p>Kansallinen audiovisuaalinen instituutti (KAVI)<br/>' +
    'Mediakasvatus- ja kuvaohjelmayksikkö</p>'

  var now = new Date()
  var dateString = now.getDate() + '.' + (now.getMonth() + 1) + '.' + now.getFullYear()
  var classification = _.first(program.classifications)
  var buyer = classification.buyer ? classification.buyer.name : ''
  var classificationSummary = summary(program, classification)
  var recipients = classification.registrationEmailAddresses.map(function(e) { return e.email })

  function previousRecipients(classifications) {
    if (classifications.length > 1) {
      return classifications[1].registrationEmailAddresses.map(function(email) { return email.email })
    } else {
      return []
    }
  }

  var data = {
    date: dateString,
    buyer: buyer,
    name: program.name.join(', '),
    year: program.year || '',
    classification: classificationText(classificationSummary),
    classificationShort: classificationSummary.age + ' ' + criteriaText(classificationSummary.warnings),
    link: (user.role == 'kavi') ? linkKavi : linkOther,
    publicComments: classification.publicComments,
    authorEmail: user.email,
    reason: classification.reason !== undefined ? enums.reclassificationReason[classification.reason] : 'ei määritelty'
  }

  return {
    recipients: recipients.concat(previousRecipients(program.classifications)),
    from: "no-reply@kavi.fi",
    subject: _.template(subject, data),
    body: _.template(text, data)
  }
}

exports.createNew = function(user) {
  return {
    creationDate: new Date(),
    status: 'in_process',
    author: { _id: user._id, name: user.name }
  }
}

exports.classificationPrice = function(duration) {
  // https://kavi.fi/fi/meku/kuvaohjelmat/maksut

  // min, max, price €
  var priceList = [
    [0, 30, 55],
    [30, 60, 109],
    [60, 90, 164],
    [90, 120, 217],
    [120, 150, 272],
    [150, 180, 326],
    [180, 210, 381],
    [210, 240, 435]
  ]

  if (duration == 0) return priceList[0][2] * 100

  if (duration > (240 * 60)) return Math.round(1.82 * (duration / 60))

  var price = _.find(priceList, function(price) {
    var min = (price[0] * 60), max = (price[1] * 60)
    return duration > min && duration <= max
  })
  return price[2] * 100
}

// see enums.reclassificationReason
exports.isRemediationRequest = function(val) {
  return val == 3
}

})(typeof exports === 'undefined'? this['classification']={}: exports)



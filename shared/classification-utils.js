if (typeof module !== 'undefined' && module.exports) {
  _ = require('lodash')
  enums = require('./enums')
  utils = require('./utils')
}

(function(exports) {

exports.fullSummary = function(program) {
  var c = enums.util.isTvSeriesName(program) ? tvSeriesClassification(program.episodes) : program.classifications[0]
  return summary(c)
}

var summary = exports.summary = function(classification) {
  if (!classification) return undefined
  if (classification.safe) return { age:0, warnings:[] }
  var maxAgeLimit = ageLimit(classification)
  var warnings = _(classification.criteria)
    .map(function(id) { return enums.classificationCriteria[id - 1] })
    .filter(function(c) { return c.age > 0 && c.age == maxAgeLimit })
    .map(function(c) { return {id: c.id, category: c.category} })
    .reduce(function(accum, c) { if (!_.some(accum, { category: c.category })) accum.push(c); return accum }, [])
  if (classification.warningOrder && classification.warningOrder.length > 0) {
    var order = classification.warningOrder
    warnings = warnings.sort(function(a, b) {
      return order.indexOf(a.category) - order.indexOf(b.category)
    })
  }
  return { age: maxAgeLimit, warnings: warnings }
}

var tvSeriesClassification = exports.tvSeriesClassification = function(episodes) {
  return { criteria: episodes.criteria, legacyAgeLimit: episodes.legacyAgeLimit, warningOrder:[] }
}

var aggregateClassification = exports.aggregateClassification = function(programs) {
  var classifications = _.compact(programs.map(function(p) { return p.classifications[0] }))
  var criteria = _(classifications).pluck('criteria').flatten().uniq().compact().value()
  var legacyAgeLimit = _(classifications).pluck('legacyAgeLimit').compact().max().value()
  if (legacyAgeLimit == Number.NEGATIVE_INFINITY) legacyAgeLimit = null
  return { criteria: criteria, legacyAgeLimit: legacyAgeLimit, warningOrder: [] }
}

exports.aggregateSummary = function(programs) {
  return summary(aggregateClassification(programs))
}

exports.canReclassify = function(program, user) {
  if (!program) return false
  if (enums.util.isUnknown(program) || enums.util.isTvSeriesName(program)) return false
  if (program.draftClassifications && program.draftClassifications[user._id]) return false
  var head = program.classifications[0]
  if (!head) return false
  return !enums.authorOrganizationIsKHO(head) && (utils.hasRole(user, 'kavi') || (head.status != 'registered'))
}

var isReclassification = exports.isReclassification = function(program, classification) {
  if (program.classifications.length == 0) return false
  var index = _.findIndex(program.classifications, { _id: classification._id })
  if (index == -1) {
    // classification is a draft, and other classifications already exist
    return true
  } else {
    // reclassification if not the last in the array
    return index < (program.classifications.length - 1)
  }
}

var ageLimit = exports.ageLimit = function(classification) {
  if (!classification) return undefined
  if (classification.safe) return 0
  if (classification.criteria.length == 0) return classification.legacyAgeLimit || 0
  return _.max(classification.criteria.map(function(id) { return enums.classificationCriteria[id - 1].age }))
}

exports.registrationEmail = function(program, classification, user, hostName) {
  var data = generateData()
  return {
    recipients: _.filter(program.sentRegistrationEmailAddresses, function(x) { return x != user.email }),
    from: "no-reply@kavi.fi",
    subject: _.template("Luokittelupäätös: <%= name %>, <%- year %>, <%- classificationShort %>", data),
    body: _.template(generateText(), data)
  }

  function generateData() {
    var classificationSummary = summary(classification)
    return {
      date: dateFormat(classification.registrationDate ? new Date(classification.registrationDate) : new Date()),
      buyer: classification.buyer ? classification.buyer.name : '',
      name: programName(),
      nameLink: programLink(),
      year: program.year || '',
      classification: classificationText(classificationSummary),
      classificationShort: ageAsText(classificationSummary.age) + ' ' + criteriaText(classificationSummary.warnings),
      publicComments: classification.publicComments || 'ei määritelty.',
      classifier: classifierName(),
      reason: classification.reason !== undefined ? enums.reclassificationReason[classification.reason].emailText : 'ei määritelty',
      extraInfoLink: extraInfoLink(),
      appendixLink: appendixLink(),
      previous: previous(),
      icons: iconHtml(classificationSummary, hostName)
    }
  }

  function generateText() {
    var reclassification = isReclassification(program, classification)
    return '<div style="text-align: right; margin-top: 8px;"><img src="'+hostName+'/images/logo.png" /></div>' +
      "<p><%- date %><br/><%- buyer %></p>" +
      '<p>'+(reclassification ? "Ilmoitus kuvaohjelman uudelleenluokittelusta" : "Ilmoitus kuvaohjelman luokittelusta") + "</p>" +
      '<p><%- classifier %> on <%- date %> ' + (reclassification ? 'uudelleen' : ' ') + 'luokitellut kuvaohjelman <%= nameLink %>. <%- classification %></p>' +
      '<%= icons %>' +
      '<p>'+(reclassification ? ' <%- previous.author %> oli <%- previous.date %> arvioinut kuvaohjelman <%- previous.criteriaText %>' : '') + '</p>' +
      ((utils.hasRole(user, 'kavi') && reclassification) ? '<p>Syy uudelleenluokittelulle: <%- reason %>.<br/>Perustelut: <%- publicComments %></p>' : '') +
      '<%= extraInfoLink %>' +
      '<%= appendixLink %>' +
      '<p>Kansallinen audiovisuaalinen instituutti (KAVI)<br/>' +
      'Mediakasvatus- ja kuvaohjelmayksikkö</p>'
  }

  function classifierName() {
    if (enums.authorOrganizationIsKHO(classification)) return 'Korkein hallinto-oikeus'
    if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification)) return 'Kuvaohjelmalautakunta'
    if (utils.hasRole(user, 'kavi')) return "Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö"
    return _([user.employerName, user.name]).compact().join(', ')
  }

  function programLink() {
    var link = hostName + '/public.html#haku/'+program.sequenceId+'//'+program._id
    return '<a href="'+link+'">'+programName()+'</a>'
  }

  function extraInfoLink() {
    if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification) || enums.authorOrganizationIsKHO(classification)) return ''
    if (utils.hasRole(user, 'kavi')) return '<p>Lisätietoja: <a href="mailto:' + user.email + '">' + user.email + '</a></p>'
    return ''
  }

  function appendixLink() {
    if (enums.authorOrganizationIsKHO(classification)) return ''
    var linkOther = { url: "https://kavi.fi/fi/meku/luokittelu/oikaisuvaatimusohje", name: "Oikaisuvaatimusohje" }
    var linkKavi = { url: "https://kavi.fi/fi/meku/luokittelu/valitusosoitus", name: "Valitusosoitus" }
    var link = (user.role == 'kavi') ? linkKavi : linkOther
    return '<p>Liitteet:<br/><a href="' + link.url + '">' + link.name + '</a></p>'
  }

  function programName() {
    var name = program.name.join(', ')
    if (enums.util.isTvEpisode(program) && program.series && program.episode) {
      return program.series.name + ': jakso ' + program.episode + ' ' + name
    } else {
      return name
    }
  }

  function previous() {
    var previous = previousClassification()
    if (!previous) return {}
    return {
      author: previousClassificationAuthor(previous),
      criteriaText: previousClassificationText(summary(previous)),
      date: previous.registrationDate ? dateFormat(new Date(previous.registrationDate)) : 'aiemmin'
    }
  }

  function previousClassification() {
    if (program.classifications.length == 0) return
    var index = _.findIndex(program.classifications, { _id: classification._id })
    if (index == -1) {
      return program.classifications[0]
    } else {
      return program.classifications[index + 1]
    }
  }

  function previousClassificationAuthor(classification) {
    if (enums.authorOrganizationIsKHO(classification)) return 'Korkein hallinto-oikeus'
    if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification)) return 'Kuvaohjelmalautakunta'
    return 'Kuvaohjelmaluokittelija'

  }

  function classificationText(summary) {
    if (summary.age == 0) {
      return 'Kuvaohjelma on sallittu.'
    } else if (summary.warnings.length == 0) {
      return 'Kuvaohjelman ikäraja on ' + ageAsText(summary.age) + '.'
    } else {
      return 'Kuvaohjelman ikäraja on ' + ageAsText(summary.age)
        + ' ja ' + (summary.warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
        + criteriaText(summary.warnings) + '.'
    }
  }

  function previousClassificationText(summary) {
    if (summary.age == 0) {
      return 'sallituksi.'
    } else if (summary.warnings.length == 0) {
      return 'ikärajaksi ' + ageAsText(summary.age) + '.'
    } else {
      return 'ikärajaksi ' + ageAsText(summary.age) + ' ja ' + (summary.warnings.length > 1 ? 'haitallisuuskriteereiksi' : 'haitallisuuskriteeriksi') + ' '
        + criteriaText(summary.warnings) + '.'
    }
  }

  function dateFormat(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() }

  function criteriaText(warnings) {
    return warnings.map(function(x) { return enums.classificationCategoriesFI[x.category] + '(' + x.id + ')' }).join(', ')
  }

  function iconHtml(summary) {
    var warningHtml = summary.warnings.map(function(w) { return img(w.category) }).join('')
    return '<div style="margin: 10px 0;">'+img('agelimit-'+summary.age) + warningHtml+'</div>'
    function img(fileName) { return '<img src="'+hostName+'/images/'+fileName+'.png" style="width: 40px; height: 40px; padding-right: 8px;"/>' }
  }
}

var ageAsText = exports.ageAsText = function(age) { return age && age.toString() || 'S' }

exports.durationToSeconds = function(duration) {
  if (!duration) return 0
  var trimmed = duration.trim && duration.trim() || $.trim(duration)
  var parts = /(?:(\d+)?:)?(\d+):(\d+)$/.exec(trimmed)
    .slice(1).map(function (x) { return x === undefined ? 0 : parseInt(x) })
  return (parts[0] * 60 * 60) + (parts[1] * 60) + parts[2]
}

exports.secondsToDuration = function(seconds) {
  if (!seconds) return '00:00:00'
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  var s = Math.floor((seconds % 3600) % 60)
  return [h,m,s].map(pad).join(':')

  function pad(s) { return s < 10 ? '0'+s : ''+s }
}

exports.price = function(program, duration) {
  // https://kavi.fi/fi/meku/kuvaohjelmat/maksut
  return enums.util.isGameType(program) ? exports.gameClassificationPrice(duration) : exports.classificationPrice(duration)
}

exports.gameClassificationPrice = function(duration) {
  return Math.min(80 + (~~(duration / (30 * 60))) * 36, 370) * 100
}

exports.classificationPrice = function(duration) {
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

})(typeof exports === 'undefined'? this['classificationUtils']={}: exports)



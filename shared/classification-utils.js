if (typeof module !== 'undefined' && module.exports) {
  _ = require('lodash')
  enums = require('./enums')
  utils = require('./utils')
  i18n = require('./i18n')
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
  var warnings = _.uniq(significantCriteria(classification), 'category')
  sortWarnings(classification.warningOrder, warnings)
  return { age: maxAgeLimit, warnings: warnings }
}

var significantCriteria = exports.significantCriteria = function(classification) {
  var maxAgeLimit = ageLimit(classification)
  return _(classification.criteria)
    .map(function(id) { return enums.classificationCriteria[id - 1] })
    .filter(function(c) { return c.category !== 'vet' && c.age > 0 && c.age == maxAgeLimit })
    .map(function(c) { return { id: c.id, category: c.category } }).value()
}

function sortWarnings(order, warnings) {
  if (!order || order.length == 0) return warnings
  return warnings.sort(function(a, b) {
    return order.indexOf(a.category) - order.indexOf(b.category)
  })
}

var tvSeriesClassification = exports.tvSeriesClassification = function(episodes) {
  return { criteria: episodes.criteria, legacyAgeLimit: episodes.legacyAgeLimit, warningOrder: episodes.warningOrder }
}

var aggregateClassification = exports.aggregateClassification = function(programs) {
  var classifications = _.compact(programs.map(function(p) { return p.classifications[0] }))
  var criteria = _(classifications).pluck('criteria').flatten().uniq().compact().value()
  var legacyAgeLimit = _(classifications).pluck('legacyAgeLimit').compact().max().value()
  if (legacyAgeLimit == Number.NEGATIVE_INFINITY) legacyAgeLimit = null
  var warningOrder = aggregateWarningOrder(classifications)
  return { criteria: criteria, legacyAgeLimit: legacyAgeLimit, warningOrder: warningOrder }
}

function aggregateWarningOrder(classifications) {
  var criteria = _(classifications).pluck('criteria').flatten().value()
  var counts = _.reduce(criteria, function(order, id) {
    var category = enums.classificationCriteria[id - 1].category
    return utils.merge(order, utils.keyValue(category, order[category] + 1))
  }, {violence: 0, fear: 0, sex: 0, drugs: 0})
  return _(counts).omit(function(c) { return c === 0}).pairs().sortBy(utils.snd).reverse().map(utils.fst).value()
}

exports.aggregateSummary = function(programs) {
  return summary(aggregateClassification(programs))
}

exports.canReclassify = function(program, user) {
  if (!program) return false
  var head = program.classifications[0]
  if (!head) return false
  if (enums.util.isTvSeriesName(program)) return false
  if (program.draftClassifications && program.draftClassifications[user._id]) return false
  if (utils.hasRole(user, 'kavi')) return true
  if (head.registrationDate && new Date(head.registrationDate).getFullYear() >= 2012) return false
  return !enums.authorOrganizationIsKHO(head) && !enums.authorOrganizationIsKuvaohjelmalautakunta(head) && !enums.authorOrganizationIsElokuvalautakunta(head)
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
  var fiData = generateData('fi')
  var svData = generateData('sv')
  return {
    recipients: _.uniq(program.sentRegistrationEmailAddresses.concat(user.email)),
    from: 'kirjaamo@kavi.fi',
    subject: _.template('Luokittelupäätös: <%= name %>, <%- year %>, <%- classificationShort %>', fiData),
    body: '<div style="text-align: right; margin-top: 8px;"><img src="' + hostName + '/images/logo.png" /></div>' +
      _.template('<p><%- date %><br/><%- buyer %></p>', fiData) +
      _.template(generateText('fi'), fiData) + '<br>' +  _.template(generateText('sv'), svData) +
      '<br><p>Kansallinen audiovisuaalinen instituutti (KAVI) / Nationella audiovisuella institutet (KAVI)<br>' +
      'Mediakasvatus- ja kuvaohjelmayksikkö / Enheten för mediefostran och bildprogram</p>'
  }

  function generateData(lang) {
    var classificationSummary = summary(classification)
    var significantWarnings = sortWarnings(classification.warningOrder, significantCriteria(classification))
    var extraCriteria = _.reject(sortAllWarnings(classification), function(w) {
      return _.find(significantWarnings, { id: w.id })
    })
    var isFi = lang === 'fi'
    return {
      date: dateFormat(classification.registrationDate ? new Date(classification.registrationDate) : new Date()),
      buyer: classification.buyer ? classification.buyer.name : '',
      name: programName(),
      nameLink: programLink(),
      year: program.year || '',
      classification: classificationText(classificationSummary.age, significantWarnings, extraCriteria),
      classificationShort: ageAsText(classificationSummary.age) + ' ' + criteriaText(significantWarnings),
      publicComments: classification.publicComments || t('ei määritelty') + '.',
      classifier: classifierName(),
      reason: classification.reason !== undefined ? t(enums.reclassificationReason[classification.reason].emailText) : t('ei määritelty'),
      extraInfoLink: extraInfoLink(),
      appendixLink: appendixLink(),
      previous: previous(),
      icons: function (lang) { return iconHtml(classificationSummary, lang) },
      reclassification: isReclassification(program, classification)
    }

    function t(text) {
      var translation = isFi ? text : i18n.sv[text]
      if (translation === undefined) return text
      return translation
    }

    function programName() {
      var name = program.name.join(', ')
      if (enums.util.isTvEpisode(program) && program.series && program.episode) {
        var season = program.season ? t('kausi') + ' ' + program.season + ', ' : ''
        return program.series.name + ': ' + season + t('jakso') + ' ' + program.episode + ', ' + name
      } else {
        return name
      }
    }

    function programLink() {
      var link = hostName + '/public.html#haku/'+program.sequenceId+'//'+program._id
      return '<a href="'+link+'">'+programName()+'</a>'
    }

    function classificationText(age, warnings, extra) {
      if (age == 0 && warnings.length > 0) {
        var s = isFi
          ? 'Kuvaohjelma on sallittu ja ' + (warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
          : 'Bildprogrammet är tillåtet och det skadliga innehållet '
        return s + criteriaText(warnings) + '. ' + extraCriteriaText(extra)
      } else if (age == 0) {
        return (isFi ? 'Kuvaohjelma on sallittu.' : 'Bildprogrammet är tillåtet.')
      } else if (warnings.length === 0) {
        return (isFi ? 'Kuvaohjelman ikäraja on ' : 'Bildprogrammet har åldersgränsen ') + ageAsText(age) + '.'
      } else {
        var s = isFi
          ? 'Kuvaohjelman ikäraja on ' + ageAsText(age) + ' ja ' + (warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
          : 'Bildprogrammet har åldersgränsen ' + ageAsText(age) + ' och det skadliga innehållet '
        return s + criteriaText(warnings) + '. ' + extraCriteriaText(extra)
      }
    }

    function criteriaText(warnings) {
      var categories = isFi ? enums.classificationCategoriesFI : enums.classificationCategoriesSV
      return warnings.map(function(x) { return categories[x.category] + ' (' + x.id + ')' }).join(', ')
    }

    function extraCriteriaText(warnings) {
      if (warnings.length === 0) return ''
      return t('Kuvaohjelma sisältää myös alempiin ikärajoihin liittyvät kriteerit') + ': ' + criteriaText(warnings)
    }

    function classifierName() {
      if (enums.authorOrganizationIsKHO(classification)) return t('Korkein hallinto-oikeus')
      if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification)) return t('Kuvaohjelmalautakunta')
      if (utils.hasRole(user, 'kavi')) return t('Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö')
      return _([user.employerName, user.name]).compact().join(', ')
    }

    function extraInfoLink() {
      if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification) || enums.authorOrganizationIsKHO(classification)) return ''
      if (utils.hasRole(user, 'kavi')) return '<p>' + t('Lisätietoja') + ': <a href="mailto:' + user.email + '">' + user.email + '</a></p>'
      return ''
    }

    function appendixLink() {
      if (enums.authorOrganizationIsKHO(classification)) return ''
      var linkOther = { url: "https://kavi.fi/fi/meku/luokittelu/oikaisuvaatimusohje", name: t('Oikaisuvaatimusohje') }
      var linkKavi = { url: "https://kavi.fi/fi/meku/luokittelu/valitusosoitus", name: t('Valitusosoitus') }
      var link = (user.role == 'kavi') ? linkKavi : linkOther
      return '<p>' + t('Liitteet') + ':<br/><a href="' + link.url + '">' + link.name + '</a></p>'
    }

    function previous() {
      var previous = previousClassification()
      if (!previous) return {}
      var significantWarnings = sortWarnings(previous.warningOrder, significantCriteria(previous))
      var extraCriteria = _.reject(sortAllWarnings(previous), function(w) {
        return _.find(significantWarnings, { id: w.id })
      })
      return {
        author: previousClassificationAuthor(previous),
        criteriaText: previousClassificationText(summary(previous).age, significantWarnings, extraCriteria),
        date: previous.registrationDate ? dateFormat(new Date(previous.registrationDate)) : t('aiemmin')
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
      if (enums.authorOrganizationIsKHO(classification)) return t('Korkein hallinto-oikeus')
      if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification)) return t('Kuvaohjelmalautakunta')
      return t('Kuvaohjelmaluokittelija')

    }

    function previousClassificationText(age, warnings, extra) {
      if (age == 0) {
        return isFi ? 'sallituksi.' : 'bedömt bildprogrammet som tillåtet.'
      } else if (warnings.length === 0) {
        return isFi
          ? 'ikärajaksi ' + ageAsText(age) + '.'
          : 'som åldergräns för bildprogrammet bedömt ' + ageAsText(age) + '.'
      } else {
        var s = isFi
          ? 'ikärajaksi ' + ageAsText(age) + ' ja ' + (warnings.length > 1 ? 'haitallisuuskriteereiksi' : 'haitallisuuskriteeriksi') + ' '
          : 'som åldergräns för bildprogrammet bedömt ' + ageAsText(age) + ' och som skadligt innehåll '
        return s
          + criteriaText(warnings) + '. ' + extraCriteriaText(extra)
      }
    }
  }

  function generateText(lang) {
    var reclassification = isReclassification(program, classification)
    if (lang === 'fi') {
      return '<p>'+(reclassification ? 'Ilmoitus kuvaohjelman uudelleenluokittelusta' : 'Ilmoitus kuvaohjelman luokittelusta') + '</p>' +
        '<p><%- classifier %> on <%- date %> ' + (reclassification ? 'uudelleen' : ' ') + 'luokitellut kuvaohjelman <%= nameLink %>. <%- classification %></p>' +
        '<%= icons("fi") %>' +
        '<p>'+(reclassification ? ' <%- previous.author %> oli <%- previous.date %> arvioinut kuvaohjelman <%- previous.criteriaText %>' : '') + '</p>' +
        ((utils.hasRole(user, 'kavi') && reclassification) ? '<p>Syy uudelleenluokittelulle: <%- reason %>.<br/>Perustelut: <%- publicComments %></p>' : '') +
        '<%= extraInfoLink %>' +
        '<%= appendixLink %>'
    } else if (lang === 'sv') {
      return '<p>Meddelande om ' + (reclassification ? 'om' : '') + 'klassificering av bildprogram</p>' +
        '<p><%- classifier %> har <%- date %> ' + (reclassification ? 'om' : '') + 'klassificerat bildprogrammet <%= nameLink %>. <%- classification %></p>' +
        '<%= icons("sv") %>' +
        '<p>' + (reclassification ? ' <%- previous.author %> hade <%- previous.date %> <%- previous.criteriaText %>' : '') + '</p>' +
        ((utils.hasRole(user, 'kavi') && reclassification) ? '<p>Orsak till omklassificering: <%- reason %>.<br/>Grunder: <%- publicComments %></p>' : '') +
        '<%= extraInfoLink %>' +
        '<%= appendixLink %>'
    }
  }

  function sortAllWarnings(classification) {
    var warnings = _.map(classification.criteria, function(id) { return enums.classificationCriteria[id - 1] })
    return sortWarnings(classification.warningOrder, warnings)
  }

  function dateFormat(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() }

  function iconHtml(summary, lang) {
    var warningHtml = summary.warnings.map(function(w) { return img(w.category) }).join('')
    var age = lang === 'sv' && summary.age === 0 ? 't' : summary.age
    return '<div style="margin: 10px 0;">'+img('agelimit-'+age) + warningHtml+'</div>'
    function img(fileName) { return '<img src="'+hostName+'/images/'+fileName+'.png" style="width: 40px; height: 40px; padding-right: 8px;"/>' }
  }
}

var ageAsText = exports.ageAsText = function(age) { return age && age.toString() || 'S' }

exports.durationToSeconds = function(duration) {
  if (!duration) return 0
  var trimmed = duration.trim && duration.trim() || $.trim(duration)
  var parts = /(?:(\d+)?:)?(\d+):(\d+)$/.exec(trimmed)
  if (parts === null) return 0
  var intParts = parts.slice(1).map(function (x) { return x === undefined ? 0 : parseInt(x) })
  return (intParts[0] * 60 * 60) + (intParts[1] * 60) + intParts[2]
}

exports.secondsToDuration = function(seconds) {
  if (!seconds) return '00:00:00'
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  var s = Math.floor((seconds % 3600) % 60)
  return [h,m,s].map(pad).join(':')

  function pad(s) { return s < 10 ? '0'+s : ''+s }
}

exports.price = function(program, duration, currentPrices) {
  // https://kavi.fi/fi/meku/kuvaohjelmat/maksut
  return enums.util.isGameType(program) ? exports.gameClassificationPrice(duration, currentPrices) : exports.classificationPrice(duration, currentPrices)
}

exports.gameClassificationPrice = function(duration, currentPrices) {
  var minFee = currentPrices.gameMinimumFee
  var maxFee = currentPrices.gameMaximumFee
  var perHalfHourFee = currentPrices.gameFeePerHalfHour
  return Math.min(minFee + (~~(duration / (30 * 60))) * perHalfHourFee, maxFee)
}

exports.classificationPrice = function(duration, currentPrices) {
  var perMinuteFee = currentPrices.classificationFeePerMinutesForLongPrograms
  if (duration == 0) return currentPrices.classificationFees[0]
  if (duration > (240 * 60)) return Math.round(perMinuteFee * (duration / 60.0))
  var idx = Math.floor((duration - 1) / (30 * 60))
  return currentPrices.classificationFees[idx]
}

})(typeof exports === 'undefined'? this['classificationUtils']={}: exports)



(function (exports) {
  const _ = typeof window === 'undefined' ? require('lodash') : window._
  const enums = typeof window === 'undefined' ? require('./enums') : window.enums
  const utils = typeof window === 'undefined' ? require('./utils') : window.utils
  const i18n = typeof window === 'undefined' ? require('./i18n') : window.i18n

  exports.fullSummary = function(program) {
    const c = enums.util.isTvSeriesName(program) ? exports.tvSeriesClassification(program.episodes) : program.classifications[0]
    return exports.summary(c)
  }

  exports.summary = function(classification) {
    if (!classification) return undefined
    if (classification.safe) return {age: 0, warnings: []}
    const maxAgeLimit = exports.ageLimit(classification)
    const warnings = _.uniqBy(exports.significantCriteria(classification), 'category')
    sortWarnings(classification.warningOrder.map(function (c) { return c.replace(/^anxiety$/, 'fear') }), warnings)
    return {age: maxAgeLimit, warnings: warnings}
  }

  exports.significantCriteria = function(classification) {
    const maxAgeLimit = exports.ageLimit(classification)
    return _(classification.criteria)
      .map(function(id) { return enums.classificationCriteria[id - 1] })
      .filter(function(c) { return c.category !== 'vet' && c.age > 0 && c.age === maxAgeLimit })
      .map(function(c) { return {id: c.id, category: c.category} }).value()
  }

  function sortWarnings(order, warnings) {
    if (!order || order.length === 0) return warnings
    return warnings.sort(function(a, b) {
      return order.indexOf(a.category) - order.indexOf(b.category)
    })
  }

  exports.tvSeriesClassification = function(episodes) {
    return {criteria: episodes.criteria, legacyAgeLimit: episodes.legacyAgeLimit, warningOrder: episodes.warningOrder}
  }

  exports.aggregateClassification = function(programs) {
    const classifications = _.compact(programs.map(function(p) { return p.classifications[0] }))
    const criteria = _(classifications).map('criteria').flatten().uniq().compact().value()
    const legacyAgeLimit = _(classifications).map('legacyAgeLimit').compact().max() || 0
    const warningOrder = aggregateWarningOrder(classifications)
    return {criteria: criteria, legacyAgeLimit: legacyAgeLimit, warningOrder: warningOrder}
  }

  function aggregateWarningOrder(classifications) {
    const criteria = _(classifications).map('criteria').flatten().value()
    const maxAge = _.max(_.map(criteria, function(c) { return enums.classificationCriteria[c - 1].age }))
    const counts = _.reduce(criteria, function(order, id) {
      const category = enums.classificationCriteria[id - 1].category
      return utils.merge(order, utils.keyValue(category, order[category] + (enums.classificationCriteria[id - 1].age === maxAge ? 1 : 0)))
    }, {violence: 0, fear: 0, sex: 0, drugs: 0})
    return _(counts).omit(function(c) { return c === 0 }).toPairs().sortBy(utils.snd).reverse().map(utils.fst).value()
  }

  exports.aggregateSummary = function(programs) {
    return exports.summary(exports.aggregateClassification(programs))
  }

  exports.canReclassify = function(program, user) {
    if (!program) return false
    const head = program.classifications[0]
    if (!head) return false
    if (enums.util.isTvSeriesName(program)) return false
    if (program.draftClassifications && program.draftClassifications[user._id]) return false
    if (utils.hasRole(user, 'kavi')) return true
    if (head.registrationDate && new Date(head.registrationDate).getFullYear() >= 2012) return false
    return !enums.authorOrganizationIsKHO(head) && !enums.authorOrganizationIsKuvaohjelmalautakunta(head) && !enums.authorOrganizationIsElokuvalautakunta(head)
  }

  exports.isReclassification = function(program, classification) {
    if (program.classifications.length === 0) return false
    const index = _.findIndex(program.classifications, {'_id': classification._id})
    if (index === -1) {
      // classification is a draft, and other classifications already exist
      return true
    }
    // reclassification if not the last in the array
    return index < program.classifications.length - 1

  }

  exports.ageLimit = function(classification) {
    if (!classification) return undefined
    if (classification.safe) return 0
    if (classification.criteria.length === 0) return classification.legacyAgeLimit || 0
    return _.max(classification.criteria.map(function(id) { return enums.classificationCriteria[id - 1].age }))
  }

  exports.registrationEmail = function(program, classification, user, hostName) {
    const fiData = generateData('fi')
    const svData = generateData('sv')
    return {
      recipients: _.uniq(program.sentRegistrationEmailAddresses.concat(utils.hasRole(user, 'root') ? [] : user.email)),
      from: 'kirjaamo@kavi.fi',
      subject: _.template('Luokittelupäätös: <%= name %>, <%- year %>, <%- classificationShort %>')(fiData),
      body: '<div style="text-align: right; margin-top: 8px;"><img src="' + hostName + '/images/logo.png" /></div>' +
        _.template('<p><%- date %><br/><%- buyer %></p>')(fiData) +
        _.template(generateText('fi'))(fiData) + '<br>' + _.template(generateText('sv'))(svData) +
        '<br><p>Kansallinen audiovisuaalinen instituutti (KAVI) / Nationella audiovisuella institutet (KAVI)<br>' +
        'Mediakasvatus- ja kuvaohjelmayksikkö / Enheten för mediefostran och bildprogram</p>'
    }

    function generateData(lang) {
      const classificationSummary = exports.summary(classification)
      const significantWarnings = sortWarnings(classification.warningOrder, exports.significantCriteria(classification))
      const extraCriteria = _.reject(sortAllWarnings(classification), function(w) {
        return _.find(significantWarnings, {id: w.id})
      })
      const isFi = lang === 'fi'
      return {
        date: dateFormat(classification.registrationDate ? new Date(classification.registrationDate) : new Date()),
        buyer: classification.buyer ? classification.buyer.name : '',
        name: programName(),
        nameLink: programLink(),
        year: program.year || '',
        classification: classificationText(classificationSummary.age, significantWarnings, extraCriteria),
        classificationShort: exports.ageAsText(classificationSummary.age) + ' ' + criteriaText(significantWarnings),
        publicComments: classification.publicComments || t('ei määritelty') + '.',
        classifier: classifierName(),
        reason: classification.reason === undefined ? t('ei määritelty') : t(enums.reclassificationReason[classification.reason].emailText),
        diaryNumber: diaryNumber(),
        participants: participants(),
        extraInfoLink: extraInfoLink(),
        appendixLink: appendixLink(),
        previous: previous(),
        icons: function (lng) { return iconHtml(classificationSummary, lng) },
        reclassification: exports.isReclassification(program, classification)
      }

      function t(text) {
        const translation = isFi ? text : i18n.translations.sv[text]
        if (translation === undefined) return text
        return translation
      }

      function programName() {
        const name = program.name.join(', ')
        if (enums.util.isTvEpisode(program) && program.series && program.episode) {
          const season = program.season ? t('kausi') + ' ' + program.season + ', ' : ''
          return program.series.name + ': ' + season + t('jakso') + ' ' + program.episode + ', ' + name
        }
        return name

      }

      function programLink() {
        const link = hostName + '/public.html#haku/' + program.sequenceId + '//' + program._id
        return '<a href="' + link + '">' + programName() + '</a>'
      }

      function classificationText(age, warnings, extra) {
        if (age === 0 && warnings.length > 0) {
          const subejct = isFi
            ? 'Kuvaohjelma on sallittu ja ' + (warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
            : 'Bildprogrammet är tillåtet och det skadliga innehållet '
          return subejct + criteriaText(warnings) + '. ' + extraCriteriaText(extra)
        } else if (age === 0) {
          return isFi ? 'Kuvaohjelma on sallittu.' : 'Bildprogrammet är tillåtet.'
        } else if (warnings.length === 0) {
          return (isFi ? 'Kuvaohjelman ikäraja on ' : 'Bildprogrammet har åldersgränsen ') + exports.ageAsText(age) + '.'
        }
        const s = isFi
          ? 'Kuvaohjelman ikäraja on ' + exports.ageAsText(age) + ' ja ' + (warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
          : 'Bildprogrammet har åldersgränsen ' + exports.ageAsText(age) + ' och det skadliga innehållet '
        return s + criteriaText(warnings) + '. ' + extraCriteriaText(extra)
      }

      function criteriaText(warnings) {
        const categories = isFi ? enums.classificationCategoriesFI : enums.classificationCategoriesSV
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

      function diaryNumber() {
        if (utils.hasRole(user, 'kavi') && !utils.hasRole(user, 'root')) {
          return '<p>' + t('Diaarinumero') + ': ' + (classification.kaviDiaryNumber && classification.kaviDiaryNumber.length > 0 ? classification.kaviDiaryNumber : '-') + '</p>'
        }
        return ''
      }

      function participants() {
        if (utils.hasRole(user, 'kavi') && !utils.hasRole(user, 'root')) {
          const s = _.uniq(_.compact([user ? user.name : undefined, classification.billing ? classification.billing.name : undefined, classification.buyer ? classification.buyer.name : undefined])).join(', ')
          return '<p>' + t('Asianosaiset') + ': ' + s + '</p>'
        }
        return ''
      }

      function extraInfoLink() {
        if (enums.authorOrganizationIsKuvaohjelmalautakunta(classification) || enums.authorOrganizationIsKHO(classification)) return ''
        if (utils.hasRole(user, 'kavi') && !utils.hasRole(user, 'root')) return '<p>' + t('Lisätietoja') + ': ' + user.name + ', <a href="mailto:kirjaamo@kavi.fi">kirjaamo@kavi.fi</a></p>'
        return ''
      }

      function appendixLink() {
        if (enums.authorOrganizationIsKHO(classification)) return ''
        const linkOther = {url: "https://kavi.fi/ikarajat/ammattilaiset/luokittelijat/muutoksenhaku/oikaisuvaatimusohje/", name: t('Oikaisuvaatimusohje')}
        const linkKavi = {url: "https://kavi.fi/ikarajat/ammattilaiset/luokittelijat/muutoksenhaku/valituskuvaohjelmalautakunnalle/", name: t('Valitusosoitus')}
        const link = user.role === 'kavi' ? linkKavi : linkOther
        return '<p>' + t('Liitteet') + ':<br/><a href="' + link.url + '">' + link.name + '</a></p>'
      }

      function previous() {
        const prev = previousClassification()
        if (!prev) return {}
        const significantWarns = sortWarnings(prev.warningOrder, exports.significantCriteria(prev))
        const extraCrit = _.reject(sortAllWarnings(prev), function(w) {
          return _.find(significantWarns, {id: w.id})
        })
        return {
          author: previousClassificationAuthor(prev),
          criteriaText: previousClassificationText(exports.summary(prev).age, significantWarns, extraCrit),
          date: prev.registrationDate ? dateFormat(new Date(prev.registrationDate)) : t('aiemmin')
        }
      }

      function previousClassification() {
        if (program.classifications.length === 0) return
        const index = _.findIndex(program.classifications, {'_id': classification._id})
        if (index === -1) {
          return program.classifications[0]
        }
        return program.classifications[index + 1]

      }

      function previousClassificationAuthor(c) {
        if (enums.authorOrganizationIsKHO(c)) return t('Korkein hallinto-oikeus')
        if (enums.authorOrganizationIsKuvaohjelmalautakunta(c)) return t('Kuvaohjelmalautakunta')
        return t('Kuvaohjelmaluokittelija')

      }

      function previousClassificationText(age, warnings, extra) {
        if (age === 0) {
          return isFi ? 'sallituksi.' : 'bedömt bildprogrammet som tillåtet.'
        } else if (warnings.length === 0) {
          return isFi
            ? 'ikärajaksi ' + exports.ageAsText(age) + '.'
            : 'som åldergräns för bildprogrammet bedömt ' + exports.ageAsText(age) + '.'
        }
        const s = isFi
          ? 'ikärajaksi ' + exports.ageAsText(age) + ' ja ' + (warnings.length > 1 ? 'haitallisuuskriteereiksi' : 'haitallisuuskriteeriksi') + ' '
          : 'som åldergräns för bildprogrammet bedömt ' + exports.ageAsText(age) + ' och som skadligt innehåll '
        return s
          + criteriaText(warnings) + '. ' + extraCriteriaText(extra)

      }
    }

    function generateText(lang) {
      const reclassification = exports.isReclassification(program, classification)
      if (lang === 'fi') {
        return '<p>' + (reclassification ? 'Päätös kuvaohjelman uudelleenluokittelusta' : 'Päätös kuvaohjelman luokittelusta') + '</p>' +
          '<p><%- classifier %> on <%- date %> ' + (reclassification ? 'uudelleen' : ' ') + 'luokitellut kuvaohjelman <%= nameLink %>. <%- classification %></p>' +
          '<%= icons("fi") %>' +
          '<p>' + (reclassification ? ' <%- previous.author %> oli <%- previous.date %> arvioinut kuvaohjelman <%- previous.criteriaText %>' : '') + '</p>' +
          (utils.hasRole(user, 'kavi') && reclassification ? '<p>Syy uudelleenluokittelulle: <%- reason %>.<br/>Perustelut: <%- publicComments %></p>' : '') +
          '<%= diaryNumber %>' +
          '<%= participants %>' +
          '<%= extraInfoLink %>' +
          '<%= appendixLink %>'
      } else if (lang === 'sv') {
        return '<p>Meddelande om ' + (reclassification ? 'om' : '') + 'klassificering av bildprogram</p>' +
          '<p><%- classifier %> har <%- date %> ' + (reclassification ? 'om' : '') + 'klassificerat bildprogrammet <%= nameLink %>. <%- classification %></p>' +
          '<%= icons("sv") %>' +
          '<p>' + (reclassification ? ' <%- previous.author %> hade <%- previous.date %> <%- previous.criteriaText %>' : '') + '</p>' +
          (utils.hasRole(user, 'kavi') && reclassification ? '<p>Orsak till omklassificering: <%- reason %>.<br/>Grunder: <%- publicComments %></p>' : '') +
          '<%= diaryNumber %>' +
          '<%= participants %>' +
          '<%= extraInfoLink %>' +
          '<%= appendixLink %>'
      }
    }

    function sortAllWarnings(c) {
      const warnings = _.map(c.criteria, function(id) { return enums.classificationCriteria[id - 1] })
      return sortWarnings(c.warningOrder, warnings)
    }

    function dateFormat(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() }

    function iconHtml(summary, lang) {
      const warningHtml = summary.warnings.map(function(w) { return img(w.category) }).join('')
      const age = lang === 'sv' && summary.age === 0 ? 't' : summary.age
      return '<div style="margin: 10px 0;">' + img('agelimit-' + age) + warningHtml + '</div>'
      function img(fileName) { return '<img src="' + hostName + '/images/' + fileName + '.png" style="width: 40px; height: 40px; padding-right: 8px;"/>' }
    }
  }

  exports.ageAsText = function(age) { return age && age.toString() || 'S' }

  exports.durationToSeconds = function(duration) {
    if (!duration) return 0
    const trimmed = duration.trim && duration.trim() || $.trim(duration)
    const parts = (/(?:(\d+)?:)?(\d+):(\d+)$/).exec(trimmed)
    if (parts === null) return 0
    const intParts = parts.slice(1).map(function (x) { return x === undefined ? 0 : parseInt(x) })
    return intParts[0] * 60 * 60 + intParts[1] * 60 + intParts[2]
  }

  exports.secondsToDuration = function(seconds) {
    if (!seconds) return '00:00:00'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor(seconds % 3600 / 60)
    const sec = Math.floor(seconds % 3600 % 60)
    return [hours, mins, sec].map(pad).join(':')

    function pad(s) { return s < 10 ? '0' + s : '' + s }
  }

  exports.price = function(program, duration, currentPrices) {
    // https://kavi.fi/fi/meku/kuvaohjelmat/maksut
    const perMinuteFee = currentPrices.classificationFeePerMinute
    if (duration < 30 * 60) return perMinuteFee * 30
    return perMinuteFee * Math.ceil(duration / 60.0)
  }
})(typeof exports === 'undefined' ? this.classificationUtils = {} : exports)

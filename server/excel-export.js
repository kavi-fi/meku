const _ = require('lodash')
const moment = require('moment')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')
const utils = require('../shared/utils')
const i18n = require('../shared/i18n')

const dateFormat = 'DD.MM.YYYY'

exports.constructProgramExportData = function constructProgramExportData(docs, showClassificationAuthor, filename, lang) {
  function translate(txt) { return i18n.translations[lang] ? i18n.translations[lang][txt] || txt : txt }
  const columnsOrig = ["Alkuperäinen nimi", "Suomenkielinen nimi", "Ruotsinkielinen nimi", "Jakso", "Jakson alkuperäinen nimi", "Rekisteröintipäivä", "Kesto", "Luokittelun tilaaja", "Luokittelija", "Uudelleenluokittelija", "Ikäraja", "Luokittelun kriteerit", "Perustelu", "Varoitukset", "Ohjelman tyyppi", "Maa", "Valmistumisvuosi", "Ohjaaja", "Tuotantoyhtiö", "Synopsis", "Id"]
  const columns = _.map(columnsOrig, translate)
  const columnWidths = [40, 40, 40, 10, 40, 15, 10, 40, 25, 25, 10, 40, 20, 20, 20, 10, 15, 20, 20, 40, 10]

  const xlsData = []
  xlsData.push(columns)
  _.forEach(docs, (doc) => {
    const name = listToString(doc.name)
    const classification = enums.util.isTvSeriesName(doc) && doc.episodes ? doc.episodes : doc.classifications && doc.classifications[0] ? doc.classifications[0] : {}
    doc.originalName = enums.util.isTvEpisode(doc) ? (doc.series || {}).name : name
    doc.format = classification.format
    doc.duration = enums.util.isGameType(doc) ? "" : classification.duration
    doc.classificationBuyer = classification.buyer ? classification.buyer.name : ""
    doc.classificationAuthor = classification.author && showClassificationAuthor ? classification.author.name : ""
    doc.agelimit = classification.agelimit
    doc.warnings = classification.warnings ? classification.warnings.map(translate).join(', ') : ""
    doc.criteriaComments = classification.isReclassification ? listToString(_.values(classification.criteriaComments)) : ""
    doc.criteria = classification.criteria
    doc.episodeCode = enums.util.isTvEpisode(doc) ? utils.seasonEpisodeCode(doc) : ""
    doc.episodeName = enums.util.isTvEpisode(doc) ? name : ""
    doc.reclassifier = classification.isReclassification && classification.authorOrganization ? enums.authorOrganization[classification.authorOrganization] : ""
    doc.registrationDate = classification.registrationDate ? moment(classification.registrationDate).format(dateFormat) : ""
    doc.programTypeName = translate((enums.programType[doc.programType] || {}).fi)

    xlsData.push([removeNewlinesIfCsv(doc.originalName), listToString(doc.nameFi), listToString(doc.nameSv), doc.episodeCode, removeNewlinesIfCsv(doc.episodeName), doc.registrationDate, doc.duration, doc.classificationBuyer, doc.classificationAuthor, doc.reclassifier, doc.agelimit, doc.criteria, removeNewlinesIfCsv(doc.criteriaComments), doc.warnings, doc.programTypeName, listToString(doc.country), doc.year, listToString(doc.directors), listToString(doc.productionCompanies), removeNewlinesIfCsv(doc.synopsis), doc.sequenceId])

    function listToString(list) {
      return removeNewlinesIfCsv((list || []).map((f) => (f ? f.trim() : '')).filter((f) => f.length > 0).join(', '))
    }

    function removeNewlinesIfCsv(orig) {
      const ext = filename.substring(filename.lastIndexOf('.'))
      if (orig && ext === '.csv') return orig.replace(/\n/g, ' ')
      return orig
    }
  })
  return write(xlsData, columnWidths)
}

exports.constructProviderExportData = function (providers) {
  const columnWidths = [20, 10, 20, 40, 40, 10, 30, 10, 10, 20, 30, 20, 40, 40, 40, 10, 20, 20, 40, 10, 40, 20, 20]
  const xlsData = [['Tyyppi', 'Rekisterissä', 'Kieku-asiakasnumero', 'Tarjoajan nimi', 'Lähiosoite', 'Postinumero', 'Kaupunki',
    'Maa', 'Y-tunnus', 'Hetu', 'Yhteyshenkilö', 'Puhelinnumero', 'Sähköposti', 'WWW-osoite', 'Tarjoamistapa', 'K-18',
    'Laskutustiedot ->', 'Kieku-asiakasnumero', 'Lähiosoite', 'Postinumero', 'Kaupunki', 'Verkkolaskuosoite', 'Välittäjätunnus']]
  _.forEach(providers, (provider) => _.forEach(providerDetails(provider, 'Tarjoaja'), (providerData) => xlsData.push(providerData)))
  return write(xlsData, columnWidths)

  function providerDetails(provider, type) {
    const address = provider.address || {}
    const eInvoice = provider.eInvoice || {}
    const billing = provider.billing || {}
    const billingAddress = billing.address || {}
    const providerData = [[type, provider.active === true ? '1' : '', provider.customerNumber, provider.name, address.street, address.zip, address.city,
      address.country, provider.yTunnus, provider.ssn, provider.contactName, provider.phoneNumber, _.compact(provider.emailAddresses).join(', '), provider.url, _.map(provider.providingType, (p) => enums.providingType[p]).join(', '), provider.adultContent ? '1' : '',
      '', billing.customerNumber, billingAddress.street, billingAddress.zip, billingAddress.city, eInvoice.address, eInvoice.operator]]
    if (provider.locations && provider.locations.length > 0) _.forEach(provider.locations, (location) => providerData.push(_.flatten(providerDetails(location, 'Tarjoamispaikka'))))
    return providerData
  }
}

exports.constructSubscriberExportData = function (subscribers) {
  const columnWidths = [10, 10, 10, 40, 10, 20, 40, 10, 30, 10, 40, 20, 40, 20, 20, 40, 10, 40, 20, 20]
  const xlsData = [['Työnantaja/Luokitteluyritys', 'Tilaaja', 'Kieku-asiakasnumero', 'Toiminimi', 'Y-tunnus', 'Hetu',
    'Lähiosoite', 'Postinumero', 'Kaupunki', 'Maa', 'Yhteyshenkilö', 'Puhelinnumero', 'Sähköposti',
    'Laskutustiedot ->', 'Kieku-asiakasnumero', 'Lähiosoite', 'Postinumero', 'Kaupunki', 'Verkkolaskuosoite', 'Välittäjätunnus']]
  _.forEach(subscribers, (subscriber) => xlsData.push(subscriberDetails(subscriber)))
  return write(xlsData, columnWidths)

  function subscriberDetails(subscriber) {
    const address = subscriber.address || {}
    const billing = subscriber.billing || {}
    const billingAddress = billing.address || {}
    const eInvoice = subscriber.eInvoice || {}
    return [_.includes(subscriber.roles, 'Classifier') ? '1' : '', _.includes(subscriber.roles, 'Subscriber') ? '1' : '', subscriber.customerNumber, subscriber.name, subscriber.yTunnus, subscriber.ssn,
      address.street, address.zip, address.city, address.country, subscriber.contactName, subscriber.phoneNumber, _.compact(subscriber.emailAddresses).join(', '),
      '', billing.customerNumber, billingAddress.street, billingAddress.zip, billingAddress.city, eInvoice.address, eInvoice.operator]
  }
}

exports.constructUserExportData = function (users) {
  const columnWidths = [10, 40, 30, 10, 40, 20, 10, 10, 40]
  const xlsData = [['Aktiivinen', 'Nimi', 'Käyttäjätunnus', 'Rooli', 'Email', 'Puhelinnumero', 'Sertifikaatin ensimmäinen myöntämispäivä', 'Voimassaolo päättyy', 'Työnantaja']]
  _.forEach(users, (user) => xlsData.push(userDetails(user)))
  return write(xlsData, columnWidths)

  function userDetails(user) {
    const userData = [user.active === true ? '1' : '', user.name, user.username, user.role, _.compact(user.emails).join(', '), user.phoneNumber]
    if (enums.util.isClassifier(user.role)) userData.push(user.certificateStartDate, user.certificateEndDate, _.map(user.employers, 'name').join(', '))
    return userData
  }
}

function write(xlsData, columnWidths) {
  const tmpFile = '' + Math.random()
  excelWriter.write(tmpFile, xlsData, _.map(columnWidths, (c) => ({wch: c})))
  const fileData = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)
  return fileData

}
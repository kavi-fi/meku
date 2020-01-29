const _ = require('lodash')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')

var dateFormat = 'DD.MM.YYYY'

exports.constructProviderExportData = function (tmpFile, providers) {
  const columnWidths = [20, 10, 20, 40, 40, 10, 30, 10, 10, 20, 30, 20, 40, 40, 40, 10, 20, 20, 40, 10, 40, 20, 20]
  const xlsData = [['Tyyppi', 'Rekisterissä', 'Kieku-asiakasnumero', 'Tarjoajan nimi', 'Lähiosoite', 'Postinumero', 'Kaupunki',
    'Maa', 'Y-tunnus', 'Hetu', 'Yhteyshenkilö', 'Puhelinnumero', 'Sähköposti', 'WWW-osoite', 'Tarjoamistapa', 'K-18',
    'Laskutustiedot ->', 'Kieku-asiakasnumero', 'Lähiosoite', 'Postinumero', 'Kaupunki', 'Verkkolaskuosoite', 'Välittäjätunnus']]
  _.forEach(providers, (provider) => _.forEach(providerDetails(provider, 'Tarjoaja'), (providerData) => xlsData.push(providerData)))
  excelWriter.write(tmpFile, xlsData, columnWidths.map((c) => ({wch: c})))
  var fileData = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)
  return fileData
}

function providerDetails(provider, type) {
  const address = provider.address || {}
  const eInvoice = provider.eInvoice || {}
  const billing = provider.billing || {}
  const billingAddress = billing.address || {}
  const providerData = [[type, provider.active === true ? '1': '', provider.customerNumber, provider.name, address.street, address.zip, address.city,
    address.country, provider.yTunnus, provider.ssn, provider.contactName, provider.phoneNumber, _.compact(provider.emailAddresses).join(', '), provider.url, _.map(provider.providingType, (p) => enums.providingType[p]).join(', '), provider.adultContent ? '1' : '',
    '', billing.customerNumber, billingAddress.street, billingAddress.zip, billingAddress.city, eInvoice.address, eInvoice.operator]]
  if (provider.locations && provider.locations.length > 0) _.forEach(provider.locations, (location) => providerData.push(_.flatten(providerDetails(location, 'Tarjoamispaikka'))))
  return providerData
}
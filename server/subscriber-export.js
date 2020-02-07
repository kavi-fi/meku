const _ = require('lodash')
const excelWriter = require('./excel-writer')
const fs = require('fs')

exports.constructSubscriberExportData = function (tmpFile, subscribers) {
  const columnWidths = [10, 10, 10, 40, 10, 20, 40, 10, 30, 10, 40, 20, 40, 20, 20, 40, 10, 40, 20, 20]
  const xlsData = [['Työnantaja/Luokitteluyritys', 'Tilaaja', 'Kieku-asiakasnumero', 'Toiminimi', 'Y-tunnus', 'Hetu',
    'Lähiosoite', 'Postinumero', 'Kaupunki', 'Maa', 'Yhteyshenkilö', 'Puhelinnumero', 'Sähköposti',
    'Laskutustiedot ->', 'Kieku-asiakasnumero', 'Lähiosoite', 'Postinumero', 'Kaupunki', 'Verkkolaskuosoite', 'Välittäjätunnus']]
  _.forEach(subscribers, (subscriber) => xlsData.push(subscriberDetails(subscriber)))
  excelWriter.write(tmpFile, xlsData, columnWidths.map((c) => ({wch: c})))
  var fileData = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)
  return fileData
}

function subscriberDetails(subscriber) {
  const address = subscriber.address || {}
  const billing = subscriber.billing || {}
  const billingAddress = billing.address || {}
  const eInvoice = subscriber.eInvoice || {}
  return [_.includes(subscriber.roles, 'Classifier') ? '1': '', _.includes(subscriber.roles, 'Subscriber') ? '1': '',  subscriber.customerNumber, subscriber.name, subscriber.yTunnus, subscriber.ssn,
    address.street, address.zip, address.city, address.country,subscriber.contactName, subscriber.phoneNumber, _.compact(subscriber.emailAddresses).join(', '),
    '', billing.customerNumber, billingAddress.street, billingAddress.zip, billingAddress.city, eInvoice.address, eInvoice.operator]
}
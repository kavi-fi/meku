var _ = require('lodash')
var moment = require('moment')
var excelWriter = require('./excel-writer')
var fs = require('fs')
var enums = require('../shared/enums')

var dateFormat = 'DD.MM.YYYY'

exports.createProviderRegistration = function createProviderRegistration(accountRows) {
  return createBilling(accountRows, _.curry(providerBillingHeader)(null), providerRowDescription, _.curry(providerBillingFooter)(accountRows))
}

exports.createYearlyProviderRegistration = function createYearlyProviderRegistration(year, accountRows) {
  return createBilling(accountRows, _.curry(providerBillingHeader)(moment().year()), providerRowDescription, _.curry(providerBillingFooter)(accountRows))
}

function providerBillingHeader(year, invoice) {
  return 'Valvontamaksu, vuosi ' + (year ? year : invoice.registrationDate.getFullYear()) + '. ' + invoice.invoiceText
}

function providerRowDescription(invoice) {
  return [moment(invoice.registrationDate).format(dateFormat), enums.providingType[invoice.providingType], invoice.name].join(', ')
}

function providerBillingFooter(accountRows, invoice) {
  var account = findAccountHavingInvoice(accountRows, invoice)
  return 'Lasku yhteensä ' + price(account.rows) + ' EUR'
}

exports.createClassificationRegistration = function createClassificationRegistration(dateRange, accountRows) {
  function billingHeader(invoice) {
    var period = dateRange.begin + ' - ' + dateRange.end
    return 'KOONTILASKUTUS ' + period + '. ' + invoice.invoiceText
  }
  function rowDescription(invoice) {
    return [
      invoice.programSequenceId,
      moment(invoice.registrationDate).format(dateFormat),
      invoice.name
    ].join(' ')
  }
  function billingFooter(invoice) {
    function summaryText(type, rows) {
      var typeString = { classification: 'luokiteltu', reclassification: 'uudelleenluokiteltu', registration: 'rekisteröity' }
      var plural = rows.length > 1 ? ' kuvaohjelmaa ' : ' kuvaohjelma '
      return rows.length + plural + typeString[type] + ', yhteensä ' + price(rows) + ' EUR.'
    }
    var account = findAccountHavingInvoice(accountRows, invoice)
    var rowsPerType = _.groupBy(account.rows, 'type')
    return _.pairs(rowsPerType).map(function (item) {
      return summaryText(item[0], item[1])
    }).join(' ')
  }
  return createBilling(accountRows, billingHeader, rowDescription, billingFooter)
}

function findAccountHavingInvoice(accountRows, invoice) {
  return _.find(accountRows, function (account) { return _.indexOf(account.rows, invoice) != -1 })
}

function price(arr) {
  return _(arr).pluck('price').reduce(function (a, b) {
    return a + b
  }, 0) / 100
}

function createBilling(accounts, billingDescription, rowDescription, billingFooter) {
  var billingData = _.flatten(_.map(accounts, function (ac) {
    var account = ac.account
    var rows = ac.rows
    var first = _.first(rows)
    var customerNumber = account.billingPreference == 'address' ? account.billing.customerNumber : account.customerNumber
    var billingLanguage = account.billingPreference == 'address' ? account.billing.language : account.language
    var invoiceText = account.billing ? (account.billing.invoiceText || '').replace(/\n/g, ' ') : ''
    var accountAddress = customerNumber ? {} : account.billingPreference == 'address' ? account.billing.address : account.address
    return _.map(rows, function (row) {
      return _.extend(row, {
        first: row === first ? 1 : 0,
        customerNumber: customerNumber,
        accountName: account.name,
        accountContactName: account.contactName,
        accountStreetAddress: accountAddress.street,
        accountZipCode: accountAddress.zip,
        accountCity: accountAddress.city,
        accountCountry: accountAddress.country,
        invoiceItemCode: enums.invoiceItemCode(row.providingType ? row.providingType : row.type, row.duration),
        invoiceText: invoiceText,
        euroPrice: row.price / 100,
        billingLanguage: billingLanguage
      })
    })
  }))
  var columns = [
    { name: 'T', value: invoiceValue('first'), repeatable: true, width: 2 },
    { name: 'Tilauslaji', value: constantValue('Z001') },
    { name: 'Myyntiorg', value: constantValue('6008') },
    { name: 'Jakelutie', value: constantValue('02') },
    { name: 'Sektori', value: constantValue('01') },
    { name: 'Myyntitsto', value: constantValue('') },
    { name: 'Viitelasku', value: constantValue('') },
    { name: 'Asiakasnro', value: invoiceValue('customerNumber') },
    { name: 'Nimi', value: invoiceValue('accountName'), width: 30 },
    { name: 'Nimi2', value: constantValue('') },
    { name: 'Lähiosoite', value: invoiceValue('accountStreetAddress') },
    { name: 'PostiNo', value: invoiceValue('accountZipCode') },
    { name: 'Toimipaikka', value: invoiceValue('accountCity') },
    { name: 'Maakoodi', value: invoiceValue('accountCountry') },
    { name: 'Kielikoodi', value: invoiceValue('billingLanguage') },
    { name: 'Laskutusasiakasnro', value: constantValue('') },
    { name: 'Laskutusasiakas nimi', value: constantValue('') },
    { name: 'Maksaja-asiakasnro', value: constantValue('') },
    { name: 'Maksaja-asiakas nimi', value: constantValue('') },
    { name: 'Toimitusasiakasnro', value: constantValue('') },
    { name: 'Toimitusasiakas nimi', value: constantValue('') },
    { name: 'Palvelun luontipvm', value: constantValue('') },
    { name: 'Hinnoittelupvm', value: constantValue('') },
    { name: 'Laskuttaja', value: constantValue('') },
    { name: 'Asiaviite', value: invoiceValue('accountContactName'), width: 15 },
    { name: 'Tilausnumero', value: constantValue('') },
    { name: 'Poikk. veron määrämaa', value: constantValue('') },
    { name: 'Otsikkoteksti: Otsikkomuistio 1 (tekstilaji 0002) tulostuu ennen rivejä. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita', value: billingDescription, width: 20 },
    { name: 'Otsikkoteksti: Maksuperusteteksti (tekstilaji Z000) tulostuu laskun loppuun. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita', value: billingFooter, width: 20 },
    { name: 'Nimike', value: invoiceValue('invoiceItemCode'), repeatable: true },
    { name: 'Määrä', value: constantValue(1), repeatable: true },
    { name: 'Määräyksikkö', value: constantValue('kpl'), repeatable: true },
    { name: 'Yksikköhinta', value: invoiceValue('euroPrice'), repeatable: true },
    { name: 'Brutto/Netto', value: constantValue('N'), repeatable: true },
    { name: 'Rivityyppi', value: constantValue('') },
    { name: 'Tulosyksikkö', value: constantValue('') },
    { name: 'Nimikkeen nimitysteksti (laskutusaihe)', value: constantValue(''), width: 20 },
    { name: 'Riviteksti: Rivimuistio (tekstilaji 0002), tulostuu laskulle rivin jälkeen', value: rowDescription, width:30, repeatable: true },
    { name: 'PRR-osa', value: constantValue('') },
    { name: 'TaKP-tili', value: constantValue('') },
    { name: 'Suorite', value: constantValue('') },
    { name: 'Toiminto', value: constantValue('') },
    { name: 'Alue /  kunta', value: constantValue('') },
    { name: 'Seurantakohde 1', value: constantValue('') },
    { name: 'Seurantakohde 2', value: constantValue('') },
    { name: 'Laskuliitteet', value: constantValue('') }
  ]

  function invoiceValue(key) {
    function valueFromInvoice(key, invoice) {
      return invoice[key]
    }
    return _.curry(valueFromInvoice)(key)
  }

  function constantValue(c) {
    function constant(c, invoice) {
      return c
    }
    return _.curry(constant)(c)
  }

  var xlsData = [ _.map(columns, function (column) { return column.name }) ]
  _.each(billingData, function (invoice) {
    xlsData.push(_.map(columns, function (column) {
      return invoice.first || column.repeatable ? column.value(invoice) : ''
    }))
  })
  var tmpXlsxFile = 'kieku_' + Math.random() + '.xlsx'
  var columnWidths = _.map(columns, function (column) { return { wch: (column.width || 10) }})
  excelWriter.write(tmpXlsxFile, xlsData, columnWidths)
  var fileData = fs.readFileSync(tmpXlsxFile)
  fs.unlinkSync(tmpXlsxFile)
  return fileData
}

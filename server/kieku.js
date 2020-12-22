const _ = require('lodash')
const moment = require('moment')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')
const i18n = require('../shared/i18n')
const srvUtils = require('./server-utils')

const dateFormat = 'DD.MM.YYYY'

exports.createProviderRegistration = function (filename, accountRows) {
  return createBilling(accountRows, _.curry(providerBillingHeader)(null), providerRowDescription, _.curry(providerBillingFooter)(accountRows), filename)
}

exports.createYearlyProviderRegistration = function (filename, year, accountRows) {
  return createBilling(accountRows, _.curry(providerBillingHeader)(moment().year()), providerRowDescription, _.curry(providerBillingFooter)(accountRows), filename)
}

function t(txt, lang) { return i18n.translations[lang] ? i18n.translations[lang][txt] || txt : txt }
function language(invoice) { return (invoice.billingLanguage || 'fi').toLowerCase() }

function providerBillingHeader(year, invoice) {
  return t('Valvontamaksu, vuosi', language(invoice)) + ' ' + (year ? year : invoice.registrationDate.getFullYear())
}

function providerRowDescription(invoice) {
  return [moment(invoice.registrationDate).format(dateFormat), enums.providingType[invoice.providingType], invoice.name].join(', ')
}

function providerBillingFooter(accountRows, invoice) {
  const account = findAccountHavingInvoice(accountRows, invoice)
  return t('Lasku yhteensä', language(invoice)) + ' ' + price(account.rows) + ' EUR'
}

exports.createClassificationRegistration = function (filename, dateRange, accountRows) {
  function billingHeader(invoice) {
    const period = dateRange.begin + ' - ' + dateRange.end
    return t('KOONTILASKUTUS', language(invoice)) + ' ' + period
  }
  function rowDescription (invoice) {
    return [
      invoice.programSequenceId,
      moment(invoice.registrationDate).format(dateFormat),
      invoice.name
    ].join(' ')
  }
  function billingFooter(invoice) {
    function summaryText(type, rows) {
      const typeString = {classification: 'luokiteltu', reclassification: 'uudelleenluokiteltu', registration: 'rekisteröity'}
      const programs = _.filter(rows, (r) => !enums.util.isGameType(r))
      const games = _.filter(rows, (r) => enums.util.isGameType(r))
      const programsPlural = programs.length > 1 ? 'kuvaohjelmaa' : 'kuvaohjelma'
      const gamesPlural = games.length > 1 ? 'peliä' : 'peli'
      const invoiceRows = []
      if (programs.length > 0) invoiceRows.push(programs.length + ' ' + t(programsPlural, language(invoice)))
      if (games.length > 0) invoiceRows.push(games.length + ' ' + t(gamesPlural, language(invoice)))
      return invoiceRows.join(' & ') + ' ' + t(typeString[type], language(invoice)) + ', ' + t('yhteensä', language(invoice)) + ' ' + price(rows) + ' EUR.'
    }
    const account = findAccountHavingInvoice(accountRows, invoice)
    // eslint-disable-next-line no-confusing-arrow
    const filteredAccountRows = _.filter(account.rows, (row) => invoice.type === 'registration' ? isRegistration(row) : !isRegistration(row))
    const rowsPerType = _.groupBy(filteredAccountRows, 'type')
    return _.toPairs(rowsPerType).map((item) => summaryText(item[0], item[1])).join(' ')
  }
  return createBilling(filename, accountRows, billingHeader, rowDescription, billingFooter)
}

function findAccountHavingInvoice(accountRows, invoice) {
  return _.find(accountRows, (account) => _.indexOf(account.rows, invoice) !== -1)
}

function price(arr) {
  return _(arr).map('price').reduce((a, b) => a + b, 0) / 100
}

function isRegistration(row) {
  return row.type === 'registration'
}

function createBilling(filename, accounts, billingDescription, rowDescription, billingFooter) {
  const billingData = _.flatten(_.map(accounts, (ac) => {
    const account = ac.account
    const rows = ac.rows
    const firstOfGroups = _(rows).groupBy(isRegistration).toPairs().map((pair) => _.first(pair[1])).value()
    const accountInvoiceOperator = account.billingPreference === 'eInvoice' ? account.eInvoice.operator : ''
    const accountInvoiceAddress = account.billingPreference === 'eInvoice' ? account.eInvoice.address : ''
    const customerNumber = account.billingPreference === 'address' ? account.billing.customerNumber : account.customerNumber
    const billingLanguage = account.language ? account.language : account.billing ? account.billing.language : ''
    const invoiceText = account.billing ? (account.billing.invoiceText || '').replace(/\n/g, ' ') : ''
    const accountAddress = customerNumber && customerNumber.trim().length > 0 ? {} : account.billingPreference === 'address' ? account.billing.address : account.address

    return _.map(rows, (row) => {
      const invoiceItem = enums.invoiceItem(row)
      return _.extend(row, {
        first: _.includes(firstOfGroups, row) ? 1 : 0,
        customerNumber: customerNumber,
        accountName: account.name,
        accountContactName: account.contactName,
        accountSsn: account.ssn,
        accountStreetAddress: accountAddress.street,
        accountZipCode: accountAddress.zip,
        accountCity: accountAddress.city,
        accountCountry: accountAddress.country,
        accountBusinessId: account.yTunnus,
        accountInvoiceAddress: accountInvoiceAddress,
        accountInvoiceOperator: accountInvoiceOperator,
        invoiceItemCode: invoiceItem.itemCode,
        invoiceIemCount: invoiceItem.itemCount,
        invoiceItemUnit: t(invoiceItem.itemUnit, billingLanguage),
        invoiceText: invoiceText,
        euroPrice: invoiceItem.pricePerMinute ? srvUtils.currentPrices().classificationFeePerMinute / 100 : row.price / 100,
        billingLanguage: billingLanguage
      })
    })
  }))
  const columns = [
    {name: 'T', value: invoiceValue('first'), repeatable: true, width: 2},
    {name: 'Tilauslaji', value: constantValue('Z001')},
    {name: 'Myyntiorg', value: constantValue('6008')},
    {name: 'Jakelutie', value: constantValue('02')},
    {name: 'Sektori', value: constantValue('01')},
    {name: 'Myyntitsto', value: constantValue('')},
    {name: 'Viitelasku', value: constantValue('')},
    {name: 'Asiakasnro', value: invoiceValue('customerNumber')},
    {name: 'Nimi', value: invoiceValue('accountName'), width: 30},
    {name: 'Nimi2', value: constantValue('')},
    {name: 'Lähiosoite', value: invoiceValue('accountStreetAddress')},
    {name: 'PostiNo', value: invoiceValue('accountZipCode')},
    {name: 'Toimipaikka', value: invoiceValue('accountCity')},
    {name: 'Maakoodi', value: invoiceValue('accountCountry')},
    {name: 'Kielikoodi', value: invoiceValue('billingLanguage')},
    {name: 'Henkilötunnus', value: invoiceValue('accountSsn')},
    {name: 'Y-tunnus', value: invoiceValue('accountBusinessId')},
    {name: 'ALV-tunnus', value: constantValue('')},
    {name: 'OVT-tunnus', value: invoiceValue('accountInvoiceAddress')},
    {name: 'Välittäjätunnus', value: invoiceValue('accountInvoiceOperator')},
    {name: 'Laskutusasiakasnro', value: constantValue('')},
    {name: 'Laskutusasiakas nimi', value: constantValue('')},
    {name: 'Maksaja-asiakasnro', value: constantValue('')},
    {name: 'Maksaja-asiakas nimi', value: constantValue('')},
    {name: 'Toimitusasiakasnro', value: constantValue('')},
    {name: 'Toimitusasiakas nimi', value: constantValue('')},
    {name: 'Palvelun luontipvm', value: constantValue('')},
    {name: 'Hinnoittelupvm', value: constantValue('')},
    {name: 'Laskun pvm', value: constantValue('')},
    {name: 'Maksuehto', value: constantValue('')},
    {name: 'Laskuttaja', value: constantValue('')},
    {name: 'Asiaviite', value: invoiceValue('invoiceText'), width: 15},
    {name: 'Tilausnumero', value: constantValue('')},
    {name: 'Sopimuspvm', value: constantValue('')},
    {name: 'Sopimusnumero', value: constantValue('')},
    {name: 'Tiliöintiviite', value: constantValue('')},
    {name: 'Työmaa-avain', value: constantValue('')},
    {name: 'Poikk. veron määrämaa', value: constantValue('')},
    {name: 'Otsikkoteksti: Otsikkomuistio 1 (tekstilaji 0002) tulostuu ennen rivejä. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita', value: billingDescription, width: 20},
    {name: 'Otsikkoteksti: Maksuperusteteksti (tekstilaji Z000) tulostuu laskun loppuun. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita', value: billingFooter, width: 20},
    {name: 'Nimike', value: invoiceValue('invoiceItemCode'), repeatable: true},
    {name: 'Määrä', value: invoiceValue('invoiceIemCount'), repeatable: true},
    {name: 'Määräyksikkö', value: invoiceValue('invoiceItemUnit'), repeatable: true},
    {name: 'Yksikköhinta', value: invoiceValue('euroPrice'), repeatable: true},
    {name: 'Brutto/Netto', value: constantValue('N'), repeatable: true},
    {name: 'Rivityyppi', value: constantValue('')},
    {name: 'Tulosyksikkö', value: constantValue('')},
    {name: 'Nimikkeen nimitysteksti (laskutusaihe)', value: constantValue(''), width: 20},
    {name: 'Riviteksti: Rivimuistio (tekstilaji 0002), tulostuu laskulle rivin jälkeen', value: rowDescription, width: 30, repeatable: true},
    {name: 'PRR-osa', value: constantValue('')},
    {name: 'TaKP-tili', value: constantValue('')},
    {name: 'Suorite', value: constantValue('')},
    {name: 'Toiminto', value: constantValue('')},
    {name: 'Alue /  kunta', value: constantValue('')},
    {name: 'Seurantakohde 1', value: constantValue('')},
    {name: 'Seurantakohde 2', value: constantValue('')},
    {name: 'Laskuliitteet', value: constantValue('')}
  ]

  function invoiceValue(key) {
    function valueFromInvoice(k, invoice) {
      return invoice[k]
    }
    return _.curry(valueFromInvoice)(key)
  }

  function constantValue(cnst) {
    // eslint-disable-next-line no-unused-vars
    function constant(c, invoice) {
      return c
    }
    return _.curry(constant)(cnst)
  }

  const xlsData = [ _.map(columns, (column) => column.name) ]
  _.each(billingData, (invoice) => {
    xlsData.push(_.map(columns, (column) => (invoice.first || column.repeatable ? column.value(invoice) : '')))
  })
  const tmpXlsxFile = Math.random() + (filename || 'kieku.xlsx')
  const columnWidths = _.map(columns, (column) => ({wch: column.width || 10}))

  excelWriter.write(tmpXlsxFile, xlsData, columnWidths)
  const fileData = fs.readFileSync(tmpXlsxFile)
  fs.unlinkSync(tmpXlsxFile)
  return fileData
}

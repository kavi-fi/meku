const fs = require('fs')
const _ = require('lodash')
const enums = require('../shared/enums')
const utils = require('../shared/utils')
const moment = require('moment')
const i18n = require('../shared/i18n')

function sv(txt) { return i18n.translations.sv[txt] || txt }

exports.registrationEmail = function (provider, hostName, callback) {
  function emailHtml(prov, cb) {
    const active = _.filter(prov.locations, (l) => !l.deleted && l.active)
    const allLocations = active.map((l) => ({
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName).join(', '),
        providingTypesSv: l.providingType.map(enums.providingTypeName).map(sv).join(', ')
      }))
    const locations = _.filter(allLocations, (l) => !l.isPayer)
    const payerLocations = _.filter(allLocations, (l) => l.isPayer)
    const vars = {
      hostName: hostName,
      header: 'Ilmoittautuminen tarjoajaksi',
      year: moment().year(),
      emailAddress: prov.emailAddresses.join(', '),
      locations: locations,
      useEInvoice: prov.billingPreference === 'eInvoice',
      eInvoice: prov.eInvoice,
      billing: prov.billingPreference === 'address' ? prov.billing.address : prov.address,
      invoiceText: prov.billing ? prov.billing.invoiceText : '',
      payerLocations: payerLocations,
      totalProvider: totalPrice(locations),
      totalLocations: totalPrice(payerLocations),
      providingTypePrices: providingTypes(),
      provider: prov,
      language: enums.billingLanguages[prov.language],
      country: enums.countries[prov.address.country]
    }

    readTemplate('registration-email.tpl.html', (err, tpl) => {
      if (err) return cb(err)
      const html = _.template(tpl, {imports: {sv: sv}})(vars)
      //fs.writeFileSync('./tmp/registration-email.html', html)
      cb(null, html)
    })
  }

  emailHtml(provider, (err, html) => {
    if (err) callback(err)
    else callback(null, providerEmail({
      recipients: provider.emailAddresses,
      subject: 'Tarjoajarekisteriin ilmoittautuminen (' + provider.name + ')',
      body: html
    }))
  })
}

exports.yearlyBillingProviderEmail = function (provider, hostName, callback) {
  function emailHtml(prov, cb) {
    const locations = _(prov.locations)
      .map((l) => ({
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName).join(', '),
        providingTypesSv: l.providingType.map(enums.providingTypeName).map(sv).join(', ')
      }))
      .groupBy((l) => (l.isPayer ? 'payer' : 'notPayer')).value()
    const vars = {
      hostName: hostName,
      header: 'Tarjoajan vuosilaskutuksen vahvistus',
      year: moment().year(),
      emailAddress: prov.emailAddresses.join(', '),
      locations: locations.notPayer,
      useEInvoice: prov.billingPreference === 'eInvoice',
      eInvoice: prov.eInvoice,
      billing: prov.billingPreference === 'address' ? prov.billing.address : prov.address,
      invoiceText: prov.billing ? prov.billing.invoiceText : '',
      payerLocations: locations.payer || [],
      totalProvider: totalPrice(locations.notPayer),
      totalLocations: totalPrice(locations.payer),
      providingTypePrices: providingTypes(),
      provider: prov,
      language: enums.billingLanguages[prov.language],
      country: enums.countries[prov.address.country]
    }
    readTemplate('registration-email.tpl.html', (err, tpl) => {
      if (err) return cb(err)
      const html = _.template(tpl, {imports: {sv: sv}})(vars)
      //fs.writeFileSync('./tmp/registration-email.html', html)
      cb(null, html)
    })
  }

  emailHtml(provider, (err, html) => {
    if (err) return callback(err)
    callback(null, providerEmail({
      recipients: provider.emailAddresses,
      subject: 'Tarjoajan vuosilaskutuksen vahvistus (' + provider.name + ')',
      body: html
    }))
  })
}

exports.registrationEmailProviderLocation = function (location, hostName, callback) {
  function emailHtml(loc, cb) {
    const vars = _.merge({}, loc, {
      hostName: hostName,
      header: 'Ilmoittautuminen tarjoajaksi',
      emailAddress: loc.emailAddresses.join(', '),
      providingTypes: loc.providingType.map(enums.providingTypeName),
      providingTypesSv: loc.providingType.map(enums.providingTypeName).map(sv),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(loc.providingType),
      location: loc
    })

    readTemplate('provider-location-registration-email.tpl.html', (err, tpl) => {
      if (err) return cb(err)
      const html = _.template(tpl, {imports: {utils: utils, sv: sv}})(vars)
      //fs.writeFileSync('./tmp/registration-email-location.html', html)
      cb(null, html)
    })
  }

  emailHtml(location, (err, html) => {
    if (err) callback(err)
    else callback(null, providerEmail({
      recipients: location.emailAddresses,
      subject: 'Tarjoajarekisteriin ilmoittautuminen (' + location.name + ')',
      body: html
    }))
  })
}


exports.yearlyBillingProviderLocationEmail = function (location, hostName, callback) {
  function emailHtml(loc, cb) {
    const vars = {
      hostName: hostName,
      header: 'Tarjoamispaikan vuosilaskutuksen vahvistus',
      emailAddress: loc.emailAddresses.join(', '),
      providingTypes: loc.providingType.map(enums.providingTypeName),
      providingTypesSv: loc.providingType.map(enums.providingTypeName).map(sv),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(loc.providingType),
      location: loc
    }

    readTemplate('provider-location-registration-email.tpl.html', (err, tpl) => {
      if (err) return cb(err)
      const html = _.template(tpl, {imports: {utils: utils, sv: sv}})(vars)
      //fs.writeFileSync('./tmp/registration-email-location.html', html)
      cb(null, html)
    })
  }

  emailHtml(location, (err, html) => {
    if (err) return callback(err)
    callback(null, providerEmail({
      recipients: location.emailAddresses,
      subject: 'Tarjoamispaikan vuosilaskutuksen vahvistus (' + location.name + ')',
      body: html
    }))
  })
}

exports.payingLocationsWithEmail = function (locations) {
  return _.filter(locations, (l) => !l.deleted && l.isPayer && l.active && !_.isEmpty(l.emailAddresses))
}

exports.payingLocationsWithoutEmail = function (locations) {
  return _.filter(locations, (l) => !l.deleted && l.isPayer && l.active && _.isEmpty(l.emailAddresses))
}

function providerEmail(fields) {
  return {
    recipients: ['tarjoajarekisteri@kuvi.fi'].concat(fields.recipients),
    from: 'tarjoajarekisteri@kavi.fi',
    subject: fields.subject,
    body: fields.body
  }
}

function totalPrice(xs) {
  return _.reduce(xs, (acc, l) => acc + l.price, 0)
}

function providingTypes() {
  return _(enums.providingType).keys().map((key) => ({name: enums.providingType[key], price: enums.providingTypePrices[key]})).value()
}

function readTemplate(file, callback) {
  return fs.readFile('./server/templates/' + file, 'utf-8', callback)
}

function providingTypeTotalPrice(types) {
  return _.reduce(types, (a, x) => a + enums.providingTypePrices[x], 0)
}

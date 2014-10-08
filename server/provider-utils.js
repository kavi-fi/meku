var fs = require('fs')
var _ = require('lodash')
var enums = require('../shared/enums')
var utils = require('../shared/utils')
var moment = require('moment')
var i18n = require('../shared/providers-i18n')

function sv(txt) { return i18n.sv[txt] || txt  }

exports.registrationEmail = function (provider, hostName, callback) {
  function emailHtml(provider, callback) {
    var active =_.select(provider.locations, function(l) { return !l.deleted && l.active })
    var allLocations = active.map(function(l) {
      return {
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName).join(', '),
        providingTypesSv: l.providingType.map(enums.providingTypeName).map(sv).join(', ')
      }
    })
    var locations = _.select(allLocations, function(l) { return !l.isPayer })
    var payerLocations = _.select(allLocations, function(l) { return l.isPayer })
    var vars = {
      hostName: hostName,
      header: 'Ilmoittautuminen tarjoajaksi',
      year: moment().year(),
      emailAddress: provider.emailAddresses.join(', '),
      locations: locations,
      useEInvoice: provider.billingPreference == 'eInvoice',
      eInvoice: provider.eInvoice,
      billing: provider.billingPreference == 'address' ? provider.billing.address : provider.address,
      invoiceText: provider.billing ? provider.billing.invoiceText : '',
      payerLocations: payerLocations,
      totalProvider: totalPrice(locations),
      totalLocations: totalPrice(payerLocations),
      providingTypePrices: providingTypes(),
      provider: provider,
      language: enums.billingLanguages[provider.language],
      country: enums.countries[provider.address.country]
    }

    readTemplate('registration-email.tpl.html', function(err, tpl) {
      if (err) return callback(err)
      var html =  _.template(tpl, vars, {imports: {sv: sv}})
      //fs.writeFileSync('./tmp/registration-email.html', html)
      callback(null, html)
    })
  }

  emailHtml(provider, function(err, html) {
    callback(null, providerEmail({
      recipients: provider.emailAddresses,
      subject: 'Tarjoajarekisteriin ilmoittautuminen (' + provider.name + ')',
      body: html
    }))
  })
}

exports.registrationEmailProviderLocation = function (location, hostName, callback) {
  function emailHtml(location, callback) {
    var vars = _.merge({}, location, {
      hostName: hostName,
      header: 'Ilmoittautuminen tarjoajaksi',
      emailAddress: location.emailAddresses.join(', '),
      providingTypes: location.providingType.map(enums.providingTypeName),
      providingTypesSv: location.providingType.map(enums.providingTypeName).map(sv),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(location.providingType),
      location: location
    })

    readTemplate('provider-location-registration-email.tpl.html', function(err, tpl) {
      if (err) return callback(err)
      var html =  _.template(tpl, vars, {imports: {enums: enums, utils: utils, sv: sv}})
      //fs.writeFileSync('./tmp/registration-email-location.html', html)
      callback(null, html)
    })
  }

  emailHtml(location, function(err, html) {
    callback(null, providerEmail({
      recipients: location.emailAddresses,
      subject: 'Tarjoajarekisteriin ilmoittautuminen (' + location.name + ')',
      body: html
    }))
  })
}

exports.yearlyBillingProviderEmail = function(provider, hostName, callback) {
  function emailHtml(provider, callback) {
    var locations = _(provider.locations)
      .map(function(l) { return {
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName)}})
      .groupBy(function(l) { return l.isPayer ? 'payer' : 'notPayer'}).value()
    var vars = {
      hostName: hostName,
      header: 'Tarjoajan vuosilaskutuksen vahvistus',
      year: moment().year(),
      emailAddress: provider.emailAddresses.join(', '),
      locations: locations.notPayer,
      useEInvoice: provider.billingPreference == 'eInvoice',
      eInvoice: provider.eInvoice,
      billing: provider.billingPreference == 'address' ? provider.billing.address : provider.address,
      invoiceText: provider.billing ? provider.billing.invoiceText : '',
      payerLocations: locations.payer || [],
      totalProvider: totalPrice(locations.notPayer),
      totalLocations: totalPrice(locations.payer),
      providingTypePrices: providingTypes(),
      provider: provider,
      language: enums.billingLanguages[provider.language],
      country: enums.countries[provider.address.country]
    }
    readTemplate('registration-email.tpl.html', function(err, tpl) {
      if (err) return callback(err)
      callback(null, _.template(tpl, vars, { enums: enums, utils: utils }))
    })
  }

  emailHtml(provider, function(err, html) {
    if (err) return callback(err)
    callback(null, providerEmail({
      recipients: provider.emailAddresses,
      subject: 'Tarjoajan vuosilaskutuksen vahvistus (' + provider.name + ')',
      body: html
    }))
  })
}

exports.yearlyBillingProviderLocationEmail = function(location, hostName, callback) {
  function emailHtml(location, callback) {
    var vars = {
      hostName: hostName,
      header: 'Tarjoamispaikan vuosilaskutuksen vahvistus',
      emailAddress: location.emailAddresses.join(', '),
      providingTypes: location.providingType.map(enums.providingTypeName),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(location.providingType),
      location: location
    }

    var tpl = readTemplate('provider-location-registration-email.tpl.html', function(err, tpl) {
      if (err) return callback(err)
      callback(null, _.template(tpl, vars, {enums: enums, utils: utils}))
    })
  }

  emailHtml(location, function(err, html) {
    if (err) return callback(err)
    callback(null, providerEmail({
      recipients: location.emailAddresses,
      subject: 'Tarjoamispaikan vuosilaskutuksen vahvistus (' + location.name + ')',
      body: html
    }))
  })
}

exports.payingLocationsWithEmail = function(locations) {
  return _.select(locations, function(l) { return !l.deleted && l.isPayer && l.active && !_.isEmpty(l.emailAddresses) })
}

exports.payingLocationsWithoutEmail = function(locations) {
  return _.select(locations, function(l) { return !l.deleted && l.isPayer && l.active && _.isEmpty(l.emailAddresses) })
}

function providerEmail(fields) {
  return {
    recipients: ['tarjoajarekisteri@kavi.fi'].concat(fields.recipients),
    from: 'tarjoajarekisteri@kavi.fi',
    subject: fields.subject,
    body: fields.body
  }
}

function totalPrice(xs) {
  return _.reduce(xs, function(acc, l) {
    return acc + l.price
  }, 0)
}

function providingTypes() {
  return _(enums.providingType).keys().map(function(key) {
    return {name: enums.providingType[key], price: enums.providingTypePrices[key]}
  }).value()
}

function readTemplate(file, callback) {
  return fs.readFile('./server/templates/' + file, 'utf-8', callback)
}

var providingTypeTotalPrice = exports.providingTypeTotalPrice = function(types) {
  return _.reduce(types, function(a, x) { return a + enums.providingTypePrices[x] }, 0)
}

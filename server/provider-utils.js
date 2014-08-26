var fs = require('fs')
var _ = require('lodash')
var enums = require('../shared/enums')
var utils = require('../shared/utils')

exports.registrationEmail = function (data) {
  function emailHtml(data) {
    var allLocations = data.locations.map(function(l) {
      return {
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName).join(', ')
      }
    })
    var locations = _.select(allLocations, function(l) { return !l.isPayer })
    var payerLocations = _.select(allLocations, function(l) { return l.isPayer })
    var vars = _.merge({}, data, {
      header: 'Ilmoittautuminen tarjoajaksi',
      emailAddress: data.emailAddresses.join(', '),
      locations: locations,
      useEInvoice: data.billingPreference == 'eInvoice',
      eInvoice: data.eInvoice,
      billing: data.billingPreference == 'address' ? data.billing.address : data.address,
      invoiceText: data.billing.invoiceText,
      payerLocations: payerLocations,
      totalProvider: totalPrice(locations),
      totalLocations: totalPrice(payerLocations),
      providingTypePrices: providingTypes()
    })

    var tpl = readTemplateSync('registration-email.tpl.html')
    var html =  _.template(tpl, vars)
    //fs.writeFileSync('./tmp/registration-email.html', html)
    return html
  }

  return {
    recipients: data.emailAddresses,
    subject: 'Tarjoajarekisteriin ilmoittautuminen (' + data.name + ')',
    from: 'noreply@kavi.fi',
    replyto: 'mirja.kosonen@kavi.fi',
    body: emailHtml(data)
  }
}

exports.registrationEmailProviderLocation = function (data) {
  function emailHtml(data) {
    var vars = {
      header: 'Ilmoittautuminen tarjoajaksi',
      emailAddress: data.emailAddresses.join(', '),
      providingTypes: data.providingType.map(enums.providingTypeName),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(data.providingType),
      provider: data
    }

    var tpl = readTemplateSync('provider-location-registration-email.tpl.html')
    var html =  _.template(tpl, vars, {enums: enums, utils: utils})
    //fs.writeFileSync('./tmp/registration-email-location.html', html)
    return html
  }

  return {
    recipients: data.emailAddresses,
    subject: 'Tarjoajarekisteriin ilmoittautuminen (' + data.name + ')',
    from: 'noreply@kavi.fi',
    replyto: 'mirja.kosonen@kavi.fi',
    body: emailHtml(data)
  }
}

exports.yearlyBillingProviderEmail = function(provider) {
  return {
    recipients: provider.emailAddresses,
    subject: 'Tarjoajan vuosilaskutuksen vahvistus (' + provider.name + ')',
    from: 'noreply@kavi.fi',
    replyto: 'mirja.kosonen@kavi.fi',
    body: emailHtml(provider)
  }

  function emailHtml(provider) {
    var locations = _(provider.locations)
      .map(function(l) { return {
        name: l.name,
        isPayer: l.isPayer,
        price: providingTypeTotalPrice(l.providingType),
        providingTypes: l.providingType.map(enums.providingTypeName).join(', ')}})
      .groupBy(function(l) { return l.isPayer ? 'payer' : 'notPayer'}).value()
    var vars = {
      header: 'Tarjoajan vuosilaskutuksen vahvistus',
      emailAddress: provider.emailAddresses.join(', '),
      locations: locations.notPayer,
      useEInvoice: provider.billingPreference == 'eInvoice',
      eInvoice: provider.eInvoice,
      billing: provider.billingPreference == 'address' ? provider.billing.address : provider.address,
      invoiceText: provider.billing.invoiceText,
      payerLocations: locations.payer || [],
      totalProvider: totalPrice(locations.notPayer),
      totalLocations: totalPrice(locations.payer),
      providingTypePrices: providingTypes(),
      provider: provider
    }
    var tpl = readTemplateSync('registration-email.tpl.html')
    return _.template(tpl, vars, { enums: enums, utils: utils })
  }
}

exports.yearlyBillingProviderLocationEmail = function(location) {
  return {
    recipients: location.emailAddresses,
    subject: 'Tarjoamispaikan vuosilaskutuksen vahvistus (' + location.name + ')',
    from: 'noreply@kavi.fi',
    replyto: 'mirja.kosonen@kavi.fi',
    body: emailHtml(location)
  }

  function emailHtml(location) {
    var vars = {
      header: 'Tarjoamispaikan vuosilaskutuksen vahvistus',
      emailAddress: location.emailAddresses.join(', '),
      providingTypes: location.providingType.map(enums.providingTypeName),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(location.providingType),
      location: location
    }

    var tpl = readTemplateSync('provider-location-registration-email.tpl.html')
    return _.template(tpl, vars, {enums: enums, utils: utils})
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

function readTemplateSync(file) {
  return fs.readFileSync('./server/templates/' + file, 'utf-8')
}

function providingTypeTotalPrice(types) {
  return _.reduce(types, function(a, x) { return a + enums.providingTypePrices[x] }, 0)
}


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
    function total(xs) {
      return _.reduce(xs, function(acc, l) {
        return acc + l.price
      }, 0)
    }
    var locations = _.select(allLocations, function(l) { return !l.isPayer })
    var payerLocations = _.select(allLocations, function(l) { return l.isPayer })
    var vars = _.merge({}, data, {
      emailAddress: data.emailAddresses.join(', '),
      locations: locations,
      useEInvoice: data.billingPreference == 'eInvoice',
      eInvoice: data.eInvoice,
      billing: data.billingPreference == 'address' ? data.billing.address : data.address,
      invoiceText: data.billing.invoiceText,
      payerLocations: payerLocations,
      totalProvider: total(locations),
      totalLocations: total(payerLocations),
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
    var vars = _.merge({}, data, {
      emailAddress: data.emailAddresses.join(', '),
      providingTypes: data.providingType.map(enums.providingTypeName),
      providingTypePrices: providingTypes(),
      total: providingTypeTotalPrice(data.providingType)
    })

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


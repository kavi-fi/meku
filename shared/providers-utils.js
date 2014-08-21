var fs = require('fs')
var _ = require('lodash')

var registrationEmailHtml = exports.registrationEmailHtml = function (data) {
  var allLocations = data.locations.map(function(l) {
    return {
      name: l.name,
      isPayer: l.isPayer,
      price: _.reduce(l.providingType, function(a, x) { return a + enums.providingTypePrices[x] }, 0),
      providingTypes: l.providingType.map(function(type) { return enums.providingType[type] }).join(', ')}
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
    totalLocations: total(payerLocations)
  })

  var tpl = fs.readFileSync('./shared/templates/registration-email.tpl.html', 'utf-8')
  var html =  _.template(tpl, vars)
  //fs.writeFileSync('./tmp/registration-email.html', html)
  return html
}

var registrationEmail = exports.registrationEmail = function (data) {
  return {
    recipients: data.emailAddresses,
    subject: 'Tarjoajarekisteriin ilmoittautuminen (' + data.name + ')',
    from: 'noreply@kavi.fi',
    //replyto: 'mirja.kosonen@kavi.fi',
    body: registrationEmailHtml(data)
  }
}


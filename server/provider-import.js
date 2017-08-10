var mongoose = require('mongoose')
var schema = require('../server/schema')
var utils = require('../shared/utils')
var _ = require('lodash')
var xlsx = require('xlsx')
var xls = require('xlsjs')
var async = require('async')
var enums = require('../shared/enums')

// NOTE: field order matters
var providerFieldMap = [
  'name',
  'yTunnus',
  'address.street',
  'address.zip',
  'address.city',
  'language',
  'contactName',
  'emailAddresses',
  'phoneNumber',
  'address.country'
]

// NOTE: field order matters
var billingFieldMap = [
  'billing.address.street',
  'billing.address.zip',
  'billing.address.city',
  'billing.invoiceText'
]

// NOTE: field order matters
var eInvoiceFieldMap = [
  'eInvoice.address',
  'eInvoice.operator'
]

// NOTE: field order matters
var locationFieldMap = [
  'name',
  'address.street',
  'address.zip',
  'address.city',
  'isPayer',
  'contactName',
  'emailAddresses',
  'phoneNumber',
  'Recordings_provide',
  'Public_presentation',
  'National_TV',
  'Regional_TV',
  'Transmitted_abroad_program',
  'Subscription_of_program',
  'url',
  'adultContent'
]

var fieldNames = {
  'name': 'Nimi',
  'yTunnus': 'Y-tunnus',
  'address.street': 'lähiosoite',
  'address.zip': 'postinro',
  'address.city': 'postitoimipaikka',
  'language': 'asiointikieli',
  'contactName': 'yhteyshenkilö',
  'emailAddresses': 'sähköposti',
  'phoneNumber': 'puhelinnumero'
}

// These need to match exactly with the labels in the provider Excel file
var i18n = {
  sv: {
    'Tarjoaja': 'Leverantör',
    'Lasku eri osoitteeseen kuin Tarjoajan osoite': 'Faktura till annan adress än Leverantörens',
    'TAI verkkolasku': 'ELLER nätfaktura',
    'Tarjoamispaikkojen tiedot ja tarjoamistavat': 'Information om ställen och sätt för tillhandahållning'
  }
}

function sv(txt) {
  return i18n.sv[txt] || txt
}

exports.import = function(file, callback) {
  var parser = false

  if (file.originalname.search(/.xls$/) > 1) parser = xls
  else if (file.originalname.search(/.xlsx$/) > 1) parser = xlsx
  else return callback({ message: '.xlsx or .xls required' })

  var allSheets = parser.readFile(file.path)
  var sheetFi = allSheets.Sheets['Tarjoajaksi ilmoittautuminen']
  var sheetSv = allSheets.Sheets['Leverant&#xF6;rsanm&#xE4;lan'] || allSheets.Sheets['Leverantörsanmälan']
  var useFi = isEmptySheet(sheetSv, i18n.sv['Tarjoaja'])

  getProviderAndLocationsFromSpreadSheet(useFi ? sheetFi : sheetSv, useFi ? identity : sv, function(err, providerAndLocations) {
    if (err) return callback(err)
    var provider = createProvider(providerAndLocations.provider, providerAndLocations.billing)
    provider.locations = createLocations(providerAndLocations.locations)
    return callback(null, provider)
  })

  function createProvider(providerData, billingData) {
    var provider = createObjectAndSetValuesWithMap(providerData, providerFieldMap)
    provider.deleted = false
    provider.active = false
    provider.creationDate = new Date()
    provider.language = (provider.language && provider.language.toLowerCase() == 'svenska') ? 'SV' : 'FI'
    provider.address.country = enums.getCountryCode(provider.address.country) || 'FI'

    var billing = createObjectAndSetValuesWithMap(billingData, billingFieldMap)

    provider = utils.merge(provider, billing)

    if (provider.billing && provider.billing.address) {
      var address = provider.billing.address
      provider.billingPreference = 'address'
    }

    if (provider.eInvoice) {
      provider.billingPreference = 'eInvoice'
    }

    return provider
  }

  function createLocations(locationsData) {
    return _.map(locationsData, function(location) {
      var location = createObjectAndSetValuesWithMap(location, locationFieldMap, { providingType: _.keys(enums.providingType) })

      return utils.merge(location, {
        deleted: false,
        active: true,
        isPayer: stringXToBoolean(location.isPayer),
        adultContent: stringXToBoolean(location.adultContent),
      })
    })
  }
  function stringXToBoolean(x) { return _.isString(x) ? x.toLowerCase() === 'x' : false }
}

function getProviderAndLocationsFromSpreadSheet(providerSheet, text, callback) {
  var requiredProviderFields = {
    name: 'Tarjoajan tiedot:',
    values: ['name', 'yTunnus', 'contactName', 'address.street', 'address.zip', 'address.city', 'address.country', 'phoneNumber', 'language']
  }

  var requiredLocationFields = {
    name: 'Tarjoamispaikan tiedot:',
    values: ['name', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber']
  }

  var noRequiredFields = { name: '', values: [] }

  var errors = []

  var providerData = parseFieldRowAndValueRowAfterColumn(text('Tarjoaja'), providerFieldMap, requiredProviderFields)
  var billingData = parseFieldRowAndValueRowAfterColumn(text('Lasku eri osoitteeseen kuin Tarjoajan osoite'), billingFieldMap, noRequiredFields)
  var eInvoiceData = parseFieldRowAndValueRowAfterColumn(text('TAI verkkolasku'), eInvoiceFieldMap, noRequiredFields)
  var locationsData = parseFieldRowAndValueRowsAfterColumn(text('Tarjoamispaikkojen tiedot ja tarjoamistavat'), locationFieldMap, requiredLocationFields)

  if (locationsData.length === 0) errors.push('Tarjoamispaikkojen tiedot puuttuvat')

  if (errors.length > 0) {
    return callback({ messages: errors })
  } else {
    return callback(null, {
      provider: providerData,
      billing: utils.merge(billingData, eInvoiceData),
      locations: locationsData
    })
  }

  function parseFieldRowAndValueRowAfterColumn(column, fieldMap, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    var row = toObject(providerSheet, rowNumber + 2, fieldMap)
    var errorMessages = validate(row, requiredFields, rowNumber + 2, fieldMap)
    errorMessages.forEach(function(msg) {
      errors.push(msg)
    })

    return row
  }

  function parseFieldRowAndValueRowsAfterColumn(column, fieldMap, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)

    var rows = values([], rowNumber + 2)
    
    var errorMessages = _.reduce(rows, function(acc, val) {
      var index = acc[0], errors = acc[1]
      var fieldErrors = validate(val, requiredFields, index, fieldMap)
      return [index + 1, errors.concat(fieldErrors)
        .concat(validateProvidingType(val, index))
        .concat(validateRequiredEmail(val, index))]
    }, [rowNumber + 2, []])[1]

    errorMessages.forEach(function(msg) {
      errors.push(msg)
    })

    return rows

    function values(xs, row) {
      var currentValues = toObject(providerSheet, row, fieldMap)
      if (_.all(currentValues, function(x) { return x === null})) {
        return xs
      } else {
        return values(xs.concat([currentValues]), row + 1)
      }
    }

    function validateProvidingType(val, index) {
      var providingTypeFields = _.keys(enums.providingType)
      var present = _.keys(val)
      var hasAtLeastOneProvidingType = _(providingTypeFields).map(function(name) {
        return _.indexOf(present, name) > 0
      }).some()

      if (!hasAtLeastOneProvidingType) {
        return ['Tarjoamispaikan tiedot rivillä ' + index + ': tarjoamispaikalla täytyy olla ainakin yksi tajoamistapa.']
      } else {
        return []
      }
    }

    function validateRequiredEmail(val, row) {
      var msg = 'Tarjoamispaikan tiedot rivillä ' + row + ': sähköpostiosoite on pakollinen jos lasku lähetetään tarjoamispaikalle.'
      if (val.isPayer && !val.emailAddresses) return [msg]
      else return []
    }
  }


  function validate(values, requiredFields, index, fieldMap) {
    var present = _.keys(values)
    var missing = _.reduce(requiredFields.values, function(acc, r) {
      if (_.indexOf(present, r) === -1) return acc.concat(r)
      else return acc
    }, [])

    return _.map(missing, function (field) {
      var errorString = 'Rivillä <%- row %>. <%- name %> pakollinen kenttä "<%- field %>" puuttuu'
      return _.template(errorString, {
        name: requiredFields.name,
        field: fieldNames[field],
        row: index
      })
    })
  }

}

function findColumnRowByValue(from, value) {
  var columnRowNumber = undefined

  _.find(from, function(field, key) {
    if (field.v && (field.v.trim().toLowerCase() == value.toLowerCase())) {
      columnRowNumber = parseRowNumber(key)
      return true
    }
  })

  return columnRowNumber

  function parseRowNumber(key) { return parseInt(key.substring(key.search(/\d/))) }
}

function toObject(from, row, fields) {
  var fst = function(x) { return x[0] }
  var snd = function(x) { return x[1] }
  
  var ob = _.reduce(from, function(result, field, key) {
    if (key.match(new RegExp('.' + row))) {
      return utils.merge(result, utils.keyValue(key.substr(0, 1), field.v))
    }
    else return result
  }, emptyRow(fields.length))

  var values = _(ob).pairs().sortBy(fst).map(snd).value()

  return _(_.pairs(_.zipObject(fields, values))).filter(function(x) {
    return x[1] !== null
  }).object().value()

  function parseColumnKey(key) { return key.substring(0, key.search(/\d/)) }
}

function emptyRow(count) {
  return _('BCDEFGHIJKLMNOPQRSTU'.split('')).take(count).reduce(function(ob, c) {
    return utils.merge(ob, utils.keyValue(c, null)) 
  }, {})
}

function isEmptySheet(s, heading) {
  var rowNumber = findColumnRowByValue(s, heading)
  var row = toObject(s, rowNumber + 2, providerFieldMap)
  return _.isEmpty(row)
}

function identity(x) { return x }

function createObjectAndSetValuesWithMap(object, map, enumProperties) {
  var enumProps = _.reduce(_.pairs(enumProperties), function(ob, x) {
    var propName = x[0], fields = x[1]
    return utils.merge(ob, utils.keyValue(propName, toArray(fields)))

    function toArray(fields) {
      return _.reduce(fields, function(acc, field) {
        if (object[field]) return acc.concat(field)
        else return acc
      }, [])
    }
  }, {})

  var props = _.reduce(_.pairs(utils.flattenObject(object)), function(ob, pair) {
    var key = pair[0], val = pair[1], prop = {}
    utils.setValueForPath(key.split('.'), prop, val)
    return utils.merge(ob, prop)
  }, {})

  return utils.merge(enumProps, omitEnumProps(props))

  function omitEnumProps(props) {
    var enumPropNames = _(enumProperties).pairs().map(function (x) { return x[1] }).flatten().value()
    return _.omit(props, enumPropNames)
  }
}

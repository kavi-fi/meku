var mongoose = require('mongoose')
var schema = require('../server/schema')
var utils = require('../shared/utils')
var _ = require('lodash')
var xlsx = require('xlsx')
var xls = require('xlsjs')
var async = require('async')
var enums = require('../shared/enums')

var providerFieldMap = {
  'address.city':    'Postitoimipaikka',
  'address.country': 'Maa',
  'address.street':  'Lähiosoite',
  'address.zip':     'Postinro',
  'contactName':     'Tarjoajan yht.hlö',
  'emailAddresses':  'Sähköposti',
  'language':        'Asiointikieli',
  'name':            'Yritys/Toiminimi',
  'phoneNumber':     'Puh.nro',
  'yTunnus':         'Y-tunnus'
}

var billingFieldMap = {
  'billing.address.city':    'Postitoimipaikka',
  'billing.address.country': 'Maa',
  'billing.address.street':  'Postiosoite',
  'billing.address.zip':     'Postinro',
  'billing.invoiceText':     'Laskulle haluttava teksti',
  'billing.language':        'Laskutuskieli', // TODO: remove from schema!
  'eInvoice.address':        'Verkkolaskuosoite (OVT/IBAN)',
  'eInvoice.operator':       'Välittäjätunnus'
}

var locationFieldMap = {
  'address.city':     'Postitoimipaikka',
  'address.street':   'Käyntiosoite',
  'address.zip':      'Postinro',
  'adultContent':     'K18 ohjelmia',
  'contactName':      'Yht.hlö',
  'emailAddresses':   'Sähköpostiosoite',
  'gamesWithoutPegi': 'Pelejä (ei PEGI)',
  'isPayer':          'Lasku pääorganisaatiolle',
  'language':         'Laskutuskieli', // TODO: remove from schema!
  'name':             'Tarjoamispaikan nimi',
  'phoneNumber':      'Puh.nro',
  'providingType':    'Tarjoamistapa',
  'url':              'www-osoite'
}

exports.import = function(file, callback) {
  try {
    var parser = false

    if (file.search(/.xls$/) > 1) parser = xls
    else if (file.search(/.xlsx$/) > 1) parser = xlsx
    else return callback({ message: '.xlsx or .xls required' })

    var providerAndLocations = getProviderAndLocationsFromSpreadSheet(parser.readFile(file))
  } catch (err) {
    return callback(err)
  }

  var provider = createObjectAndSetValuesWithMap(providerAndLocations.provider, providerFieldMap)
  provider.deleted = false
  provider.active = false
  provider.address.country = enums.getCountryCode(provider.address.country) || provider.address.country

  var billing = createObjectAndSetValuesWithMap(providerAndLocations.billing, billingFieldMap)

  provider = _.merge({}, provider, billing)

  provider.billing.language = billing.language === 'Swedish' ? 'SV' : 'FI'

  var address = provider.billing.address

  if (address) {
    provider.billing.address.country = enums.getCountryCode(address.country) || address.country
    provider.billingPreference = 'address'
  }

  if (provider.eInvoice) {
    provider.billingPreference = 'eInvoice'
  }

  new schema.Provider(_.omit(provider, 'other')).save(function(err, provider) {
    if (err) return callback(err)

    var locations = []

    async.forEach(providerAndLocations.locations, function(location, callback) {
      location = createObjectAndSetValuesWithMap(location, locationFieldMap)
      location.providingType = location.providingType.split(',')
      location.provider = provider._id
      location.deleted = false
      location.active = true
      location.providingType = _.map(location.providingType, function(providingTypeNumber) {
        return enums.getProvidingType(providingTypeNumber)
      })

      new schema.ProviderLocation(location).save(function(err, location) {
        if (err) return callback(err)
        locations.push(location)
        callback()
      })
    }, function(err) {
      return callback(err, {
        provider: provider,
        locations: locations
      })
    })
  })
}

function getProviderAndLocationsFromSpreadSheet(providerSpreadSheet) {
  var providerSheet = providerSpreadSheet.Sheets['Tarjoajan yhteystiedot']

  var requiredProviderFields = {
    name: 'Tarjoajan yhteystiedot',
    values: [
      'Yritys/Toiminimi', 'Y-tunnus', 'Tarjoajan yht.hlö', 'Lähiosoite', 'Postinro', 'Postitoimipaikka',
      'Puh.nro', 'Kotipaikka', 'Asiointikieli'
    ]
  }

  // There are duplicate field names in Excel, maybe there shouldn't be?
  var requiredBillingFields = {
    name: 'Tarjoajan laskutustiedot',
    values: [
      'Yritys / toiminimi', 'Yht.hlö', 'Postiosoite', 'Postinro', 'Postitoimipaikka', 'Maa', 'Puh.nro',
      'Asiointikieli', 'Laskutuskieli'
    ]
  }

  var requiredLocationFields = {
    name: 'Tarj.paikan yht.tiedot ja tapa',
    values: [
      'Tarjoamispaikan nimi', 'Tarjoamistapa', 'K18 ohjelmia', 'Pelejä (ei PEGI)', 'Yht.hlö', 'Käyntiosoite',
      'Postinro', 'Postitoimipaikka', 'Puh.nro', 'Lasku pääorganisaatiolle', 'Asiointikieli'
    ]
  }

  var errors = []

  var providerData = parseFieldRowAndValueRowAfterColumn(providerSheet, 'Tarjoaja', requiredProviderFields)
  var billingData = parseFieldRowAndValueRowAfterColumn(providerSheet, 'Laskutustiedot', requiredBillingFields)
  var locationsData = parseFieldRowAndValueRows(providerSpreadSheet.Sheets['Tarj.paikan yht.tiedot ja tapa'],
    requiredLocationFields)

  if (locationsData.length === 0) errors.push('Tarjoamispaikkojen tiedot puuttuvat')

  if (errors.length > 0) throw { message: errors.join(', ') }

  return {
    provider: providerData,
    billing: billingData,
    locations: locationsData
  }

  function parseFieldRowAndValueRowAfterColumn(sheet, column, requiredFields) {
    var rowNumber = findColumnRowByValue(sheet, column)
    return toObject(getFields(sheet, rowNumber + 1), getValues(sheet, rowNumber + 2), requiredFields)
  }

  function findColumnRowByValue(from, value) {
    var columnRowNumber = undefined

    _.find(from, function(field, key) {
      if (field.v === value) {
        columnRowNumber = parseRowNumber(key)
        return true
      }
    })

    return columnRowNumber

    function parseRowNumber(key) { return parseInt(key.substring(key.search(/\d/))) }
  }

  function toObject(fields, values, requiredFields) {
    fields = _.clone(fields)
    var object = _.reduce(values, function(result, value) {
      result[fields[value[0]]] = value[1]
      delete fields[value[0]]
      return result
    }, {})

    if (requiredFields) {
      _.forEach(fields, function (field) {
        if (_.contains(requiredFields.values, field)) {
          var errorString = '<%- name %> pakollinen kenttä "<%- field %>" puuttuu'
          if (requiredFields.row) errorString = 'Rivillä <%- row %>. ' + errorString

          errors.push(_.template(errorString, {
            name: requiredFields.name, field: field, row: requiredFields.row
          }))
        }
      })
    }

    return object
  }

  function getFields(from, row) {
    return _.reduce(getValues(from, row), function(result, value) {
      result[value[0]] = value[1]
      return result
    }, {})
  }

  function getValues(from, row) {
    return _.reduce(from, function(result, field, key) {
      if (key.match(new RegExp('.' + row))) result.push([parseColumnKey(key), field.v])
      return result
    }, [])

    function parseColumnKey(key) { return key.substring(0, key.search(/\d/)) }
  }

  function parseFieldRowAndValueRows(sheet, requiredFields) {
    var fields = getFields(sheet, 1)

    var index = 2
    var values = []

    while (true) {
      var currentValues = getValues(sheet, index)
      if (currentValues.length > 0) {
        values.push(toObject(fields, currentValues, _.merge(requiredFields, { row: index })))
        index += 1
      }
      else return values
    }
  }
}

function createObjectAndSetValuesWithMap(object, map) {
  var newObject = {}

  map = _.invert(map)

  _.forEach(utils.flattenObject(object), function(value, key) {
    var path = map[key] ? map[key].split('.') : ['other', key]
    utils.setValueForPath(path, newObject, value)
  })

  return newObject
}

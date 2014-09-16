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
  'contactName':     'Tarjoajan yhteyshenkilö',
  'emailAddresses':  'Sähköposti',
  'language':        'Asiointikieli',
  'name':            'Yritys/Toiminimi',
  'phoneNumber':     'Puhelinnumero',
  'yTunnus':         'Y-tunnus'
}

var billingFieldMap = {
  'billing.address.city':    'Postitoimipaikka',
  'billing.address.street':  'Lähiosoite',
  'billing.address.zip':     'Postinro',
  'billing.invoiceText':     'Laskulle haluttava teksti',
  'eInvoice.address':        'Verkkolaskuosoite (OVT/IBAN)',
  'eInvoice.operator':       'Välittäjätunnus'
}

// Invert
var locationFieldMap = {
  'address.city':     'Postitoimipaikka',
  'address.street':   'Lähiosoite',
  'address.zip':      'Postinro',
  'adultContent':     'K18 ohjelmia',
  'contactName':      'Tarjoamispaikan yhteyshenkilö',
  'emailAddresses':   'Sähköpostiosoite',
  'isPayer':          'Lasku Tarjoamispaikalle',
  'name':             'Tarjoamispaikan nimi',
  'phoneNumber':      'Puhelinnumero',
  'url':              'www-osoite'
}

exports.import = function(file, callback) {
  var parser = false

  if (file.search(/.xls$/) > 1) parser = xls
  else if (file.search(/.xlsx$/) > 1) parser = xlsx
  else return callback({ message: '.xlsx or .xls required' })

  getProviderAndLocationsFromSpreadSheet(parser.readFile(file).Sheets['Tarjoajaksi ilmoittautuminen'], function(err, providerAndLocations) {
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
    provider.address.country = enums.getCountryCode(provider.address.country) || provider.address.country

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
      var location = createObjectAndSetValuesWithMap(location, locationFieldMap, {
        providingType: {
          fields: [
            'Tallenteiden tarjoaminen', 'Julkinen esittäminen', 'Valtakunnallinen TV-ohjelmisto',
            'Alueellinen ohjelmisto', 'Ulkomailta välitetty ohjelm.', 'Tilausohjelma-palvelu'
          ],
          toValue: enums.getProvidingType
        }
      })

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

function getProviderAndLocationsFromSpreadSheet(providerSheet, callback) {
  // TODO: check
  var requiredProviderFields = {
    name: 'Tarjoajan tiedot:',
    values: ['name', 'yTunnus', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber', 'language'],
    fieldMap: providerFieldMap
  }

  // TODO: check
  var requiredLocationFields = {
    name: 'Tarjoamispaikan tiedot:',
    values: ['name', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber'],
    fieldMap: locationFieldMap
  }

  var noRequiredFields = {
    name: '',
    values: [],
    fieldMap: {}
  }

  var errors = []

  var providerData = parseFieldRowAndValueRowAfterColumn('Tarjoaja', requiredProviderFields)
  var billingData = parseFieldRowAndValueRowAfterColumn('Lasku eri osoitteeseen kuin Tarjoajan osoite', noRequiredFields)
  var eInvoiceData = parseFieldRowAndValueRowAfterColumn('TAI verkkolasku', noRequiredFields)
  var locationsData = parseFieldRowAndValueRowsAfterColumn('Tarjoamispaikkojen tiedot ja tarjoamistavat', requiredLocationFields)

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

  function parseFieldRowAndValueRowAfterColumn(column, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    var rows = toObject(getFields(providerSheet, rowNumber + 1), getValues(providerSheet, rowNumber + 2))

    var errorMessages = validate(rows, requiredFields, rowNumber + 2)
    errorMessages.forEach(function(msg) {
      errors.push(msg)
    })

    return rows
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

  function toObject(fields, values) {
    return _.reduce(values, function(result, value) {
      result[fields[value[0]]] = value[1]
      return result
    }, {})
  }

  function validate(values, requiredFields, index) {
    var inverted = _.invert(requiredFields.fieldMap)
    var present = _(values).keys().map(function(x) {
      return inverted[x]
    }).value()

    var missing = _.reduce(requiredFields.values, function(acc, r) {
      if (_.indexOf(present, r) === -1) return acc.concat(r)
      else return acc
    }, [])

    return _.map(missing, function (field) {
      var errorString = 'Rivillä <%- row %>. <%- name %> pakollinen kenttä "<%- field %>" puuttuu'
      return _.template(errorString, {
        name: requiredFields.name, field: requiredFields.fieldMap[field], row: index
      })
    })
  }

  function getFields(from, row) {
    return _.reduce(getValues(from, row), function(result, value) {
      result[value[0]] = value[1]
      return result
    }, {})
  }

  function getValues(from, row) {
    return _.reduce(from, function(result, field, key) {
      if (key.match(new RegExp('.' + row))) return result.concat([[parseColumnKey(key), field.v]])
      else return result
    }, [])

    function parseColumnKey(key) { return key.substring(0, key.search(/\d/)) }
  }

  function parseFieldRowAndValueRowsAfterColumn(column, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    var fields = getFields(providerSheet, rowNumber + 1)

    var rows = values([], rowNumber + 2)
    
    var errorMessages = _.reduce(rows, function(acc, val) {
      var index = acc[0]
      var errors = acc[1]
      var fieldErrors = validate(val, requiredFields, index)
      return [index + 1, errors.concat(fieldErrors).concat(validateProvidingType(val, index))]
    }, [rowNumber + 2, []])[1]

    errorMessages.forEach(function(msg) {
      errors.push(msg)
    })

    return rows

    function values(xs, index) {
      var currentValues = getValues(providerSheet, index)
      if (currentValues.length == 0) {
        return xs
      } else {
        return values(xs.concat([toObject(fields, currentValues)]), index + 1)
      }
    }

    function validateProvidingType(val, index) {
      var providingTypeFields = [
        'Tallenteiden tarjoaminen', 'Julkinen esittäminen', 'Valtakunnallinen TV-ohjelmisto',
        'Alueellinen ohjelmisto', 'Ulkomailta välitetty ohjelm.', 'Tilausohjelma-palvelu'
      ]
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
  }
}

function createObjectAndSetValuesWithMap(object, map, specialFields) {
  var newObject = {}

  map = _.invert(map)

  _.forEach(utils.flattenObject(object), function(value, key) {
    if (map[key]) {
      utils.setValueForPath(map[key].split('.'), newObject, value)
    } else {
      var arrayProperty = getArrayPropertyKeyAndValue(key)
      if (arrayProperty) {
        if (_.isArray(newObject[arrayProperty[0]])) {
          newObject[arrayProperty[0]].push(arrayProperty[1])
        } else {
          newObject[arrayProperty[0]] = [arrayProperty[1]]
        }
      } else {
        utils.setValueForPath(['other', key], newObject, value)
      }
    }
  })

  return newObject

  function getArrayPropertyKeyAndValue(key) {
    var propertyName = _.findKey(specialFields, function(property) { return _.contains(property.fields, key) })

    if (propertyName) {
      var property = specialFields[propertyName]

      return [ propertyName, property.toValue(_.indexOf(property.fields, key)) ]
    } else {
      return undefined
    }
  }
}

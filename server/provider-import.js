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
  'gamesWithoutPegi': 'Pelejä (ei PEGI)',
  'isPayer':          'Lasku Tarjoamispaikalle',
  'name':             'Tarjoamispaikan nimi',
  'phoneNumber':      'Puhelinnumero',
  //'providingType':    '', // special case
  'url':              'www-osoite'
}

exports.import = function(file, callback) {
  try {
    var parser = false

    if (file.search(/.xls$/) > 1) parser = xls
    else if (file.search(/.xlsx$/) > 1) parser = xlsx
    else return callback({ message: '.xlsx or .xls required' })

    var providerAndLocations = getProviderAndLocationsFromSpreadSheet(parser.readFile(file).Sheets['Tarjoajaksi ilmoittautuminen'])
  } catch (err) {
    return callback(err)
  }

  var provider = createProvider(providerAndLocations.provider, providerAndLocations.billing)
  provider.locations = createLocations(providerAndLocations.locations)

  return new schema.Provider(_.omit(provider, 'other')).save(function(err, provider) { return callback(err, provider) })

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
        gamesWithoutPegi: stringXToBoolean(location.gamesWithoutPegi)
      })
    })
  }
  function stringXToBoolean(x) { return _.isString(x) ? x.toLowerCase() === 'x' : false }
}

function getProviderAndLocationsFromSpreadSheet(providerSheet) {
  // TODO: check
  var requiredProviderFields = {
    name: 'Tarjoaja',
    values: ['name', 'yTunnus', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber', 'language'],
    fieldMap: providerFieldMap
  }

  // TODO: check
  var requiredLocationFields = {
    name: 'Tarjoamispaikkojen tiedot ja tarjoamistavat',
    values: ['name', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber'],
    fieldMap: locationFieldMap
  }

  var errors = []

  var providerData = parseFieldRowAndValueRowAfterColumn('Tarjoaja', requiredProviderFields)
  var billingData = parseFieldRowAndValueRowAfterColumn('Lasku eri osoitteeseen kuin Tarjoajan osoite')
  var eInvoiceData = parseFieldRowAndValueRowAfterColumn('TAI verkkolasku')
  var locationsData = parseFieldRowAndValueRowsAfterColumn('Tarjoamispaikkojen tiedot ja tarjoamistavat', requiredLocationFields)

  if (locationsData.length === 0) errors.push('Tarjoamispaikkojen tiedot puuttuvat')

  if (errors.length > 0) throw { message: errors.join(', ') }

  return {
    provider: providerData,
    billing: utils.merge(billingData, eInvoiceData),
    locations: locationsData
  }

  function parseFieldRowAndValueRowAfterColumn(column, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    return toObject(getFields(providerSheet, rowNumber + 1), getValues(providerSheet, rowNumber + 2), requiredFields)
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

  function toObject(fields, values, requiredFields) {
    fields = _.clone(fields)
    var object = _.reduce(values, function(result, value) {
      result[fields[value[0]]] = value[1]
      delete fields[value[0]]
      return result
    }, {})

    if (requiredFields) {
      var reqFields = _.map(requiredFields.values, function(value) {
        return requiredFields.fieldMap[value]
      })

      _.forEach(fields, function (field) {
        if (_.contains(reqFields, field)) {
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
      if (key.match(new RegExp('.' + row))) return result.concat([[parseColumnKey(key), field.v]])
      else return result
    }, [])

    function parseColumnKey(key) { return key.substring(0, key.search(/\d/)) }
  }

  function parseFieldRowAndValueRowsAfterColumn(column, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    var fields = getFields(providerSheet, rowNumber + 1)

    return values([], rowNumber + 2)

    function values(xs, index) {
      var currentValues = getValues(providerSheet, index)
      if (currentValues.length == 0) {
        return xs
      } else {
        return values(xs.concat([toObject(fields, currentValues, utils.merge(requiredFields, { row: index }))]), index + 1)
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

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

var locationFieldMap = {
  'address.city':               'Postitoimipaikka',
  'address.street':             'Lähiosoite',
  'address.zip':                'Postinro',
  'adultContent':               'Luokittelemattomia K18 ohjelmia',
  'contactName':                'Tarjoamispaikan yhteyshenkilö',
  'emailAddresses':             'Sähköpostiosoite',
  'isPayer':                    'Lasku lähetetään Tarjoamispaikalle',
  'name':                       'Tarjoamispaikan nimi',
  'phoneNumber':                'Puhelinnumero',
  'url':                        ' www-osoite',
  'Recordings_provide':         'Tallenteiden tarjoaminen',
  'Public_presentation':        'Julkinen esittäminen',
  'National_TV':                'Valtakunnallinen TV-ohjelmisto',
  'Regional_TV':                'Alueellinen ohjelmisto',
  'Transmitted_abroad_program': 'Ulkomailta välitetty ohjelm.',
  'Subscription_of_program':    'Tilausohjelma-palvelu'
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

function getProviderAndLocationsFromSpreadSheet(providerSheet, callback) {
  var requiredProviderFields = {
    name: 'Tarjoajan tiedot:',
    values: ['name', 'yTunnus', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber', 'language']
  }

  var requiredLocationFields = {
    name: 'Tarjoamispaikan tiedot:',
    values: ['name', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber']
  }

  var noRequiredFields = { name: '', values: [] }

  var errors = []

  var providerData = parseFieldRowAndValueRowAfterColumn('Tarjoaja', providerFieldMap, requiredProviderFields)
  var billingData = parseFieldRowAndValueRowAfterColumn('Lasku eri osoitteeseen kuin Tarjoajan osoite', billingFieldMap, noRequiredFields)
  var eInvoiceData = parseFieldRowAndValueRowAfterColumn('TAI verkkolasku', billingFieldMap, noRequiredFields)
  var locationsData = parseFieldRowAndValueRowsAfterColumn('Tarjoamispaikkojen tiedot ja tarjoamistavat', locationFieldMap, requiredLocationFields)

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
    var row = toObject(getFields(providerSheet, rowNumber + 1, _.invert(fieldMap)), getValues(providerSheet, rowNumber + 2))

    var errorMessages = validate(row, requiredFields, rowNumber + 2, fieldMap)
    errorMessages.forEach(function(msg) {
      errors.push(msg)
    })

    return row
  }

  function parseFieldRowAndValueRowsAfterColumn(column, fieldMap, requiredFields) {
    var rowNumber = findColumnRowByValue(providerSheet, column)
    var fields = getFields(providerSheet, rowNumber + 1, _.invert(fieldMap))

    var rows = values([], rowNumber + 2)
    
    var errorMessages = _.reduce(rows, function(acc, val) {
      var index = acc[0], errors = acc[1]
      var fieldErrors = validate(val, requiredFields, index, fieldMap)
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
      return utils.merge(result, utils.keyValue(fields[value[0]], value[1]))
    }, {})
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
        field: fieldMap[field],
        row: index
      })
    })
  }

  function getFields(from, row, fieldMap) {
    return _.reduce(getValues(from, row), function(result, value) {
      var excelColIndex = value[0]
      var excelCol = value[1]
      result[excelColIndex] = fieldMap[excelCol]
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
}

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

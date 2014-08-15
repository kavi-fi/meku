var mongoose = require('mongoose')
var schema = require('../server/schema')
var utils = require('../shared/utils')
var _ = require('lodash')
var xlsx = require('xlsx')
var xls = require('xlsjs')
var async = require('async')

var providerFieldMap = {
  'Y-tunnus': 'yTunnus',
  'Yritys/Toiminimi': 'name',
  'Lähiosoite': 'address.street', Postitoimipaikka: 'address.city', Postinro: 'address.zip', Maa: 'address.country',
  'Laskutus.Postiosoite': 'billing.address.street', 'Laskutus.Postitoimipaikka': 'billing.address.city',
  'Laskutus.Postinro': 'billing.address.zip', 'Laskutus.Maa': 'billing.address.country',
  'Laskutus.Laskutuskieli': 'billing.language', 'Laskutus.Laskulle haluttava teksti': 'billing.invoiceText',
  'Tarjoajan yht.hlö': 'contactName',
  'Puh.nro': 'phoneNumber',
  'Sähköposti': 'emailAddresses',
  'Asiointikieli': 'language'
}

var locationFieldMap = {
  'Tarjoamispaikan nimi': 'name',
  'Laskutusosoite': 'address.street',
  'Postitoimipaikka': 'address.city',
  'Postinro': 'address.zip',
  'Yht.hlö': 'contactName',
  'Puh.nro': 'phoneNumber',
  'Sähköpostiosoite': 'emailAddresses',
  'Laskutuskieli': 'language',
  'Tarjoamistapa': 'providingType',
  'Lasku pääorganisaatiolle': 'isPayer',
  'K18 ohjelmia': 'adultContent',
  'Pelejä (ei PEGI)': 'gamesWithoutPegi'
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

  new schema.Provider(_.omit(provider, 'other')).save(function(err, provider) {
    if (err) return callback(err)

    var locations = []

    async.forEach(providerAndLocations.locations, function(location, callback) {
      location = createObjectAndSetValuesWithMap(location, locationFieldMap)
      location.providingType = location.providingType.split(',')
      location.provider = provider._id
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
      'Postinro', 'Postitoimipaikka', 'Puh.nro', 'Lasku pääorganisaatiolle', 'Asiointikieli',
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
    provider: _.merge(providerData, { Laskutus: billingData }),
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

  _.forEach(utils.flattenObject(object), function(value, key) {
    var path = map[key] ? map[key].split('.') : ['other', key]
    utils.setValueForPath(path, newObject, value)
  })

  return newObject
}

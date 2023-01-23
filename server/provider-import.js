const utils = require('../shared/utils')
const _ = require('lodash')
const xlsx = require('xlsx')
const enums = require('../shared/enums')

// NOTE: field order matters
const providerFieldMap = [
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
const billingFieldMap = [
  'billing.address.street',
  'billing.address.zip',
  'billing.address.city',
  'billing.invoiceText'
]

// NOTE: field order matters
const eInvoiceFieldMap = [
  'eInvoice.address',
  'eInvoice.operator'
]

// NOTE: field order matters
const locationFieldMap = [
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
  'Video_sharing_service',
  'url',
  'adultContent'
]

const fieldNames = {
  'name': 'Nimi',
  'yTunnus': 'Y-tunnus',
  'address.street': 'lähiosoite',
  'address.zip': 'postinro',
  'address.city': 'postitoimipaikka',
  'address.country': 'maa',
  'language': 'asiointikieli',
  'contactName': 'yhteyshenkilö',
  'emailAddresses': 'sähköposti',
  'phoneNumber': 'puhelinnumero'
}

// These need to match exactly with the labels in the provider Excel file
const i18n = {
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
  let parser = false

  if (file.originalname.search(/.xlsx?$/) > 1) parser = xlsx
  else return callback({message: '.xlsx or .xls required'})

  const allSheets = parser.readFile(file.path)
  const sheetFi = allSheets.Sheets['Tarjoajaksi ilmoittautuminen']
  const sheetSv = allSheets.Sheets['Leverant&#xF6;rsanm&#xE4;lan'] || allSheets.Sheets['Leverantörsanmälan']
  const useFi = isEmptySheet(sheetSv, i18n.sv.Tarjoaja)

  getProviderAndLocationsFromSpreadSheet(useFi ? sheetFi : sheetSv, useFi ? identity : sv, (err, providerAndLocations) => {
    if (err) return callback(err)
    const provider = createProvider(providerAndLocations.provider, providerAndLocations.billing)
    provider.locations = createLocations(providerAndLocations.locations)
    return callback(null, provider)
  })

  function createProvider(providerData, billingData) {
    let provider = createObjectAndSetValuesWithMap(providerData, providerFieldMap)
    provider.deleted = false
    provider.active = false
    provider.creationDate = new Date()
    provider.language = provider.language && provider.language.toLowerCase() === 'svenska' ? 'SV' : 'FI'
    provider.address.country = enums.getCountryCode(provider.address.country) || 'FI'

    const billing = createObjectAndSetValuesWithMap(billingData, billingFieldMap)

    provider = utils.merge(provider, billing)

    if (provider.billing && provider.billing.address) {
      provider.billingPreference = 'address'
    }

    if (provider.eInvoice) {
      provider.billingPreference = 'eInvoice'
    }

    return provider
  }

  function createLocations(locationsData) {
    return _.map(locationsData, (location) => {
      const loc = createObjectAndSetValuesWithMap(location, locationFieldMap, {providingType: _.keys(enums.providingType)})

      return utils.merge(loc, {
        deleted: false,
        active: true,
        isPayer: stringXToBoolean(loc.isPayer),
        adultContent: stringXToBoolean(loc.adultContent)
      })
    })
  }
  function stringXToBoolean(x) { return _.isString(x) ? x.toLowerCase() === 'x' : false }
}

function getProviderAndLocationsFromSpreadSheet(providerSheet, text, callback) {
  const requiredProviderFields = {
    name: 'Tarjoajan tiedot:',
    values: ['name', 'yTunnus', 'contactName', 'address.street', 'address.zip', 'address.city', 'address.country', 'phoneNumber', 'language']
  }

  const requiredLocationFields = {
    name: 'Tarjoamispaikan tiedot:',
    values: ['name', 'contactName', 'address.street', 'address.zip', 'address.city', 'phoneNumber']
  }

  const noRequiredFields = {name: '', values: []}

  const errors = []

  const providerData = parseFieldRowAndValueRowAfterColumn(text('Tarjoaja'), providerFieldMap, requiredProviderFields)
  const billingData = parseFieldRowAndValueRowAfterColumn(text('Lasku eri osoitteeseen kuin Tarjoajan osoite'), billingFieldMap, noRequiredFields)
  const eInvoiceData = parseFieldRowAndValueRowAfterColumn(text('TAI verkkolasku'), eInvoiceFieldMap, noRequiredFields)
  const locationsData = parseFieldRowAndValueRowsAfterColumn(text('Tarjoamispaikkojen tiedot ja tarjoamistavat'), locationFieldMap, requiredLocationFields)

  if (locationsData.length === 0) errors.push('Tarjoamispaikkojen tiedot puuttuvat')

  if (errors.length > 0) {
    return callback({messages: errors})
  }
    return callback(null, {
      provider: providerData,
      billing: utils.merge(billingData, eInvoiceData),
      locations: locationsData
    })


  function parseFieldRowAndValueRowAfterColumn(column, fieldMap, requiredFields) {
    const rowNumber = findColumnRowByValue(providerSheet, column)
    const row = toObject(providerSheet, rowNumber + 2, fieldMap)
    const errorMessages = validate(row, requiredFields, rowNumber + 2, fieldMap)
    errorMessages.forEach((msg) => {
      errors.push(msg)
    })

    return row
  }

  function parseFieldRowAndValueRowsAfterColumn(column, fieldMap, requiredFields) {
    const rowNumber = findColumnRowByValue(providerSheet, column)

    const rows = values([], rowNumber + 2)

    const errorMessages = _.reduce(rows, (acc, val) => {
      const index = acc[0], errs = acc[1]
      const fieldErrors = validate(val, requiredFields, index, fieldMap)
      return [index + 1, errs.concat(fieldErrors)
        .concat(validateProvidingType(val, index))
        .concat(validateRequiredEmail(val, index))]
    }, [rowNumber + 2, []])[1]

    errorMessages.forEach((msg) => {
      errors.push(msg)
    })

    return rows

    function values(xs, row) {
      const currentValues = toObject(providerSheet, row, fieldMap)
      if (_.every(currentValues, (x) => !x)) {
        return xs
      }
      return values(xs.concat([currentValues]), row + 1)
    }

    function validateProvidingType(val, index) {
      const providingTypeFields = _.keys(enums.providingType)
      const present = _.keys(val)
      const hasAtLeastOneProvidingType = _(providingTypeFields).map((name) => _.indexOf(present, name) > 0).some()

      if (!hasAtLeastOneProvidingType) {
        return ['Tarjoamispaikan tiedot rivillä ' + index + ': tarjoamispaikalla täytyy olla ainakin yksi tajoamistapa.']
      }
        return []

    }

    function validateRequiredEmail(val, row) {
      const msg = 'Tarjoamispaikan tiedot rivillä ' + row + ': sähköpostiosoite on pakollinen jos lasku lähetetään tarjoamispaikalle.'
      if (val.isPayer && !val.emailAddresses) return [msg]
      return []
    }
  }


  function validate(values, requiredFields, index) {
    const present = _.keys(values)
    const missing = _.reduce(requiredFields.values, (acc, r) => {
      if (_.indexOf(present, r) === -1) return acc.concat(r)
      return acc
    }, [])

    return _.map(missing, (field) => {
      const errorString = 'Rivillä <%- row %>. <%- name %> pakollinen kenttä "<%- field %>" puuttuu'
      return _.template(errorString)({
        name: requiredFields.name,
        field: fieldNames[field],
        row: index
      })
    })
  }

}

function findColumnRowByValue(from, value) {
  let columnRowNumber

  _.find(from, (field, key) => {
    if (field.v && field.v.trim().toLowerCase() === value.toLowerCase()) {
      columnRowNumber = parseRowNumber(key)
      return true
    }
  })

  return columnRowNumber

  function parseRowNumber(key) { return parseInt(key.substring(key.search(/\d/))) }
}

function toObject(from, row, fields) {
  const fst = function (x) { return x[0] }
  const snd = function (x) { return x[1] }

  const ob = _.reduce(from, (result, field, key) => {
    if (key.match(new RegExp('.' + row))) {
      return utils.merge(result, utils.keyValue(key.substr(0, 1), field.v))
    }
    return result
  }, emptyRow(fields.length))

  const values = _(ob).toPairs().sortBy(fst).map(snd).value()

  return _.pickBy(_.zipObject(fields, values), _.identity)
}

function emptyRow(count) {
  return _('BCDEFGHIJKLMNOPQRSTU'.split('')).take(count).reduce((ob, c) => utils.merge(ob, utils.keyValue(c, null)), {})
}

function isEmptySheet(s, heading) {
  const rowNumber = findColumnRowByValue(s, heading)
  const row = toObject(s, rowNumber + 2, providerFieldMap)
  return _.isEmpty(row)
}

function identity(x) { return x }

function createObjectAndSetValuesWithMap(object, map, enumProperties) {
  const enumProps = _.reduce(_.toPairs(enumProperties), (ob, x) => {
    const propName = x[0], fields = x[1]
    return utils.merge(ob, utils.keyValue(propName, toArray(fields)))

    function toArray(flds) {
      return _.reduce(flds, (acc, field) => {
        if (object[field]) return acc.concat(field)
        return acc
      }, [])
    }
  }, {})

  const properties = _.reduce(_.toPairs(utils.flattenObject(object)), (ob, pair) => {
    const key = pair[0], val = pair[1], prop = {}
    utils.setValueForPath(key.split('.'), prop, val)
    return utils.merge(ob, prop)
  }, {})

  return utils.merge(enumProps, omitEnumProps(properties))

  function omitEnumProps(props) {
    const enumPropNames = _(enumProperties).toPairs().map((x) => x[1]).flatten().value()
    return _.omit(props, enumPropNames)
  }
}

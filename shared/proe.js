if (isNodeJs()) {
  var _ = require('lodash')
  var moment = require('moment')
  var utils = require('./utils')
  var enums = require('./enums')
}

// dateRange: { begin: moment, end: moment }, accountRows: [{ account:Account, rows:[InvoiceRow] }]
function createProe(dateRange, accountRows, proeType) {
  var dateFormat = 'DD.MM.YYYY'

  var providerBilling = /^provider/.test(proeType)

  return _(accountRows).map(function (i) {
    var id = i.account.sequenceId
    return [
      accountHeaderRow(id, i.account),
      eInvoiceRow(id, i.account),
      textRows(id, dateRange, i.rows),
      i.rows.map(function (r) {
        return billingRow(id, r)
      })
    ]
  }).flatten().compact().join('\n')

  function accountHeaderRow(id, account) {
    var address = account.billingPreference == 'address' ? utils.getProperty(account, 'billing.address') : account.address
    if (!address) address = {}
    var invoiceText = (utils.getProperty(account, 'billing.invoiceText') || '').replace(/\n/g, ' ')
    return header(id, 'L') + ws(2) + pad(account.name, 50)
      + ws(50) // asiakkaan nimi20
      + pad(address.street, 30)
      + pad(concat(address.zip, address.city), 30)
      + ws(105) // puhelin/fax/yhteysHenkilö/pankki/pankkiTili
      + ws(1) // asiakastyyppi, default = 0
      + languageCode(account.billingLanguage)
      + ws(3) // maksukehoituslupa/maksutapa/maksuhäiriökoodi
      + 'K' // tulostustapa: tulostetaan normaali lasku
      + ws(72) // Laskupvm/Eräpvm/Kirjauspvm/Viivästysmaksut/Hyvityslaskunumero/Laskunumero/Viitenumero
      + (useEInvoice(account) ? 'V' : ' ') // Laskun maksutapa
      + ws(10) //Kumppani
      + 'EUR'
      + ws(5) // Laskulaji/Laskutusyksikkö
      + pad(invoiceText, 30) //Laskun selite/
      + ws(111) //Turvakielto/Työnantaja1/Työnantaja2/Osoite2
      + pad(address.country, 30)
      + pad(account.yTunnus, 11)
      + ws(39)
  }

  function eInvoiceRow(id, account) {
    if (!useEInvoice(account)) return ''
    var e = account.eInvoice
    return header(id, 'E') + pad(e.address, 35) + pad(e.operator, 35) + ws(100)
  }

  function textRows(id, dateRange, rows) {
    var arr = []
    if (providerBilling) {
      arr.push(textRow('Valvontamaksu vuosi ' + dateRange.begin.year()))
      arr.push(textRow(rows.length + ' ' + price(rows) + ' EUR'))
    } else {
      arr.push(textRow('KOONTILASKUTUS ' + dateRange.begin + ' - ' + dateRange.end))
      var rowsPerType = _.groupBy(rows, 'type')
      _.pairs(rowsPerType).forEach(function(item) {
        arr.push(textRow(summaryText(item[0], item[1])))
      })
    }
    arr.push(textRow('Lasku yhteensä ' + price(rows) + ' EUR'))
    arr.push(textRow(' '))
    arr.push(textRow(providerBilling ? 'Rek. pvm, Tarjoamistapa, Tarjoamispaikka' : 'Kuvaohjelman tunniste, päätöspvm, nimi'))
    return arr

    function textRow(txt) {
      return header(id, '3') + pad(' ' + txt, 78) + ws(40)
    }

    function summaryText(type, rows) {
      var typeString = { classification: 'luokiteltu', reclassification: 'uudelleenluokiteltu', registration: 'rekisteröity' }
      var plural = rows.length > 1 ? ' kuvaohjelmaa ' : ' kuvaohjelma '
      return rows.length + plural + typeString[type] + ', yhteensä ' + price(rows) + ' EUR'
    }

    function price(arr) {
      return _(arr).pluck('price').reduce(function (a, b) {
        return a + b
      }, 0) / 100
    }
  }

  function billingRow(id, invoice) {
    var txt = providerBilling
      ? ' ' + [moment(invoice.registrationDate).format(dateFormat), shortProvidingTypeName(invoice.providingType), invoice.name].join(', ')
      : ' ' + [invoice.programSequenceId, moment(invoice.registrationDate).format(dateFormat), invoice.name].join(' ')

    return header(id, '2')
      + '00' // alv-koodi
      + pad(txt, 65)
      + ws(1) // summa-etumerkki
      + pad(invoice.price.toString(), 11, true)
      + 'N' // brutto-netto
      + ws(180)
  }

  function shortProvidingTypeName(providingType) {
    var names = {
      'Recordings_provide': 'Tallenteiden tarj.',
      'Public_presentation': 'Julkinen esitt.',
      'National_TV': 'Valtak. tv-ohjelm.',
      'Regional_TV': 'Alueell. tv-ohjelm.',
      'Transmitted_abroad_program': 'Ulk. väl. tv-ohjelm.',
      'Subscription_of_program': 'Tilausohjelmapalv.'
    }
    return names[providingType]
  }

  function header(id, code) {
    return pad(id.toString(), 11) + code
  }

  function pad(s, length, asPrice) {
    if (!s) s = ''
    var fill = length - s.length + 1
    if (fill == 0) return s
    if (fill < 0) {
      return s.substring(0, length)
    } else {
      var padding = new Array(fill).join(asPrice ? '0' : ' ')
      return asPrice ? padding + s : s + padding
    }
  }

  function ws(length) {
    return new Array(length + 1).join(' ')
  }

  function concat(args) {
    return Array.prototype.slice.call(arguments).join(' ')
  }

  function languageCode(lang) {
    return [0, 'FI', 'SE', 'EN'].indexOf(lang || 'FI')
  }

  function useEInvoice(account) {
    return account.billingPreference == 'eInvoice'
  }
}

if (isNodeJs()) module.exports = createProe

function isNodeJs() { return typeof module !== 'undefined' && module.exports }

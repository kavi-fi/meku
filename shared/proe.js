if (isNodeJs()) {
  var _ = require('lodash')
  var moment = require('moment')
}

// dateRange: { begin: moment, end: moment }, accountRows: [{ account:Account, rows:[InvoiceRow] }]
function createProe(dateRange, accountRows) {
  var dateFormat = 'DD.MM.YYYY'

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
    return header(id, 'L') + ws(2) + pad(account.name, 50)
      + ws(50) // asiakkaan nimi20
      + pad(account.billing.street, 30)
      + pad(concat(account.billing.zip, account.billing.city), 30)
      + ws(105) // puhelin/fax/yhteysHenkilö/pankki/pankkiTili
      + ws(1) // asiakastyyppi, default = 0
      + languageCode(account.billingLanguage)
      + ws(3) // maksukehoituslupa/maksutapa/maksuhäiriökoodi
      + 'K' // tulostustapa: tulostetaan normaali lasku
      + ws(72) // Laskupvm/Eräpvm/Kirjauspvm/Viivästysmaksut/Hyvityslaskunumero/Laskunumero/Viitenumero
      + (hasEInvoice(account) ? 'V' : ' ') // Laskun maksutapa
      + ws(10) //Kumppani
      + 'EUR'
      + ws(5) // Laskulaji/Laskutusyksikkö
      + pad(account.billing.invoiceText, 30) //Laskun selite/
      + ws(111) //Turvakielto/Työnantaja1/Työnantaja2/Osoite2
      + pad(account.billing.country, 30)
      + pad(account.yTunnus, 11)
      + ws(39)
  }

  function eInvoiceRow(id, account) {
    if (!hasEInvoice(account)) return ''
    var e = account.eInvoice
    return header(id, 'E') + pad(e.address, 35) + pad(e.operator, 35) + ws(100)
  }

  function textRows(id, dateRange, rows) {
    var typeString = { classification: 'luokiteltu', reclassification: 'uudelleenluokiteltu', registration: 'rekisteröity' }
    var rowsPerType = _.groupBy(rows, 'type')
    var arr = []
    arr.push(textRow('KOONTILASKUTUS ' + dateRange.begin + ' - ' + dateRange.end))
    _.pairs(rowsPerType).forEach(function(item) {
      arr.push(textRow(summaryText(item[0], item[1])))
    })
    arr.push(textRow('Lasku yhteensä ' + price(rows) + ' EUR'))
    arr.push(textRow(' '))
    arr.push(textRow('Kuvaohjelman tunniste, päätöspvm, nimi'))
    return arr

    function textRow(txt) {
      return header(id, '3') + pad(' ' + txt, 78) + ws(40)
    }

    function summaryText(type, rows) {
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
    var txt = ' ' + [invoice.program, moment(invoice.registrationDate).format(dateFormat), invoice.name].join(' ')
    return header(id, '2')
      + '00' // alv-koodi
      + pad(txt, 65)
      + ws(1) // summa-etumerkki
      + pad(invoice.price.toString(), 11, true)
      + 'N' // brutto-netto
      + ws(180)
  }

  function header(id, code) {
    return pad(id.toString(), 11) + code
  }

  function pad(s, length, asPrice) {
    if (!s) s = ''
    var fill = length - s.length + 1
    if (fill == 0) return s
    if (fill < 0) {
      return s.substring(length)
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
    return [0, 'fi', 'sv', 'en'].indexOf(lang || 'fi')
  }

  function hasEInvoice(account) {
    return account.eInvoice && account.eInvoice.address && account.eInvoice.operator
  }
}

if (isNodeJs()) module.exports = createProe

function isNodeJs() { return typeof module !== 'undefined' && module.exports }

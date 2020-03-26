const xlsx = require('xlsx')

function datenum (v, date1904) {
  const epoch = Date.parse(date1904 ? v + 1462 : v);
  return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function sheet_from_array_of_arrays (data) {
  const ws = {}
  const range = {s: {c: 10000000, r: 10000000}, e: {c: 0, r: 0}}
  for (let R = 0; R !== data.length; R += 1) {
    for (let C = 0; C !== data[R].length; C += 1) {
      if (range.s.r > R) range.s.r = R
      if (range.s.c > C) range.s.c = C
      if (range.e.r < R) range.e.r = R
      if (range.e.c < C) range.e.c = C
      const cell = {v: data[R][C]}
      if (cell.v) {
        const cell_ref = xlsx.utils.encode_cell({c: C, r: R})

        /* TEST: proper cell types and value handling */
        if (typeof cell.v === 'number') cell.t = 'n'
        else if (typeof cell.v === 'boolean') cell.t = 'b'
        else if (cell.v instanceof Date) {
          cell.t = 'n'; cell.z = xlsx.SSF._table[14]
          cell.v = datenum(cell.v)
        }
        else cell.t = 's'
        ws[cell_ref] = cell
      }
    }
  }

  if (range.s.c < 10000000) ws['!ref'] = xlsx.utils.encode_range(range)
  return ws
}

function Workbook () {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

exports.write = function (xlsxName, excelData, columnWidths) {
  const wb = new Workbook()
  const ws_name = 'Sheet1'
  const ws = sheet_from_array_of_arrays(excelData)
  wb.SheetNames.push(ws_name)
  wb.Sheets[ws_name] = ws
  ws['!cols'] = columnWidths
  xlsx.writeFile(wb, xlsxName)
}


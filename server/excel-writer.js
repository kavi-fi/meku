var xlsx = require('xlsx')

function datenum(v, date1904) {
  if(date1904) v+=1462;
  var epoch = Date.parse(v);
  return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function sheet_from_array_of_arrays(data, opts) {
  var ws = {}
  var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }}
  for(var R = 0; R != data.length; ++R) {
    for(var C = 0; C != data[R].length; ++C) {
      if(range.s.r > R) range.s.r = R
      if(range.s.c > C) range.s.c = C
      if(range.e.r < R) range.e.r = R
      if(range.e.c < C) range.e.c = C
      var cell = {v: data[R][C] }
      if(cell.v == null) continue;
      var cell_ref = xlsx.utils.encode_cell({c:C,r:R})

      /* TEST: proper cell types and value handling */
      if(typeof cell.v === 'number') cell.t = 'n'
      else if(typeof cell.v === 'boolean') cell.t = 'b'
      else if(cell.v instanceof Date) {
        cell.t = 'n'; cell.z = xlsx.SSF._table[14]
        cell.v = datenum(cell.v)
      }
      else cell.t = 's'
      ws[cell_ref] = cell
    }
  }

  if(range.s.c < 10000000) ws['!ref'] = xlsx.utils.encode_range(range)
  return ws
}

function Workbook() {
  if(!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

exports.write = function (xlsxName, excelData, columnWidths) {
  var wb = new Workbook()
  var ws_name = 'Sheet1'
  var ws = sheet_from_array_of_arrays(excelData)
  wb.SheetNames.push(ws_name)
  wb.Sheets[ws_name] = ws
  ws['!cols'] = columnWidths
  xlsx.writeFile(wb, xlsxName)
}


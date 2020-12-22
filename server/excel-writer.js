const xlsx = require('xlsx')

function Workbook () {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

exports.write = function (xlsxName, excelData, columnWidths) {
  const wb = new Workbook()
  const ws_name = 'Sheet1'
  const ws = xlsx.utils.aoa_to_sheet(excelData)
  wb.SheetNames.push(ws_name)
  wb.Sheets[ws_name] = ws
  ws['!cols'] = columnWidths
  xlsx.writeFile(wb, xlsxName)
}


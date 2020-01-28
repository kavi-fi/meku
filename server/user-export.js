const _ = require('lodash')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')

var dateFormat = 'DD.MM.YYYY'

exports.constructUserExportData = function (tmpFile, users) {
  const columnWidths = [10, 40, 30, 10, 40, 20, 10, 10, 40]
  const xlsData = [['Aktiivinen', 'Nimi', 'Käyttäjätunnus', 'Rooli', 'Email', 'Puhelinnumero', 'Sertifikaatin ensimmäinen myöntämispäivä', 'Voimassaolo päättyy', 'Työnantaja']]
  _.forEach(users, (user) => xlsData.push(userDetails(user)))
  excelWriter.write(tmpFile, xlsData, columnWidths.map((c) => ({wch: c})))
  var fileData = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)
  return fileData
}

function userDetails(user) {
  const userData = [user.active === true ? '1': '', user.name, user.username, user.role, user.emails.join(', '), user.phone]
  if (enums.util.isClassifier(user.role)) userData.push(user.certificateStartDate, user.certificateEndDate, _.map(user.employers, 'name').join(', '))
  return userData
}
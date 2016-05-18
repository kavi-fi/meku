var _ = require('lodash')
var moment = require('moment')
var excelWriter = require('./excel-writer')
var fs = require('fs')
var enums = require('../shared/enums')

var dateFormat = 'DD.MM.YYYY'

exports.constructProgramExportData = function constructProgramExportData(docs, showClassificationAuthor) {
  return createData(docs, showClassificationAuthor)
}


function createData(docs, showClassificationAuthor) {

  var tmpXlsxFile = "kavi_luokittelut.xlsx"
  var columns = ["Alkuperäinen nimi", "Suomenkielinen nimi", "Luokittelun tilaaja", "Luokittelija", "Ikäraja", "Varoitukset", "Ohjelman tyyppi", "Maa", "Valmistumisvuosi", "Ohjaaja", "Tuotantoyhtiö", "Synopsis"]
  columnWidths = [{"wch":40},{"wch":40},{"wch":40},{"wch":40},{"wch":10},{"wch":20},{"wch":20},{"wch":10},{"wch":15},{"wch":20},{"wch":20},{"wch":40}]


  var xlsData = []
  xlsData.push(columns)
  _.forEach(docs, function(doc){
    doc.format = doc.classifications[0] === undefined ? "" : doc.classifications[0].format
    doc.duration = doc.classifications[0] === undefined ? "" : doc.classifications[0].duration
    doc.classificationBuyer = doc.classifications[0] === undefined ? "" : doc.classifications[0].buyer === undefined ? "" : doc.classifications[0].buyer.name
    doc.classificationAuthor = doc.classifications[0] === undefined ? "" : doc.classifications[0].author === undefined ? "" :  showClassificationAuthor ? doc.classifications[0].author.name : ""
    doc.agelimit = doc.classifications[0] === undefined ? "" : doc.classifications[0].agelimit === undefined ? "" : doc.classifications[0].agelimit
    doc.warnings = doc.classifications[0] === undefined ? "" : doc.classifications[0].warnings === undefined ? "" : doc.classifications[0].warnings.join(', ')


    xlsData.push([doc.name.join(', '), doc.nameFi.join(', '), doc.classificationBuyer, doc.classificationAuthor, doc.agelimit, doc.warnings, enums.programType[doc.programType].fi, doc.country.join(', '), doc.year, doc.directors.join(', '), doc.productionCompanies.join(', '), doc.synopsis])
  })
  
  excelWriter.write(tmpXlsxFile, xlsData, columnWidths)
  var fileData = fs.readFileSync(tmpXlsxFile)
  fs.unlinkSync(tmpXlsxFile)
  return fileData
}
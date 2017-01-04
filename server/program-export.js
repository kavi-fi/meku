const _ = require('lodash')
const moment = require('moment')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')
const utils = require('../shared/utils')

var dateFormat = 'DD.MM.YYYY'

exports.constructProgramExportData = function constructProgramExportData(docs, showClassificationAuthor) {
  return createData(docs, showClassificationAuthor)
}

function createData(docs, showClassificationAuthor) {
  var tmpXlsxFile = "kavi_luokittelut.xlsx"
  var columns = ["Alkuperäinen nimi", "Suomenkielinen nimi", "Jakso", "Jakson nimi", "Rekisteröintipäivä", "Kesto", "Luokittelun tilaaja", "Luokittelija", "Uudelleenluokittelija", "Ikäraja", "Kriteerit", "Perustelu", "Varoitukset", "Ohjelman tyyppi", "Maa", "Valmistumisvuosi", "Ohjaaja", "Tuotantoyhtiö", "Synopsis"]
  columnWidths = [{"wch":40},{"wch":40},{"wch":10},{"wch":40},{"wch":15},{"wch":10},{"wch":40},{"wch":25},{"wch":25},{"wch":10},{"wch":40},{"wch":20},{"wch":20},{"wch":20},{"wch":10},{"wch":15},{"wch":20},{"wch":20},{"wch":40}]

  var xlsData = []
  xlsData.push(columns)
  _.forEach(docs, function(doc){
    doc.originalName = doc.programType === 3 ? doc.series.name : doc.name.join(', ')
    doc.format = doc.classifications[0] === undefined ? "" : doc.classifications[0].format
    doc.duration = doc.classifications[0] === undefined ? "" : doc.classifications[0].duration
    doc.classificationBuyer = doc.classifications[0] === undefined ? "" : doc.classifications[0].buyer === undefined ? "" : doc.classifications[0].buyer.name
    doc.classificationAuthor = doc.classifications[0] === undefined ? "" : doc.classifications[0].author === undefined ? "" :  showClassificationAuthor ? doc.classifications[0].author.name : ""
    doc.agelimit = doc.classifications[0] === undefined ? "" : doc.classifications[0].agelimit === undefined ? "" : doc.classifications[0].agelimit
    doc.warnings = doc.classifications[0] === undefined ? "" : doc.classifications[0].warnings === undefined ? "" : doc.classifications[0].warnings.join(', ')
    doc.criteriaComments = doc.classifications[0] === undefined ? "" : doc.classifications[0].isReclassification ? _.values(doc.classifications[0].criteriaComments).join(', ') : ""
    doc.criteria = doc.classifications[0] === undefined ? "" : doc.classifications[0].criteria === undefined ? "" : doc.classifications[0].criteria
    doc.episodeCode = doc.programType === 3 ? utils.seasonEpisodeCode(doc) : ""
    doc.episodeName = doc.programType === 3 ? doc.name.join(', ') : ""
    doc.reclassifier = doc.classifications[0] === undefined ? "" : doc.classifications[0].isReclassification ? doc.classifications[0].authorOrganization === undefined ? "" : enums.authorOrganization[doc.classifications[0].authorOrganization] : ""

    xlsData.push([doc.originalName, doc.nameFi.join(', '), doc.episodeCode, doc.episodeName, moment(doc.classifications[0].registrationDate).format(dateFormat), doc.duration, doc.classificationBuyer, doc.classificationAuthor, doc.reclassifier, doc.agelimit, doc.criteria, doc.criteriaComments, doc.warnings, enums.programType[doc.programType].fi, doc.country.join(', '), doc.year, doc.directors.join(', '), doc.productionCompanies.join(', '), doc.synopsis])
  })

  excelWriter.write(tmpXlsxFile, xlsData, columnWidths)
  var fileData = fs.readFileSync(tmpXlsxFile)
  fs.unlinkSync(tmpXlsxFile)
  return fileData
}
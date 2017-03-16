const _ = require('lodash')
const moment = require('moment')
const excelWriter = require('./excel-writer')
const fs = require('fs')
const enums = require('../shared/enums')
const utils = require('../shared/utils')
var i18n = require('../shared/i18n')

var dateFormat = 'DD.MM.YYYY'

exports.constructProgramExportData = function constructProgramExportData(docs, showClassificationAuthor, tmpFile, lang) {
  function translate(txt) { return i18n[lang] ? i18n[lang][txt] || txt : txt }
  var columnsOrig = ["Alkuperäinen nimi", "Suomenkielinen nimi", "Ruotsinkielinen nimi", "Jakso", "Jakson alkuperäinen nimi", "Rekisteröintipäivä", "Kesto", "Luokittelun tilaaja", "Luokittelija", "Uudelleenluokittelija", "Ikäraja", "Luokittelun kriteerit", "Perustelu", "Varoitukset", "Ohjelman tyyppi", "Maa", "Valmistumisvuosi", "Ohjaaja", "Tuotantoyhtiö", "Synopsis", "Id"]
  var columns = _.map(columnsOrig, translate)
  columnWidths = [{"wch":40},{"wch":40},{"wch":40},{"wch":10},{"wch":40},{"wch":15},{"wch":10},{"wch":40},{"wch":25},{"wch":25},{"wch":10},{"wch":40},{"wch":20},{"wch":20},{"wch":20},{"wch":10},{"wch":15},{"wch":20},{"wch":20},{"wch":40},{"wch":10}]

  var xlsData = []
  xlsData.push(columns)
  _.forEach(docs, function (doc) {
    var name = listToString(doc.name)
    var classification = enums.util.isTvSeriesName(doc) && doc.episodes ? doc.episodes : doc.classifications && doc.classifications[0] ? doc.classifications[0] : {}
    doc.originalName = enums.util.isTvEpisode(doc) ? (doc.series || {}).name : name
    doc.format = classification.format
    doc.duration = enums.util.isGameType(doc) ? "" :classification.duration
    doc.classificationBuyer = classification.buyer ? classification.buyer.name : ""
    doc.classificationAuthor = classification.author && showClassificationAuthor ? classification.author.name : ""
    doc.agelimit = classification.agelimit
    doc.warnings = classification.warnings ? classification.warnings.map(translate).join(', ') : ""
    doc.criteriaComments = classification.isReclassification ? listToString(_.values(classification.criteriaComments)) : ""
    doc.criteria = classification.criteria
    doc.episodeCode = enums.util.isTvEpisode(doc) ? utils.seasonEpisodeCode(doc) : ""
    doc.episodeName = enums.util.isTvEpisode(doc) ? name : ""
    doc.reclassifier = classification.isReclassification && classification.authorOrganization ? enums.authorOrganization[classification.authorOrganization] : ""
    doc.registrationDate = classification.registrationDate ? moment(classification.registrationDate).format(dateFormat) : ""
    doc.programTypeName = translate((enums.programType[doc.programType] || {}).fi)

    xlsData.push([doc.originalName, listToString(doc.nameFi), listToString(doc.nameSv), doc.episodeCode, doc.episodeName, doc.registrationDate, doc.duration, doc.classificationBuyer, doc.classificationAuthor, doc.reclassifier, doc.agelimit, doc.criteria, doc.criteriaComments, doc.warnings, doc.programTypeName, listToString(doc.country), doc.year, listToString(doc.directors), listToString(doc.productionCompanies), doc.synopsis, doc.sequenceId])

    function listToString(list) {
      return (list || []).join(', ')
    }
  })

  excelWriter.write(tmpFile, xlsData, columnWidths)
  var fileData = fs.readFileSync(tmpFile)
  fs.unlinkSync(tmpFile)
  return fileData
}
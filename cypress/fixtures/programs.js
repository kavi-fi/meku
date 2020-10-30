const moment = require('moment')

module.exports = [{
  programType: 0,
  name: ['The Cirkus'],
  nameFi: ['Sirkus'],
  nameSv: [],
  nameOther: [],
  country: ['CS'],
  classifications: [{
    legacyAgeLimit: 0,
    registrationDate: moment('1955-01-26T00:00:00Z'),
    status: 'reclassification2',
    agelimit: 0,
    isReclassification: false
  }]
}, {
  name: ['Deleted program'],
  nameFi: ['Deleted program - fi'],
  nameSv: ['Deleted program - sv'],
  nameOther: ['cypress-test deleted'],
  country: ['FI', 'SE'],
  productionCompanies: ['First Films Oy', 'Second Films Oy'],
  directors: ['David Silverman'],
  actors: ['John First', 'Jack Second'],
  programType: 1,
  year: '2014',
  synopsis: 'synopsis',
  deleted: true,
  classifications: [],
  customer: 'DEMO tilaaja 3',
  customersId: {id: 'cypress-test-2'}
}, {
  name: ['Zero classifications'],
  nameFi: ['Zero classifications - fi'],
  nameSv: ['Zero classifications - sv'],
  nameOther: ['cypress-test zero'],
  country: ['FI', 'SE'],
  productionCompanies: ['First Films Oy', 'Second Films Oy'],
  directors: ['David Silverman'],
  actors: ['John First', 'Jack Second'],
  programType: 1,
  year: '2014',
  synopsis: 'synopsis',
  classifications: [],
  customer: 'DEMO tilaaja 3',
  customersId: {id: 'cypress-test-3'}
}]

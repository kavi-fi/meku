const moment = require('moment')

describe('Classification as user', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('user', 'user')
    cy.wait(100)
  })

  it('always registers a classification with registration date as now (cannot be in the past)', () => {
    cy.get('.user-info').should('be.visible')
    cy.get('.name').should('have.text', 'user')
    cy.getDataCy('search-page controls create').click()
    cy.getDataCy('classification-page program-info name').type('A classification in the past')
    cy.getDataCy('classification-page program-info name-fi').type('mennyt luokittelu')
    cy.getDataCy('classification-page program-info name-sv').type('pastade classificaatioa')
    cy.getDataCy('classification-page program-info name-other').type('cypress-test')
    cy.getDataCy('classification-registrationDate').invoke('removeAttr', 'disabled')
    cy.getDataCy('classification-registrationDate:first').clear()
    cy.getDataCy('classification-registrationDate:first').type("30.11.2020")
    cy.getDataCy('classification-registrationDate:first').type("{enter}{esc}")
    cy.select2('#classification-page .select2-container.country', 'su')
    cy.getDataCy('classification-page program-info year').type('2014')
    cy.select2('#classification-page .select2-container.x-productionCompanies', 'Warner Sisters Oy.')
    cy.select2('#classification-page .select2-container.x-genre', 'ko')
    cy.select2('#classification-page .select2-container.x-directors', 'Ivan Reitman')
    cy.select2('#classification-page .select2-container.x-actors', ['Bill Murray', 'Harold Ramis', 'Dan Aykroyd', 'Sigourney Weaver'])
    cy.getDataCy('classification-page program-info synopsis').type('The plot is unknown at this time.')
    cy.getDataCy('classification-page classification-details classification').should('have.text', 'Luokittelu')
    cy.select2one('#classification-page .select2-container.x-buyer', 'demo')
    cy.get('#classification-page .select2-container.x-buyer').should('contain', 'DEMO tilaaja')
    cy.select2one('#classification-page .select2-container.x-buyer', 'demo')
    cy.get('#classification-page .select2-container.x-billing').should('contain', 'DEMO tilaaja')
    cy.select2one('#classification-page .select2-container.format', 'DVD')
    cy.getDataCy('classification-page classification-details duration').type('01:23:45')
    cy.getDataCy('classification-page classification-details user-comments').type('POW! by Cypress.io')
    cy.getDataCy('classification-page criteria12').click()
    cy.getDataCy('classification-page criteria12 criteria-text').type('Komediaväkivaltaa...')
    cy.getDataCy('classification-page criteria19').click()
    cy.getDataCy('classification-page register').click()
    cy.getDataCy('registration-confirmation-dialog').should('be.visible')
    cy.getDataCy('registration-confirmation-dialog warning-summary').assertAgelimitAndWarnings('7 violence sex')
    cy.getDataCy('registration-confirmation-dialog button').click()
    cy.getDataCy('search-page results result:first').should('be.visible')
    cy.getDataCy('results result:first').click()
    cy.assertSearchResult('search-page results result:first', expectedClassificationRow, expectedProgramBox)
    cy.getDataCy('results result:first').click()
    cy.getDataCy('search-page program-box classifications classification0').should('have.text', expectedProgramBox.registrationDate)
  })
})

const today = moment().format('D.M.YYYY')

const expectedClassificationRow = {
  name: 'A classification in the past',
  duration: '1 t 23 min 45 s',
  ageAndWarnings: '7 violence sex',
  countryYearDate: '(' + today + ', Suomi, 2014)',
  type: 'Elokuva'
}

const expectedProgramBox = {
  name: 'A classification in the past',
  nameFi: 'mennyt luokittelu',
  nameSv: 'pastade classificaatioa',
  nameOther: 'cypress-test',
  country: 'Suomi',
  year: '2014',
  productionCompanies: 'Warner Sisters Oy.',
  genre: 'Komedia ja farssi',
  directors: 'Ivan Reitman',
  actors: 'Bill Murray, Harold Ramis, Dan Aykroyd, Sigourney Weaver',
  format: 'DVD',
  duration: '01:23:45',
  synopsis: 'The plot is unknown at this time.',
  author: 'user',
  buyer: 'DEMO tilaaja 2',
  billing: 'DEMO tilaaja 2',
  ageAndWarnings: '7 violence sex',
  criteria: ['Väkivalta (12)', 'Seksi (19)'],
  registrationDate: today
}

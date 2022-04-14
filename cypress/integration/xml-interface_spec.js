const moment = require('moment')

describe('XML interface', function () {
  beforeEach(() => {
    cy.visit('/')
    cy.login('kavi', 'kavi')
  })

  it('registers a classification', () => {
    cy.task('sendXML', './cypress/integration/movie-program.xml')
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls query').type('Star Warx')
    cy.assertSearchResult('search-page results result:first', expectedRow, expectedProgram)
  })

  it('registers a classification for deleted program', () => {
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls query').type('Deleted program')
    cy.getDataCy('search-page no-results').should('be.visible')
    cy.task('sendXML', './cypress/integration/undelete-program.xml')
    cy.getDataCy('search-page controls query').clear().type('Deleted prog')
    cy.getDataCy('search-page results result').should('have.length', 1)
  })

  it('registers a classification for program without any classifications', () => {
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls query').type('Zero classifications')
    cy.getDataCy('search-page no-results').should('be.visible')
    cy.task('sendXML', './cypress/integration/add-classification.xml')
    cy.getDataCy('search-page controls query').clear().type('Zero class')
    cy.getDataCy('search-page results result').should('have.length', 1)
  })
})

const date = moment().format('D.M.YYYY')

const expectedRow = {
  name: 'Star Warx XVI',
  duration: '1 t 12 min 34 s',
  ageAndWarnings: '18 violence',
  countryYearDate: '(' + date + ', Suomi, Ruotsi, 2014)',
  type: 'Elokuva'
}

const expectedProgram = {
  name: 'Star Warx XVI',
  nameFi: 'Star Warx XVI - fi',
  nameSv: 'Star Warx XVI - sv',
  nameOther: 'cypress-test',
  country: 'Suomi, Ruotsi',
  year: '2014',
  productionCompanies: 'First Films Oy, Second Films Oy',
  genre: 'Romantiikka, Draama',
  directors: 'David Silverman',
  actors: 'John First, Jack Second',
  format: 'DVD',
  duration: '1:12:34',
  synopsis: 'synopsis',
  author: 'kavi (KAVI)',
  buyer: 'DEMO tilaaja 3',
  billing: 'DEMO tilaaja 3',
  ageAndWarnings: '18 violence',
  criteria: ['Seksi (19)', 'Väkivalta (3)', 'Väkivalta (1)']
}

const moment = require('moment')

describe('Classification', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('kavi', 'kavi')
  })

  it('registers a classification as KAVI with registration date as today', () => {
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls create').click()
    cy.getDataCy('classification-page program-info title').should('have.text', 'Uusi kuvaohjelma - Elokuva')
    cy.getDataCy('classification-page program-info name').type('Ghostbusters XVI')
    cy.getDataCy('classification-page program-info name-fi').type('Haamujengi 16')
    cy.getDataCy('classification-page program-info name-sv').type('Spökgänget 16')
    cy.getDataCy('classification-page program-info name-other').type('cypress-test')
    cy.select2('#classification-page .select2-container.country', 'su')
    cy.getDataCy('classification-page program-info year').type('2014')
    cy.getDataCy('classification-registrationDate').invoke('removeAttr', 'disabled')
    cy.getDataCy('classification-registrationDate:first').clear()
    cy.getDataCy('classification-registrationDate:first').type("30.11.2020")
    cy.getDataCy('classification-registrationDate:first').type("{enter}{esc}")
    cy.select2('#classification-page .select2-container.x-productionCompanies', 'Warner Sisters Oy.')
    cy.select2('#classification-page .select2-container.x-genre', 'ko')
    cy.select2('#classification-page .select2-container.x-directors', 'Ivan Reitman')
    cy.select2('#classification-page .select2-container.x-actors', ['Bill Murray', 'Harold Ramis', 'Dan Aykroyd', 'Sigourney Weaver'])
    cy.getDataCy('classification-page program-info synopsis').type('The plot is unknown at this time.')
    cy.getDataCy('classification-page classification-details classification').should('have.text', 'Luokittelu')
    cy.select2one('#classification-page .select2-container.x-buyer', 'demo')
    cy.get('#classification-page .select2-container.x-billing').should('contain', 'DEMO tilaaja 1')
    cy.select2one('#classification-page .select2-container.format', 'DVD')
    cy.getDataCy('classification-page classification-details duration').type('01:23:45')
    cy.getDataCy('classification-page classification-details comments').type('POW! by Cypress.io')
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
    cy.assertLatestEmail(expectedClassificationEmail)
  })

  it('registers a reclassification as KAVI', () => {
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls query').type('Ghostbusters XVI')
    cy.getDataCy('search-page results program-box reclassify').click()
    cy.getDataCy('classification-page program-info title').should('have.text', 'Kuvaohjelman tiedot - Elokuva')
    cy.getDataCy('classification-page program-info name').should('have.value', 'Ghostbusters XVI')
    cy.getDataCy('classification-page program-info name-fi').should('have.value', 'Haamujengi 16')
    cy.getDataCy('classification-page program-info name-sv').should('have.value', 'Spökgänget 16')
    cy.getDataCy('classification-page program-info name-other').should('have.value', 'cypress-test')
    cy.getDataCy('classification-page program-info country').should('have.value', 'FI')
    cy.getDataCy('classification-page program-info year').should('have.value', '2014')
    cy.getDataCy('classification-page program-info production-companies').should('have.value', 'Warner Sisters Oy.')
    cy.getDataCy('classification-page program-info genre').should('have.value', 'Komedia ja farssi')
    cy.getDataCy('classification-page program-info directors').should('have.value', 'Ivan Reitman')
    cy.getDataCy('classification-page program-info actors').should('have.value', 'Bill Murray,Harold Ramis,Dan Aykroyd,Sigourney Weaver')
    cy.getDataCy('classification-page program-info synopsis').should('have.value', 'The plot is unknown at this time.')
    cy.getDataCy('classification-page classification-details classification').should('have.text', 'Uudelleenluokittelu')
    cy.select2one('#classification-page .select2-container.x-classificationReason', 'pal')
    cy.select2one('#classification-page .select2-container.x-classificationAuthorOrganization', 'kuva')
    cy.select2one('#classification-page .select2-container.format', 'DVD')
    cy.getDataCy('classification-page classification-details duration').type('02:22:22')
    cy.getDataCy('classification-page classification-details public-comments').type('PUBLIC COMMENTS')
    cy.getDataCy('classification-page classification-details comments').type('POW2! by Cypress.io')
    cy.getDataCy('classification-page classification-criteria safe').click()
    cy.getDataCy('classification-page classification-criteria').find('.criteria').should('be.not.visible')
    cy.getDataCy('classification-page classification-email registration-emails').should('have.value', 'kavi@fake-meku.fi,demo.1@email.org,leo.pekkala@kuvi.fi,ville.sohn@kuvi.fi,milja.lampinen@kuvi.fi')
    cy.getDataCy('classification-page classification-email register').click()
    cy.getDataCy('registration-confirmation-dialog').should('be.visible')
    cy.getDataCy('registration-confirmation-dialog warning-summary').assertAgelimitAndWarnings('0')
    cy.getDataCy('registration-confirmation-dialog button').click()
    cy.assertSearchResultRow('search-page results result:first', expectedReclassificationRow)
    cy.getDataCy('search-page results result:first').assertAgelimitAndWarnings('0')
    cy.getDataCy('search-page results program-box reason').should('have.text', 'Yleisöpalaute')
    cy.getDataCy('search-page results program-box public-comments').should('have.text', 'PUBLIC COMMENTS')
    cy.getDataCy('search-page results program-box comments').should('have.text', 'POW2! by Cypress.io')
    cy.getDataCy('search-page results program-box current-duration').should('have.text', '02:22:22')
    cy.getDataCy('search-page results program-box classification1').click()
    cy.getDataCy('search-page results program-box-normal-classification-details warning-summary').assertAgelimitAndWarnings('7 violence sex')
    cy.getDataCy('search-page results program-box-normal-classification-details duration').should('have.text', '01:23:45')
    cy.getDataCy('search-page results program-box-normal-classification-details format').should('have.text', 'DVD')
    cy.getDataCy('search-page results program-box-normal-classification-details author').should('have.text', 'kavi (KAVI)')
    cy.assertLatestEmail(expectedReclassificationEmail)
  })
})

const date = moment().format('D.M.YYYY')

const expectedClassificationRow = {
  name: 'Ghostbusters XVI',
  duration: '1 t 23 min 45 s',
  ageAndWarnings: '7 violence sex',
  countryYearDate: '(' + date + ', Suomi, 2014)',
  type: 'Elokuva'
}

const expectedReclassificationRow = {
  name: 'Ghostbusters XVI',
  duration: '2 t 22 min 22 s',
  ageAndWarnings: '0',
  countryYearDate: '(' + date + ', Suomi, 2014)',
  type: 'Elokuva'
}

const expectedProgramBox = {
  name: 'Ghostbusters XVI',
  nameFi: 'Haamujengi 16',
  nameSv: 'Spökgänget 16',
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
  author: 'kavi (KAVI)',
  buyer: 'DEMO tilaaja 1',
  billing: 'DEMO tilaaja 1',
  ageAndWarnings: '7 violence sex',
  criteria: ['Väkivalta (12)', 'Seksi (19)']
}

const expectedClassificationEmail = {
  to: ['kavi@fake-meku.fi', 'demo.1@email.org', 'leo.pekkala@kuvi.fi', 'ville.sohn@kuvi.fi', 'milja.lampinen@kuvi.fi'],
  subject: 'Luokittelupäätös: Ghostbusters XVI, 2014, 7 väkivalta (12), seksi (19)',
  body: [
    date,
    'DEMO tilaaja 1',
    'Päätös kuvaohjelman luokittelusta',
    'Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö on ' + date + '  luokitellut kuvaohjelman ',
    'Ghostbusters XVI',
    '. Kuvaohjelman ikäraja on 7 ja haitallisuuskriteerit väkivalta (12), seksi (19). ',
    'Diaarinumero: -',
    'Asianosaiset: kavi, DEMO tilaaja 1',
    'Lisätietoja: kavi, ',
    'kirjaamo@kuvi.fi',
    'Liitteet:',
    'Valitusosoitus',
    'Beslut om klassificering av bildprogram',
    'Nationella audiovisuella institutets (KAVI) enhet för mediefostran och bildprogram har ' + date + ' klassificerat bildprogrammet ',
    'Ghostbusters XVI',
    '. Bildprogrammet har åldersgränsen 7 och det skadliga innehållet våld (12), sexuellt innehåll (19). ',
    'Diarienummer: -',
    'Parter: kavi, DEMO tilaaja 1',
    'Mera information: kavi, ',
    'kirjaamo@kuvi.fi',
    'Bilaga:',
    'Besvärsanvisning',
    'Kansallinen audiovisuaalinen instituutti (KAVI) / Nationella audiovisuella institutet (KAVI)',
    'Mediakasvatus- ja kuvaohjelmayksikkö / Enheten för mediefostran och bildprogram'
  ].join('\n')
}

const expectedReclassificationEmail = {
  to: ['kavi@fake-meku.fi', 'demo.1@email.org', 'leo.pekkala@kuvi.fi', 'ville.sohn@kuvi.fi', 'milja.lampinen@kuvi.fi'],
  subject: 'Luokittelupäätös: Ghostbusters XVI, 2014, S ',
  body: [
    date,
    'Päätös kuvaohjelman uudelleenluokittelusta',
    'Kuvaohjelmalautakunta on ' + date + ' uudelleenluokitellut kuvaohjelman ',
    'Ghostbusters XVI',
    '. Kuvaohjelma on sallittu.',
    ' Kuvaohjelmaluokittelija oli ' + date + ' arvioinut kuvaohjelman ikärajaksi 7 ja haitallisuuskriteereiksi väkivalta (12), seksi (19). ',
    'Syy uudelleenluokittelulle: Yleisöpalaute.',
    'Perustelut: PUBLIC COMMENTS',
    'Diaarinumero: -',
    'Asianosaiset: kavi',
    'Liitteet:',
    'Valitusosoitus',
    'Beslut om omklassificering av bildprogram',
    'Bildprogramsnämnden har ' + date + ' omklassificerat bildprogrammet ',
    'Ghostbusters XVI',
    '. Bildprogrammet är tillåtet.',
    ' Bildprogramsklassificeraren hade ' + date + ' som åldergräns för bildprogrammet bedömt 7 och som skadligt innehåll våld (12), sexuellt innehåll (19). ',
    'Orsak till omklassificering: Respons.',
    'Beslutets motivering: PUBLIC COMMENTS',
    'Diarienummer: -',
    'Parter: kavi',
    'Bilaga:',
    'Besvärsanvisning',
    'Kansallinen audiovisuaalinen instituutti (KAVI) / Nationella audiovisuella institutet (KAVI)',
    'Mediakasvatus- ja kuvaohjelmayksikkö / Enheten för mediefostran och bildprogram'
  ].join('\n')
}

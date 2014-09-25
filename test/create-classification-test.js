var moment = require('moment')
var webdriver = require('./client-ext')
var db = require('./mongo-ext')
var app = require('../server/app')

describe('create-classification-test', function() {
  this.timeout(30000)

  var date = moment().format('D.M.YYYY')

  before(function(done) {
    app.start(function(err) {
      if (err) return done(err)
      db.reset(done)
    })
  })

  after(function(done) { app.shutdown(done) })

  it('registers a classification as KAVI', function(done) {
    webdriver.client()
      .login('kavi','kavi','kavi')
      .ajaxClick('#search-page .new-classification button')
      .assertText('#classification-page .program-info h2', 'Uusi kuvaohjelma - Elokuva')

      .setValue('#classification-page input[name=name]', 'Ghostbusters XVI')
      .setValue('#classification-page input[name=nameFi]', 'Haamujengi 16')
      .setValue('#classification-page input[name=nameSv]', 'Spökgänget 16')
      .setValue('#classification-page input[name=nameOther]', 'webdriver-test')
      .select2('#classification-page .select2-container.country', 'su', 'Suomi')
      .setValue('#classification-page input[name=year]', '2014')
      .select2('#classification-page .select2-container.x-productionCompanies', 'Warner Sisters Oy.', true)
      .select2('#classification-page .select2-container.x-genre', 'ko', 'Komedia ja farssi')
      .select2('#classification-page .select2-container.x-directors', 'Ivan Reitman', true)
      .select2('#classification-page .select2-container.x-actors', ['Bill Murray', 'Harold Ramis', 'Dan Aykroyd', 'Sigourney Weaver'], true)
      .setValue('#classification-page textarea[name=synopsis]', 'The plot is unknown at this time.')

      .select2one('#classification-page .select2-container.x-buyer', 'demo', 'DEMO tilaaja 1')
      .assertText('#classification-page .select2-container.x-billing', 'DEMO tilaaja 1')
      .waitForText('#classification-page .select2-container.x-registrationEmails', 'demo.1@email.org')

      .select2one('#classification-page .select2-container.format', 'DVD', true)
      .setValue('#classification-page input.duration', '01:23:45')
      .setValue('#classification-page textarea[name="classification.comments"]', 'POW! by Webdriverio+Selenium/WebDriver')

      .click('#classification-page .criteria[data-id="12"]')
      .setValue('#classification-page .criteria[data-id="12"] textarea', 'Komediaväkivaltaa...')
      .click('#classification-page .criteria[data-id="19"]')

      .waitForEnabled('#classification-page button[name=register]', 1000)
      .ajaxClick('#classification-page button[name=register]')

      .assertVisible('#dialog .registration-confirmation')
      .assertAgelimitAndWarnings('#dialog .registration-confirmation .warning-summary', '7 violence sex')
      .click('#dialog button')

      .waitForVisible('#search-page .results .result')
      .assertSearchResult('.result', expectedRow, expectedProgram)

      .end(done)
  })

  var expectedRow = {
    name: 'Ghostbusters XVI',
    duration: '1 t 23 min 45 s',
    ageAndWarnings: '7 violence sex',
    countryYearDate: '('+date+', Suomi, 2014)',
    type: 'Elokuva'
  }
  var expectedProgram = {
    name: 'Ghostbusters XVI',
    nameFi: 'Haamujengi 16',
    nameSv: 'Spökgänget 16',
    nameOther: 'webdriver-test',
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
    criteria: ['Väkivalta (12)','Komediaväkivaltaa...','Seksi (19)']
  }
})

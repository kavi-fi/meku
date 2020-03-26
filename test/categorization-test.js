const moment = require('moment')
const webdriver = require('./client-ext')
const db = require('./mongo-ext')
const app = require('../server/app')
const schema = require('../server/schema.js')

describe('categorization-test', function () {
  this.timeout(30000)

  before((done) => {
    app.start((err) => {
      if (err) return done(err)
      db.reset((resetErr) => {
        if (resetErr) return done(resetErr)
        new schema.Program(legacyProgram).save(done)
      })
    })
  })

  after((done) => { app.shutdown(done) })

  it('can categorize as USER', (done) => {
    webdriver.client()
      .login('user', 'user', 'user')
      .waitForVisible('#search-page .results .result')
      .assertSearchResultRow('.result', initialRow)
      .click('#search-page .program-box button.categorize').waitForAnimations()
      .select2one('#search-page .categorization-form .select2-container.x-category-select', 'trai', 'Traileri')
      .click('#search-page .categorization-form button.save-category')
      .waitForText('#search-page .results .result .program-type', 'Traileri')
      .assertSearchResultRow('.result', resultRow)
      .end(done)
  })

  const legacyProgram = {
    programType: 0,
    name: ['The Cirkus'],
    nameFi: ['Sirkus'],
    nameSv: [ ],
    nameOther: [ ],
    country: ['CS'],
    classifications: [{
      legacyAgeLimit: 0,
      registrationDate: moment('1955-01-26T00:00:00Z'),
      status: 'reclassification2',
      agelimit: 0,
      isReclassification: false
    }]
  }

  const initialRow = {
    name: 'The Cirkus',
    duration: '',
    ageAndWarnings: '0',
    countryYearDate: '(26.1.1955, Serbia ja Montenegro / Tsekkoslovakia)',
    type: ''
  }

  const resultRow = {
    name: 'The Cirkus',
    type: 'Traileri',
    duration: '',
    ageAndWarnings: '0',
    countryYearDate: '(26.1.1955, Serbia ja Montenegro / Tsekkoslovakia)'
  }
})

var moment = require('moment')
var webdriver = require('./client-ext')
var db = require('./mongo-ext')
var app = require('../server/app')
var schema = require('../server/schema.js')

describe('categorization-test', function() {
  this.timeout(30000)

  before(function(done) {
    app.start(function(err) {
      if (err) return done(err)
      db.reset(function(err) {
        if (err) return done(err)
        new schema.Program(legacyProgram).save(done)
      })
    })
  })

  after(function(done) { app.shutdown(done) })

  it('can categorize as USER', function(done) {
    webdriver.client()
      .login('user','user','user')
      .waitForVisible('#search-page .results .result')
      .assertSearchResultRow('.result', initialRow)
      .click('#search-page .results .result').waitForAnimations()
      .click('#search-page .program-box button.categorize').waitForAnimations()
      .select2one('#search-page .categorization-form .select2-container.x-category-select', 'trai', 'Traileri')
      .click('#search-page .categorization-form button.save-category')
      .waitForText('#search-page .results .result .program-type', 'Traileri')
      .assertSearchResultRow('.result', resultRow)
      .end(done)
  })

  var legacyProgram = {
    programType : 0,
    name : ['The Cirkus'],
    nameFi : ['Sirkus'],
    nameSv : [ ],
    nameOther : [ ],
    country : ['CS'],
    classifications : [{
      legacyAgeLimit : 0,
      registrationDate : moment('1955-01-26T00:00:00Z'),
      status : 'reclassification2',
      agelimit : 0,
      isReclassification : false
    }]
  }

  var initialRow = {
    name: 'The Cirkus',
    duration: '',
    ageAndWarnings: '0',
    countryYearDate: '(26.1.1955, Serbia ja Montenegro / Tsekkoslovakia)',
    type: ''
  }

  var resultRow = {
    name: 'The Cirkus',
    type: 'Traileri',
    duration: '',
    ageAndWarnings: '0',
    countryYearDate: '(26.1.1955, Serbia ja Montenegro / Tsekkoslovakia)',
  }
})

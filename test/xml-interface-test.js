var fs = require('fs')
var moment = require('moment')
var request = require('request')
var assert = require('chai').assert
var webdriver = require('./client-ext')
var db = require('./mongo-ext')
var app = require('../server/app')

describe('xml-interface-test', function() {
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
    sendXML('movie-program.xml', function(err, resp) {
      assert.include(resp, '<STATUS>OK</STATUS>')
      if (err) return done(err)
      webdriver.client()
        .login('kavi','kavi','kavi')
        .waitForVisible('#search-page .results .result')
        .assertSearchResultRow('#search-page .results .result', expectedRow)
        .waitForAnimations()
        .assertVisible('#search-page .program-box')
        .assertProgramBox('#search-page .program-box', expectedProgram)
        .end(done)
    })
  })

  it('registers a classification for deleted program as KAVI', function(done) {
    db.deleteProgram('Star Warx XVI', function (err) {
      if (err) return done(err)
      sendXML('movie-program.xml', function(err, resp) {
        assert.include(resp, '<STATUS>OK</STATUS>')
        if (err) return done(err)
        webdriver.client()
          .login('kavi','kavi','kavi')
          .waitForVisible('#search-page .results .result')
          .assertSearchResultRow('#search-page .results .result', expectedRow)
          .waitForAnimations()
          .assertVisible('#search-page .program-box')
          .assertProgramBox('#search-page .program-box', expectedProgram)
          .end(done)
      })
    })
  })

  it('registers a classification for program without any classifications as KAVI', function(done) {
    db.removeClassifications('Star Warx XVI', function (err) {
      if (err) return done(err)
      sendXML('movie-program.xml', function(err, resp) {
        assert.include(resp, '<STATUS>OK</STATUS>')
        if (err) return done(err)
        webdriver.client()
          .login('kavi','kavi','kavi')
          .waitForVisible('#search-page .results .result')
          .assertSearchResultRow('#search-page .results .result', expectedRow)
          .waitForAnimations()
          .assertVisible('#search-page .program-box')
          .assertProgramBox('#search-page .program-box', expectedProgram)
          .end(done)
      })
    })
  })

  function sendXML(filename, callback) {
    fs.createReadStream(__dirname + '/' + filename)
      .pipe(request.post('http://localhost:4000/xml/v1/programs/apiToken', function(err, msg, body) {
        callback(err, body)
      }))
  }

  var expectedRow = {
    name: 'Star Warx XVI',
    duration: '1 t 12 min 34 s',
    ageAndWarnings: '18 violence',
    countryYearDate: '('+date+', Suomi, Ruotsi, 2014)',
    type: 'Elokuva'
  }

  var expectedProgram = {
    name: 'Star Warx XVI',
    nameFi: 'Star Warx XVI - fi',
    nameSv: 'Star Warx XVI - sv',
    nameOther: 'webdriver-test',
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
    criteria: ['Väkivalta (1)','hieman väkivaltaista','Väkivalta (3)','Seksi (19)', 'lievää seksiä']
  }
})

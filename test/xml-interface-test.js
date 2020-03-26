const fs = require('fs')
const path = require('path')
const moment = require('moment')
const request = require('request')
const assert = require('chai').assert
const webdriver = require('./client-ext')
const db = require('./mongo-ext')
const app = require('../server/app')

describe('xml-interface-test', function () {
  this.timeout(30000)

  const date = moment().format('D.M.YYYY')

  before((done) => {
    app.start((err) => {
      if (err) return done(err)
      db.reset(done)
    })
  })

  after((done) => { app.shutdown(done) })

  it('registers a classification as KAVI', (done) => {
    sendXML('movie-program.xml', (err, resp) => {
      assert.include(resp, '<STATUS>OK</STATUS>')
      if (err) return done(err)
      webdriver.client()
        .login('kavi', 'kavi', 'kavi')
        .waitForVisible('#search-page .results .result')
        .assertSearchResultRow('#search-page .results .result', expectedRow)
        .waitForAnimations()
        .assertVisible('#search-page .program-box')
        .assertProgramBox('#search-page .program-box', expectedProgram)
        .end(done)
    })
  })

  it('registers a classification for deleted program as KAVI', (done) => {
    db.deleteProgram('Star Warx XVI', (err) => {
      if (err) return done(err)
      sendXML('movie-program.xml', (sendErr, resp) => {
        assert.include(resp, '<STATUS>OK</STATUS>')
        if (sendErr) return done(sendErr)
        webdriver.client()
          .login('kavi', 'kavi', 'kavi')
          .waitForVisible('#search-page .results .result')
          .assertSearchResultRow('#search-page .results .result', expectedRow)
          .waitForAnimations()
          .assertVisible('#search-page .program-box')
          .assertProgramBox('#search-page .program-box', expectedProgram)
          .end(done)
      })
    })
  })

  it('registers a classification for program without any classifications as KAVI', (done) => {
    db.removeClassifications('Star Warx XVI', (err) => {
      if (err) return done(err)
      sendXML('movie-program.xml', (sendErr, resp) => {
        assert.include(resp, '<STATUS>OK</STATUS>')
        if (sendErr) return done(sendErr)
        webdriver.client()
          .login('kavi', 'kavi', 'kavi')
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
    fs.createReadStream(path.join(__dirname, filename))
      .pipe(request.post('http://localhost:4000/xml/v1/programs/apiToken', (err, msg, body) => {
        callback(err, body)
      }))
  }

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
    criteria: ['Väkivalta (1)', 'hieman väkivaltaista', 'Väkivalta (3)', 'Seksi (19)', 'lievää seksiä']
  }
})

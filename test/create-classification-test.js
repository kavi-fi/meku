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

  describe('classification', function() {
    it('registers a classification as KAVI', function(done) {
      webdriver.client()
        .login('kavi','kavi','kavi')
        .ajaxClick('#search-page .new-classification button')
        .assertText('#classification-page .program-info h2', 'Uusi kuvaohjelma - Elokuva')
        .assertText('#classification-page .classification-details h2', 'Luokittelu')

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
        .assertSearchResult('.result', expectedRow, expectedProgramBox)
        .assertLatestEmail(expectedEmail)
        .end(done)
    })

    var expectedRow = {
      name: 'Ghostbusters XVI',
      duration: '1 t 23 min 45 s',
      ageAndWarnings: '7 violence sex',
      countryYearDate: '('+date+', Suomi, 2014)',
      type: 'Elokuva'
    }
    var expectedProgramBox = {
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
    var expectedEmail = {
      to: ['kavi@fake-meku.fi', 'demo.1@email.org'],
      subject: 'Luokittelupäätös: Ghostbusters XVI, 2014, 7 väkivalta(12), seksi(19)',
      body: [
        date,
        'DEMO tilaaja 1',
        'Ilmoitus kuvaohjelman luokittelusta',
          'Kansallisen audiovisuaalisen instituutin (KAVI) mediakasvatus- ja kuvaohjelmayksikkö on '+date+'  luokitellut kuvaohjelman ',
        'Ghostbusters XVI',
        '. Kuvaohjelman ikäraja on 7 ja haitallisuuskriteerit väkivalta(12), seksi(19).',
        'Lisätietoja: ',
        'kavi@fake-meku.fi',
        'Liitteet:',
        'Valitusosoitus',
        'Kansallinen audiovisuaalinen instituutti (KAVI)',
        'Mediakasvatus- ja kuvaohjelmayksikkö'
      ].join('\n')
    }
  })

  describe('reclassification', function() {
    it('registers a reclassification as ROOT', function(done) {
      webdriver.client()
        .login('root','root','root')
        .waitForVisible('#search-page .results .result')
        .click('#search-page .results .result').waitForAnimations()
        .ajaxClick('#search-page .program-box .reclassify')
        .assertText('#classification-page .program-info h2', 'Kuvaohjelman tiedot - Elokuva')
        .assertText('#classification-page .classification-details h2', 'Uudelleenluokittelu')
        .assertValue('#classification-page input[name=name]', 'Ghostbusters XVI')
        .assertValue('#classification-page input[name=nameFi]', 'Haamujengi 16')
        .assertValue('#classification-page input[name=nameSv]', 'Spökgänget 16')
        .assertValue('#classification-page input[name=nameOther]', 'webdriver-test')
        .assertSelect2Value('#classification-page .select2-container.country', ['Suomi'])
        .assertValue('#classification-page input[name=year]', '2014')
        .assertSelect2Value('#classification-page .select2-container.x-productionCompanies', ['Warner Sisters Oy.'])
        .assertSelect2Value('#classification-page .select2-container.x-genre', ['Komedia ja farssi'])
        .assertSelect2Value('#classification-page .select2-container.x-directors', ['Ivan Reitman'])
        .assertSelect2Value('#classification-page .select2-container.x-actors', ['Bill Murray', 'Harold Ramis', 'Dan Aykroyd', 'Sigourney Weaver'])
        .assertValue('#classification-page textarea[name=synopsis]', 'The plot is unknown at this time.')

        .assertDisabled('#classification-page input[name="classification.buyer"]')
        .assertDisabled('#classification-page input[name="classification.billing"]')
        .assertSelect2Value('#classification-page .select2-container.x-registrationEmails', ['kavi@fake-meku.fi', 'demo.1@email.org', 'root@fake-meku.fi'])

        .select2one('#classification-page .select2-container.x-classificationReason', 'pal', 'Palaute')
        .select2one('#classification-page .select2-container.x-classificationAuthorOrganization', 'kuva', 'Kuvaohjelmalautakunta')
        .select2one('#classification-page .select2-container.format', 'DVD', true)
        .setValue('#classification-page input.duration', '02:22:22')

        .setValue('#classification-page textarea[name="classification.publicComments"]', 'PUBLIC COMMENTS')
        .setValue('#classification-page textarea[name="classification.comments"]', 'POW2! by Webdriverio+Selenium/WebDriver')
        .click('#classification-page input[name="classification.safe"]').waitForAnimations()
        .assertHidden('#classification-page .classification-criteria .criteria')

        .waitForEnabled('#classification-page button[name=register]', 1000)
        .ajaxClick('#classification-page button[name=register]')

        .assertVisible('#dialog .registration-confirmation')
        .assertAgelimitAndWarnings('#dialog .registration-confirmation .warning-summary', 'S')
        .click('#dialog button')

        .waitForVisible('#search-page .results .result')
        .assertSearchResultRow('#search-page .results .result', expectedRow)
        .click('#search-page .results .result').waitForAnimations()
        .assertAgelimitAndWarnings('#search-page .program-box .warning-summary', 'S')
        .assertText('#search-page .program-box .reason', 'Palaute')
        .assertText('#search-page .program-box .current-duration', '02:22:22')
        .assertText('#search-page .program-box .author', 'root (ROOT)')
        .assertText('#search-page .program-box .publicComments', 'PUBLIC COMMENTS')
        .assertText('#search-page .program-box .comments', 'POW2! by Webdriverio+Selenium/WebDriver')
        .click('#search-page .program-box .classifications .classification:nth-child(2)')
        .assertAgelimitAndWarnings('#search-page .program-box .warning-summary', '7 violence sex')
        .assertText('#search-page .program-box .duration', '01:23:45')
        .assertText('#search-page .program-box .format', 'DVD')
        .assertText('#search-page .program-box .author', 'kavi (KAVI)')
        .assertLatestEmail(expectedEmail)

        .end(done)
    })

    var expectedRow = {
      name: 'Ghostbusters XVI',
      duration: '2 t 22 min 22 s',
      ageAndWarnings: 'S',
      countryYearDate: '('+date+', Suomi, 2014)',
      type: 'Elokuva'
    }

    var expectedEmail = {
      to: ['kavi@fake-meku.fi', 'demo.1@email.org', 'root@fake-meku.fi'],
      subject: 'Luokittelupäätös: Ghostbusters XVI, 2014, S ',
      body: [
        date,
        'Ilmoitus kuvaohjelman uudelleenluokittelusta',
        'Kuvaohjelmalautakunta on '+date+' uudelleenluokitellut kuvaohjelman ',
        'Ghostbusters XVI',
        '. Kuvaohjelma on sallittu.',
        ' Kuvaohjelmaluokittelija oli '+date+' arvioinut kuvaohjelman ikärajaksi 7 ja haitallisuuskriteereiksi väkivalta(12), seksi(19).',
        'Syy uudelleenluokittelulle: Yleisön pyyntö.',
        'Perustelut: PUBLIC COMMENTS',
        'Liitteet:',
        'Oikaisuvaatimusohje',
        'Kansallinen audiovisuaalinen instituutti (KAVI)',
        'Mediakasvatus- ja kuvaohjelmayksikkö'
      ].join('\n')
    }
  })

})

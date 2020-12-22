const moment = require('moment')

describe('Downloading classifications', function () {
  beforeEach(() => {
    cy.visit('/')
    cy.login('kavi', 'kavi')
  })

  it('returns proper csv file', () => {
    cy.get('a[href="#haku"].active').should('be.visible')

    // add another classification for billing
    cy.getDataCy('search-page controls create').click()
    cy.getDataCy('classification-page program-info name').type('Terminator XII')
    cy.getDataCy('classification-page program-info name-fi').type('Terminaattori 12')
    cy.getDataCy('classification-page program-info name-sv').type('terminator 12')
    cy.getDataCy('classification-page program-info name-other').type('cypress-test')
    cy.select2('#classification-page .select2-container.country', 'su')
    cy.getDataCy('classification-page program-info year').type('2016')
    cy.select2('#classification-page .select2-container.x-productionCompanies', 'Warner Sisters Oy.')
    cy.select2('#classification-page .select2-container.x-genre', 'ko')
    cy.select2('#classification-page .select2-container.x-directors', 'Dunno')
    cy.select2('#classification-page .select2-container.x-actors', ['Arska'])
    cy.getDataCy('classification-page program-info synopsis').type('Tulevaisuus - pilalla. Pelkkiä terminaattoreita tilalla.')
    cy.select2one('#classification-page .select2-container.x-buyer', 'demo')
    cy.get('#classification-page .select2-container.x-billing').should('contain', 'DEMO tilaaja 1')
    cy.select2one('#classification-page .select2-container.format', 'DVD')
    cy.getDataCy('classification-page classification-details duration').type('01:23:45')
    cy.getDataCy('classification-page criteria16').click()
    cy.getDataCy('classification-page register').click()
    cy.getDataCy('registration-confirmation-dialog button').click()

    // create billing
    cy.getCookie('_csrf_token').then((csrf) => {
      cy.request({
        method: 'POST',
        url: '/kieku',
        body: {
          begin: '1.1.2000',
          end: '1.1.3000',
          _csrf: csrf.value,
          csv: true
        }
      }).then((response) => {
        const today = moment().format('DD.MM.YYYY')
        const rows = response.body.split('\n')
        cy.expect(rows[0]).to.equal(`T,Tilauslaji,Myyntiorg,Jakelutie,Sektori,Myyntitsto,Viitelasku,Asiakasnro,Nimi,Nimi2,Lähiosoite,PostiNo,Toimipaikka,Maakoodi,Kielikoodi,Henkilötunnus,Y-tunnus,ALV-tunnus,OVT-tunnus,Välittäjätunnus,Laskutusasiakasnro,Laskutusasiakas nimi,Maksaja-asiakasnro,Maksaja-asiakas nimi,Toimitusasiakasnro,Toimitusasiakas nimi,Palvelun luontipvm,Hinnoittelupvm,Laskun pvm,Maksuehto,Laskuttaja,Asiaviite,Tilausnumero,Sopimuspvm,Sopimusnumero,Tiliöintiviite,Työmaa-avain,Poikk. veron määrämaa,"Otsikkoteksti: Otsikkomuistio 1 (tekstilaji 0002) tulostuu ennen rivejä. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita","Otsikkoteksti: Maksuperusteteksti (tekstilaji Z000) tulostuu laskun loppuun. Huom. Kirjoita teksti katkeamattomasti, ei rivivaihtoja eikä alt+enter painikkeita",Nimike,Määrä,Määräyksikkö,Yksikköhinta,Brutto/Netto,Rivityyppi,Tulosyksikkö,Nimikkeen nimitysteksti (laskutusaihe),"Riviteksti: Rivimuistio (tekstilaji 0002), tulostuu laskulle rivin jälkeen",PRR-osa,TaKP-tili,Suorite,Toiminto,Alue /  kunta,Seurantakohde 1,Seurantakohde 2,Laskuliitteet`)
        cy.expect(rows[1]).to.equal(`1,Z001,6008,02,01,,,,DEMO tilaaja 1,,,00000,Helsinki,,,,DEMO1,,,,,,,,,,,,,,,,,,,,,,KOONTILASKUTUS 1.1.2000 - 1.1.3000,"2 kuvaohjelmaa luokiteltu, yhteensä 336 EUR.",4691,84,min,2,N,,,,4 ${today} Ghostbusters XVI,,,,,,,,`)
        cy.expect(rows[2]).to.equal(`0,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,4691,84,min,2,N,,,,5 ${today} Terminator XII,,,,,,,,`)
        cy.expect(rows[3]).to.equal(`1,Z001,6008,02,01,,,,DEMO tilaaja 1,,,00000,Helsinki,,,,DEMO1,,,,,,,,,,,,,,,,,,,,,,KOONTILASKUTUS 1.1.2000 - 1.1.3000,"2 kuvaohjelmaa rekisteröity, yhteensä 26 EUR.",1852,1,kpl,13,N,,,,4 ${today} Ghostbusters XVI,,,,,,,,`)
        cy.expect(rows[4]).to.equal(`0,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,1852,1,kpl,13,N,,,,5 ${today} Terminator XII,,,,,,,,`)
      })
    })
  })
})

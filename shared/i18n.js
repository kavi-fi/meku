
var i18n = {
  sv: {

  // Custom html-content texts:

    'upgrade-reload': 'SV: Lataa sivu uudelleen <a href="javascript:window.location.reload(true)">tästä</a>.',
    'error-reload': 'SV: Lataa sivu uudelleen <a href="#">tästä</a>,<br/>tai palaa etusivulle tästä <a href="/">tästä</a>.',
    'conflict-reload': 'SV: Palaa etusivulle <a href="/">tästä</a>.',
    'draft-notice': 'SV: Luokittelu kesken käyttäjällä <b></b>. Luonnos tallennettu <span></span>.',

  // Program types:

    '?': '?',
    'Elokuva': 'Film',
    'TV-sarjan nimi': 'TV-serie',
    'TV-sarjan jakso': 'TV-serienamn',
    'Muu TV-ohjelma': 'Annat TV-program',
    'Extra': 'Extra',
    'Traileri': 'Trailer',
    'Peli': 'Spel',

  // Dynamic texts:

    // Generic buttons:
    'Poista': 0,
    'Sulje': 0,

    // select2:
    'Valitse...': 0,
    'Ei tuloksia': 0,
    'Haetaan...': 0,

    // Login -form
    'Väärä käyttäjätunnus tai salasana.': 0,
    'Lähetimme sähköpostilla ohjeet salasanan vaihtamista varten.':'',
    'Käyttäjätunnusta ei ole olemassa.': 0,

    // Reset password -page
    'Salasanan tulee olla vähintään kuusi merkkiä pitkä.': 0,
    'Salasanat eivät täsmää.': 0,
    'Virhe salasanan vaihtamisessa.': 0,

    // Search-page:
    'Tuntematon rekisteröintiaika': 0,
    'kpl': 'st.',
    'Ei jaksoja.': 0,
    'Tuotantokausi': 'Säsong',
    'Tuntematon tuotantokausi': 0,

    // Classification-page:
    'Kuvaohjelman tiedot': 0,
    'Uusi kuvaohjelma': 0,
    'Luokittelu': 0,
    'Uudelleenluokittelu': 0,
    'Jakson alkuperäinen nimi': 0,
    'Jakson suomalainen nimi': 0,
    'Jakson ruotsinkielinen nimi': 0,
    'Luokittelun kesto': 0,
    'Perusteet uudelleenluokittelulle': 0,
    'KAVI:n sisäiset kommentit': 0,
    'Kommentit...': 0,
    'Rekisteröity': 'Registrerad',

    // Request-reclassification -email
    'Ohjelma:': 'Programmet:',
    'Kuvaohjelman uudelleenluokittelupyyntö': 'Kuvaohjelman uudelleenluokittelupyyntö',

    // Software upgrade -dialog
    'Järjestelmä on päivitetty.': 0,

    // Manual addition:
    'Kuvaohjelmien luokittelu- ja valvontajärjestelmä ei toimi selainversiollasi. Tuettuja selaimia ovat: ': 0
  }
}

var i18nDateRangePicker = {
  fi: {
    'selected': 'Valittu:',
    'day':'Päivä',
    'days': ' päivää',
    'apply': 'Sulje',
    'week-1' : 'MA',
    'week-2' : 'TI',
    'week-3' : 'KE',
    'week-4' : 'TO',
    'week-5' : 'PE',
    'week-6' : 'LA',
    'week-7' : 'SU',
    'month-name': ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    'shortcuts' : 'Valitse',
    'past': 'Past',
    'following':'Seuraavat',
    'previous' : 'edellinen',
    'prev-week' : 'viikko',
    'prev-month' : 'kuukausi',
    'prev-year' : 'vuosi',
    'next':'seuraava',
    'next-week':'viikko',
    'next-month':'kuukausi',
    'next-year':'vuosi',
    'less-than' : 'Date range should not be more than %d days',
    'more-than' : 'Date range should not be less than %d days',
    'default-more' : 'Please select a date range longer than %d days',
    'default-single' : 'Please select a date',
    'default-less' : 'Please select a date range less than %d days',
    'default-range' : 'Please select a date range between %d and %d days',
    'default-default': 'Ole hyvä ja valitse alku- ja loppupäivä'
  },
  sv: {
    'selected': 'Valittu:',
    'day':'Päivä',
    'days': ' päivää',
    'apply': 'Sulje',
    'week-1' : 'MA',
    'week-2' : 'TI',
    'week-3' : 'KE',
    'week-4' : 'TO',
    'week-5' : 'PE',
    'week-6' : 'LA',
    'week-7' : 'SU',
    'month-name': ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    'shortcuts' : 'Valitse',
    'past': 'Past',
    'following':'Seuraavat',
    'previous' : 'edellinen',
    'prev-week' : 'viikko',
    'prev-month' : 'kuukausi',
    'prev-year' : 'vuosi',
    'next':'seuraava',
    'next-week':'viikko',
    'next-month':'kuukausi',
    'next-year':'vuosi',
    'less-than' : 'Date range should not be more than %d days',
    'more-than' : 'Date range should not be less than %d days',
    'default-more' : 'Please select a date range longer than %d days',
    'default-single' : 'Please select a date',
    'default-less' : 'Please select a date range less than %d days',
    'default-range' : 'Please select a date range between %d and %d days',
    'default-default': 'Ole hyvä ja valitse alku- ja loppupäivä'
  }
}

var i18nPikaday = {
  fi: {
    previousMonth: 'Edellinen kuukausi',
    nextMonth: 'Seuraava kuukausi',
    months: ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    weekdays: ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'],
    weekdaysShort: ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La']
  },
  sv: {
    previousMonth: 'Edellinen kuukausi',
    nextMonth: 'Seuraava kuukausi',
    months: ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    weekdays: ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'],
    weekdaysShort: ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La']
  }
}
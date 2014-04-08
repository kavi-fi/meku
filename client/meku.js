$(setup)

function setup() {
  $.ajaxSetup({dataType: "json", processData: false, contentType: "application/json"})

  var details = movieDetails()

  if (location.hash.indexOf('#/movies/') == 0) {
    var _id = location.hash.substring(9)
    $.get('/movies/' + _id).done(details.show)
  }
}

function movieDetails() {
  var $form = $('#movie-details')
  var $submit = $form.find('button[name=register]')

  $('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      location.hash = '#/movies/'+movie._id
      show(movie)
    })
  })

  $form.find('input.country').typeahead({}, { source: countryMatcher() })

  $form.find('select').on('change', function() {
    saveMovieField($form.data('id'), $(this).attr('name'), $(this).val())
  })

  $form.on('validation', function() {
    if ($form.find(".required.invalid").length === 0) {
      $submit.removeAttr('disabled')
    } else {
      $submit.attr('disabled', 'disabled')
    }
  })

  $form.find('.required').on('keyup change', function(e) {
    var $el = $(this)
    if ($el.val().length > 0) {
      $el.removeClass('invalid')
    } else {
      $el.addClass('invalid')
    }
    $el.trigger('validation')
  })

  $form.find('input, textarea').not('.multivalue').throttledInput(function(txt) {
    var value = $(this).data('type') == 'number' ? parseInt(txt) : txt
    saveMovieField($form.data('id'), $(this).attr('name'), value)
  })

  $form.find('input.multivalue').throttledInput(function(txt) {
    var values = txt.split(',').map($.trim)
    saveMovieField($form.data('id'), $(this).attr('name'), values)
  })

  $form.find('.categories li').click(function() {
    $(this).addClass('selected').siblings().removeClass('selected')
    $form.find('.category-criteria ol').hide().eq($(this).index()).show()
  })

  function show(movie) {
    $('.new-movie').attr('disabled', 'true')
    $form.data('id', movie._id).show()
      .find('input[name=name]').val(movie.name).end()
      .find('input[name=name-fi]').val(movie['name-fi']).end()
      .find('input[name=name-sv]').val(movie['name-sv']).end()
      .find('input[name=country]').val(movie.country).end()
      .find('input[name=production-companies]').val(movie['production-companies'].join(', ')).end()
      .find('input[name=year]').val(movie.year).end()
      .find('select[name=genre]').val(movie.genre).end()
      .find('input[name=directors]').val(movie.directors.join(', ')).end()
      .find('input[name=actors]').val(movie.actors.join(', ')).end()
      .find('textarea[name=synopsis]').val(movie.synopsis).end()

    $form.find('.required').trigger('change')
  }

  return { show: show }
}

function saveMovieField(id, field, value) {
  $.post('/movies/' + id, JSON.stringify(keyValue(field, value)))
}

function keyValue(key, value) {
  var data = {}
  data[key] = value
  return data
}

$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = ''
    var timeout = null
    var $input = $(this).on('keyup', function() {
      var txt = $input.val()
      var that = this
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(function() {
        if (prev == txt) return
        prev = txt
        fn.call(that, txt)
      }, 400)
    })
  })
}

function countryMatcher() {
  var countries = ['Afganistan', 'Alankomaat', 'Albania', 'Algeria', 'Arabiemiirikunnat', 'Argentiina', 'Australia', 'Bangladesh', 'Belgia', 'Bermuda', 'Bhutan', 'Bhutan', 'Bolivia', 'Bosnia-Hertsegovina', 'Brasilia', 'Bulgaria', 'Chile', 'Costa Rica', 'Ecuador', 'Egypti', 'El Salvador', 'Espanja', 'Etelä-Afrikka', 'Etelä-Korea', 'Etiopia', 'Filippiinit', 'Fär-saaret', 'Grönlanti', 'Guatemala', 'Guinea', 'Hongkong', 'Indonesia', 'Intia', 'Irak', 'Iran', 'Irlanti', 'Islanti', 'Iso-Britannia', 'Israel', 'Italia', 'Itä-Saksa', 'Itävalta', 'Jamaika', 'Japani', 'Jordania', 'Jugoslavia', 'Kamerun', 'Kanada', 'Kenia', 'Kiina', 'Kolumbia', 'Kreikka', 'Kroatia', 'Kuuba', 'Kypros', 'Laos', 'Latvia', 'Libanon', 'Lichtenstein', 'Liettua', 'Luxemburg', 'Malesia', 'Mali', 'Malta', 'Marokko', 'Mauritania', 'Mauritius', 'Meksiko', 'Monaca', 'Mongolia', 'Mosambik', 'Muu maa', 'Namibia', 'Nepal', 'Neuvostoliitto', 'Nicaragua', 'Niger', 'Nigeria', 'Norja', 'Pakistan', 'Paraguay', 'Peru', 'Pohjois-Korea', 'Portugali', 'Puerto Rico', 'Puola', 'Ranska', 'Romania', 'Ruotsi', 'Saksa', 'Sambia', 'Senegal', 'Serbia / Tsekkoslovakia', 'Singapore', 'Slovakia', 'Slovenia', 'Sri Lanka', 'Sudan', 'Suomi', 'Sveitsi', 'Syyria', 'Taiwan', 'Tansania', 'Tanska', 'Thaimaa', 'Tsekinmaa', 'Tunisia', 'Turkki', 'Unkari', 'Uruguay', 'Uusi-Seelanti', 'Valko-Venäjä', 'Vatikaanivaltio', 'Venezuela', 'Venäjä', 'Vietnam', 'Viro', 'Yhdysvallat', 'Zimbabwe']
  return function(q, callback) {
    var regexp = new RegExp('(^| )' + q, 'i')
    var result = countries.filter(function(s) { return regexp.test(s) }).map(function(s) { return { value: s } })
    callback(result)
  }
}

var classificationCriteria = {
  1: { category: 'violence', age: '18', description: "01. Kuvaohjelmassa on ERITTÄIN VOIMAKASTA VÄKIVALTAA: fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
  2: { category: 'violence', age: '18', description: "02. Kuvaohjelmassa on ERITTÄIN VOIMAKASTA VÄKIVALTAA: aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  3: { category: 'violence', age: '18', description: "03. Kuvaohjelmassa on ERITTÄIN VOIMAKASTA VÄKIVALTAA: fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
  4: { category: 'violence', age: '16', description: "04. Kuvaohjelmassa on VOIMAKASTA VÄKIVALTAA: fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  5: { category: 'violence', age: '16', description: "05. Kuvaohjelmassa on VOIMAKASTA VÄKIVALTAA: fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
  6: { category: 'violence', age: '16', description: "06. Kuvaohjelmassa on VOIMAKASTA VÄKIVALTAA: fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  7: { category: 'violence', age: '16', description: "07. Kuvaohjelmassa on VOIMAKASTA VÄKIVALTAA: aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
  8: { category: 'violence', age: '16', description: "08. Kuvaohjelmassa on VOIMAKASTA VÄKIVALTAA: seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
  9: { category: 'violence', age: '12', description: "09. Kuvaohjelmassa on VÄKIVALTAA: ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
  10: { category: 'violence', age: '12', description: "10. Kuvaohjelmassa on VÄKIVALTAA: epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
  11: { category: 'violence', age: '12', description: "11. Kuvaohjelmassa on VÄKIVALTAA: seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
  12: { category: 'violence', age: '7',  description: "12. Kuvaohjelmassa on LIEVÄÄ VÄKIVALTAA: epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
  13: { category: 'violence', age: '7',  description: "13. Kuvaohjelmassa on LIEVÄÄ VÄKIVALTAA: Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
  14: { category: 'violence', age: 'S',  description: "14. Kuvaohjelmassa EI VÄKIVALTAA tai vain HYVIN LIEVÄÄ VÄKIVALTAA: Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
  15: { category: 'sex',      age: '18', description: "15. Kuvaohjelmassa on ERITTÄIN YKSITYISKOHTAISTA SEKSUAALISTA SISÄLTÖÄ: hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
  16: { category: 'sex',      age: '16', description: "16. Kuvaohjelmassa on AVOINTA SEKSUAALISTA SISÄLTÖÄ: avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
  17: { category: 'sex',      age: '12', description: "17. Kuvaohjelmassa on SEKSUAALISTA SISÄLTÖÄ: peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
  18: { category: 'sex',      age: '12', description: "18. Kuvaohjelmassa on SEKSUAALISTA SISÄLTÖÄ: yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
  19: { category: 'sex',      age: '7',  description: "19. Kuvaohjelmassa on LIEVÄÄ SEKSUAALISTA SISÄLTÖÄ: lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
  20: { category: 'sex',      age: 'S',  description: "20. Kuvaohjelmassa on vain HYVIN LIEVÄÄ SEKSUAALISTA SISÄLTÖÄ: halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
  21: { category: 'anxiety',  age: '18', description: "21. Kuvaohjelmassa on ERITTÄIN VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
  22: { category: 'anxiety',  age: '18', description: "22. Kuvaohjelmassa on ERITTÄIN VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
  23: { category: 'anxiety',  age: '16', description: "23. Kuvaohjelmassa on VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
  24: { category: 'anxiety',  age: '16', description: "24. Kuvaohjelmassa on VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  25: { category: 'anxiety',  age: '16', description: "25. Kuvaohjelmassa on VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
  26: { category: 'anxiety',  age: '12', description: "26. Kuvaohjelmassa on MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
  27: { category: 'anxiety',  age: '12', description: "27. Kuvaohjelmassa on MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
  28: { category: 'anxiety',  age: '12', description: "28. Kuvaohjelmassa on MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
  29: { category: 'anxiety',  age: '12', description: "29. Kuvaohjelmassa on MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  30: { category: 'anxiety',  age: '12', description: "30. Kuvaohjelmassa on MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
  31: { category: 'anxiety',  age: '7',  description: "31. Kuvaohjelmassa on LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
  32: { category: 'anxiety',  age: '7',  description: "32. Kuvaohjelmassa on LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
  33: { category: 'anxiety',  age: '7',  description: "33. Kuvaohjelmassa on LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
  34: { category: 'anxiety',  age: 'S',  description: "34. Kuvaohjelmassa on vain HYVIN LIEVÄÄ AHDISTAVAA SISÄLTÖÄ: hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
  35: { category: 'drugs',    age: '18', description: "35. Kuvaohjelmassa on IHANNOIVAA ERITTÄIN VAARALLISTEN HUUMEIDEN KÄYTTÖÄ: hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
  36: { category: 'drugs',    age: '16', description: "36. Kuvaohjelmassa on HUUMEIDEN KÄYTTÖÄ: huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
  37: { category: 'drugs',    age: '12', description: "37. Kuvaohjelmassa on HUUMEIDEN EI-HALLITSEVAA KÄYTTÖÄ / ALAIKÄISTEN ALKOHOLIN KÄYTTÖÄ: Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." }
}

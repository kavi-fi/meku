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

  renderClassificationCriteria()

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

  // validations
  $form.find('.required').on('keyup change', validate(isNotEmpty))
  $form.find('.required-duration').on('keyup change', validate(isValidDuration))

  $form.find('input, textarea').not('.multivalue').throttledInput(function(txt) {
    var value = txt
    var dataType = $(this).data('type')

    if ($(this).hasClass('invalid')) {
      return false
    }

    if (dataType == 'number') {
      value = parseInt(txt)
    } else {
      value = txt
    }

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
      .find('input[name="classifications.0.buyer"]').val(movie.classifications[0].buyer).end()
      .find('input[name="classifications.0.billing"]').val(movie.classifications[0].billing).end()
      .find('select[name="classifications.0.format"]').val(movie.classifications[0].format).end()
      .find('input[name="classifications.0.duration"]').val(movie.classifications[0].duration).end()

    $form.find('.required').trigger('change')
  }

  function renderClassificationCriteria() {
    var $categories = ['violence', 'sex', 'anxiety', 'drugs'].map(function(category) {
      var criteria = classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = criteria.map(function(c) {
        return $('<li>')
          .append($('<input>', { type: 'checkbox', name:'criteria-' + c.id } ))
          .append($('<span>', { class:'agelimit agelimit-' + c.age }))
          .append($('<span>').text(c.description))
      })

      return $('<ol>', { class: category }).append($criteria)
    })
    $form.find('.category-criteria').html($categories)
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

function isNotEmpty(val) {
  return (val.trim().length) > 0
}

function isValidDuration(txt) {
  return /(?:(\d+)?:)?(\d+):(\d+)/.test(txt)
}

function validate(f) {
  return function(e) {
    var $el = $(this)
    if (f($el.val())) {
      $el.removeClass('invalid')
    } else {
      $el.addClass('invalid')
    }
    $el.trigger('validation')
  }
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

var classificationCriteria = [
  {},
  { id:1,  category: 'violence', age: '18', description: "01. ERITTÄIN VOIMAKASTA VÄKIVALTAA: fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
  { id:2,  category: 'violence', age: '18', description: "02. ERITTÄIN VOIMAKASTA VÄKIVALTAA: aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:3,  category: 'violence', age: '18', description: "03. ERITTÄIN VOIMAKASTA VÄKIVALTAA: fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
  { id:4,  category: 'violence', age: '16', description: "04. VOIMAKASTA VÄKIVALTAA: fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:5,  category: 'violence', age: '16', description: "05. VOIMAKASTA VÄKIVALTAA: fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
  { id:6,  category: 'violence', age: '16', description: "06. VOIMAKASTA VÄKIVALTAA: fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:7,  category: 'violence', age: '16', description: "07. VOIMAKASTA VÄKIVALTAA: aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
  { id:8,  category: 'violence', age: '16', description: "08. VOIMAKASTA VÄKIVALTAA: seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
  { id:9,  category: 'violence', age: '12', description: "09. VÄKIVALTAA: ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
  { id:10, category: 'violence', age: '12', description: "10. VÄKIVALTAA: epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
  { id:11, category: 'violence', age: '12', description: "11. VÄKIVALTAA: seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
  { id:12, category: 'violence', age: '7',  description: "12. LIEVÄÄ VÄKIVALTAA: epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
  { id:13, category: 'violence', age: '7',  description: "13. LIEVÄÄ VÄKIVALTAA: Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
  { id:14, category: 'violence', age: 'S',  description: "14. VÄKIVALTAA tai vain HYVIN LIEVÄÄ VÄKIVALTAA: Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
  { id:15, category: 'sex',      age: '18', description: "15. ERITTÄIN YKSITYISKOHTAISTA SEKSUAALISTA SISÄLTÖÄ: hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
  { id:16, category: 'sex',      age: '16', description: "16. AVOINTA SEKSUAALISTA SISÄLTÖÄ: avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
  { id:17, category: 'sex',      age: '12', description: "17. SEKSUAALISTA SISÄLTÖÄ: peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
  { id:18, category: 'sex',      age: '12', description: "18. SEKSUAALISTA SISÄLTÖÄ: yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
  { id:19, category: 'sex',      age: '7',  description: "19. LIEVÄÄ SEKSUAALISTA SISÄLTÖÄ: lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
  { id:20, category: 'sex',      age: 'S',  description: "20. vain HYVIN LIEVÄÄ SEKSUAALISTA SISÄLTÖÄ: halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
  { id:21, category: 'anxiety',  age: '18', description: "21. ERITTÄIN VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
  { id:22, category: 'anxiety',  age: '18', description: "22. ERITTÄIN VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
  { id:23, category: 'anxiety',  age: '16', description: "23. VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
  { id:24, category: 'anxiety',  age: '16', description: "24. VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:25, category: 'anxiety',  age: '16', description: "25. VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ SISÄLTÖÄ: aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:26, category: 'anxiety',  age: '12', description: "26. MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
  { id:27, category: 'anxiety',  age: '12', description: "27. MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
  { id:28, category: 'anxiety',  age: '12', description: "28. MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
  { id:29, category: 'anxiety',  age: '12', description: "29. MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:30, category: 'anxiety',  age: '12', description: "30. MELKO VOIMAKASTA AHDISTUSTA HERÄTTÄVÄÄ sisältöä: aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:31, category: 'anxiety',  age: '7',  description: "31. LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
  { id:32, category: 'anxiety',  age: '7',  description: "32. LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
  { id:33, category: 'anxiety',  age: '7',  description: "33. LIEVÄÄ AHDISTUSTA HERÄTTÄVÄÄ sisältöä: dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
  { id:34, category: 'anxiety',  age: 'S',  description: "34. vain HYVIN LIEVÄÄ AHDISTAVAA SISÄLTÖÄ: hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
  { id:35, category: 'drugs',    age: '18', description: "35. IHANNOIVAA ERITTÄIN VAARALLISTEN HUUMEIDEN KÄYTTÖÄ: hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
  { id:36, category: 'drugs',    age: '16', description: "36. HUUMEIDEN KÄYTTÖÄ: huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
  { id:37, category: 'drugs',    age: '12', description: "37. HUUMEIDEN EI-HALLITSEVAA KÄYTTÖÄ / ALAIKÄISTEN ALKOHOLIN KÄYTTÖÄ: Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." }
]

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

  $form.find('input.country').typeahead({hint: false}, { source: countryMatcher() })

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
  $form.find('.duration').on('keyup change', validate(isValidDuration))

  $form.find('input[type=text], textarea').not('.multivalue').throttledInput(function(txt) {
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

  $form.find('input[name="classifications.0.safe"]').change(function() {
    var safe = $(this).is(':checked')
    $form.find('.category-container').toggle(!safe)
    saveMovieField($form.data('id'), $(this).attr('name'), safe)
  })

  $form.find('.category-criteria input[type=checkbox]').change(function() {
    var ids = $form.find('.category-criteria input[type=checkbox]:checked').map(function(i, e) { return $(e).data('id') }).get()
    saveMovieField($form.data('id'), 'classifications.0.criteria', ids)
  })

  function show(movie) {
    $('.new-movie').attr('disabled', 'true')
    var classification = movie.classifications[0]
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
      .find('input[name="classifications.0.buyer"]').val(classification.buyer).end()
      .find('input[name="classifications.0.billing"]').val(classification.billing).end()
      .find('select[name="classifications.0.format"]').val(classification.format).end()
      .find('input[name="classifications.0.duration"]').val(classification.duration).end()
      .find('input[name="classifications.0.safe"]').check(classification.safe).end()

    $form.find('.category-container').toggle(!classification.safe)
    $form.find('.category-criteria input').removeAttr('checked')
    classification.criteria.forEach(function(id) { $form.find('input[name=criteria-'+id+']').check(true) })
    $form.find('.required').trigger('change')
  }

  function renderClassificationCriteria() {
    var $categories = ['violence', 'sex', 'anxiety', 'drugs'].map(function(category) {
      var criteria = classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = criteria.map(function(c) {
        return $('<li>')
          .append($('<input>', { type: 'checkbox', name:'criteria-' + c.id, 'data-id': c.id } ))
          .append($('<span>', { class:'agelimit agelimit-' + c.age }))
          .append($('<span>').text(c.id + ' ' + c.title))
          .append($('<small>').text(c.description))
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

$.fn.check = function(on) {
  return on ? $(this).prop('checked', 'checked') : $(this).removeProp('checked')
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
  { id:1,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
  { id:2,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:3,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
  { id:4,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:5,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
  { id:6,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:7,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
  { id:8,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
  { id:9,  category: 'violence', age: '12', title: "Väkivaltaa", description: "Ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
  { id:10, category: 'violence', age: '12', title: "Väkivaltaa", description: "Epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
  { id:11, category: 'violence', age: '12', title: "Väkivaltaa", description: "Seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
  { id:12, category: 'violence', age: '7',  title: "Lievää väkivaltaa", description: "Epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
  { id:13, category: 'violence', age: '7',  title: "Lievää väkivaltaa", description: "Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
  { id:14, category: 'violence', age: 'S',  title: "Väkivaltaa tai vain hyvin lievää väkivaltaa", description: "Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
  { id:15, category: 'sex',      age: '18', title: "Erittäin yksityiskohtaista seksuaalista sisältöä", description: "Hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
  { id:16, category: 'sex',      age: '16', title: "Avointa seksuaalista sisältöä", description: "Avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
  { id:17, category: 'sex',      age: '12', title: "Seksuaalista sisältöä", description: "Peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
  { id:18, category: 'sex',      age: '12', title: "Seksuaalista sisältöä", description: "Yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
  { id:19, category: 'sex',      age: '7',  title: "Lievää seksuaalista sisältöä", description: "Lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
  { id:20, category: 'sex',      age: 'S',  title: "Vain hyvin lievää seksuaalista sisältöä", description: "Halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
  { id:21, category: 'anxiety',  age: '18', title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
  { id:22, category: 'anxiety',  age: '18', title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
  { id:23, category: 'anxiety',  age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
  { id:24, category: 'anxiety',  age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:25, category: 'anxiety',  age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:26, category: 'anxiety',  age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
  { id:27, category: 'anxiety',  age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
  { id:28, category: 'anxiety',  age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
  { id:29, category: 'anxiety',  age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:30, category: 'anxiety',  age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:31, category: 'anxiety',  age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
  { id:32, category: 'anxiety',  age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
  { id:33, category: 'anxiety',  age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
  { id:34, category: 'anxiety',  age: 'S',  title: "Vain hyvin lievää ahdistavaa sisältöä", description: "Hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
  { id:35, category: 'drugs',    age: '18', title: "Ihannoivaa erittäin vaarallisten huumeiden käyttöä", description: "Hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
  { id:36, category: 'drugs',    age: '16', title: "Huumeiden käyttöä", description: "Huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
  { id:37, category: 'drugs',    age: '12', title: "Huumeiden ei-hallitsevaa käyttöä / alaikäisten alkoholin käyttöä", description: "Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." }
]

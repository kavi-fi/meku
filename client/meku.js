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

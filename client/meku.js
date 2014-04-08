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

  $('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      location.hash = '#/movies/'+movie._id
      show(movie)
    })
  })

  $form.find('input').throttledInput(function(txt) {
    saveMovieField($form.data('id'), $(this).attr('name'), txt)
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
      .find('input[name=year]').val(movie.year).end()
      .find('input[name=synopsis]').val(movie.synopsis).end()
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

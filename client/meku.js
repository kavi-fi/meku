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
      $('.new-movie').attr('disabled', 'true')
      $form.show().data('id', movie._id)
    })
  })

  $form.find('input').throttledInput(function(txt) {
    $.post('/movies/' + $form.data('id'), JSON.stringify(keyValue($(this).attr('name'), txt)))
  })

  function show(movie) {
    console.log(movie)
    $form.show().data('id', movie._id)
  }

  return { show: show }
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

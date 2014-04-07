$(setup)

function setup() {
  $.ajaxSetup({dataType: "json", processData: false, contentType: "application/json"})

  var $form = $('#movie-details')

  $('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      $('.new-movie').hide()
      $form.show().data('id', movie._id)
    })
  })

  $form.find("input").throttledInput(function(txt) {
    $.ajax({
      type: 'POST',
      url: '/movies/' + $form.data('id'),
      data: JSON.stringify(keyValue($(this).attr('name'), txt))
    })
  })
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

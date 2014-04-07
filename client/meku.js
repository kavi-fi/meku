$(setup)

function setup() {
  $('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      $('.new-movie').hide()
      $('#movie-details').show()
    })
  })
}





$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = ''
    var timeout = null
    var $input = $(this).on('keyup', function() {
      var txt = $input.val()
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(function() {
        if (prev == txt) return
        prev = txt
        fn(txt)
      }, 400)
    })
  })
}

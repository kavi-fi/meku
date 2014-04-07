$(setup)

function setup() {
  $('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      $('.new-movie').hide()
      $('#movie-details').show()
    })
  })
}

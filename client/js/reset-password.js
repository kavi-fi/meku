function resetPasswordPage() {
  $.ajaxSetup({ dataType: 'json', processData: false, contentType: 'application/json' })

  var $page = $('#reset-password-page')
  var $form = $page.find('.reset-password-form').submit(function(e) { e.preventDefault() })
  var $password = $form.find('input[name="password"]').on('input', checkInput)
  var $passwordConfirmation = $form.find('input[name="password-confirmation"]').on('input', checkInput)
  var $feedback = $page.find('.feedback')
  var $button = $form.find('button')

  var resetHash = parseLocationHash().length === 2 ? parseLocationHash()[1] : undefined

  $form.on('validate', function () {
    var invalid = !($password.hasClass('invalid') && $password.val() === $passwordConfirmation.val())
    $button.prop('disabled', invalid ? 'disabled' : '')
    $feedback.slideUp()
  })

  $button.click(function() {
    $.post('/reset-password', JSON.stringify({ resetHash: resetHash, password: $password.val() }))
      .done(function() {
        window.location = '/'
      })
      .fail(function() {
        showFeedback('Virhe salasanan vaihtamisessa.')
      })
  })

  return { show: show }

  function show() {
    $page.show()
    if (resetHash) {
      $.get('/check-reset-hash/' + resetHash).fail(function() {
        $form.hide()
        showFeedback('Virheellinen tunniste.')
      })
    }
  }

  function showFeedback(text) {
    $feedback.html(text)
    $feedback.slideDown()
  }

  function checkInput() {
    $(this).toggleClass('invalid', $(this).val().length > 3).trigger('validate')
  }
}

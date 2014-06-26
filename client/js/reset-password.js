function resetPasswordPage() {
  $.ajaxSetup({ dataType: 'json', processData: false, contentType: 'application/json' })

  var $page = $('#reset-password-page')
  var $form = $page.find('.reset-password-form').submit(function(e) { e.preventDefault() })
  var $password = $form.find('input[name="password"]').on('input', checkInput)
  var $passwordConfirmation = $form.find('input[name="password-confirmation"]').on('input', checkInput)
  var $feedback = $page.find('.feedback')
  var $button = $form.find('button')

  var resetHash = location.hash.substring(1)

  $form.on('validate', function () {
    var invalid = !($password.hasClass('invalid') && $password.val() === $passwordConfirmation.val())
    $button.prop('disabled', invalid)
    $feedback.slideUp()
  })

  $button.click(function() {
    $.post('/reset-password', JSON.stringify({ resetHash: resetHash, password: $password.val() }))
      .done(function() {
        window.location = '/'
      })
      .fail(function() {
        $feedback.html('Virhe salasanan vaihtamisessa.').slideDown()
      })
  })

  return { show: show }

  function show() {
    $page.show()
    if (resetHash) {
      $.get('/check-reset-hash/' + resetHash, function(data) {
        if (data.newUser) {
          showActivationInstructions(data.name)
        } else {
          showResetInstructions(data.name)
        }
      })
        .fail(function() {
          $form.hide()
          $feedback.html('Virheellinen tunniste.').slideDown()
        })
    } else {
      $form.hide()
    }
  }

  function updateInstructions(header, text) {
    var $instructions = $page.find('.instructions')

    $instructions.find('h1').text(header)
    $instructions.find('span').text(text)
    $instructions.show()
  }

  function showResetInstructions(name) {
    var text = 'Tervetuloa vaihtamaan salasanasi ' + name + ', aseta uusi salasanasi '
             + 'allaolevan lomakkeen avulla.'

    updateInstructions('Salasanan vaihtaminen', text)
  }

  function showActivationInstructions(name) {
    var text = 'Tervetuloa aktivoimaan käyttäjätunnuksesi ' + name + ', aseta salasanasi '
             + 'allaolevan lomakkeen avulla.'

    updateInstructions('Käyttäjätunnuksen aktivointi', text)
  }

  function checkInput() {
    $(this).toggleClass('invalid', $(this).val().length > 3).trigger('validate')
  }
}

var user;

$(setup)

function setup() {
  user = parseUserCookie()
  $.fn.select2.defaults.formatNoMatches = 'Ei tuloksia'
  $.fn.select2.defaults.formatSearching = 'Haetaan...'
  $.fn.select2.defaults.adaptDropdownCssClass = function(c) {  return c == 'required' ? c : null }

  var login = loginPage()
  var error = errorDialog()

  $.ajaxSetup({dataType: "json", processData: false, contentType: "application/json"})

  $(document).ajaxError(function(e, req) {
    if (req.status == 403) {
      login.show()
    } else {
      error.show()
    }
  })

  $('#overlay').on('click', function() {
    closeDialog()
  })

  $('body').on('click', '.dialog', function(e) {
    e.stopPropagation()
  })

  var navigation = navi()
  searchPage()
  movieDetails()
  buyerPage()
  billingPage()
  navigation.start()
}

function errorDialog() {
  var $overlay = $('#error-overlay')
  var $dialog = $('#error-dialog')
  $dialog.find('a').click(function(e) { e.preventDefault(); location.reload() })
  return { show: function() { $dialog.add($overlay).show() } }
}

function loginPage() {
  var $overlay = $('#login-overlay')
  var $form = $('#login').submit(function(e) { e.preventDefault() })
  var $username = $form.find('input[name="username"]').on('input', checkInput)
  var $password = $form.find('input[name="password"]').on('input', checkInput)
  var $feedback = $form.find('.feedback')
  var $button = $form.find('button')
  var $info = $('#header .user-info').toggle(!!user)
  $info.find('.name').text(user ? user.name : '')

  $info.find('.logout').click(function() {
    $.post('/logout').done(function() { location.reload() })
  })

  $form.on('validate', function() {
    var invalid = $username.hasClass('invalid') || $password.hasClass('invalid')
    $button.prop('disabled', invalid? 'disabled' : '')
    $feedback.slideUp()
  })

  $button.click(function() {
    $.post('/login', JSON.stringify({ username: $username.val(), password: $password.val() }))
      .done(function() { location.reload() })
      .fail(function(jqXHR) {
        if (jqXHR.status == 403) {
          $password.val('').trigger('input').focus()
          $feedback.slideDown()
        }
      })
  })

  return { show: show }

  function show() {
    $form.add($overlay).show()
    $username.focus()
  }
  function checkInput() {
    $(this).toggleClass('invalid', $(this).val() === '').trigger('validate')
  }
}

function navi() {
  var $navi = $('#header .navi')

  $navi.find('a').on('click', function(e) {
    e.preventDefault()
    show($(this)).trigger('show')
  })

  function start() {
    var hash = location.hash
    if (hash == '') {
      $navi.find('a:first').click()
    } else {
      var parts = hash.split('/').map(decodeURIComponent)
      var $a = $navi.find('a[href='+parts.shift()+']')
      show($a).trigger('show', parts)
    }
  }

  function show($a) {
    $navi.find('a.active').removeClass('active')
    $a.addClass('active')
    $('body').children('.page').hide()
    return $($a.data('href')).show()
  }

  return { start: start }
}

function buyerPage() { $('#buyer-page').on('show', function() { location.hash = '#tilaajat' }) }
function billingPage() { $('#billing-page').on('show', function() { location.hash = '#laskutus'}) }

function isReclassification(movie) {
  return movie.classifications.length > 1
}

function isNotEmpty(val) {
  return (val.trim().length) > 0
}

function isValidDuration(txt) {
  return /(?:(\d+)?:)?(\d+):(\d+)$/.test(txt)
}

function isEmail(txt) {
  var regexp = /^([A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+(\.[A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+)*)@(([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63})(\.([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63}))*\.[a-zA-Z0-9]{2,63})$/
  return regexp.test(txt)
}

function isValidYear(txt) {
  return /^\d{4}$/.test(txt) && parseInt(txt) > 1889
}

function validate(f) {
  return function() {
    var $el = $(this)
    if (f($el.val())) {
      $el.removeClass('invalid')
    } else {
      $el.addClass('invalid')
    }
    $el.trigger('validation', ['kutsuttu validatesta'])
  }
}

function showDialog($html) {
  $('#overlay').show()
  $('#dialog').show().append($html)
}

function closeDialog() {
  $('#dialog').empty().hide()
  $('#overlay').hide()
}

$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = undefined
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
    $input.on('reset', reset)
    $input.on('fire', function() {
      reset()
      fn.call(this, prev)
    })

    function reset() {
      if (timeout) clearTimeout(timeout)
      prev = $input.val()
    }
  })
}

$.fn.check = function(on) {
  $(this).each(function() {
    on ? $(this).prop('checked', 'checked') : $(this).removeProp('checked')
  })
  return this
}

function ageLimitIcon(summary) {
  return summary.pegi
    ? 'images/pegi-'+summary.age.toString().toLowerCase()+'.png'
    : 'images/agelimit-'+summary.age.toString().toLowerCase()+'.png'
}
function warningIcons(summary) {
  return summary.pegi
    ? summary.warnings.map(function(w) { return $('<span>', { class:'warning pegi-' + w.toLowerCase() }) })
    : summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w }) })
}

function notIn(arr, el) {
  return _.indexOf(arr, el) === -1
}

function parseUserCookie() {
  var cookie = $.cookie('user')
  if (!cookie) return null
  return JSON.parse(cookie.substring(4, cookie.lastIndexOf('.')))
}

function hasRole(role) {
  var roles = ['root', 'kavi', 'user']
  if (!user) return false
  return roles.indexOf(role) >= roles.indexOf(user.role)
}
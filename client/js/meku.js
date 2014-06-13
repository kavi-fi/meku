var user;

$(function() {
  loadTemplates(setup)
})

function setup() {
  user = parseUserCookie()
  $.fn.select2.defaults.formatNoMatches = 'Ei tuloksia'
  $.fn.select2.defaults.formatSearching = 'Haetaan...'
  $.fn.select2.defaults.adaptDropdownCssClass = function(c) {  return c == 'required' ? c : null }
  $.dateRangePickerLanguages.fi = {
    'selected': 'Valittu:',
    'day':'Päivä',
    'days': ' päivää',
    'apply': 'Sulje',
    'week-1' : 'MA',
    'week-2' : 'TI',
    'week-3' : 'KE',
    'week-4' : 'TO',
    'week-5' : 'PE',
    'week-6' : 'LA',
    'week-7' : 'SU',
    'month-name': ['Tammikuu','Helmikuu','Maaliskuu','Huhtikuu','Toukokuu','Kesäkuu','Heinäkuu','Elokuu','Syyskuu','Lokakuu','Marraskuu','Joulukuu'],
    'shortcuts' : 'Valitse',
    'past': 'Past',
    'following':'Seuraavat',
    'previous' : 'edellinen',
    'prev-week' : 'viikko',
    'prev-month' : 'kuukausi',
    'prev-year' : 'vuosi',
    'next':'seuraava',
    'next-week':'viikko',
    'next-month':'kuukausi',
    'next-year':'vuosi',
    'less-than' : 'Date range should not be more than %d days',
    'more-than' : 'Date range should not be less than %d days',
    'default-more' : 'Please select a date range longer than %d days',
    'default-single' : 'Please select a date',
    'default-less' : 'Please select a date range less than %d days',
    'default-range' : 'Please select a date range between %d and %d days',
    'default-default': 'Ole hyvä ja valitse alku- ja loppupäivä'
  }

  var login = loginPage()
  var error = errorDialog()

  $.ajaxSetup({ dataType: 'json', processData: false, contentType: 'application/json' })

  $(document).ajaxError(function(e, req) {
    if (req.status == 403) {
      login.show()
    } else if (req.statusText != 'abort') {
      error.show()
    }
  })

  $('#overlay').on('click', closeDialog)

  $('body').on('click', '.dialog', stopPropagation)

  var navigation = navi()
  internalSearchPage()
  classificationPage()
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

  $navi.find('a[data-href="#billing-page"]').parent().toggle(hasRole('kavi'))

  $navi.find('a').on('click', function(e) {
    e.preventDefault()
    show($(this)).trigger('show')
  })

  function start() {
    var hash = parseLocationHash()
    if (!hash) {
      $navi.find('a:first').click()
    } else {
      var $a = $navi.find('a[href='+hash.shift()+']')
      show($a).trigger('show', hash)
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

function stopPropagation(e) { e.stopPropagation() }

function isNotEmpty(val) {
  return (val.trim().length) > 0
}

function isEmail(txt) {
  var regexp = /^([A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+(\.[A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+)*)@(([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63})(\.([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63}))*\.[a-zA-Z0-9]{2,63})$/
  return regexp.test(txt)
}

function validate(f) {
  return function() {
    $(this).toggleClass('invalid', !f($(this).val())).trigger('validation')
  }
}

function validateTextChange($el, validatorFn) {
  var validator = validate(validatorFn)
  $el.on('input change validate', validator).on('blur', function() { $(this).addClass('touched') })
}

function requiredCheckboxGroup($el) {
  function validate() {
    $el.toggleClass('invalid', $el.find('input:checkbox:checked').length == 0).trigger('validation')
  }
  $el.on('validate', validate)
  $el.on('change validate', 'input:checkbox', validate)
}

function showDialog($html) {
  $('#overlay').show()
  $('#dialog').show().append($html)
}

function closeDialog() {
  $('#dialog').empty().hide()
  $('#overlay').hide()
}

function switchLatestDeferred() {
  var current = null
  return function(deferred, $spinner) {
    if ($spinner) {
      setTimeout(function() { if (deferred.state() == 'pending') $spinner.addClass('active') }, 150)
      deferred.done(function() { $spinner.removeClass('active') })
    }
    if (current && current.state() == 'pending') current.abort()
    return current = deferred
  }
}

function notIn(arr, el) {
  return _.indexOf(arr, el) === -1
}

function parseUserCookie() {
  var cookie = $.cookie('user')
  if (!cookie) return null
  return JSON.parse(cookie.substring(4, cookie.lastIndexOf('.')))
}

function spinner() {
  return $('<div>', { class:'spinner' }).html('<span/><span/><span/>')
}
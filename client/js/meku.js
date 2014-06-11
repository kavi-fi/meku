var user;

$(setup)

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
    } else {
      error.show()
    }
  })

  $('#overlay').on('click', closeDialog)

  $('body').on('click', '.dialog', stopPropagation)

  var navigation = navi()
  searchPage()
  programDetails()
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

function billingPage() {
  var $page = $('#billing-page')
  var $datePicker = $page.find('.datepicker')
  var $proeButton = $page.find('button')
  var format = 'DD.MM.YYYY'

  $page.on('click', 'input[name=invoiceId]', toggleLoadButton)

  $page.on('click', 'input[name="account-select"]', function() {
    $(this).parent().find('.rows input[name=invoiceId]').prop('checked', $(this).prop('checked'))
    toggleLoadButton()
  })

  $datePicker.dateRangePicker({
    language: 'fi',
    format: format,
    separator: ' - ',
    startOfWeek: 'monday',
    shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']},
    getValue: function() { return $datePicker.find('span').text() },
    setValue: function(s) { $datePicker.find('span').text(s) }
  }).bind('datepicker-change',function(event, obj) {
    fetchInvoiceRows(obj.date1, obj.date2)
  })

  function toggleLoadButton() {
    $proeButton.toggle($page.find('.rows input[type=checkbox]:checked').length > 0)
  }

  function fetchInvoiceRows(date1, date2) {
    var begin = moment(date1).format(format)
    var end = moment(date2).format(format)
    location.hash = '#laskutus/'+begin+'/'+end
    $.get('/invoicerows/' + begin + '/' + end).done(function(rows) {
      $page.find('input[name=begin]').val(begin)
      $page.find('input[name=end]').val(end)
      var $accounts = $page.find('.accounts').empty()

      _(rows).groupBy(function(x) { return x.account.name }).pairs().sortBy(function(t) { return t[0] }).forEach(function(account) {
        var name = account[0]
        var rows = account[1]
        var $account = $("#templates").find('.invoice-account').clone()
        var $rows = $account.find('table')
        $account.find('.name').text(name)
        rows.forEach(function(row) {
          var $row = $("#templates").find('.invoicerow tr').clone()
          $row
            .find('input[type=checkbox]').val(row._id).end()
            .find('.type').text(enums.invoiceRowType[row.type]).end()
            .find('.name').text(row.name).end()
            .find('.duration').text(utils.secondsToDuration(row.duration)).end()
            .find('.registrationDate').text(moment(row.registrationDate).format(format)).end()
            .find('.price').text(formatCentsAsEuros(row.price)).end()
          $rows.find('tbody').append($row)
        })
        $rows.find('tfoot span').text(formatCentsAsEuros(_.reduce(rows, function(acc, row) { return acc + row.price }, 0)))
        $accounts.append($account)
      })
      toggleLoadButton()
    })
  }

  function formatCentsAsEuros(cents) {
    return cents / 100 + ' €'
  }

  $page.on('show', function(e, begin, end) {
    if (begin && end) {
      begin = moment(begin, format)
      end = moment(end, format)
    } else {
      begin = moment().subtract('months', 1).startOf('month')
      end = moment().subtract('months', 1).endOf('month')
    }
    $datePicker.data('dateRangePicker').setDateRange(begin.format(format), end.format(format))
    fetchInvoiceRows(begin, end)
  })
}

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

function ageLimitIcon(summary) {
  return 'images/agelimit-'+summary.age.toString().toLowerCase()+'.png'
}
function warningIcons(summary) {
  return summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w.category }) })
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
  return utils.hasRole(user, role)
}
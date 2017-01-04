var user
var pikadayDefaults = {
  defaultDate: new Date(),
  firstDay: 1,
  format: utils.dateFormat,
  i18n: i18nPikaday[langCookie()],
  setDefaultDate: true,
  showWeekNumber: true
}

$(function() {
  loadTemplates(setup)
})

function setup() {
  user = parseUserCookie()
  localize()
  registerLanguageChangers()
  $.fn.select2.defaults.formatNoMatches = i18nText('Ei tuloksia')
  $.fn.select2.defaults.formatSearching = i18nText('Haetaan...')
  $.fn.select2.defaults.adaptDropdownCssClass = function(c) {  return c == 'required' ? c : null }
  $.dateRangePickerLanguages.fi = i18nDateRangePicker.fi
  $.dateRangePickerLanguages.sv = i18nDateRangePicker.sv

  var login = loginPage()
  var error = errorDialog()
  var conflict = conflictDialog()


  $.ajaxSetup({ dataType: 'json', processData: false, contentType: 'application/json',
    beforeSend: function(xhr, settings) {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/.test(xhr.type)) {
        xhr.setRequestHeader('x-csrf-token', $.cookie('_csrf_token'))
      }
    }
  })

  if (APP_ENVIRONMENT === 'training') $('.training-ribbon').show()
  else if (APP_ENVIRONMENT === 'development') $('.development-ribbon').show()

  $(document).ajaxError(function(e, req) {
    if (req.status == 403) {
      login.show()
    } else if (req.status == 409) {
      conflict.show()
    } else if (req.status == 418) {
      showRevisionMismatchDialog()
    } else if (req.statusText != 'abort') {
      error.show()
    }
  })

  $('#overlay').on('click', closeDialog)

  $('body').on('click', '.dialog', stopPropagation)

  var navigation = navi()
  internalSearchPage()
  classificationPage()
  billingPage()
  userManagementPage()
  subscriberManagementPage()
  providerPage()
  reportsPage()
  navigation.start()
}

function setDatePickerSelection($datePicker, range, callbackWhenManualFire) {
  var rangeAsString = stringDateRange(range)
  $datePicker.data('dateRangePicker').setDateRange(rangeAsString.begin, rangeAsString.end)
  if (!$datePicker.data('dateRangePicker').isInitiated()) {
    $datePicker.data('selection', rangeAsString)
    callbackWhenManualFire(rangeAsString)
  }
}

function errorDialog() {
  var $overlay = $('#error-overlay')
  var $dialog = $('#error-dialog')
  $dialog.find('a[href=#]').one('click', function(e) { e.preventDefault(); location.reload() })
  return { show: function() { $dialog.attr('style', 'display: -webkit-flex; display: flex;'); $overlay.show() }}
}

function conflictDialog() {
  var $overlay = $('#conflict-overlay')
  var $dialog = $('#conflict-dialog')
  return { show: function() { $dialog.attr('style', 'display: -webkit-flex; display: flex'); $overlay.show() }}
}

function loginPage() {
  var $overlay = $('#login-overlay')
  var $form = $('#login').submit(function(e) { e.preventDefault() })
  var $username = $form.find('input[name="username"]').on('input', checkInput)
  var $password = $form.find('input[name="password"]').on('input', checkInput)
  var $feedback = $form.find('.feedback')
  var $loginButton = $form.find('button.login')
  var $forgotPasswordButton = $form.find('button.forgot-password')
  var $info = $('#header .user-info').toggle(!!user)

  $info.find('.name').text(user ? user.name : '')
  $info.find('.username').text('(' + (user ? user.username : '') + ')')
  $info.find('.logout').one('click', function() {
    $.post('/logout').done(function() {
      setLocation('')
      location.reload()
    })
  })

  $form.on('validate', function() {
    $forgotPasswordButton.prop('disabled', $username.hasClass('invalid'))
    $feedback.slideUp()
  })

  $loginButton.click(function() {
    $.post('/login', JSON.stringify({ username: $username.val(), password: $password.val() }))
      .done(function() { location.reload() })
      .fail(function(jqXHR) {
        if (jqXHR.status == 403) {
          $password.val('').trigger('input').focus()
          $feedback.i18nText('Väärä käyttäjätunnus tai salasana.').slideDown()
        }
      })
  })

  $forgotPasswordButton.click(function() {
    $password.val('').trigger('input')
    $forgotPasswordButton.prop('disabled', true)
    $.post('/forgot-password', JSON.stringify({ username: $username.val() }))
      .done(function() {
        $feedback.i18nText('Lähetimme sähköpostilla ohjeet salasanan vaihtamista varten.').slideDown()
        $username.val('')
      })
      .fail(function() {
        $feedback.i18nText('Käyttäjätunnusta ei ole olemassa.').slideDown()
      })
  })

  return { show: show }

  function show() {
    $form.attr('style', 'display: -webkit-flex; display: flex;');
    $overlay.show()
    $username.focus()
  }

  function checkInput() {
    $(this).toggleClass('invalid', $(this).val() === '').trigger('validate')
  }
}

function navi() {
  var $navi = $('#header .navi')

  $navi.toggle(hasRole('kavi'))

  $navi.find('a[data-href="#billing-page"]').parent().toggle(hasRole('kavi'))
  $navi.find('a[data-href="#user-management-page"]').parent().toggle(hasRole('root'))
  $navi.find('a[data-href="#reports-page"]').parent().toggle(hasRole('root'))

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

function stopPropagation(e) { e.stopPropagation() }

function isNotEmpty(val) {
  return (val.trim().length) > 0
}

function isMultiEmail(xs) {
  return _.all(xs.split(','), utils.isEmail)
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

function parseUserCookie() {
  var cookie = $.cookie('user')
  if (!cookie) return null
  return JSON.parse(cookie.substring(4, cookie.lastIndexOf('.')))
}

function select2EnumAutocomplete(opts, onChangeFn) {
  opts = _.merge({
    data: opts.data,
    placeholder: i18nText('Valitse...'),
    multiple: opts.multiple || false,
    initSelection: function(e, callback) { callback() },
    fromOption: function(x) { return x.id }
  }, opts)

  return opts.$el.select2(opts).on('change', onChange).on('setVal', setValue)

  function idToOption(id) {
    var opt = _.find(opts.data, function(item) { return item.id === id })
    return opt ? opt : { id: id, text: id }
  }
  function onChange() {
    var data = $(this).select2('data')
    var val = opts.multiple ? data.map(opts.fromOption) : opts.fromOption(data)
    onChangeFn && onChangeFn($(this).attr('name'), val)
  }
  function setValue(e) {
    var arr = Array.prototype.slice.call(arguments, 1).map(idToOption)
    var data = opts.multiple ? arr : (arr[0] && arr[0] || '')
    $(this).select2('data', data).trigger('validate')
  }
}

function idNamePairToSelect2Option(x) {
  if (!x) return null
  return {id: x._id === null ? x.name : x._id, text: x.name, isNew: x._id === null }
}

function select2OptionToIdNamePair(x) {
  if (!x) return null
  return { _id: x.isNew ? null : x.id, name: x.text }
}
function select2OptionToUser(x) {
  if (!x) return null
  return { _id: x.id, username: x.username, name: x.name, active: x.active }
}
function userToSelect2Option(user) {
  if (!user) return null
  return { id: user._id, text: user.name + ' (' + user.username + ')', name: user.name, username: user.username, active: user.active }
}

function select2OptionToInt(x) { return parseInt(x.id) }

function select2DataFromEnumObject(object) {
  return _.map(object, function(value, key) { return { id: key, text: value }})
}

function changeLog(document) {
  var operations = { update: 'Päivitys', create: 'Luonti', delete: 'Poisto' }
  var $changeLog = $('#templates').find('.change-log').clone()

  return { render: render }

  function render() {
    $.get('/changelogs/' + document._id, function (logEntries) {
      if (logEntries.length > 0) {
        $changeLog.removeClass('hide')

        $changeLog.find('a.show-changelogs').on('click', function (e) {
          e.preventDefault()
          $(this).toggleClass('selected')
          $changeLog.find('.entries-container').slideToggle()
        })
      }

      logEntries.forEach(function(entry) {
        var operation = operations[entry.operation]
        var date = moment(entry.date).format('D.M.YYYY HH:mm:ss')
        var $element = $('<div>', { class: 'entry-row', 'data-id': entry._id })
        var entryString = date + ', ' + entry.user.username + ' (' + entry.user.ip + '), ' + operation
        $element.append($('<label>').text(entryString))

        if (entry.operation === 'update' && entry.updates) {
          var $entryDetails = $('<div>', { class: 'entry-details' })
          $element.append($entryDetails)
          _.forEach(entry.updates, function(value, key) {
            $('<div>', { class: 'entry-detail-row' })
              .append($('<label>').text(key.replace(/,/g, '.')))
              .append(renderDetailRow(value))
              .appendTo($entryDetails)
          })
        }
        $changeLog.find('.entries').append($element)
      })
    })

    function renderDetailRow(value) {
      if (_.isObject(value.old) || _.isObject(value.new)) {
        var $container = $('<div>', { class: 'update-container' })
        var $inserted = $('<div>', { class: 'inserted hide' })
        var $deleted = $('<div>', { class: 'deleted hide' })

        _.forEach(value.old, function (oldValue) {
          if (!_.find(value.new, function (newValue) {
            return _.isEqual(newValue, oldValue)
          })) {
            $deleted.removeClass('hide')
            $deleted.append($('<pre>').text('Poistettu: ' + JSONstringify(oldValue)))
          }
        })

        _.forEach(value.new, function (newValue) {
          if (!_.find(value.old, function (oldValue) {
            return _.isEqual(oldValue, newValue)
          })) {
            $inserted.removeClass('hide')
            $inserted.append($('<pre>').text('Lisätty: ' + JSONstringify(newValue)))
          }
        })

        return $container.append($inserted).append($deleted)
      }

      return $('<span>').text(getOldToNewString(value.old, value.new))

      function getOldToNewString(oldVal, newVal) {
        var oldToNewString = ' -> "' + newVal + '"'

        if (value.old === undefined || value.old === null || value.old === '') {
          return 'tyhjä' + oldToNewString
        } else {
          return '"' + value.old + '"' + oldToNewString
        }
      }

      function JSONstringify(value) {
        return JSON.stringify(value, null, 2)
      }
    }

    return $changeLog
  }
}

window.meku = {
  pikadayDefaults: {
    defaultDate: new Date(),
    firstDay: 1,
    format: utils.dateFormat,
    i18n: window.i18nPikaday[shared.langCookie()],
    setDefaultDate: true,
    showWeekNumber: true
  },
  setDatePickerSelection: function ($datePicker, range, callbackWhenManualFire) {
    const rangeAsString = shared.stringDateRange(range)
    $datePicker.data('dateRangePicker').setDateRange(rangeAsString.begin, rangeAsString.end)
    if (!$datePicker.data('dateRangePicker').isInitiated()) {
      $datePicker.data('selection', rangeAsString)
      callbackWhenManualFire(rangeAsString)
    }
  },
  isNotEmpty: function (val) {
    return val.trim().length > 0
  },
  isMultiEmail: function (xs) {
    return _.every(xs.split(','), utils.isEmail)
  },
  validateTextChange: function ($el, validatorFn) {
    const validator = validate(validatorFn)
    $el.on('input change validate', validator).on('blur', function () { $(this).addClass('touched') })
  },
  switchLatestDeferred: function () {
    let current = null
    return function (deferred, $spinner) {
      if ($spinner) {
        setTimeout(function () { if (deferred.state() === 'pending') $spinner.addClass('active') }, 150)
        deferred.done(function () { $spinner.removeClass('active') })
      }
      if (current && current.state() === 'pending') current.abort()
      current = deferred
      return current
    }
  },
  select2EnumAutocomplete: function (opts, onChangeFn) {
    const optsMerged = _.merge({
      data: opts.data,
      placeholder: shared.i18nText('Valitse...'),
      multiple: opts.multiple || false,
      initSelection: function (e, callback) { callback() },
      fromOption: function (x) { return x.id }
    }, opts)

    return optsMerged.$el.select2(optsMerged).on('change', onChange).on('setVal', setValue)

    function idToOption(id) {
      const opt = _.find(optsMerged.data, function (item) { return item.id === id })
      return opt ? opt : {id: id, text: id}
    }
    function onChange() {
      const data = $(this).select2('data')
      const val = optsMerged.multiple ? data.map(optsMerged.fromOption) : optsMerged.fromOption(data)
      onChangeFn && onChangeFn($(this).attr('name'), val)
    }
    function setValue() {
      const arr = Array.prototype.slice.call(arguments, 1).map(idToOption)
      const data = optsMerged.multiple ? arr : arr[0] && arr[0] || ''
      $(this).select2('data', data).trigger('validate')
    }
  },
  idNamePairToSelect2Option: function (x) {
    if (!x) return null
    return {id: x._id === null ? x.name : x._id, text: x.name, isNew: x._id === null}
  },
  select2OptionToIdNamePair: function (x) {
    if (!x) return null
    return {_id: x.isNew ? null : x.id, name: x.text}
  },
  select2OptionToUser: function (x) {
    if (!x) return null
    return {_id: x.id, username: x.username, name: x.name, active: x.active}
  },
  userToSelect2Option: function (x) {
    if (!x) return null
    return {id: x._id, text: x.name + ' (' + x.username + ')', name: x.name, username: x.username, active: x.active}
  },
  select2OptionToInt: function (x) {
    return parseInt(x.id)
  },
  select2DataFromEnumObject: function (object) {
    return _.map(object, function (value, key) { return {id: key, text: value} })
  },

  changeLog: function (document) {
    const operations = {update: 'Päivitys', create: 'Luonti', delete: 'Poisto'}
    const $changeLog = $('#templates').find('.change-log').clone()

    return {render: render}

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

        logEntries.forEach(function (entry) {
          const operation = operations[entry.operation]
          const date = moment(entry.date).format('D.M.YYYY HH:mm:ss')
          const $element = $('<div>', {class: 'entry-row', 'data-id': entry._id})
          const entryString = date + ', ' + entry.user.username + ' (' + entry.user.ip + '), ' + operation
          $element.append($('<label>').text(entryString))

          if (entry.operation === 'update' && entry.updates) {
            const $entryDetails = $('<div>', {class: 'entry-details'})
            $element.append($entryDetails)
            _.forEach(entry.updates, function (value, key) {
              $('<div>', {class: 'entry-detail-row'})
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
          const $container = $('<div>', {class: 'update-container'})
          const $inserted = $('<div>', {class: 'inserted hide'})
          const $deleted = $('<div>', {class: 'deleted hide'})

          _.forEach(value.old, function (oldValue) {
            if (!_.find(value.new, function (newValue) { return _.isEqual(newValue, oldValue) })) {
              $deleted.removeClass('hide')
              $deleted.append($('<pre>').text('Poistettu: ' + stringify(oldValue)))
            }
          })

          _.forEach(value.new, function (newValue) {
            if (!_.find(value.old, function (oldValue) { return _.isEqual(oldValue, newValue) })) {
              $inserted.removeClass('hide')
              $inserted.append($('<pre>').text('Lisätty: ' + stringify(newValue)))
            }
          })

          return $container.append($inserted).append($deleted)
        }

        return $('<span>').text(getOldToNewString(value.old, value.new))

        function getOldToNewString(oldVal, newVal) {
          const oldToNewString = ' -> "' + newVal + '"'

          if (value.old === undefined || value.old === null || value.old === '') {
            return 'tyhjä' + oldToNewString
          }
          return '"' + value.old + '"' + oldToNewString

        }

        function stringify(obj) {
          return JSON.stringify(obj, null, 2)
        }
      }

      return $changeLog
    }
  }}

$(function () {
  shared.loadTemplates(setup)
})

function setup() {
  window.user = shared.parseUserCookie()
  shared.localize()
  shared.registerLanguageChangers()
  $.fn.select2.defaults.formatNoMatches = shared.i18nText('Ei tuloksia')
  $.fn.select2.defaults.formatSearching = shared.i18nText('Haetaan...')
  $.fn.select2.defaults.adaptDropdownCssClass = function (c) { return c === 'required' ? c : null }
  $.dateRangePickerLanguages.fi = window.i18nDateRangePicker.fi
  $.dateRangePickerLanguages.sv = window.i18nDateRangePicker.sv

  const login = loginPage()
  const error = errorDialog()
  const conflict = conflictDialog()


  $.ajaxSetup({dataType: 'json', processData: false, contentType: 'application/json',
    beforeSend: function (xhr) {
      if (!(/^(GET|HEAD|OPTIONS|TRACE)$/).test(xhr.type)) {
        xhr.setRequestHeader('x-csrf-token', $.cookie('_csrf_token'))
      }
    }
  })

  if (APP_ENVIRONMENT === 'training') $('.training-ribbon').show()
  else if (APP_ENVIRONMENT === 'development') $('.development-ribbon').show()

  $(document).ajaxError(function (e, req) {
    if (req.status === 403) {
      login.show()
    } else if (req.status === 409) {
      conflict.show()
    } else if (req.status === 418) {
      shared.showRevisionMismatchDialog()
    } else if (req.statusText !== 'abort') {
      console.error(req, e)
      error.show()
    }
  })

  $('#overlay').on('click', shared.closeDialog)

  $('body').on('click', '.dialog', shared.stopPropagation)

  const navigation = navi()
  window.internalSearchPage()
  window.classificationPage()
  window.billingPage()
  window.userManagementPage()
  window.subscriberManagementPage()
  window.providerPage()
  window.reportsPage()
  navigation.start()
}

function errorDialog() {
  const $overlay = $('#error-overlay')
  const $dialog = $('#error-dialog')
  $dialog.find('a[href=#]').one('click', function (e) { e.preventDefault(); location.reload() })
  return {show: function () { $dialog.attr('style', 'display: -webkit-flex; display: flex;'); $overlay.show() }}
}

function conflictDialog() {
  const $overlay = $('#conflict-overlay')
  const $dialog = $('#conflict-dialog')
  return {show: function () { $dialog.attr('style', 'display: -webkit-flex; display: flex'); $overlay.show() }}
}

function loginPage() {
  const $overlay = $('#login-overlay')
  const $form = $('#login').submit(function (e) { e.preventDefault() })
  const $username = $form.find('input[name="username"]').on('input', checkInput)
  const $password = $form.find('input[name="password"]').on('input', checkInput)
  const $feedback = $form.find('.feedback')
  const $loginButton = $form.find('button.login')
  const $forgotPasswordButton = $form.find('button.forgot-password')
  const $info = $('#header .user-info').toggle(!!window.user)

  $info.find('.name').text(window.user ? window.user.name : '')
  $info.find('.username').text('(' + (window.user ? window.user.username : '') + ')')
  $info.find('.logout').one('click', function () { $.post('/logout').done(function () { shared.setLocation('')
      location.reload()
    })
  })

  $form.on('validate', function () { $forgotPasswordButton.prop('disabled', $username.hasClass('invalid'))
    $feedback.slideUp()
  })

  $loginButton.click(function () { $.post('/login', JSON.stringify({username: $username.val(), password: $password.val()}))
      .done(function () { location.reload() })
      .fail(function (jqXHR) {
        if (jqXHR.status === 403) {
          $password.val('').trigger('input').focus()
          $feedback.i18nText('Väärä käyttäjätunnus tai salasana.').slideDown()
        }
      })
  })

  $forgotPasswordButton.click(function () { $password.val('').trigger('input')
    $forgotPasswordButton.prop('disabled', true)
    $.post('/forgot-password', JSON.stringify({username: $username.val()}))
      .done(function () { $feedback.i18nText('Lähetimme sähköpostilla ohjeet salasanan vaihtamista varten.').slideDown()
        $username.val('')
      })
      .fail(function () { $feedback.i18nText('Käyttäjätunnusta ei ole olemassa.').slideDown()
      })
  })

  return {show: show}

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
  const $navi = $('#header .navi')

  $navi.toggle(shared.hasRole('kavi'))

  $navi.find('a[data-href="#billing-page"]').parent().toggle(shared.hasRole('kavi'))
  $navi.find('a[data-href="#user-management-page"]').parent().toggle(shared.hasRole('root'))
  $navi.find('a[data-href="#reports-page"]').parent().toggle(shared.hasRole('root'))

  $navi.find('a').on('click', function (e) {
    e.preventDefault()
    show($(this)).trigger('show')
  })

  function start() {
    const hash = shared.parseLocationHash()
    if (hash) {
      const $a = $navi.find('a[href=' + hash.shift() + ']')
      show($a).trigger('show', hash)
    } else {
      $navi.find('a:first').click()
    }
  }

  function show($a) {
    $navi.find('a.active').removeClass('active')
    $a.addClass('active')
    $('body').children('.page').hide()
    return $($a.data('href')).show()
  }

  return {start: start}
}

function validate(f) {
  return function () {
    $(this).toggleClass('invalid', !f($(this).val())).trigger('validation')
  }
}


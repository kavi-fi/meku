/* Shared between auth and public users */

$.fn.throttledInput = function (fn) {
  return $(this).each(function () {
    let prev
    let timeout = null
    const $input = $(this).on('keyup input', function () {
      const txt = $input.val()
      const that = this
      if (timeout) clearTimeout(timeout)
      $input.addClass('throttled').trigger('throttled')
      timeout = setTimeout(function () { $input.removeClass('throttled').trigger('throttled')
        if (prev === txt) return
        prev = txt
        fn.call(that, txt)
      }, 400)
    })
    $input.on('reset', reset)
    $input.on('fire', function () {
      reset()
      fn.call(this, prev)
    })

    function reset() {
      if (timeout) clearTimeout(timeout)
      prev = $input.removeClass('throttled').trigger('throttled').val()
    }
  })
}

$.fn.labeledText = function (txt) {
  this.text(txt).add(this.prev('label')).toggleClass('hide', !txt)
  return this
}

$.fn.i18nText = function (key) {
  const txt = shared.i18nText(key)
  return this.text(txt || key).toggleClass('i18n-fail', !txt)
}
$.fn.i18nHtml = function (key, fallback) {
  const lang = shared.langCookie()
  const html = lang === 'fi' ? undefined : window.i18n[lang][key]
  return this.html(html || fallback).toggleClass('i18n-fail', lang !== 'fi' && !html)
}

window.shared = {
  i18nText: function (key) {
    const lang = shared.langCookie()
    return lang === 'fi' ? key : window.i18n[lang][key]
  },
  langCookie: function () {
    return $.cookie('lang') === 'sv' ? 'sv' : 'fi'
  },
  localize: function () {
    $('[data-i18n]').each(function () {
      const $e = $(this)
      const key = $e.data('i18n')
      key ? $e.i18nHtml(key, $e.html()) : $e.i18nText($e.text())
    })
    $('[data-i18n-placeholder]').each(function () {
      const $e = $(this)
      const key = $e.prop('placeholder')
      $e.prop('placeholder', shared.i18nText(key) || key)
    })
  },
  renderWarningSummary: function (summary) {
    if (!summary) return undefined
    return $('#templates > .warning-summary').clone()
      .find('.agelimit').attr('src', shared.ageLimitIcon(summary)).end()
      .find('.warnings').html(shared.warningIcons(summary)).end()
  },
  ageLimitIcon: function (summary) {
    const age = shared.langCookie() === 'sv' && summary.age === 0 ? 't' : summary.age
    return 'images/agelimit-' + age + '.png'
  },
  warningIcons: function (summary) {
    return summary.warnings.map(function (w) { return $('<span>', {class: 'warning ' + w.category}) })
  },
  hasRole: function (role) {
    if (!window.utils) return false
    return utils.hasRole(window.user, role)
  },
  loadTemplates: function(callback) {
    $.get('/templates.html').done(function (html) {
      $('#templates').html(html)
      callback()
    })
  },
  setLocation: function (path) {
    if (path === window.location.hash) return
    window.sendPageview(window.location.pathname + path)
    history.replaceState(null, null, path)
  },
  parseLocationHash: function () {
    if (!location.hash) return undefined
    return location.hash.split('/').map(decodeURIComponent)
  },
  spinner: function () {
    return $('<div>', {class: 'spinner'}).html('<span/><span/><span/>')
  },
  showDialog: function ($html) {
    $('#overlay').show()
    $('#dialog').attr('style', 'display: -webkit-flex; display: flex;').append($html)
  },
  closeDialog: function () {
    $('#dialog').empty().hide()
    $('#overlay').hide()
  },
  showRevisionMismatchDialog: function () {
    if (!$('.revision-mismatch-dialog').is(':visible')) {
      const html = $('<h2>').i18nText('Järjestelmä on päivitetty.')
        .add($('<span>').html(shared.i18nText('upgrade-reload') || 'Lataa sivu uudelleen <a href="javascript:window.location.reload(true)">tästä</a>.'))
      shared.showDialog($('<div>').addClass('dialog revision-mismatch-dialog').html(html))
    }
  },
  registerRevisionMismatchAjaxErrorHandler: function () {
    $(document).ajaxError(function (e, req) {
      if (req.status === 418) shared.showRevisionMismatchDialog()
    })
  },
  registerLanguageChangers: function () {
    const lang = shared.langCookie()
    $('.toggleLanguage').text(lang === 'fi' ? 'På svenska' : 'Suomeksi').one('click', function () { $.cookie('lang', lang === 'fi' ? 'sv' : 'fi')
      window.location.reload(true)
    })
  },
  yearShortcuts: function () {
    let yearOffset = 0

    function year(n) {
      return function () {
        const startYear = moment().year()
        yearOffset += n
        return [ moment(startYear + yearOffset, 'YYYY').toDate() ]
      }
    }

    return [
      {name: '-10v', dates: year(-10)},
      {name: '-1v', dates: year(-1)},
      {name: '+1v', dates: year(1)},
      {name: '+10v', dates: year(10)}
    ]
  },
  setupDatePicker: function ($datePicker, opts, onChange, forceUpdate) {
    $.dateRangePickerLanguages.fi = window.i18nDateRangePicker.fi
    $.dateRangePickerLanguages.sv = window.i18nDateRangePicker.sv
    const defaults = {
      language: shared.langCookie(),
      format: 'DD.MM.YYYY',
      separator: ' - ',
      startOfWeek: 'monday',
      getValue: function () { return $datePicker.find('span').text() },
      setValue: function (s) { $datePicker.find('span').text(s) }
    }
    $datePicker.dateRangePicker(_.merge({}, defaults, opts)).bind('datepicker-change', function (event, obj) {
      const selection = shared.stringDateRange({begin: moment(obj.date1), end: moment(obj.date2)})
      if (!_.isEqual(selection, $datePicker.data('selection')) || forceUpdate) {
        $datePicker.data('selection', selection)
        onChange(selection)
      }
    })
  },
  stringDateRange: function (range) {
    const format = 'DD.MM.YYYY'
    return {begin: range.begin.format(format), end: range.end.format(format)}
  },
  parseUserCookie: function () {
    const cookie = $.cookie('user')
    if (!cookie) return null
    return JSON.parse(cookie.substring(4, cookie.lastIndexOf('.')))
  },
  stopPropagation: function (e) {
    e.stopPropagation()
  },
  select2Autocomplete: function (opts, onChangeFn) {
    const defaults = {
      toOption: function (x) { return {id: x.replace(/,/g, '&#44;'), text: x} },
      fromOption: function (x) { return x.id.replace(/&#44;/g, ',') },
      multiple: false,
      allowAdding: false,
      termMinLength: 1
    }
    const optsMerged = _.merge(defaults, opts)

    const $select = optsMerged.$el

    function createSearchChoice(term, data) {
      const found = _.find(data, function (d) { return d.text === term })
      if (!found) {
        return {id: term, text: term, isNew: true}
      }
    }

    $select.select2({
      query: function (query) {
        const len = $.trim(query.term).length
        if (len < optsMerged.termMinLength) {
          return query.callback({results: []})
        }
        const path = typeof optsMerged.path === 'function' ? optsMerged.path(query.term) : optsMerged.path + encodeURIComponent(query.term)
        return $.get(path).done(function (data) { return query.callback({results: data.map(optsMerged.toOption)}) })
      },
      initSelection: function (element, callback) {
        const val = optsMerged.multiple ? (optsMerged.val || []).map(optsMerged.toOption) : optsMerged.toOption(optsMerged.val)
        return callback(val)
      },
      multiple: optsMerged.multiple,
      placeholder: shared.i18nText('Valitse...'),
      allowClear: optsMerged.allowClear,
      formatSelection: optsMerged.formatSelection,
      formatResultCssClass: optsMerged.formatResultCssClass,
      createSearchChoice: optsMerged.allowAdding ? createSearchChoice : undefined
    })

    return $select.on('change', function () {
      const data = $(this).select2('data')
      const val = optsMerged.multiple ? data.map(optsMerged.fromOption) : optsMerged.fromOption(data)
      onChangeFn && onChangeFn($(this).attr('name'), val)
    }).on('setVal', function () {
      const arr = Array.prototype.slice.call(arguments, 1).map(optsMerged.toOption)
      const data = optsMerged.multiple ? arr : arr[0] && arr[0] || ''
      $(this).select2('data', data).trigger('validate')
    })
  }
}

$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = undefined
    var timeout = null
    var $input = $(this).on('keyup input', function() {
      var txt = $input.val()
      var that = this
      if (timeout) clearTimeout(timeout)
      $input.addClass('throttled').trigger('throttled')
      timeout = setTimeout(function() {
        $input.removeClass('throttled').trigger('throttled')
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
      prev = $input.removeClass('throttled').trigger('throttled').val()
    }
  })
}

$.fn.labeledText = function(txt) {
  this.text(txt).add(this.prev('label')).toggleClass('hide', !txt)
  return this
}

$.fn.i18nText = function(key) {
  var txt = i18nText(key)
  return this.text(txt || key).toggleClass('i18n-fail', !txt)
}
$.fn.i18nHtml = function(key, fallback) {
  var lang = langCookie()
  var html = lang == 'fi' ? undefined : i18n[lang][key]
  return this.html(html || fallback).toggleClass('i18n-fail', (lang != 'fi' && !html))
}

function i18nText(key) {
  var lang = langCookie()
  return lang == 'fi' ? key : i18n[lang][key]
}

function langCookie() {
  return $.cookie('lang') == 'sv' ? 'sv' : 'fi'
}

function localize() {
  $('[data-i18n]').each(function() {
    var $e = $(this)
    var key = $e.data('i18n')
    key ? $e.i18nHtml(key, $e.html()) : $e.i18nText($e.text())
  })
  $('[data-i18n-placeholder]').each(function() {
    var $e = $(this)
    var key = $e.prop('placeholder')
    $e.prop('placeholder', i18nText(key) || key)
  })
}

function renderWarningSummary(summary) {
  if (!summary) return undefined
  return $('#templates > .warning-summary').clone()
    .find('.agelimit').attr('src', ageLimitIcon(summary)).end()
    .find('.warnings').html(warningIcons(summary)).end()
}

function ageLimitIcon(summary) {
  return 'images/agelimit-'+summary.age+'.png'
}

function warningIcons(summary) {
  return summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w.category }) })
}

function hasRole(role) {
  if (!window.utils) return false
  return utils.hasRole(window.user, role)
}

function loadTemplates(callback) {
  $.get('/templates.html').done(function(html) {
    $('#templates').html(html)
    callback()
  })
}

function setLocation(path) {
  history.replaceState(null, null, path)
}

function parseLocationHash() {
  if (!location.hash) return undefined
  return location.hash.split('/').map(decodeURIComponent)
}

function spinner() {
  return $('<div>', { class:'spinner' }).html('<span/><span/><span/>')
}

function showDialog($html) {
  $('#overlay').show()
  $('#dialog').attr('style', 'display: -webkit-flex; display: flex;').append($html)
}

function closeDialog() {
  $('#dialog').empty().hide()
  $('#overlay').hide()
}

function showRevisionMismatchDialog() {
  if (!$('.revision-mismatch-dialog').is(':visible')) {
    var html = $('<h2>').i18nText('Järjestelmä on päivitetty.')
      .add($('<span>').html(i18nText('upgrade-reload') || 'Lataa sivu uudelleen <a href="javascript:window.location.reload(true)">tästä</a>.'))
    showDialog($('<div>').addClass('dialog revision-mismatch-dialog').html(html))
  }
}

function registerRevisionMismatchAjaxErrorHandler() {
  $(document).ajaxError(function(e, req) {
    if (req.status == 418) showRevisionMismatchDialog()
  })
}

function registerLanguageChangers() {
  var lang = langCookie()
  $('.toggleLanguage').text(lang == 'fi' ? 'På svenska' : 'Suomeksi').one('click', function() {
    $.cookie('lang', lang == 'fi' ? 'sv' : 'fi')
    window.location.reload(true)
  })
}

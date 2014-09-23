$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = undefined
    var timeout = null
    var $input = $(this).on('keyup input', function() {
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

$.fn.labeledText = function(txt) {
  this.text(txt).add(this.prev('label')).toggleClass('hide', !txt)
  return this
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
    var html = '<h2>Järjestelmä on päivitetty.</h2><span>Lataa sivu uudelleen <a href="javascript:window.location.reload(true)">tästä</a>.</span>'
    showDialog($('<div>').addClass('dialog revision-mismatch-dialog').html(html))
  }
}

function registerRevisionMismatchAjaxErrorHandler() {
  $(document).ajaxError(function(e, req) {
    if (req.status == 418) showRevisionMismatchDialog()
  })
}

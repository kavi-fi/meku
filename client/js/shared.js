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

$.fn.labeledText = function(txt) {
  this.text(txt).add(this.prev()).toggleClass('hide', !txt)
  return this
}

function renderWarningSummary(summary) {
  return $('#templates > .warning-summary').clone()
    .find('.agelimit').attr('src', ageLimitIcon(summary)).end()
    .find('.warnings').html(warningIcons(summary)).end()
}

function ageLimitIcon(summary) {
  return 'images/agelimit-'+summary.age.toString().toLowerCase()+'.png'
}

function warningIcons(summary) {
  return summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w.category }) })
}

function hasRole(role) {
  return utils.hasRole(window.user, role)
}

function loadTemplates(callback) {
  $.get('/templates.html').done(function(html) {
    $('#templates').html(html)
    callback()
  })
}

function parseLocationHash() {
  if (!location.hash) return undefined
  return location.hash.split('/').map(decodeURIComponent)
}
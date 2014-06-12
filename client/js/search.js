function searchPage() {
  var $page = $('#search-page')
  var $input = $page.find('.query')
  var $button = $page.find('button.search')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')

  var $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  var $newClassificationButton = $page.find('.new-classification button')

  var detailRenderer = programBox()
  var state = { q:'', page: 0 }

  $page.on('show', function(e, q, filters, programId) {
    $input.val(q || '').trigger('reset')
    setFilters(filters)
    queryChanged(q || '')
    loadUntil(programId)
  })

  $button.click(function() { $input.trigger('fire') })
  $filters.on('change', function() { $input.trigger('fire') })

  $(window).on('scroll', function() {
    if (!$page.is(':visible')) return
    if ($loading.is(':visible') || $noResults.is(':visible') || $noMoreResults.is(':visible')) return
    if($(document).height() - $(window).scrollTop() - $(window).height() < 100) {
      state.page++
      load()
    }
  })

  $input.throttledInput(function() {
    queryChanged($input.val().trim())
    updateLocationHash()
    load()
  })

  $newClassificationType.select2({
    data: [
      {id: 1, text: 'Elokuva'},
      {id: 3, text: 'TV-sarjan jakso'},
      {id: 4, text: 'Muu TV-ohjelma'},
      {id: 5, text: 'Extra'},
      {id: 6, text: 'Trailer'},
      {id: 7, text: 'Peli'}
    ]
  }).select2('val', 1)

  $newClassificationButton.click(function() {
    var programType = $newClassificationType.select2('val')
    $.post('/programs/new', JSON.stringify({ programType: programType})).done(function(program) {
      $('body').children('.page').hide()
      $('#classification-page').trigger('show', program._id).show()
    })
  })

  $results.on('click', '.result', function() {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  $results.on('click', 'button.reclassify', function(e) {
    var id = $(this).parents('.program-box').data('id')
    $.post('/programs/' + id + '/reclassification').done(function(program) {
      $('body').children('.page').hide()
      $('#classification-page').trigger('show', program._id).show()
    })
  })

  $results.on('click', 'button.continue-classification', function(e) {
    var id = $(this).parents('.program-box').data('id')
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', id).show()
  })

  function queryChanged(q) {
    state = { q:q, page: 0 }
    $noResults.add($noMoreResults).hide()
  }

  function loadUntil(selectedProgramId) {
    load(function() {
      if (!selectedProgramId) {
        updateLocationHash()
        return
      }
      var $selected = $results.find('.result[data-id='+selectedProgramId+']')
      if ($selected.length > 0) {
        openDetail($selected, false)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      } else if (state.page < 20) {
        state.page++
        loadUntil(selectedProgramId)
      }
    })
  }

  function load(callback) {
    $loading.show()
    var url = '/programs/search/'+encodeURIComponent(state.q)
    var data = $.param({ page:state.page, filters:currentFilters() })
    state.jqXHR = $.get(url, data).done(function(results, status, jqXHR) {
      if (state.jqXHR != jqXHR) return
      $noResults.toggle(state.page == 0 && results.length == 0)
      $noMoreResults.toggle((state.page > 0 || results.length > 0) && results.length < 100)
      if (state.page == 0) $results.empty()
      $results.append(results.map(function(p) { return render(p, state.q) }))
      $loading.hide()
      if (callback) callback()
    })
  }

  function currentFilters() {
    return $filters.filter(':checked')
      .map(function() { return $(this).data('type') })
      .toArray().join(',').split(',')
  }

  function setFilters(filterString) {
    $filters.each(function() {
      $(this).prop('checked', filterString && filterString.indexOf($(this).data('id')) >= 0)
    })
  }

  function openDetail($row, animate) {
    var p = $row.data('program')
    updateLocationHash(p._id)
    var $details = detailRenderer.render(p)
    toggleDetailButtons($details, p)
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
  }

  function closeDetail() {
    $results.find('.result.selected').removeClass('selected')
    $results.find('.program-box').slideUp(function() { $(this).remove() }).end()
  }

  function toggleDetailButtons($detail, p) {
    var head = p.classifications[0]
    var canContinue = head && head.status == 'in_process' && (hasRole('kavi') || !head.author || head.author._id == user._id)
    var canReclassify = !canContinue && (!head || head.authorOrganization !== 3) && (hasRole('kavi') || !head || (head.status != 'registered' && head.status != 'in_process'))
    $detail.find('button.continue-classification').toggle(!!canContinue)
    $detail.find('button.reclassify').toggle(!!canReclassify)
  }

  function updateLocationHash(selectedProgramId) {
    var filters = $filters.filter(':checked').map(function() { return $(this).data('id') }).toArray().join('')
    location.hash = '#haku/' + encodeURIComponent(state.q) + '/' + filters + '/' + (selectedProgramId || '')
  }

  function render(p, query) {
    var c = p.classifications[0]
    var queryParts = (query || '').trim().toLowerCase().split(/\s+/)
    return $('<div>', { class:'result', 'data-id': p._id })
      .data('program', p)
      .append($('<span>').text(name(p)).highlight(queryParts, { beginningsOnly: true, caseSensitive: false }))
      .append($('<span>').text(countryAndYear(p)))
      .append($('<span>').text(enums.util.isGameType(p) ? p.gameFormat || '': duration(c)))
      .append($('<span>').text(enums.programType[p.programType].fi))
      .append($('<span>').append(c && renderWarningSummary(classification.summary(p, c)) || ' - '))

    function name(p) {
      return _.compact([p.name[0], utils.seasonEpisodeCode(p)]).join(' ')
    }

    function countryAndYear(p) {
      var s = _([enums.util.toCountryString(p.country), p.year]).compact().join(', ')
      return s == '' ? s : '('+s+')'
    }

    function duration(c) {
      if (!c || !c.duration) return ''
      var match = c.duration.match(/(?:(\d+)?:)?(\d+):(\d+)$/)
      if (!match) return c.duration
      match.shift()
      return _.chain(match).map(suffixify).compact().join(' ')

      function suffixify(x, ii) {
        if (!x) return x
        var int = parseInt(x)
        if (!int) return ''
        if (ii == 0) return int + ' h'
        if (ii == 1) return int + ' min'
        if (ii == 2) return int + ' s'
        return x
      }
    }
  }
}

function searchPage() {
  var $page = $('#search-page')
  var $input = $page.find('.query')
  var $button = $page.find('button.search')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')
  var $detailTemplate = $('#templates > .search-result-details').detach()
  var $newClassificationButton = $page.find('.new-classification button')

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

  $('input[name="new-classification-type"]').select2({
    data: [
      {id: 1, text: 'Elokuva'},
      {id: 4, text: 'Extra'},
      {id: 5, text: 'Trailer'}
    ]
  }).select2('val', 1)

  $newClassificationButton.click(function() {
    var programType = $('input[name="new-classification-type"]').select2('val')
    $.post('/programs/new', JSON.stringify({'program-type': programType})).done(function(program) {
      $('body').children('.page').hide()
      $('#classification-page').trigger('show', program._id).show()
    })
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

  $results.on('click', '.result', function() {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  function openDetail($row, animate) {
    var p = $row.data('program')
    updateLocationHash(p._id)
    var $details = renderDetails(p)
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
  }

  function closeDetail() {
    $results.find('.result.selected').removeClass('selected')
    $results.find('.search-result-details').slideUp(function() { $(this).remove() }).end()
  }

  $results.on('click', 'button.reclassify', function(e) {
    var id = $(this).parents('.search-result-details').data('id')
    $.post('/programs/' + id + '/reclassification').done(function(program) {
      $('body').children('.page').hide()
      $('#classification-page').trigger('show', program._id).show()
    })
  })
  $results.on('click', 'button.continue-classification', function(e) {
    var id = $(this).parents('.search-result-details').data('id')
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', id).show()
  })

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
      .append($('<span>').text(classification.ageLimit(c)))
      .append($('<span>').text(enums.programType[p['program-type']].fi))
      .append($('<span>').text(enums.util.isGameType(p) ? p.gameFormat || '': duration(c)))

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

  function renderDetails(p) {
    var names = { n: p.name.join(', '), fi: p['name-fi'].join(', '), sv: p['name-sv'].join(', '), other: p['name-other'].join(', ')}
    var series = p.series && p.series.name || undefined
    var episode = utils.seasonEpisodeCode(p)
    var classificationStatusText = classification.fullStatus(p.classifications).map(function(t) { return $('<span>').text(t) })
    var $e = $detailTemplate.clone()
      .data('id', p._id)
      .find('.primary-name').text(p.name[0]).end()
      .find('.name').text(names.n).end()
      .find('.name-fi').text(names.fi).end()
      .find('.name-sv').text(names.sv).prev().toggleClass('hide', !names.sv).end().end()
      .find('.name-other').text(names.other).prev().toggleClass('hide', !names.other).end().end()
      .find('.series').text(series).prev().toggleClass('hide', !series).end().end()
      .find('.episode').text(episode).prev().toggleClass('hide', !episode).end().end()
      .find('.country').text(enums.util.toCountryString(p.country)).end()
      .find('.year').text(p.year).end()
      .find('.production-companies').text(p['production-companies'].join(', ')).end()
      .find('.genre').text(p.genre.join(', ') || p['legacy-genre'].join(', ')).end()
      .find('.directors').text(p.directors.join(', ')).end()
      .find('.actors').text(p.actors.join(', ')).end()
      .find('.synopsis').text(p.synopsis).end()
      .find('.status').html(classificationStatusText).end()

    var c = classification.mostValid(p.classifications)
    if (c) {
      var summary = classification.summary(p, c)
      $e.find('.agelimit').attr('src', ageLimitIcon(summary)).end()
        .find('.warnings').html(warningIcons(summary)).end()
        .find('.buyer').text(c.buyer && c.buyer.name || '').end()
        .find('.billing').text(c.billing && c.billing.name || '').end()
        .find('.format').text(enums.util.isGameType(p) && p.gameFormat || c.format).end()
        .find('.duration').text(c.duration).end()
        .find('.criteria').html(renderClassificationCriteria(c)).end()
    }

    var head = p.classifications[0]
    var canContinue = head && head.status == 'in_process' && (hasRole('kavi') || !head.author || head.author._id == user._id)
    var canReclassify = !canContinue && (hasRole('kavi') || !head || (head.status != 'registered' && head.status != 'in_process'))
    $e.find('button.continue-classification').toggle(!!canContinue)
    $e.find('button.reclassify').toggle(!!canReclassify)

    return $e
  }

  function renderClassificationCriteria(c) {
    if (!c.criteria) return ''
    return c.criteria.map(function(id) {
      var cr = enums.classificationCriteria[id - 1]
      var category = enums.classificationCategoriesFI[cr.category]
      return $('<div>')
        .append($('<label>').text(category + ' ('+cr.id+')'))
        .append($('<span>').text(c['criteria-comments'] && c['criteria-comments'][cr.id] || ''))
    })
  }
}

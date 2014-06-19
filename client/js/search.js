function publicSearchPage() {
  searchPage('/public/search/')

  var $page = $('#search-page')
  $page.find('.new-classification').remove()

  $page.on('showDetails', '.program-box', function(e, program) {
    var body = encodeURIComponent('Ohjelma: '+program.name[0]+ ' [id:'+program._id+']')
    var subject = encodeURIComponent('Kuvaohjelman uudelleenluokittelupyyntö')
    var q = '?subject='+subject+'&body='+body
    $(this).find('.request-reclassification').attr('href', 'mailto:kavi@kavi.fi'+q).show()
  })
}

function internalSearchPage() {
  searchPage('/programs/search/')

  var $page = $('#search-page')
  var $results = $page.find('.results')
  var $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  var $newClassificationButton = $page.find('.new-classification button')

  var programTypesSelect2 = {
    data: [
      {id: 1, text: 'Elokuva'},
      {id: 3, text: 'TV-sarjan jakso'},
      {id: 4, text: 'Muu TV-ohjelma'},
      {id: 5, text: 'Extra'},
      {id: 6, text: 'Trailer'},
      {id: 7, text: 'Peli'}
    ]
  }

  $newClassificationType.select2(programTypesSelect2).select2('val', 1)

  $page.on('showDetails', '.program-box', function(e, program) {
    toggleDetailButtons($(this), program)
  })

  $newClassificationButton.click(function () {
    var programType = $newClassificationType.select2('val')
    $.post('/programs/new', JSON.stringify({ programType: programType })).done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.reclassify', function(e) {
    var id = $(this).parents('.program-box').data('id')
    $.post('/programs/' + id + '/reclassification').done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.continue-classification', function(e) {
    var id = $(this).parents('.program-box').data('id')
    showClassificationPage(id)
  })

  $results.on('click', 'button.categorize', function(e) {
    showCategorizationForm($(this).parents('.program-box').data('id'))
  })


  function toggleDetailButtons($detail, p) {
    if (enums.util.isUnknown(p) && hasRole('kavi')) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.categorize').show()
    } else if (enums.util.isTvSeriesName(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.categorize').hide()
    } else if (p.draftClassifications && p.draftClassifications[user._id]) {
      $detail.find('button.continue-classification').show()
      $detail.find('button.reclassify').hide()
      $detail.find('button.categorize').hide()
    } else {
      var head = p.classifications[0]
      var canReclassify = (!head || head.authorOrganization !== 3) && (hasRole('kavi') || !head || (head.status != 'registered'))
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(!!canReclassify)
      $detail.find('button.categorize').hide()
    }
  }

  function showClassificationPage(programId) {
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', programId).show()
  }

  function isTvEpisode(value) {
    return value == 3
  }

  function showCategorizationForm(id) {
    var $categorySelectForm = $page.find('.categorization-form input[name=category-select]')
    var $categorySaveButton = $page.find('.categorization-form .save-category')

    $categorySelectForm.select2(programTypesSelect2).select2('val', 1)

    $('.categorization-form').show()
    $categorySelectForm.change(function() {
      var value = $categorySelectForm.select2('val')

      $categorySaveButton.prop('disabled', isTvEpisode(value))

      if (isTvEpisode(value)) {
        $('.categorization-form-tv-episode').show()
        } else {
        $('.categorization-form-tv-episode').hide()
      }
    })

    $categorySaveButton.click(function() {
      var programType = $categorySelectForm.select2('val')
      $.post('/programs/' + id + '/categorization', JSON.stringify({programType: programType}))
        .done(function(program) {
          toggleDetailButtons($('.program-box'), program)
          $('.categorization-form').hide()
        })
    })
  }
}

function searchPage(baseUrl) {
  var $page = $('#search-page').html($('#templates .search-page').clone())
  var $input = $page.find('.query')
  var $button = $page.find('button.search')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')

  var detailRenderer = programBox()
  var state = { q:'', page: 0 }

  $page.on('show', function(e, q, filters, programId) {
    if (q) $input.val(q).trigger('reset')
    setFilters(filters)
    queryChanged($input.val().trim())
    loadUntil(programId, function() { $input.focus() })
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

  $results.on('click', '.result', function() {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  function queryChanged(q) {
    state = { q:q, page: 0 }
    $noResults.add($noMoreResults).hide()
  }

  function loadUntil(selectedProgramId, callback) {
    load(function() {
      if (!selectedProgramId) {
        updateLocationHash()
        return callback()
      }
      var $selected = $results.find('.result[data-id='+selectedProgramId+']')
      if ($selected.length > 0) {
        openDetail($selected, false)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      } else if (state.page < 20) {
        state.page++
        loadUntil(selectedProgramId, callback)
      }
    })
  }

  function load(callback) {
    $loading.show()
    var url = baseUrl+encodeURIComponent(state.q)
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
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
    $details.trigger('showDetails', p)
  }

  function closeDetail() {
    $results.find('.result.selected').removeClass('selected')
    $results.find('.program-box').slideUp(function() { $(this).remove() }).end()
  }

  function updateLocationHash(selectedProgramId) {
    var filters = $filters.filter(':checked').map(function() { return $(this).data('id') }).toArray().join('')
    location.hash = '#haku/' + encodeURIComponent(state.q) + '/' + filters + '/' + (selectedProgramId || '')
  }

  function render(p, query) {
    var c = classification.mostValid(p.classifications)
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

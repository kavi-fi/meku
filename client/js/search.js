function publicSearchPage() {
  searchPage('/public/search/')

  var $page = $('#search-page')
  $page.find('.new-classification').remove()
  $page.find('.drafts').remove()
  $page.find('.recent').remove()

  $page.on('showDetails', '.program-box', function(e, program) {
    var body = encodeURIComponent('Ohjelma: '+program.name[0]+ ' [id:'+program._id+']')
    var subject = encodeURIComponent('Kuvaohjelman uudelleenluokittelupyyntö')
    var q = '?subject='+subject+'&body='+body
    $(this).find('.request-reclassification').attr('href', 'mailto:kavi@kavi.fi'+q).show()
  })
}

function internalSearchPage() {
  var searchPageApi = searchPage('/programs/search/')

  var $page = $('#search-page')
  var $results = $page.find('.results').add($page.find('.recent'))
  var $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  var $newClassificationButton = $page.find('.new-classification button')
  var $drafts = $page.find('.drafts')
  var $recent = $page.find('.recent')
  var detailRenderer = programBox()

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

  $page.on('show', function(e, q, filters, programId) {
    loadDrafts()
    loadRecent()
  })

  $page.find('.recent').on('click', '.result', function() {
    var $box = $page.find('.recent').find('.program-box')
    if ($box.length > 0) {
      $box.slideUp(function() { $(this).remove() })
    } else {
      var $result = $(this)
      $.get('/programs/' + $(this).data('id')).done(function (p) {
        var $details = detailRenderer.render(p)
        $result.after($details)
        toggleDetailButtons($details, p)
        $details.slideDown()
      })
    }
  })

  $drafts.on('click', '.draft', function() {
    showClassificationPage($(this).data('id'))
  })

  $drafts.on('click', '.draft button', function(e) {
    e.stopPropagation()
    var $draft = $(this).parents('.draft')
    $.ajax({url: '/programs/drafts/' + $draft.data('id'), type: 'delete'}).done(function(p) {
      var programId = $draft.data('id')
      $draft.remove()
      $drafts.toggleClass('hide', $drafts.find('.draft').length === 0)
      var $box = $page.find('.result[data-id=' + programId + '] + .program-box')
      toggleDetailButtons($box, p)
      $box.find('.drafts div[data-userId=' + user._id + ']').remove()
    })
  })

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
    $(this).hide()
  })

  function loadDrafts() {
    $drafts.find('.draft').remove()
    $.get('/programs/drafts', function(drafts) {
      drafts.forEach(function(draft) {
        var $date = $('<span>', {class: 'creationDate'}).text(utils.asDate(draft.creationDate))
        var $link = $('<span>', {class: 'name'}).text(draft.name)
        var $remove = $('<div>', {class: 'remove'}).append($('<button>').text('Poista'))
        var $draft = $('<div>', {class: 'result draft'})
          .data('id', draft._id).append($date).append($link).append($remove)
        $drafts.find('> div').append($draft)
      })
      $drafts.toggleClass('hide', drafts.length === 0)
    })
  }

  function loadRecent() {
    $recent.find('.result').remove()
    $recent.find('.program-box').remove()
    $.get('/programs/recent', function(recents) {
      recents.forEach(function(p) {
        var $result = $('<div>').addClass('result').data('id', p._id)
          .append($('<span>', { class: 'registrationDate' }).text(utils.asDate(p.classifications[0].registrationDate)))
          .append($('<span>', { class: 'name' }).text(p.name[0]))
          .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': duration(p)))
          .append($('<span>', { class: 'program-type' }).html(enums.programType[p.programType].fi))
          .append($('<span>', { class: 'classification'}).append(renderWarningSummary(classification.fullSummary(p)) || ' - '))
        $recent.append($result)
      })
    })
  }

  function toggleDetailButtons($detail, p) {
    if (enums.util.isUnknown(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.categorize').toggle(hasRole('kavi'))
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
      var canReclassify = (!head || !enums.isKHO(head.authorOrganization)) && (hasRole('kavi') || !head || (head.status != 'registered'))
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(!!canReclassify)
      $detail.find('button.categorize').hide()
    }
  }

  function showClassificationPage(programId) {
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', programId).show()
  }

  function showCategorizationForm(id) {
    var $categorizationForm = $page.find('.categorization-form')
    var $categorySelection = $categorizationForm.find('input[name=category-select]')
    var $categorySaveButton = $categorizationForm.find('.save-category')

    var $tvEpisodeForm = $categorizationForm.find('.categorization-form-tv-episode')
    var $episode = $tvEpisodeForm.find('input[name=episode]')
    var $season = $tvEpisodeForm.find('input[name=season]')
    var $series = $tvEpisodeForm.find('input[name=series]')

    select2Autocomplete({
      $el: $series,
      path: '/series/search/',
      toOption: idNamePairToSelect2Option,
      fromOption: select2OptionToIdNamePair,
      allowAdding: true
    })

    $categorySelection.select2(programTypesSelect2).select2('val', 1)

    var isTvEpisode = function() {
      return enums.util.isTvEpisode({ programType: $categorySelection.select2('val') })
    }

    $categorizationForm.on('select2-blur', function(e) { $(e.target).addClass('touched') })

    $categorizationForm.show()
    validateTextChange($categorizationForm.find('input.required'), isNotEmpty)

    $categorizationForm.on('validation input', function(e) {
      var required = $categorizationForm.find('.required.invalid, input:invalid')
        .not('.select2-container')
        .filter(function() {
          var $this = $(this)
          // Filter hidden elements, but select the hidden offscreen input if its select2 container is visible
          if ($this.is('.select2-offscreen')) {
            return $($this.select2('container')).is(':visible')
          }
          return $this.is(':visible')
        })
      $categorySaveButton.prop('disabled', required.length > 0)
    })

    $categorySelection.change(function() {
      $tvEpisodeForm.toggleClass('hide', !isTvEpisode()).find('input').trigger('validate')
    })

    $categorySaveButton.click(function() {
      var categoryData = { programType: $categorySelection.select2('val') }

      if (isTvEpisode()) {
        var series = select2OptionToIdNamePair($series.select2('data'))
        categoryData.series = series
        categoryData.episode = $episode.val()
        categoryData.season = $season.val()
      }

      $.post('/programs/' + id + '/categorization', JSON.stringify(categoryData))
        .done(function(program) {
          toggleDetailButtons($('.program-box'), program)
          $categorizationForm.hide()
          $results.find('.selected .program-type').text(enums.programType[program.programType].fi)
          var $row = $results.find('.result[data-id=' + program._id + ']').data('program', program)
          searchPageApi.programDataUpdated($row)
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

  return { programDataUpdated: programDataUpdated }

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

  function programDataUpdated($row) {
    var $newRow = render($row.data('program'), state.q)
    $row.replaceWith($newRow)
    openDetail($newRow, false)
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
    var queryParts = (query || '').trim().toLowerCase().split(/\s+/)
    return $('<div>', { class:'result', 'data-id': p._id }).data('program', p).append(series(p)).append(row(p))

    function series(p) {
      if (!enums.util.isTvEpisode(p)) return undefined
      return $('<div>').addClass('series')
        .text(_.compact([p.series && p.series.name, utils.seasonEpisodeCode(p)]).join(' '))
        .highlight(queryParts, { beginningsOnly: true, caseSensitive: false })
    }

    function row(p) {
      return $('<div>').addClass('items')
        .append($('<span>', { class: 'name' }).text(p.name[0]).highlight(queryParts, { beginningsOnly: true, caseSensitive: false }))
        .append($('<span>', { class: 'country-and-year' }).text(countryAndYear(p)))
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': duration(p)))
        .append($('<span>', { class: 'program-type' }).html(enums.util.isUnknown(p) ? '<i class="icon-warning-sign"></i>' : enums.programType[p.programType].fi))
        .append($('<span>').append(renderWarningSummary(classification.fullSummary(p)) || ' - '))
    }


  }
}
    function countryAndYear(p) {
      var s = _([enums.util.toCountryString(p.country), p.year]).compact().join(', ')
      return s == '' ? s : '('+s+')'
    }
    function duration(p) {
      var c = p.classifications[0]
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

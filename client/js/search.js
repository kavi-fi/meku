function publicSearchPage() {
  searchPage()

  var $page = $('#search-page')
  $page.find('.new-classification').remove()
  $page.find('.drafts').remove()
  $page.find('.recent').remove()

  $page.on('showDetails', '.program-box', function(e, program) {
    var body = encodeURIComponent('Ohjelma: '+program.name[0]+ ' [id:'+program.sequenceId+']')
    var subject = encodeURIComponent('Kuvaohjelman uudelleenluokittelupyyntö')
    var q = '?subject='+subject+'&body='+body
    $(this).find('.request-reclassification').attr('href', 'mailto:kavi@kavi.fi'+q).show()
  })
}

function internalSearchPage() {
  var searchPageApi = searchPage()

  var $page = $('#search-page')
  var $results = $page.find('.results').add($page.find('.recent'))
  var $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  var $newClassificationButton = $page.find('.new-classification button')
  var $drafts = $page.find('.drafts')
  var $recent = $page.find('.recent')

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

  $drafts.on('click', '.draft', function() {
    showClassificationPage($(this).data('id'))
  })

  $drafts.on('click', '.draft button', function(e) {
    e.stopPropagation()
    var $draft = $(this).parents('.draft')
    $.ajax({url: '/programs/drafts/' + $draft.data('id'), type: 'delete'}).done(function(p) {
      $draft.remove()
      $drafts.toggleClass('hide', $drafts.find('.draft').length === 0)
      p.deleted ? searchPageApi.programDeleted(p) : searchPageApi.programDataUpdated(p)
    })
  })

  $page.on('showDetails', '.program-box', function(e, program) {
    e.stopPropagation()
    toggleDetailButtons($(this), program)
  })

  $newClassificationButton.click(function () {
    var programType = $newClassificationType.select2('val')
    $.post('/programs/new', JSON.stringify({ programType: programType })).done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.reclassify', function(e) {
    var id = $(this).closest('.program-box').data('id')
    $.post('/programs/' + id + '/reclassification').done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.continue-classification', function(e) {
    var id = $(this).closest('.program-box').data('id')
    showClassificationPage(id)
  })

  $results.on('click', 'button.categorize', function(e) {
    showCategorizationForm($(this).closest('.program-box'))
    $(this).hide()
  })

  $results.on('click', 'button.edit', function() {
    var $programBox = $(this).closest('.program-box')
    showClassificationEditPage($programBox.data('id'), $programBox.find('.classification.selected').data('id'))
  })

  $results.on('click', 'button.remove', function() {
    var $programBox = $(this).closest('.program-box')
    var $row = $programBox.prev('.result')
    var program = $row.data('program')
    showDialog($('#templates').find('.remove-program-dialog').clone()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').click(removeProgram).end()
      .find('button[name=cancel]').click(closeDialog).end())

    function removeProgram() {
      $.ajax('/programs/' + program._id, { type: 'delete' }).done(function() {
        closeDialog()
        $programBox.slideUp(function() { $(this).remove() })
        $row.slideUp(function() {
          if (!_.isEmpty($(this).parents('.recent'))) { loadRecent() }
          if (!_.isEmpty($(this).parents('.episodes'))) {
            var $parentRow = $row.closest('.program-box').prev('.result')
            $.get('/programs/' + $parentRow.data('id')).done(searchPageApi.programDataUpdated)
          }
          $(this).remove()
        })
      })
    }
  })

  function loadDrafts() {
    $drafts.find('.draft').remove()
    $.get('/programs/drafts', function(drafts) {
      drafts.forEach(function(draft) {
        var $date = $('<span>', {class: 'creationDate'}).text(utils.asDateTime(draft.creationDate))
        var $link = $('<span>', {class: 'name'}).text(draft.name)
        var $remove = $('<div>', {class: 'remove'}).append($('<button>', { class: 'button' }).text('Poista'))
        var $draft = $('<div>', {class: 'result draft'})
          .data('id', draft._id).append($date).append($link).append($remove)
        $drafts.find('> div').append($draft)
      })
      $drafts.toggleClass('hide', drafts.length === 0)
    })
  }

  function loadRecent() {
    $recent.hide()
    $recent.find('.result').remove()
    $recent.find('.program-box').remove()
    $.get('/programs/recent', function(recents) {
      recents.forEach(function(p) {
        var $result = $('<div>').addClass('result').data('id', p._id).data('program', p)
          .append($('<span>', { class: 'registrationDate' }).text(utils.asDateTime(p.classifications[0].registrationDate)))
          .append($('<span>', { class: 'name' }).text(p.name[0]))
          .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.programDurationAsText(p)))
          .append($('<span>', { class: 'program-type' }).text(enums.util.programTypeName(p.programType)))
          .append($('<span>', { class: 'classification'}).append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
        $recent.show().append($result)
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
    } else if (p.classifications.length == 0) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(hasRole('kavi'))
      $detail.find('button.categorize').hide()
    } else {
      var head = p.classifications[0]
      var canReclassify = !enums.isKHO(head.authorOrganization) && (hasRole('kavi') || (head.status != 'registered'))
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(!!canReclassify)
      $detail.find('button.categorize').hide()
    }
    $detail.find('button.edit').toggle(hasRole('root'))
    $detail.find('button.remove').toggle(hasRole('root') && (!enums.util.isTvSeriesName(p) || p.episodes.count == 0))
  }

  function showClassificationPage(programId) {
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', programId).show()
  }

  function showClassificationEditPage(programId, classificationId) {
    $('body').children('.page').hide()
    $('#classification-page').trigger('show', [programId, 'edit', classificationId]).show()
  }

  function showCategorizationForm($programBox) {
    var id = $programBox.data('id')
    var $categorizationForm = $programBox.find('.categorization-form')
    var $categorySelection = $categorizationForm.find('input[name=category-select]')
    var $categorySaveButton = $categorizationForm.find('.save-category')

    var $tvEpisodeForm = $categorizationForm.find('.categorization-form-tv-episode')
    var $episode = $tvEpisodeForm.find('input[name=episode]')
    var $season = $tvEpisodeForm.find('input[name=season]')
    var $series = $tvEpisodeForm.find('input[name=series]')
    var $newSeriesForm = $categorizationForm.find('.categorization-form-tv-new-series')

    select2Autocomplete({
      $el: $series,
      path: function(term) { return '/series/search?q=' + encodeURIComponent(term) },
      toOption: idNamePairToSelect2Option,
      fromOption: select2OptionToIdNamePair,
      allowAdding: true,
      termMinLength: 0
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

    $series.change(function() {
      var data = $(this).select2('data')
      if (!data) return
      var $inputs = $newSeriesForm.find('input')
      if (data.isNew) {
        $newSeriesForm.find('input[name="series.draft.name"]').val(data.text)
        $newSeriesForm.slideDown()
        $inputs.trigger('validate')
      } else {
        $inputs.val('').removeClass('touched')
        $newSeriesForm.slideUp(function() { $inputs.trigger('validate') })
      }
    })

    $newSeriesForm.find('input[name="series.draft.name"]').on('input', function() {
      var val = $(this).val()
      $series.select2('data', { id: val, text: val, isNew: true })
    })

    $categorySaveButton.click(function() {
      var categoryData = { programType: $categorySelection.select2('val') }

      if (isTvEpisode()) {
        var seriesData = $series.select2('data')
        var series = select2OptionToIdNamePair(seriesData)
        categoryData.series = series
        categoryData.episode = $episode.val()
        categoryData.season = $season.val() == '' ? undefined : $season.val()
        if (seriesData.isNew) {
          categoryData.series.draft = {
            name: $newSeriesForm.find('input[name="series.draft.name"]').val(),
            nameFi: $newSeriesForm.find('input[name="series.draft.nameFi"]').val(),
            nameSv: $newSeriesForm.find('input[name="series.draft.nameSv"]').val(),
            nameOther: $newSeriesForm.find('input[name="series.draft.nameOther"]').val()
          }
        }
      }

      $.post('/programs/' + id + '/categorization', JSON.stringify(categoryData)).done(function(program) {
        searchPageApi.programDataUpdated(program)
      })
    })
  }
}

function searchPage() {
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
    loadUntil(programId, function() {
      if ($('#login').is(':hidden')) $input.focus()
    })
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

  $page.on('click', '.results .result, .recent .result', function() {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  return { programDataUpdated: programDataUpdated, programDeleted: programDeleted }

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
    var url = '/programs/search/'+encodeURIComponent(state.q)
    var data = $.param({ page: state.page, filters: currentFilters() })
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

  function programDataUpdated(program) {
    var $row = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($row)) return
    var $newRow = render(program, state.q)
    $row.next('.program-box').remove()
    $row.replaceWith($newRow)
    if ($row.is('.selected')) {
      openDetail($newRow, false)
    }
  }

  function programDeleted(program) {
    var $row = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($row)) return
    $row.next('.program-box').add($row).slideUp(function() { $(this).remove() })
  }

  function openDetail($row, animate) {
    var p = $row.data('program')
    updateLocationHash(p._id)
    var $details = detailRenderer.render(p)
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
    $details.trigger('showDetails', p)

    if (hasRole('root')) $details.append(changeLog(p).render())
  }

  function closeDetail() {
    $page.find('.result.selected').removeClass('selected')
    $page.find('.program-box').slideUp(function() { $(this).remove() }).end()
  }

  function updateLocationHash(selectedProgramId) {
    var filters = $filters.filter(':checked').map(function() { return $(this).data('id') }).toArray().join('')
    setLocation('#haku/' + encodeURIComponent(state.q) + '/' + filters + '/' + (selectedProgramId || ''))
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
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.programDurationAsText(p)))
        .append($('<span>', { class: 'program-type' }).html(enums.util.isUnknown(p) ? '<i class="fa fa-warning"></i>' : enums.util.programTypeName(p.programType)))
        .append($('<span>').append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
    }
  }

  function countryAndYear(p) {
    var s = _([enums.util.toCountryString(p.country), p.year]).compact().join(', ')
    return s == '' ? s : '('+s+')'
  }

}

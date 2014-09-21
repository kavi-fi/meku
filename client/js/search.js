function publicSearchPage() {
  searchPage()

  var $page = $('#search-page')
  $page.find('.new-classification').remove()
  $page.find('.drafts').remove()
  $page.find('.recent').remove()
  $page.find('.kavi-query-filters').remove()
  $page.find('.user-query-filters').remove()
  $page.find('.controls h2.main').remove()

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
    $(this).prop('disabled', true)
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

  $newClassificationButton.click(function() {
    $newClassificationButton.prop('disabled', true)
    var programType = $newClassificationType.select2('val')
    $.post('/programs/new', JSON.stringify({ programType: programType })).done(function(program) {
      showClassificationPage(program._id)
      $newClassificationButton.prop('disabled', false)
    })
  })

  $results.on('click', 'button.reclassify', function() {
    $(this).prop('disabled', true)
    var id = $(this).closest('.program-box').data('id')
    $.post('/programs/' + id + '/reclassification').done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.continue-classification', function() {
    $(this).prop('disabled', true)
    var id = $(this).closest('.program-box').data('id')
    showClassificationPage(id)
  })

  $results.on('click', 'button.categorize', function() {
    $(this).prop('disabled', true)
    showCategorizationForm($(this).closest('.program-box'))
  })

  $results.on('click', 'button.recategorize', function() {
    $(this).prop('disabled', true)
    showCategorizationForm($(this).closest('.program-box'))
  })

  $results.on('click', 'button.edit', function() {
    $(this).prop('disabled', true)
    var $programBox = $(this).closest('.program-box')
    showClassificationEditPage($programBox.data('id'), $programBox.find('.classification.selected').data('id'))
  })

  $results.on('click', 'button.remove', function() {
    var $programBox = $(this).closest('.program-box')
    var $row = $programBox.prev('.result')
    var program = $row.data('program')
    showDialog($('#templates').find('.remove-program-dialog').clone()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').one('click', removeProgram).end()
      .find('button[name=cancel]').one('click', closeDialog).end())

    function removeProgram() {
      $.ajax('/programs/' + program._id, { type: 'delete' }).done(function() {
        closeDialog()
        searchPageApi.programDeleted(program, function() {
          loadDrafts()
          loadRecent()
        })
      })
    }
  })

  $results.on('click', 'button.remove-classification', function() {
    var $programBox = $(this).closest('.program-box')
    var $row = $programBox.prev('.result')
    var program = $row.data('program')
    var classification = $programBox.find('.classification.selected').data('classification')
    var registrationDate = utils.asDate(classification.registrationDate) || 'Tuntematon rekisteröintiaika'
    showDialog($('#templates').find('.remove-classification-dialog').clone()
      .find('.registration-date').text(registrationDate).end()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').one('click', removeClassification).end()
      .find('button[name=cancel]').one('click', closeDialog).end())

    function removeClassification() {
      $.ajax('/programs/' + program._id +'/classification/' + classification._id, { type: 'delete' }).done(function(program) {
        closeDialog()
        searchPageApi.programDataUpdated(program)
      })
    }
  })

  function loadDrafts() {
    $.get('/programs/drafts', function(drafts) {
      $drafts.find('.draft').remove()
      drafts.forEach(function(draft) {
        var $date = $('<span>', {class: 'creationDate'}).text(utils.asDateTime(draft.creationDate))
        var $link = $('<span>', {class: 'name'}).text(draft.name)
        var $remove = $('<div>', {class: 'remove'}).append($('<button>', { class: 'button' }).text('Poista'))
        var $draft = $('<div>', {class: 'result draft'}).data('id', draft._id).append($date).append($link).append($remove)
        $drafts.find('> div').append($draft)
      })
      $drafts.toggleClass('hide', drafts.length === 0)
    })
  }

  function loadRecent() {
    $recent.find('.program-box').remove()
    $.get('/programs/recent', function(recents) {
      $recent.hide()
      $recent.find('.result').remove()
      recents.forEach(function(p) {
        var $result = renderRecentRow(p)
        $recent.show().append($result)
      })
    })

    function renderRecentRow(p) {
      return $('<div>', { 'data-id': p._id }).addClass('result').data('program', p)
        .append($('<span>', { class: 'registrationDate' }).text(utils.asDateTime(p.classifications[0].registrationDate)))
        .append($('<span>', { class: 'name' }).text(p.name[0]))
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.programDurationAsText(p)))
        .append($('<span>', { class: 'program-type' }).text(enums.util.programTypeName(p.programType)))
        .append($('<span>', { class: 'classification'}).append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
        .data('renderer', renderRecentRow)
    }
  }

  function toggleDetailButtons($detail, p) {
    if (enums.util.isUnknown(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.recategorize').hide()
    } else if (enums.util.isTvSeriesName(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.recategorize').hide()
    } else if (p.draftClassifications && p.draftClassifications[user._id]) {
      $detail.find('button.continue-classification').show()
      $detail.find('button.reclassify').hide()
      $detail.find('button.recategorize').hide()
    } else if (p.classifications.length == 0) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(hasRole('kavi'))
      $detail.find('button.recategorize').toggle(hasRole('kavi'))
    } else {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(classificationUtils.canReclassify(p, user))
      $detail.find('button.recategorize').toggle(hasRole('kavi'))
    }
    $detail.find('button.categorize').toggle(enums.util.isUnknown(p))

    $detail.find('button.edit').toggle(hasRole('root'))
    $detail.find('button.remove').toggle(hasRole('root') && (!enums.util.isTvSeriesName(p) || p.episodes.count == 0))
    $detail.find('button.remove-classification').toggle(hasRole('root'))

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
    var program = $programBox.prev('.result').data('program')
    var $categorizationForm = $programBox.find('.categorization-form')
    var $categorySelection = $categorizationForm.find('input[name=category-select]')
    var $categorySaveButton = $categorizationForm.find('.save-category')

    var $tvEpisodeForm = $categorizationForm.find('.categorization-form-tv-episode')
    var $episode = $tvEpisodeForm.find('input[name=episode]')
    var $season = $tvEpisodeForm.find('input[name=season]')
    var $series = $tvEpisodeForm.find('input[name=series]')
    var $newSeriesForm = $categorizationForm.find('.categorization-form-tv-new-series')

    $categorySelection.select2(programTypesSelect2).select2('val', 1)
    $categorySelection.change(function() {
      $tvEpisodeForm.toggleClass('hide', !isTvEpisode()).find('input').trigger('validate')
    })

    select2Autocomplete({
      $el: $series,
      path: function(term) { return '/series/search?q=' + encodeURIComponent(term) },
      toOption: idNamePairToSelect2Option,
      fromOption: select2OptionToIdNamePair,
      allowAdding: true,
      termMinLength: 0
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

    $categorizationForm.on('select2-blur', function(e) { $(e.target).addClass('touched') })

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

    $categorizationForm.show()

    if (enums.util.isDefinedProgramType(program.programType)) {
      $categorySelection.select2('val', program.programType).trigger('change')
      $series.select2('data', idNamePairToSelect2Option(program.series)).trigger('validate')
      $season.val(program.season).trigger('validate')
      $episode.val(program.episode).trigger('validate')
    }

    $categorySaveButton.click(function() {
      $categorySaveButton.prop('disabled', true)
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
      $.post('/programs/' + program._id + '/categorization', JSON.stringify(categoryData)).done(function(newProgram) {
        var oldProgram = program
        var oldSeriesId = utils.getProperty(oldProgram, 'series._id')
        var newSeriesId = utils.getProperty(newProgram, 'series._id')
        if (oldSeriesId && oldSeriesId != newSeriesId) searchPageApi.updateProgramIfVisible(oldSeriesId)
        searchPageApi.programDataUpdated(newProgram)
      })
    })

    function isTvEpisode() {
      return enums.util.isTvEpisode({ programType: $categorySelection.select2('val') })
    }

  }
}

function searchPage() {
  var $page = $('#search-page').html($('#templates .search-page').clone())
  var $input = $page.find('.query')
  var $button = $page.find('button.search')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $registrationDatePicker = $page.find('.kavi-query-filters .datepicker')
  var $clearRegistrationDatePicker = $page.find('.kavi-query-filters .clear-date-picker')
  var $classifier = $page.find('.kavi-query-filters input[name=classifier]')
  var $reclassifiedToggle = $page.find('.kavi-query-filters input[name=reclassified]')
  var $ownClassificationsOnly = $page.find('.user-query-filters input[name=own-classifications-only]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')

  var detailRenderer = programBox()
  var state = { q:'', page: 0 }
  var dateFormat = 'DD.MM.YYYY'

  setupKaviFilters()

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
  $ownClassificationsOnly.on('change', function() { $input.trigger('fire') })

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

  return { programDataUpdated: programDataUpdated, programDeleted: programDeleted, updateProgramIfVisible: updateProgramIfVisible }

  function queryChanged(q) {
    state = { q:q, page: 0 }
    $noResults.add($noMoreResults).hide()
  }

  function setupKaviFilters() {
    if (!hasRole('kavi')) {
      $page.find('.kavi-query-filters').remove()
      return
    }

    $page.find('.user-query-filters').remove()

    select2Autocomplete({
      $el: $classifier,
      path: function(term) { return '/users/search?q=' + encodeURIComponent(term) },
      toOption: userToSelect2Option,
      fromOption: select2OptionToUser,
      termMinLength: 0,
      allowClear: true,
      formatSelection: function(user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
      formatResultCssClass: function(user) { return user.active ? '' : 'grey' }
    }, function() {
      var isEmpty = !currentClassifier()
      $reclassifiedToggle.prop('disabled', isEmpty).parent().toggleClass('grey', isEmpty)
      if (isEmpty) $reclassifiedToggle.prop('checked', false)
      $input.trigger('fire')
    })

    var datePickerOpts = {
      shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['week', 'month']},
      getValue: function() { return $registrationDatePicker.find('span').text() },
      setValue: function(s) {
        $clearRegistrationDatePicker.toggle(!!s)
        $registrationDatePicker.find('span').text(s)
      }
    }
    setupDatePicker($registrationDatePicker, datePickerOpts, function() {
      $input.trigger('fire')
    })

    $clearRegistrationDatePicker.click(function(e) {
      e.stopPropagation()
      $registrationDatePicker.removeData('selection')
      $registrationDatePicker.data('dateRangePicker').clear()
      $input.trigger('fire')
    })

    $reclassifiedToggle.change(function() {
      $input.trigger('fire')
    })

    $page.find('.kavi-query-filters .filterbutton').click(function() {
      $(this).toggleClass('active')
      $input.trigger('fire')
    })
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
    if (state.page == 0) $results.empty()
    var url = '/programs/search/'+encodeURIComponent(state.q)
    var data = $.param({
      page: state.page,
      filters: currentFilters(),
      classifier: currentClassifier(),
      registrationDateRange: currentRegistrationDateRange(),
      reclassified: $reclassifiedToggle.prop('checked'),
      agelimits: currentAgelimits(),
      warnings: currentWarnings(),
      ownClassificationsOnly: $ownClassificationsOnly.is(':checked')
    })
    state.jqXHR = $.get(url, data).done(function(data, status, jqXHR) {
      if (state.jqXHR != jqXHR) return
      var results = data.programs
      if (data.count != undefined) $page.find('.program-count .num').text(data.count)
      $noResults.toggle(state.page == 0 && results.length == 0)
      $noMoreResults.toggle((state.page > 0 || results.length > 0) && results.length < 100)
      $results.append(results.map(function(p) { return render(p, state.q) }))
      $loading.hide()
      if (callback) callback()
    })
  }

  function currentFilters() {
    return $filters.filter(':checked').map(function() { return $(this).data('type') }).toArray()
  }

  function setFilters(filterString) {
    $filters.each(function() {
      $(this).prop('checked', filterString && filterString.indexOf($(this).data('id')) >= 0)
    })
  }

  function currentClassifier() {
    var data = $classifier.select2 && $classifier.select2('data') || undefined
    return data && data.id || undefined
  }
  function currentRegistrationDateRange() {
    return $registrationDatePicker.data('selection')
  }
  function currentAgelimits() {
    return $page.find('.kavi-query-filters .agelimit-filter.active').map(function() { return $(this).data('id') }).toArray()
  }
  function currentWarnings() {
    return $page.find('.kavi-query-filters .warning-filter.active').map(function() { return $(this).data('id') }).toArray()
  }

  function updateProgramIfVisible(programId) {
    var $rows = $page.find('.result[data-id=' + programId + ']')
    if (_.isEmpty($rows)) return
    $.get('/programs/'+programId).done(programDataUpdated)
  }

  function programDataUpdated(program) {
    var seriesId = utils.getProperty(program, 'series._id')
    if (seriesId) updateProgramIfVisible(seriesId)
    var $rows = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($rows)) return
    var episodesAreOpen = $rows.next('.program-box').find('.episode-container > h3').hasClass('open')
    if (episodesAreOpen) {
      $.get('/episodes/'+ program._id).done(updateUI)
    } else {
      updateUI()
    }

    function updateUI(episodes) {
      $rows.each(function() {
        var $row = $(this)
        var customRenderer = $row.data('renderer')
        var $newRow = customRenderer ? customRenderer(program) : render(program, state.q)
        $row.next('.program-box').remove()
        $row.replaceWith($newRow)
        if ($row.is('.selected')) {
          openDetail($newRow, false, episodes)
        }
      })
    }
  }

  function programDeleted(program, callback) {
    if (!callback) callback = function() {}
    updateLocationHash()
    if (program.series && program.series._id) updateProgramIfVisible(program.series._id)
    var $rows = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($rows)) return callback()
    var $remove = $rows.next('.program-box').add($rows).slideUp()
    $remove.promise().done(function() {
      $remove.remove()
      callback()
    })
  }

  function openDetail($row, animate, preloadedEpisodes) {
    var p = $row.data('program')
    updateLocationHash(p._id)
    var $details = detailRenderer.render(p, preloadedEpisodes)
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
    var showRegistrationDate = !!window.user
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
        .append($('<span>', { class: 'country-year-date' }).text(countryAndYearAndDate(p)))
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.programDurationAsText(p)))
        .append($('<span>', { class: 'program-type' }).html(enums.util.isUnknown(p) ? '<i class="fa fa-warning"></i>' : enums.util.programTypeName(p.programType)))
        .append($('<span>').append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
    }

    function countryAndYearAndDate(p) {
      var s = _([registrationDate(p), enums.util.toCountryString(p.country), p.year]).compact().join(', ')
      return s == '' ? s : '('+s+')'
    }

    function registrationDate(p) {
      if (!showRegistrationDate) return undefined
      var date = utils.getProperty(p, 'classifications.0.registrationDate')
      return date ? moment(date).format('D.M.YYYY') : undefined
    }
  }
}

function publicSearchPage() {
  searchPage()

  var $page = $('#search-page')
  $page.find('.new-classification').remove()
  $page.find('.drafts').remove()
  $page.find('.recent').remove()
  $page.find('.kavi-query-filters').remove()
  $page.find('.user-query-filters').remove()
  $page.find('.controls h2.main').remove()
  setAgelimit0IconByLanguage($page)

  $page.on('showDetails', '.program-box', function(e, program) {
    $(this).find('.request-reclassification').on('click', function () { openSurvey(program) })
    $(this).find('.request-reclassification').show()
  })

  function openSurvey(program) {
    sendPageview('/#surveymonkey/' + program._id)
    window.open('https://fi.surveymonkey.com/r/ikarajapalaute')
  }
}

function setAgelimit0IconByLanguage($page) {
  var zeroAge = langCookie() === 'sv' ? 't' : '0'
  $page.find('.agelimit-0').attr('src', 'images/agelimit-'+ zeroAge +'.png')
}

function internalSearchPage() {
  var searchPageApi = searchPage()

  var $page = $('#search-page')
  var $results = $page.find('.results').add($page.find('.recent'))
  var $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  var $newClassificationButton = $page.find('.new-classification button')
  var $drafts = $page.find('.drafts')
  var $recent = $page.find('.recent')
  var $reclassifiedBy = $page.find('.public-query-filters input[name=reclassified-by]')
  setAgelimit0IconByLanguage($page)

  var programTypesSelect2 = {
    data: [
      {id: 1, text: i18nText('Elokuva') },
      {id: 3, text: i18nText('TV-sarjan jakso') },
      {id: 4, text: i18nText('Muu TV-ohjelma') },
      {id: 5, text: i18nText('Extra') },
      {id: 6, text: i18nText('Traileri') },
      {id: 7, text: i18nText('Peli') }
    ]
  }

  var reclassifierBySelect = {
    data: [
      {id: 1, text: i18nText('Kaikki') },
      {id: 2, text: i18nText('Organisaatio') },
      {id: 3, text: i18nText('Henkilö') }
    ]
  }

  $newClassificationType.select2(programTypesSelect2).select2('val', 1)
  $reclassifiedBy.select2(reclassifierBySelect).select2('val', 1)

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

  $results.on('click', 'button.classify', function() {
    $(this).prop('disabled', true)
    var id = $(this).closest('.program-box').data('id')
    $.post('/programs/' + id + '/classification').done(function(program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.copy', function() {
    var id = $(this).closest('.program-box').data('id')
    $.get('/programs/' + id, function (origProgram) {
      var _id = origProgram.classifications.length > 0 && origProgram.classifications[0].buyer ? origProgram.classifications[0].buyer._id : 0
      $.get('/accounts/access/' + _id, function (res) {
        if (res.access) {
          $.post('/programs/new', JSON.stringify({ programType: origProgram.programType, origProgram: origProgram })).done(function (program) {
            showClassificationPage(program._id)
          })
        } else showDialog($('#templates').find('.copy-forbidden-dialog').clone().find('.button').on('click', closeDialog).end())
      })
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
    var registrationDate = utils.asDate(classification.registrationDate) || i18nText('Tuntematon rekisteröintiaika')
    showDialog($('#templates').find('.remove-classification-dialog').clone()
      .find('.registration-date').text(registrationDate).end()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').one('click', removeClassification).end()
      .find('button[name=cancel]').one('click', closeDialog).end())

    function removeClassification() {
      $.ajax('/programs/' + program._id +'/classification/' + classification._id, { type: 'delete' }).done(function(program) {
        closeDialog()
        searchPageApi.updateLocationHash()
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
        var $remove = $('<div>', {class: 'remove'}).append($('<button>', { class: 'button' }).i18nText('Poista'))
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
      recents.forEach(function(program) {
        var classification = _.find(program.classifications, { author: { _id: user._id } })
        var $result = renderRecentRow(program, classification)
        $recent.show().append($result)
      })
    })

    function renderRecentRow(p, c) {
      var registrationDate = utils.asDate(c.registrationDate) || i18nText('Tuntematon rekisteröintiaika')
      return $('<div>', { 'data-id': p._id }).addClass('result').data('program', p)
        .append($('<span>', { class: 'registrationDate' }).text(registrationDate))
        .append($('<span>', { class: 'name' }).text(p.name[0]))
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.durationAsText(c.duration)))
        .append($('<span>', { class: 'program-type' }).i18nText(enums.util.programTypeName(p.programType)))
        .append($('<span>', { class: 'classification'}).append(renderWarningSummary(classificationUtils.summary(c)) || ' - '))
        .data('renderer', rerenderRecentRow)
    }

    function rerenderRecentRow(program) {
      var classification = _.find(program.classifications, { author: { _id: user._id } })
      if (classification) {
        return renderRecentRow(program, classification)
      } else {
        loadRecent()
        return
      }
    }
  }

  function toggleDetailButtons($detail, p) {
    if (enums.util.isUnknown(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(classificationUtils.canReclassify(p, user))
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
      $detail.find('button.reclassify').hide()
      $detail.find('button.classify').toggle(hasRole('kavi'))
      $detail.find('button.recategorize').toggle(hasRole('kavi'))
    } else {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(classificationUtils.canReclassify(p, user))
      $detail.find('button.recategorize').toggle(hasRole('kavi'))
    }
    $detail.find('button.copy').toggle(enums.util.isTvEpisode(p) || enums.util.isTrailer(p))
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
  var $exportbutton = $page.find('button.export')
  var $showDeleted = $page.find('input[type=checkbox].showDeleted')
  var $searchFromSynopsis = $page.find('input[type=checkbox].searchFromSynopsis')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $registrationDatePicker = $page.find('.public-query-filters .datepicker')
  var $clearRegistrationDatePicker = $page.find('.public-query-filters .clear-date-picker')
  var $classifier = $page.find('.kavi-query-filters input[name=classifier]')
  var $director = $page.find('.public-query-filters input[name=director]')
  var $buyer = $page.find('.kavi-query-filters input[name="buyer"]')
  var $reclassifiedToggle = $page.find('.filters input[name=reclassified]')
  var $reclassifiedBy = $page.find('.public-query-filters input[name=reclassified-by]')
  var $ownClassificationsOnly = $page.find('.user-query-filters input[name=own-classifications-only]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')
  var detailRenderer = programBox()
  var state = { q:'', page: 0 }

  setupPublicFilters()
  setupKaviFilters()
  if (!hasRole('root')) $page.find('.root-query-filters').remove()

  $page.on('show', function(e, q, filters, programId) {
    if (q) $input.val(q).trigger('reset')
    setFilters(filters)
    queryChanged($input.val().trim())
    loadUntil(programId, function() {
      if ($results.find('.result').length == 1) {
        openDetail($results.find('.result:first'), false)
      }
      if ($('#login').is(':hidden')) $input.focus()
    })

    $("#search-excel-export-form").find('input[name=_csrf]').val($.cookie('_csrf_token'))

  })

  $button.click(function() { $input.trigger('fire') })
  $exportbutton.on('click', function(){

    var $form = $("#search-excel-export-form")

    var postParams = constructPostDataParams()
    postParams.q = state.q ? state.q : ""
    postParams.user = window.user

    $form.find('input[name=post_data]').val(JSON.stringify(postParams))
    $form.submit()

  })
  
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
    load(function() {
      if ($results.find('.result').length == 1) {
        openDetail($results.find('.result:first'), false)
      }
    })
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

  $page.on('click', '.results .program-box a.series', function() {
    setLocation($(this).attr('href'))
    var sequenceId = parseLocationHash()
    $page.trigger('show', sequenceId[1]).show()
  })

  return { programDataUpdated: programDataUpdated, programDeleted: programDeleted,
           updateProgramIfVisible: updateProgramIfVisible, updateLocationHash: updateLocationHash }

  function queryChanged(q) {
    state = { q:q, page: 0 }
    $noResults.add($noMoreResults).hide()
  }

  function setupPublicFilters() {
    var datePickerOpts = {
      shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['week', 'month']},
      customShortcuts: yearShortcuts(),
      getValue: function() { return $registrationDatePicker.find('span').text() },
      setValue: function(s) {
        $clearRegistrationDatePicker.toggle(!!s)
        $registrationDatePicker.find('span').text(s)
      }
    }

    $page.find('.filterbutton').click(function() {
      $(this).toggleClass('active')
      $input.trigger('fire')
    })
    select2Autocomplete({
      $el: $director,
      path: function(term) { return '/directors/search?q=' + encodeURIComponent(term) },
      termMinLength: 0,
      multiple: true,
      allowClear: true
    }, function() {
      $input.trigger('fire')
    })
    setupDatePicker($registrationDatePicker, datePickerOpts, function() {
      $input.trigger('fire')
    })
    $clearRegistrationDatePicker.click(function(e) {
      e.stopPropagation()
      $registrationDatePicker.removeData('selection')
      $registrationDatePicker.data('dateRangePicker').clear()
      $input.trigger('fire')
    })
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
      $input.trigger('fire')
    })

    select2Autocomplete({
      $el: $buyer,
      path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber' },
      toOption: idNamePairToSelect2Option,
      fromOption: select2OptionToIdNamePair,
      termMinLength: 0,
      allowClear: true
    }, function() {
      $input.trigger('fire')
    })

    $reclassifiedBy.change(function() {
      $input.trigger('fire')
    })

    $reclassifiedToggle.change(function() {
      $reclassifiedBy.toggleClass('hide', !$reclassifiedToggle.prop('checked'))
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
    var data = $.param(constructPostDataParams())
    state.jqXHR = $.get(url, data).done(function(data, status, jqXHR) {
      if (state.jqXHR != jqXHR) return
      var results = data.programs

      $page.find('.button.export').prop('disabled', !(data.count != undefined && data.count < 5001))
      $page.find('.search-export').toggle(data.count === undefined || data.count > 5000)


      if (data.count != undefined) $page.find('.program-count .num').text(data.count)
      $noResults.toggle(state.page == 0 && results.length == 0)
      $noMoreResults.toggle((state.page > 0 || results.length > 0) && results.length < 100)
      $results.append(results.map(function(p) { return render(p, state.q) }))
      $loading.hide()
      if (callback) callback()
    })
  }

  function constructPostDataParams(){
    return {
      page: state.page,
      filters: currentFilters(),
      classifier: currentClassifier(),
      registrationDateRange: currentRegistrationDateRange(),
      reclassified: $reclassifiedToggle.prop('checked'),
      agelimits: currentAgelimits(),
      warnings: currentWarnings(),
      ownClassificationsOnly: $ownClassificationsOnly.is(':checked'),
      showDeleted: $showDeleted.is(':checked'),
      reclassifiedBy: currentReClassifier(),
      buyer: currentBuyer(),
      searchFromSynopsis: $searchFromSynopsis.is(':checked'),
      directors: currentDirectors()
    }
  }

  function currentFilters() {
    return $filters.filter(':checked').map(function() { return $(this).data('type') }).toArray()
  }

  function setFilters(filterString) {
    $filters.each(function() {
      $(this).prop('checked', !!(filterString && filterString.indexOf($(this).data('id')) >= 0))
    })
  }

  function currentReClassifier() {
    var data = $reclassifiedBy.select2 && $reclassifiedBy.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentClassifier() {
    var data = $classifier.select2 && $classifier.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentDirectors() {
    var data = $director.select2 && $director.select2('data') || []
    return _.map(data, function (d) { return d.id }).join(',')
  }

  function currentBuyer() {
    var data = $buyer.select2 && $buyer.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentRegistrationDateRange() {
    return $registrationDatePicker.data('selection')
  }
  function currentAgelimits() {
    return $page.find('.agelimit-filter.active').map(function() { return $(this).data('id') }).toArray()
  }
  function currentWarnings() {
    return $page.find('.warning-filter.active').map(function() { return $(this).data('id') }).toArray()
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
        if ($newRow) {
          $row.replaceWith($newRow)
          if ($row.is('.selected')) {
            openDetail($newRow, false, episodes)
          }
        } else {
          $row.remove()
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
    var hilites = highlights(query)
    var showRegistrationDate = !!window.user
    return $('<div>', { class:'result', 'data-id': p._id }).data('program', p).append(series(p)).append(row(p))

    function series(p) {
      if (!enums.util.isTvEpisode(p)) return undefined
      return $('<div>').addClass('series')
        .text(_.compact([p.series && p.series.name, utils.seasonEpisodeCode(p)]).join(' '))
        .highlight(hilites, { beginningsOnly: true, caseSensitive: false })
    }

    function row(p) {
      return $('<div>').addClass('items')
        .append($('<span>', { class: 'name' }).text(p.name[0]).highlight(hilites, { beginningsOnly: true, caseSensitive: false }))
        .append($('<span>', { class: 'country-year-date' }).text(countryAndYearAndDate(p)))
        .append($('<span>', { class: 'duration-or-game' }).text(enums.util.isGameType(p) ? p.gameFormat || '': utils.programDurationAsText(p)))
        .append($('<span>', { class: 'program-type' }).html(enums.util.isUnknown(p) ? '<i class="fa fa-warning"></i>' : i18nText(enums.util.programTypeName(p.programType))))
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

  function highlights(query) {
    var parts = (query || '').trim().toLowerCase().match(/"[^"]*"|[^ ]+/g) || ['']
    return _.map(parts, function(s) {
      return s[0] == '"' && s[s.length-1] == '"' ? s.substring(1, s.length - 1) : s
    })

  }
}

function select2Autocomplete(opts, onChangeFn) {
  var defaults = {
    toOption: function(x) { return {id: x.replace(/,/g, '&#44;'), text: x} },
    fromOption: function(x) { return x.id.replace(/&#44;/g, ',') },
    multiple: false,
    allowAdding: false,
    termMinLength: 1
  }
  opts = _.merge(defaults, opts)

  var $select = opts.$el

  function createSearchChoice(term, data) {
    var found = _.find(data, function(d) { return d.text === term })
    if (!found) {
      return {id: term, text: term, isNew: true }
    }
  }

  $select.select2({
    query: function(query) {
      var len = $.trim(query.term).length
      if (len < opts.termMinLength) {
        return query.callback({results: []})
      }
      var path = (typeof opts.path === 'function') ? opts.path(query.term) : opts.path + encodeURIComponent(query.term)
      return $.get(path).done(function(data) {
        return query.callback({results: data.map(opts.toOption)})
      })
    },
    initSelection: function(element, callback) {
      var val = opts.multiple ? (opts.val || []).map(opts.toOption) : opts.toOption(opts.val)
      return callback(val)
    },
    multiple: opts.multiple,
    placeholder: i18nText('Valitse...'),
    allowClear: opts.allowClear,
    formatSelection: opts.formatSelection,
    formatResultCssClass: opts.formatResultCssClass,
    createSearchChoice: opts.allowAdding ? createSearchChoice : undefined
  })

  return $select.on('change', function() {
    var data = $(this).select2('data')
    var val = opts.multiple ? data.map(opts.fromOption) : opts.fromOption(data)
    onChangeFn && onChangeFn($(this).attr('name'), val)
  }).on('setVal', function() {
    var arr = Array.prototype.slice.call(arguments, 1).map(opts.toOption)
    var data = opts.multiple ? arr : (arr[0] && arr[0] || '')
    $(this).select2('data', data).trigger('validate')
  })
}


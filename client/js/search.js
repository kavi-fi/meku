window.publicSearchPage = function () {
  searchPage()

  const $page = $('#search-page')
  $page.find('.advanced-search').click(function () { toggleAdvancedSearchOpen($page) })
  $page.find('.new-classification').remove()
  $page.find('.drafts').remove()
  $page.find('.recent').remove()
  $page.find('.kavi-query-filters').remove()
  $page.find('.user-query-filters').remove()
  $page.find('.controls h2.main').remove()
  setAgelimit0IconByLanguage($page)

  $page.on('showDetails', '.program-box', function (e, program) {
    $(this).find('.request-reclassification').on('click', function () { openSurvey(program) })
    $(this).find('.request-reclassification').show()
  })

  function openSurvey(program) {
    window.sendPageview('/#webropolsurveys/' + program._id)
    window.open('https://link.webropolsurveys.com/S/8A271C1FFF26AFB4?q1=' + encodeURIComponent(program.name + ' (' + program.sequenceId + ')'))
  }
}

function setAgelimit0IconByLanguage($page) {
  const zeroAge = shared.langCookie() === 'sv' ? 't' : '0'
  $page.find('.agelimit-0').attr('src', 'images/agelimit-' + zeroAge + '.png')
}

function toggleAdvancedSearchOpen($page) {
  $page.find('.advanced-search').toggleClass('selected')
  $page.find('.advanced-search-controls').slideToggle()
}

window.internalSearchPage = function () {
  const searchPageApi = searchPage()

  const $page = $('#search-page')
  $page.find('.advanced-search').click(function () { toggleAdvancedSearchOpen($page) })
  const $results = $page.find('.results').add($page.find('.recent'))
  const $newClassificationType = $page.find('.new-classification input[name=new-classification-type]')
  const $newClassificationButton = $page.find('.new-classification button')
  const $drafts = $page.find('.drafts')
  const $recent = $page.find('.recent')
  const $reclassifiedBy = $page.find('.public-query-filters input[name=reclassified-by]')
  setAgelimit0IconByLanguage($page)

  const programTypesSelect2 = {
    data: [
      {id: 1, text: shared.i18nText('Elokuva')},
      {id: 3, text: shared.i18nText('TV-sarjan jakso')},
      {id: 4, text: shared.i18nText('Muu TV-ohjelma')},
      {id: 5, text: shared.i18nText('Extra')},
      {id: 6, text: shared.i18nText('Traileri')},
      {id: 7, text: shared.i18nText('Peli')}
    ]
  }

  const reclassifierBySelect = {
    data: [
      {id: 1, text: shared.i18nText('Kaikki')},
      {id: 2, text: shared.i18nText('Organisaatio')},
      {id: 3, text: shared.i18nText('Henkilö')}
    ]
  }

  $newClassificationType.select2(programTypesSelect2).select2('val', 1)
  $reclassifiedBy.select2(reclassifierBySelect).select2('val', 1)

  $page.on('show', function () {
    loadDrafts()
    loadRecent()
  })

  $drafts.on('click', '.draft', function () {
    showClassificationPage($(this).data('id'))
  })

  $drafts.on('click', '.draft button', function (e) {
    shared.stopPropagation(e)
    $(this).prop('disabled', true)
    const $draft = $(this).parents('.draft')
    $.ajax({url: '/programs/drafts/' + $draft.data('id'), type: 'delete'}).done(function (p) {
      $draft.remove()
      $drafts.toggleClass('hide', $drafts.find('.draft').length === 0)
      p.deleted ? searchPageApi.programDeleted(p) : searchPageApi.programDataUpdated(p)
    })
  })

  $page.on('showDetails', '.program-box', function (e, program) {
    shared.stopPropagation(e)
    toggleDetailButtons($(this), program)
  })

  $newClassificationButton.click(function () {
    $newClassificationButton.prop('disabled', true)
    const programType = $newClassificationType.select2('val')
    $.post('/programs/new', JSON.stringify({programType: programType})).done(function (program) {
      showClassificationPage(program._id)
      $newClassificationButton.prop('disabled', false)
    })
  })

  $results.on('click', 'button.classify', function () {
    $(this).prop('disabled', true)
    const id = $(this).closest('.program-box').data('id')
    $.post('/programs/' + id + '/classification').done(function (program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.copy', function () {
    const id = $(this).closest('.program-box').data('id')
    $.get('/programs/' + id, function (origProgram) {
      const _id = origProgram.classifications.length > 0 && origProgram.classifications[0].buyer ? origProgram.classifications[0].buyer._id : 0
      $.get('/accounts/access/' + _id, function (res) {
        if (res.access) {
          $.post('/programs/new', JSON.stringify({programType: origProgram.programType, origProgram: origProgram})).done(function (program) {
            showClassificationPage(program._id)
          })
        } else shared.showDialog($('#templates').find('.copy-forbidden-dialog').clone().find('.button').on('click', shared.closeDialog).end())
      })
    })
  })

  $results.on('click', 'button.reclassify', function () {
    $(this).prop('disabled', true)
    const id = $(this).closest('.program-box').data('id')
    $.post('/programs/' + id + '/reclassification').done(function (program) {
      showClassificationPage(program._id)
    })
  })

  $results.on('click', 'button.continue-classification', function () {
    $(this).prop('disabled', true)
    const id = $(this).closest('.program-box').data('id')
    showClassificationPage(id)
  })

  $results.on('click', 'button.categorize', function () {
    $(this).prop('disabled', true)
    showCategorizationForm($(this).closest('.program-box'))
  })

  $results.on('click', 'button.recategorize', function () {
    $(this).prop('disabled', true)
    showCategorizationForm($(this).closest('.program-box'))
  })

  $results.on('click', 'button.edit', function () {
    $(this).prop('disabled', true)
    const $programBox = $(this).closest('.program-box')
    showClassificationEditPage($programBox.data('id'), $programBox.find('.classification.selected').data('id'))
  })

  $results.on('click', 'button.remove', function () {
    const $programBox = $(this).closest('.program-box')
    const $row = $programBox.prev('.result')
    const program = $row.data('program')
    shared.showDialog($('#templates').find('.remove-program-dialog').clone()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').one('click', removeProgram).end()
      .find('button[name=cancel]').one('click', shared.closeDialog).end())

    function removeProgram () {
      $.ajax('/programs/' + program._id, {type: 'delete'}).done(function () {
        shared.closeDialog()
        searchPageApi.programDeleted(program, function () { loadDrafts()
          loadRecent()
        })
      })
    }
  })

  $results.on('click', 'button.remove-classification', function () {
    const $programBox = $(this).closest('.program-box')
    const $row = $programBox.prev('.result')
    const program = $row.data('program')
    const classification = $programBox.find('.classification.selected').data('classification')
    const registrationDate = utils.asDate(classification.registrationDate) || shared.i18nText('Tuntematon rekisteröintiaika')
    shared.showDialog($('#templates').find('.remove-classification-dialog').clone()
      .find('.registration-date').text(registrationDate).end()
      .find('.program-name').text(program.name).end()
      .find('button[name=remove]').one('click', removeClassification).end()
      .find('button[name=cancel]').one('click', shared.closeDialog).end())

    function removeClassification() {
      $.ajax('/programs/' + program._id + '/classification/' + classification._id, {type: 'delete'}).done(function (prg) {
        shared.closeDialog()
        searchPageApi.updateLocationHash()
        searchPageApi.programDataUpdated(prg)
      })
    }
  })

  function loadDrafts() {
    $.get('/programs/drafts', function (drafts) {
      $drafts.find('.draft').remove()
      drafts.forEach(function (draft) {
        const $date = $('<span>', {class: 'creationDate'}).text(utils.asDateTime(draft.creationDate))
        const $link = $('<span>', {class: 'name'}).text(draft.name)
        const $remove = $('<div>', {class: 'remove'}).append($('<button>', {class: 'button'}).i18nText('Poista'))
        const $draft = $('<div>', {class: 'result draft'}).data('id', draft._id).append($date).append($link).append($remove)
        $drafts.find('> div').append($draft)
      })
      $drafts.toggleClass('hide', drafts.length === 0)
    })
  }

  function loadRecent() {
    $recent.find('.program-box').remove()
    $.get('/programs/recent', function (recents) {
      $recent.hide()
      $recent.find('.result').remove()
      recents.forEach(function (program) {
        const classification = _.find(program.classifications, {author: {_id: window.user._id}})
        const $result = renderRecentRow(program, classification)
        $recent.show().append($result)
      })
    })

    function renderRecentRow(p, c) {
      const registrationDate = utils.asDate((c || {}).registrationDate) || shared.i18nText('Tuntematon rekisteröintiaika')
      return $('<div>', {'data-id': p._id}).addClass('result').data('program', p)
        .append($('<span>', {class: 'registrationDate'}).text(registrationDate))
        .append($('<span>', {class: 'name'}).text(p.name[0]))
        .append($('<span>', {class: 'duration-or-game'}).text(enums.util.isGameType(p) ? p.gameFormat || '' : utils.durationAsText((c || {}).duration)))
        .append($('<span>', {class: 'program-type'}).i18nText(enums.util.programTypeName(p.programType)))
        .append($('<span>', {class: 'classification'}).append(shared.renderWarningSummary(window.classificationUtils.summary(c)) || ' - '))
        .data('renderer', rerenderRecentRow)
    }

    function rerenderRecentRow (program) {
      const classification = _.find(program.classifications, {author: {_id: window.user._id}})
      if (classification) {
        return renderRecentRow(program, classification)
      }
        loadRecent()


    }
  }

  function toggleDetailButtons($detail, p) {
    if (enums.util.isUnknown(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(window.classificationUtils.canReclassify(p, window.user))
      $detail.find('button.recategorize').hide()
    } else if (enums.util.isTvSeriesName(p)) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.recategorize').hide()
    } else if (p.draftClassifications && p.draftClassifications[window.user._id]) {
      $detail.find('button.continue-classification').show()
      $detail.find('button.reclassify').hide()
      $detail.find('button.recategorize').hide()
    } else if (p.classifications.length === 0) {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').hide()
      $detail.find('button.classify').toggle(shared.hasRole('kavi'))
      $detail.find('button.recategorize').toggle(shared.hasRole('kavi'))
    } else {
      $detail.find('button.continue-classification').hide()
      $detail.find('button.reclassify').toggle(window.classificationUtils.canReclassify(p, window.user))
      $detail.find('button.recategorize').toggle(shared.hasRole('kavi'))
    }
    $detail.find('button.copy').toggle(enums.util.isTvEpisode(p) || enums.util.isTrailer(p))
    $detail.find('button.categorize').toggle(enums.util.isUnknown(p))
    $detail.find('button.edit').toggle(shared.hasRole('root'))
    $detail.find('button.remove').toggle(shared.hasRole('root') && (!enums.util.isTvSeriesName(p) || p.episodes.count === 0))
    $detail.find('button.remove-classification').toggle(shared.hasRole('root'))

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
    const program = $programBox.prev('.result').data('program')
    const $categorizationForm = $programBox.find('.categorization-form')
    const $categorySelection = $categorizationForm.find('input[name=category-select]')
    const $categorySaveButton = $categorizationForm.find('.save-category')

    const $tvEpisodeForm = $categorizationForm.find('.categorization-form-tv-episode')
    const $episode = $tvEpisodeForm.find('input[name=episode]')
    const $season = $tvEpisodeForm.find('input[name=season]')
    const $series = $tvEpisodeForm.find('input[name=series]')
    const $newSeriesForm = $categorizationForm.find('.categorization-form-tv-new-series')

    $categorySelection.select2(programTypesSelect2).select2('val', 1)
    $categorySelection.change(function () {
      $tvEpisodeForm.toggleClass('hide', !isTvEpisode()).find('input').trigger('validate')
    })

    shared.select2Autocomplete({
      $el: $series,
      path: function (term) { return '/series/search?q=' + encodeURIComponent(term) },
      toOption: meku.idNamePairToSelect2Option,
      fromOption: meku.select2OptionToIdNamePair,
      allowAdding: true,
      termMinLength: 0
    })

    $series.change(function () {
      const data = $(this).select2('data')
      if (!data) return
      const $inputs = $newSeriesForm.find('input')
      if (data.isNew) {
        $newSeriesForm.find('input[name="series.draft.name"]').val(data.text)
        $newSeriesForm.slideDown()
        $inputs.trigger('validate')
      } else {
        $inputs.val('').removeClass('touched')
        $newSeriesForm.slideUp(function () { $inputs.trigger('validate') })
      }
    })

    $newSeriesForm.find('input[name="series.draft.name"]').on('input', function () {
      const val = $(this).val()
      $series.select2('data', {id: val, text: val, isNew: true})
    })

    $categorizationForm.on('select2-blur', function (e) { $(e.target).addClass('touched') })

    meku.validateTextChange($categorizationForm.find('input.required'), meku.isNotEmpty)

    $categorizationForm.on('validation input', function () {
      const required = $categorizationForm.find('.required.invalid, input:invalid')
        .not('.select2-container')
        .filter(function () {
          const $this = $(this)
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
      $series.select2('data', meku.idNamePairToSelect2Option(program.series)).trigger('validate')
      $season.val(program.season).trigger('validate')
      $episode.val(program.episode).trigger('validate')
    }

    $categorySaveButton.click(function () {
      $categorySaveButton.prop('disabled', true)
      const categoryData = {programType: $categorySelection.select2('val')}
      if (isTvEpisode()) {
        const seriesData = $series.select2('data')
        const series = meku.select2OptionToIdNamePair(seriesData)
        categoryData.series = series
        categoryData.episode = $episode.val()
        categoryData.season = _.trim($season.val()) === '' ? undefined : $season.val()
        if (seriesData.isNew) {
          categoryData.series.draft = {
            name: $newSeriesForm.find('input[name="series.draft.name"]').val(),
            nameFi: $newSeriesForm.find('input[name="series.draft.nameFi"]').val(),
            nameSv: $newSeriesForm.find('input[name="series.draft.nameSv"]').val(),
            nameOther: $newSeriesForm.find('input[name="series.draft.nameOther"]').val()
          }
        }
      }
      $.post('/programs/' + program._id + '/categorization', JSON.stringify(categoryData)).done(function (newProgram) {
        const oldProgram = program
        const oldSeriesId = utils.getProperty(oldProgram, 'series._id')
        const newSeriesId = utils.getProperty(newProgram, 'series._id')
        if (oldSeriesId && oldSeriesId !== newSeriesId) searchPageApi.updateProgramIfVisible(oldSeriesId)
        searchPageApi.programDataUpdated(newProgram)
      })
    })

    function isTvEpisode() {
      return enums.util.isTvEpisode({programType: $categorySelection.select2('val')})
    }

  }
}

function searchPage() {
  const $page = $('#search-page').html($('#templates .search-page').clone())
  const $input = $page.find('.query')
  const $button = $page.find('button.search')
  const $sort_name_col = $page.find('.searchResultSortCols .col_name')
  const $sort_duration_col = $page.find('.searchResultSortCols .col_duration')
  const $sort_type_col = $page.find('.searchResultSortCols .col_type')
  const $sort_age_col = $page.find('.searchResultSortCols .col_agelimit')
  const $exportbutton = $page.find('button.export')
  const $asCsv = $page.find('.ascsv')
  const $showDeleted = $page.find('input[type=checkbox].showDeleted')
  const $searchFromSynopsis = $page.find('input[type=checkbox].searchFromSynopsis')
  const $filters = $page.find('.filters input[type=checkbox]')
  const $registrationDatePicker = $page.find('.public-query-filters .datepicker')
  const $clearRegistrationDatePicker = $page.find('.public-query-filters .clear-date-picker')
  const $classifier = $page.find('.kavi-query-filters input[name=classifier]')
  const $director = $page.find('.public-query-filters input[name=director]')
  const $buyer = $page.find('.kavi-query-filters input[name="buyer"]')
  const $reclassifiedToggle = $page.find('.filters input[name=reclassified]')
  const $reclassifiedBy = $page.find('.public-query-filters input[name=reclassified-by]')
  const $ownClassificationsOnly = $page.find('.user-query-filters input[name=own-classifications-only]')
  const $results = $page.find('.results')
  const $noResults = $page.find('.no-results')
  const $noMoreResults = $page.find('.no-more-results')
  const $loading = $page.find('.loading')
  const detailRenderer = window.programBox()
  let state = {q: '', page: 0, sortBy: '', sortOrder: 'ascending'}

  setupPublicFilters()
  setupKaviFilters()
  if (!shared.hasRole('root')) $page.find('.root-query-filters').remove()

  $page.on('show', function (e, q, filters, programId) {
    if (q) $input.val(q).trigger('reset')
    setFilters(filters)
    queryChanged($input.val().trim())
    loadUntil(programId, function () {
      $('.search-excel-export-form:visible').find('input[name="_csrf"]').val($.cookie('_csrf_token'))
      if (!programId && $results.find('.result').length === 1) {
        openDetail($results.find('.result:first'), false)
      }
      if ($('#login').is(':hidden')) $input.focus()
    })
  })

  $button.click(function () { $input.trigger('fire') })
  $sort_name_col.click(function () { sortChanged('col_name') })
  $sort_duration_col.click(function () { sortChanged('col_duration') })
  $sort_type_col.click(function () { sortChanged('col_type') })
  $sort_age_col.click(function () { sortChanged('col_agelimit') })

  function sortChanged(column) {
    const newOrder = $('.searchResultSortCols .' + column).hasClass('ascending') ? 'descending' : 'ascending'
    $('.searchResultSortCols .' + column).removeClass('ascending descending')
    $('.searchResultSortCols .' + column).siblings().removeClass('ascending descending')
    $('.searchResultSortCols .' + column).addClass(newOrder)

    const icon = newOrder === 'ascending' ? 'fa-sort-asc' : 'fa-sort-desc'
    $('.searchResultSortCols .' + column).find('#' + column + '_icon').removeClass('fa-sort-asc fa-sort-desc').addClass(icon).toggle(true)
    $('.searchResultSortCols .' + column).siblings().find('i').removeClass('fa-sort-asc fa-sort-desc').addClass('fa-sort-asc')

    state = _.extend(state, {sortBy: column, sortOrder: newOrder})
    $input.trigger('fire')
  }

  $exportbutton.on('click', function () {
    const $form = $(".search-excel-export-form:visible")

    const postParams = constructPostDataParams()
    postParams.q = state.q ? state.q : ""

    $form.find('input[name=post_data]').val(JSON.stringify(postParams))
    $form.submit()

  })
  $asCsv.on('click', function () {
    $('.search-excel-export-form:visible input[name=csv]').val('' + $('.ascsv:checked').length)
  })

  $filters.on('change', function () { $input.trigger('fire') })
  $ownClassificationsOnly.on('change', function () { $input.trigger('fire') })

  $(window).on('scroll', function () {
    if (!$page.is(':visible')) return
    if ($loading.is(':visible') || $noResults.is(':visible') || $noMoreResults.is(':visible')) return
    if ($(document).height() - $(window).scrollTop() - $(window).height() < 100) {
      state.page += 1
      load()
    }
  })

  $input.throttledInput(function () {
    queryChanged($input.val().trim())
    updateLocationHash()
    load(function () {
      if ($results.find('.result').length === 1) {
        openDetail($results.find('.result:first'), false)
      }
    })
  })

  $page.on('click', '.results .result, .recent .result', function () {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  $page.on('click', '.results .program-box a.series', function () {
    shared.setLocation($(this).attr('href'))
    const sequenceId = shared.parseLocationHash()
    $page.trigger('show', sequenceId[1]).show()
  })

  return {programDataUpdated: programDataUpdated, programDeleted: programDeleted,
           updateProgramIfVisible: updateProgramIfVisible, updateLocationHash: updateLocationHash}

  function queryChanged(q) {
    state = {q: q, page: 0, sortBy: state.sortBy, sortOrder: state.sortOrder}
    $noResults.add($noMoreResults).hide()
  }

  function setupPublicFilters() {
    const datePickerOpts = {
      shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['week', 'month']},
      customShortcuts: shared.yearShortcuts(),
      getValue: function () { return $registrationDatePicker.find('span').text() },
      setValue: function (s) {
        $clearRegistrationDatePicker.toggle(!!s)
        $registrationDatePicker.find('span').text(s)
      }
    }

    $page.find('.filterbutton').click(function () {
      $(this).toggleClass('active')
      $input.trigger('fire')
    })
    shared.select2Autocomplete({
      $el: $director,
      path: function (term) { return '/directors/search?q=' + encodeURIComponent(term) },
      termMinLength: 0,
      multiple: true,
      allowClear: true
    }, function () {
      $input.trigger('fire')
    })
    shared.setupDatePicker($registrationDatePicker, datePickerOpts, function () {
      $input.trigger('fire')
    })
    $clearRegistrationDatePicker.click(function (e) {
      shared.stopPropagation(e)
      $registrationDatePicker.removeData('selection')
      $registrationDatePicker.data('dateRangePicker').clear()
      $input.trigger('fire')
    })
  }

  function setupKaviFilters() {
    if (!shared.hasRole('kavi')) {
      $page.find('.kavi-query-filters').remove()
      return
    }

    $page.find('.user-query-filters').remove()

    shared.select2Autocomplete({
      $el: $classifier,
      path: function (term) { return '/users/search?q=' + encodeURIComponent(term) },
      toOption: meku.userToSelect2Option,
      fromOption: meku.select2OptionToUser,
      termMinLength: 0,
      allowClear: true,
      formatSelection: function (user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
      formatResultCssClass: function (user) { return user.active ? '' : 'grey' }
    }, function () {
      $input.trigger('fire')
    })

    shared.select2Autocomplete({
      $el: $buyer,
      path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber' },
      toOption: meku.idNamePairToSelect2Option,
      fromOption: meku.select2OptionToIdNamePair,
      termMinLength: 0,
      allowClear: true
    }, function () {
      $input.trigger('fire')
    })

    $reclassifiedBy.change(function () {
      $input.trigger('fire')
    })

    $reclassifiedToggle.change(function () {
      $reclassifiedBy.toggleClass('hide', !$reclassifiedToggle.prop('checked'))
      $input.trigger('fire')
    })
  }

  function loadUntil(selectedProgramId, callback) {
    load(function () {
      if (!selectedProgramId) {
        updateLocationHash()
        return callback()
      }
      const $selected = $results.find('.result[data-id=' + selectedProgramId + ']')
      if ($selected.length > 0) {
        openDetail($selected, false)
        const top = $selected.offset().top - 25
        $('body,html').animate({scrollTop: top})
        callback()
      } else if (state.page < 20) {
        state.page += 1
        loadUntil(selectedProgramId, callback)
      }
    })
  }

  function load(callback) {
    $loading.show()
    if (state.page === 0) $results.empty()
    const url = '/programs/search/' + encodeURIComponent(state.q)
    const data = $.param(constructPostDataParams())
    state.jqXHR = $.get(url, data).done(function (result, status, jqXHR) {
      if (state.jqXHR !== jqXHR) return
      const results = result.programs

      $page.find('.button.export').prop('disabled', !(result.count !== undefined && result.count < 5001))
      $page.find('.search-export').toggle(result.count === undefined || result.count > 5000)


      if (result.count !== undefined) $page.find('.program-count .num').text(result.count)
      $noResults.toggle(state.page === 0 && results.length === 0)
      $noMoreResults.toggle((state.page > 0 || results.length > 0) && results.length < 100)
      $results.append(results.map(function (program) { return render(program, state.q) }))
      $loading.hide()
      if (callback) callback()
    })
  }

  function constructPostDataParams() {
    return {
      page: state.page,
      filters: currentFilters(),
      classifier: currentClassifier(),
      registrationDateRange: currentRegistrationDateRange(),
      reclassified: $reclassifiedToggle.prop('checked'),
      agelimits: currentAgelimits(),
      warnings: currentWarnings(),
      ownClassificationsOnly: $ownClassificationsOnly.is(':checked').toString(),
      showDeleted: $showDeleted.is(':checked').toString(),
      showCount: 'true',
      sorted: 'true',
      reclassifiedBy: currentReClassifier(),
      buyer: currentBuyer(),
      searchFromSynopsis: $searchFromSynopsis.is(':checked'),
      directors: currentDirectors(),
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    }
  }

  function currentFilters() {
    const filters = $filters.filter(':checked').map(function () { return $(this).data('type') }).toArray()
    return filters.length > 0 ? filters : undefined
  }

  function setFilters(filterString) {
    $filters.each(function () {
      $(this).prop('checked', !!(filterString && filterString.indexOf($(this).data('id')) >= 0))
    })
  }

  function currentReClassifier() {
    const data = $reclassifiedBy.select2 && $reclassifiedBy.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentClassifier() {
    const data = $classifier.select2 && $classifier.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentDirectors() {
    const data = $director.select2 && $director.select2('data') || []
    return _.map(data, function (d) { return d.id }).join(',')
  }

  function currentBuyer() {
    const data = $buyer.select2 && $buyer.select2('data') || undefined
    return data && data.id || undefined
  }

  function currentRegistrationDateRange() {
    return $registrationDatePicker.data('selection')
  }
  function currentAgelimits() {
    const ageLimits = $page.find('.agelimit-filter.active').map(function () { return $(this).data('id') }).toArray()
    return ageLimits.length > 0 ? ageLimits : ''
  }
  function currentWarnings() {
    const warnings = $page.find('.warning-filter.active').map(function () { return $(this).data('id') }).toArray()
    return warnings.length > 0 ? warnings : ''
  }

  function updateProgramIfVisible(programId) {
    const $rows = $page.find('.result[data-id=' + programId + ']')
    if (_.isEmpty($rows)) return
    $.get('/programs/' + programId).done(programDataUpdated)
  }

  function programDataUpdated(program) {
    const seriesId = utils.getProperty(program, 'series._id')
    if (seriesId) updateProgramIfVisible(seriesId)
    const $rows = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($rows)) return
    const episodesAreOpen = $rows.next('.program-box').find('.episode-container > h3').hasClass('open')
    if (episodesAreOpen) {
      $.get('/episodes/' + program._id).done(updateUI)
    } else {
      updateUI()
    }

    function updateUI(episodes) {
      $rows.each(function () {
        const $row = $(this)
        const customRenderer = $row.data('renderer')
        const $newRow = customRenderer ? customRenderer(program) : render(program, state.q)
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
    const cb = callback ? callback : function() {} // eslint-disable-line
    updateLocationHash()
    if (program.series && program.series._id) updateProgramIfVisible(program.series._id)
    const $rows = $page.find('.result[data-id=' + program._id + ']')
    if (_.isEmpty($rows)) return cb()
    const $remove = $rows.next('.program-box').add($rows).slideUp()
    $remove.promise().done(function () {
      $remove.remove()
      cb()
    })
  }

  function openDetail($row, animate, preloadedEpisodes) {
    const p = $row.data('program')
    updateLocationHash(p._id)
    const $details = detailRenderer.render(p, preloadedEpisodes)
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
    $details.trigger('showDetails', p)

    if (shared.hasRole('root')) $details.append(meku.changeLog(p).render())
  }

  function closeDetail() {
    $page.find('.result.selected').removeClass('selected')
    $page.find('.program-box').slideUp(function () { $(this).remove() }).end()
  }

  function updateLocationHash(selectedProgramId) {
    const filters = $filters.filter(':checked').map(function () { return $(this).data('id') }).toArray().join('')
    shared.setLocation('#haku/' + encodeURIComponent(state.q) + '/' + filters + '/' + (selectedProgramId || ''))
  }

  function render(program, query) {
    const hilites = highlights(query)
    const showRegistrationDate = !!window.user
    return $('<div>', {class: 'result', 'data-id': program._id}).data('program', program).append(series(program)).append(row(program))

    function series(p) {
      if (!enums.util.isTvEpisode(p)) return undefined
      return $('<div>').addClass('series')
        .text(_.compact([p.series && p.series.name, utils.seasonEpisodeCode(p)]).join(' '))
        .highlight(hilites, {beginningsOnly: true, caseSensitive: false})
    }

    function row(p) {
      return $('<div>').addClass('items')
        .append($('<span>', {class: 'name'}).text(p.name[0]).highlight(hilites, {beginningsOnly: true, caseSensitive: false}))
        .append($('<span>', {class: 'country-year-date'}).text(countryAndYearAndDate(p)))
        .append($('<span>', {class: 'duration-or-game'}).text(enums.util.isGameType(p) ? p.gameFormat || '' : utils.programDurationAsText(p)))
        .append($('<span>', {class: 'program-type'}).html(enums.util.isUnknown(p) ? '<i class="fa fa-warning"></i>' : shared.i18nText(enums.util.programTypeName(p.programType))))
        .append($('<span>').append(shared.renderWarningSummary(window.classificationUtils.fullSummary(p)) || ' - '))
    }

    function countryAndYearAndDate(p) {
      const s = _([registrationDate(p), enums.util.toCountryString(p.country), p.year]).compact().join(', ')
      return s === '' ? s : '(' + s + ')'
    }

    function registrationDate(p) {
      if (!showRegistrationDate) return undefined
      const date = utils.getProperty(p, 'classifications.0.registrationDate')
      return date ? moment(date).format('D.M.YYYY') : undefined
    }
  }

  function highlights(query) {
    const parts = (query || '').trim().toLowerCase().match(/"[^"]*"|[^ ]+/g) || ['']
    return _.map(parts, function (s) { return s[0] === '"' && s[s.length - 1] === '"' ? s.substring(1, s.length - 1) : s })
  }
}



window.classificationPage = function () {
  const $root = $('#classification-page')

  $root.on('show', function (e, programId, rootEditMode, classificationId) {
    if (rootEditMode) {
      shared.setLocation('#luokittelu/' + programId + '/edit/' + (classificationId || ''))
      $.get('/programs/' + programId).done(function (program) {
        classificationForm(program, rootClassificationFinder(classificationId), true)
      })
    } else if (programId) {
      shared.setLocation('#luokittelu/' + programId)
      $.get('/programs/' + programId).done(function (program) {
        classificationForm(program, draftClassificationFinder, false)
      })
    } else {
      shared.setLocation('#luokittelu')
    }
    $('.navi li:first a').addClass('active')
  })

  function rootClassificationFinder(classificationId) {
    return function (program) {
      return _.find(program.classifications, {_id: classificationId}) || {criteria: [], warningOrder: [], registrationEmailAddresses: []}
    }
  }
  function draftClassificationFinder (program) {
    const draftClassification = program.draftClassifications[window.user._id]
    if (draftClassification && !shared.hasRole('root')) draftClassification.registrationDate = new Date()
    return draftClassification
  }
}

function classificationForm(program, classificationFinder, rootEditMode) {
  let selectedClassification = classificationFinder(program)
  const rootModifiedFields = {}
  const cfu = classificationFormUtils()
  const $form = cfu.renderForm(program, selectedClassification, rootEditMode)
  const select2Opts = cfu.select2Opts($form)
  const detailRenderer = window.programBox()
  const emailRenderer = cfu.registrationEmails($form, save).render(program, selectedClassification, rootEditMode)

  setProgramFields(program)
  setClassificationFields(selectedClassification)
  configureValidation()
  configureEventBinding()
  onProgramUpdated(program)

  function setProgramFields(p) {
    $form
      .find('input[name=year]').val(p.year).end()
      .find('input[name=season]').val(p.season).end()
      .find('input[name=episode]').val(p.episode).end()
      .find('textarea[name=synopsis]').val(p.synopsis).end()
      .find('input[name="series.draft.name"]').val(window.utils.getProperty(p, 'series.draft.name') || '').end()
      .find('input[name="series.draft.nameFi"]').val(window.utils.getProperty(p, 'series.draft.nameFi') || '').end()
      .find('input[name="series.draft.nameSv"]').val(window.utils.getProperty(p, 'series.draft.nameSv') || '').end()
      .find('input[name="series.draft.nameOther"]').val(window.utils.getProperty(p, 'series.draft.nameOther') || '').end()

    cfu.nameFields.forEach(function (field) {
      p[field].forEach(function (val, index) {
        $form.find('input[name="' + field + '"]').eq(index).val(val).end()
      })
    })
    shared.select2Autocomplete(select2Opts.series, save).trigger('setVal', p.series)
    meku.select2EnumAutocomplete(select2Opts.countries, save).trigger('setVal', p.country)
    shared.select2Autocomplete(select2Opts.productionCompanies, save).trigger('setVal', p.productionCompanies)
    meku.select2EnumAutocomplete(select2Opts.gameFormat, save).trigger('setVal', p.gameFormat)
    meku.select2EnumAutocomplete(select2Opts.genre(p), save).trigger('setVal', p.genre)
    shared.select2Autocomplete(select2Opts.directors, save).trigger('setVal', p.directors)
    shared.select2Autocomplete(select2Opts.actors, save).trigger('setVal', p.actors)
  }

  function setClassificationFields(c) {
    const authorOrgVal = typeof c.authorOrganization === 'number' ? c.authorOrganization.toString() : ''
    const reasonVal = typeof c.reason === 'number' ? c.reason.toString() : ''
    const kaviTypeVal = typeof c.kaviType === 'number' ? c.kaviType.toString() : ''
    const isVetClassification = _.find(c.criteria.map(function (id) { return window.enums.classificationCriteria[id - 1].category === 'vet' })) !== undefined

    $form
      .find('span.author').text(window.utils.getProperty(c, 'author.name') || '-').end()
      .find('input[name="classification.duration"]').val(c.duration).end()
      .find('textarea[name="classification.comments"]').val(c.comments).end()
      .find('textarea[name="classification.userComments"]').val(c.userComments).end()
      .find('textarea[name="classification.publicComments"]').val(c.publicComments).end()
      .find('input[name="classification.safe"]').prop('checked', !!c.safe).end()
      .find('input[name="classification.vet"]').prop('checked', isVetClassification).end()
      .find('.category-container').toggle(!c.safe).end()
      .find('.vet').toggle(isVetClassification).end()

    shared.select2Autocomplete(select2Opts.author, save).trigger('setVal', c.author)
    shared.select2Autocomplete(select2Opts.buyer, save).trigger('setVal', c.buyer)
    shared.select2Autocomplete(select2Opts.billing, save).trigger('setVal', c.billing)
    meku.select2EnumAutocomplete(select2Opts.format, save).trigger('setVal', c.format)
    meku.select2EnumAutocomplete(select2Opts.authorOrg, save).trigger('setVal', authorOrgVal)
    meku.select2EnumAutocomplete(select2Opts.reason, save).trigger('setVal', reasonVal)
    meku.select2EnumAutocomplete(select2Opts.kaviType, save).trigger('setVal', kaviTypeVal)

    const $registrationDate = $form.find('input[name="classification.registrationDate"]')
    const pikadayOpts = {
      defaultDate: c.registrationDate ? moment(c.registrationDate).toDate() : '',
      onSelect: function () { $registrationDate.trigger('input') }
    }
    $registrationDate.pikaday(_.defaults(pikadayOpts, meku.pikadayDefaults))
    if (c.status === 'in_process') saveRegistrationDate($registrationDate)

    c.criteria.forEach(function (id) { $form.find('.criteria[data-id=' + id + ']').addClass('selected') })
    Object.keys(c.criteriaComments || {}).forEach(function (id) {
      const txt = c.criteriaComments[id]
      if (meku.isNotEmpty(txt)) {
        $form.find('textarea[name="classification.criteriaComments.' + id + '"]').val(txt).parents('.criteria').addClass('has-comment')
      }
    })
  }

  function configureValidation() {
    $form.on('validation throttled', function () { // For select2's, we only care about the original element from which the invalid class has been removed
      const required = $form.find('.required.invalid')
        .not('.select2-container.required.invalid')
        .not('.select2-drop.required.invalid')
        .not('input:disabled, textarea:disabled')

      /*
       * Enable to log validation:
       * required.length === 0 ? console.log('valid.') : console.log('invalid: ', required.map(function() { return $(this).prop('name') }).toArray())
       */
      const throttled = $form.find('.throttled')
      $form.find('button[name=register]').prop('disabled', (required.length > 0 || throttled.length > 0) && !$('input[name="classification.vet"]').is(':checked'))
    })
    meku.validateTextChange($form.find('.required'), meku.isNotEmpty)
    meku.validateTextChange($form.find('input[name=year]'), window.utils.isValidYear)
    meku.validateTextChange($form.find('input[name="classification.registrationDate"]'), window.utils.isEmptyOrValidDate)
    meku.validateTextChange($form.find('.duration'), window.utils.isValidDuration)
    meku.validateTextChange($form.find('input[name="classification.registrationEmailAddresses"]'), meku.isMultiEmail)
    $form.on('select2-blur', function (e) { $(e.target).addClass('touched') })
    $form.find('.required').trigger('validate')
  }

  function configureEventBinding() {
    $form.find('textarea').autosize()
    $form.on('submit', function (e) {
      const registrationDate = $form.find('input[name="classification.registrationDate"]').val()
      $form.find('button[name=register]').prop('disabled', true)
      e.preventDefault()
      $.post('/programs/' + program._id + '/register', JSON.stringify({preventSendingEmail: $form.find('input[name="classification.preventSendingEmail"]:checked').length})).done(function (savedProgram) {
        $form.hide()
        $("#search-page").trigger('show').show()
        shared.showDialog($('<div>', {class: 'registration-confirmation dialog', 'data-cy': 'registration-confirmation-dialog'})
          .append($('<span>', {class: 'name'}).text(savedProgram.name))
          .append(shared.renderWarningSummary(window.classificationUtils.fullSummary(savedProgram)))
          .append($('<p>', {class: 'registration-date'}).text(shared.i18nText('Rekisteröity') + ' ' + registrationDate))
          .append($('<p>', {class: 'buttons'}).html($('<button>', {click: shared.closeDialog, class: 'button', 'data-cy': 'button'}).i18nText('Sulje'))))
        $(window).scrollTop(0)
      })
    })
    $form.find('button[name=save]').on('click', function (e) {
      $form.find('button[name=save]').prop('disabled', true)
      e.preventDefault()
      $.post('/programs/' + program._id, JSON.stringify(rootModifiedFields)).done(function (p) {
        $('#classification-page').trigger('show', [p._id, 'edit', selectedClassification._id]).show()
        shared.showDialog($('#templates').find('.modify-success-dialog').clone().find('button.ok').click(shared.closeDialog).end())
      })
    })
    $form.on('click', '.back-to-search', function (e) {
      e.preventDefault()
      $form.hide()
      $("#search-page").trigger('show').show()
    })
    $form.find('.throttledInput').throttledInput(function (txt) {
      if (($(this).is(':invalid') || $(this).hasClass('invalid')) && $(this).val().length > 0) return false
      save($(this).attr('name'), txt)
    })

    $form.find('.throttledNameInput').throttledInput(function () { saveNames($(this).attr('name'), $(this).parent()) })

    $form.on('click', 'button.addExtraName', function (e) {
      e.preventDefault()
      const fieldName = $(this).data('name-type')
      const $html = cfu.nameFieldHtml(fieldName).appendTo($(this).parent())
      $html.filter('input[type=text]').throttledInput(function () { saveNames(fieldName, $(this).parent()) })
    })
    $form.on('click', 'button.removeExtraName', function (e) {
      e.preventDefault()
      const $container = $(this).parent()
      $(this).prev().add($(this)).remove()
      saveNames($(this).data('name-type'), $container)
    })

    function saveNames(fieldName, $container) {
      const values = $container.find('input[type=text]').map(function () { return $(this).val() }).toArray()
      save(fieldName, values)
    }

    $form.find('input[name="classification.safe"]').change(function () {
      const safe = $(this).is(':checked')
      $form.find('.category-container').slideToggle()
      save($(this).attr('name'), safe)
    })
    $form.find('.safe-container span').click(function () {
      $(this).prev().click()
    })
    $form.find('input[name="classification.vet"]').change(function () {
      $('.vet').toggle($(this).is(':checked'))
      const ids = $form.find('.category .criteria.selected:visible').map(function (i, e) { return $(e).data('id') }).get()
      save('classification.criteria', ids)
      $form.find('.required').trigger('validate')
    })
    $form.find('.vet-container span').click(function () {
      $(this).prev().click()
    })
    $form.find('input[name="series"]').on('change', function () { onSeriesChanged(false) })
    onSeriesChanged(true)

    $form.find('input[name="series.draft.name"]').on('input', function () {
      const val = $(this).val()
      $form.find('input[name="series"]').select2('data', {id: val, text: val, isNew: true})
    })
    $form.find('input[name="classification.registrationDate"]').on('input', function () {
      saveRegistrationDate($(this))
    })
    $form.find('input[name="classification.buyer"]').on('change', function () {
      const $billing = $form.find('input[name="classification.billing"]')
      if (!$billing.select2('data')) $billing.select2('data', $(this).select2('data')).trigger('validate').trigger('change')
    })
    $form.find('input[name="classification.reason"]').on('change', function () {
      if (rootEditMode) return
      const $buyerAndBilling = $form.find('input[name="classification.buyer"], input[name="classification.billing"]')
      $buyerAndBilling.removeClass('touched').select2('enable', shared.hasRole('root') || window.enums.isOikaisupyynto($(this).val())).select2('val', '').trigger('validate').trigger('change')
    })
    $form.on('click', '.category .criteria', function () {
      $(this).toggleClass('selected').toggleClass('has-comment', meku.isNotEmpty($(this).find('textarea').val() || ''))
      const ids = $form.find('.category .criteria.selected').map(function (i, e) { return $(e).data('id') }).get()
      if ($(this).hasClass('selected')) $(this).find('textarea').focus()
      save('classification.criteria', ids)
    })
    $form.on('click', '.category .criteria textarea', shared.stopPropagation)
    $form.on('blur', '.category .criteria.has-comment:not(.selected) textarea', function () {
      $(this).parents('.criteria').toggleClass('has-comment', meku.isNotEmpty($(this).val()))
    })
    cfu.warningDragOrder($form.find('.classification-criteria .warning-order'), save)

    function onSeriesChanged(isInitial) {
      const data = $form.find('input[name="series"]').select2('data')
      if (!data) return
      const $container = $form.find('.new-series-fields')
      const $inputs = $container.find('input')
      if (data.isNew) {
        $inputs.prop('disabled', false)
        if (!isInitial) {
          $container.find('input[name="series.draft.name"]').val(data.text).trigger('input')
        }
        $container[isInitial ? 'show' : 'slideDown']()
      } else {
        $inputs.prop('disabled', true).removeClass('touched').val('').trigger('validate')
        $container[isInitial ? 'hide' : 'slideUp']()
      }
    }
  }

  function saveRegistrationDate($registrationDate) {
    if ($registrationDate.hasClass('invalid')) return false
    const val = _.trim($registrationDate.val())
    const date = val === '' ? '' : moment(val, window.utils.dateFormat).toJSON()
    save($registrationDate.attr('name'), date)
  }

  function save(field, value) {
    if (rootEditMode) {
      const classificationIndex = _.findIndex(program.classifications, {_id: selectedClassification._id})
      const fieldModified = field.replace(/^classification/, 'classifications.' + classificationIndex)
      rootModifiedFields[fieldModified] = value
      window.utils.setValueForPath(fieldModified.split('.'), program, value)
      onProgramUpdated(program)
      $form.find('button[name=save]').prop('disabled', false)
    } else {
      const fieldModified = field.replace(/^classification/, 'draftClassifications.' + window.user._id)
      $form.find('button[name=register]').prop('disabled', true)
      $.post('/programs/autosave/' + program._id, JSON.stringify(window.utils.keyValue(fieldModified, value))).done(function (p) {
        if ($form.find('button[name=register]').is(':enabled') && $.active > 1) {
          $form.find('button[name=register]').prop('disabled', true)
        }
        onProgramUpdated(p)
      })
    }
  }

  function onProgramUpdated(updatedProgram) {
    selectedClassification = classificationFinder(updatedProgram)
    updateAuthorOrganizationDependantValidation()
    cfu.updateWarningOrdering($form, selectedClassification)
    $form.find('.program-box-container').html(detailRenderer.render(cfu.cloneForProgramBox(updatedProgram, classificationFinder, rootEditMode)).show())
    $form.find('.program-box-container .buttons').remove()
    if (rootEditMode) $form.find('.program-box-container .classifications .classification[data-id="' + selectedClassification._id + '"]').click()
    emailRenderer.update(updatedProgram, selectedClassification, rootEditMode)
  }

  function updateAuthorOrganizationDependantValidation() {
    const isClassificationInfoRequired = !(window.enums.authorOrganizationIsElokuvalautakunta(selectedClassification) || window.enums.authorOrganizationIsKuvaohjelmalautakunta(selectedClassification) || window.enums.authorOrganizationIsKHO(selectedClassification))
    const hiddenInputNames = ['classification.reason', 'classification.buyer', 'classification.billing']
    const hiddenInputs = hiddenInputNames.map(function (name) { return $('input[name="' + name + '"]') })

    if (isClassificationInfoRequired) {
      hiddenInputs.forEach(function (input) {
        $(input).addClass('required')
        $(input).trigger('validate')
        $(input).removeAttr('disabled')
      })
    } else {
      hiddenInputs.forEach(function (input) {
        $(input).trigger('setVal', '')
        $(input).removeClass('required invalid')
        $(input).attr('disabled', 'disabled')
      })
    }
  }
}

function classificationFormUtils() {
  const nameFields = ['name', 'nameFi', 'nameSv', 'nameOther']

  return {
    renderForm: renderForm, updateWarningOrdering: updateWarningOrdering,
    registrationEmails: registrationEmails, warningDragOrder: warningDragOrder,
    cloneForProgramBox: cloneForProgramBox, select2Opts: select2Opts,
    nameFields: nameFields, nameFieldHtml: nameFieldHtml
  }

  function renderForm (program, classification, editMode) {
    $('#classification-page').html($('#templates .program-details').clone())
    const $form = $('#classification-page .program-details-form')
    renderClassificationCriteria($form)
    replaceWithStoredClassificationCriteria($form)
    renderExtraNameFields($form, program)
    filterFields($form, program, classification, editMode)
    if (editMode) configureRootEditMode($form, program)
    return $form
  }

  function renderExtraNameFields($form, p) {
    nameFields.forEach(function (field) {
      const range = p[field].length > 0 ? _.range(1, p[field].length) : _.range(0, 0)
      range.forEach(function () { $form.find('.' + field + 'Container').append(nameFieldHtml(field))
      })
    })
  }

  function nameFieldHtml(name) {
    const $input = $('<input>', {name: name, class: 'throttledNameInput extraName', type: 'text'})
    const $removeButton = $('<button>', {class: 'button removeExtraName', 'data-name-type': name, tabindex: '-1'}).text('-')
    return $input.add($removeButton)
  }

  function renderClassificationCriteria($form) {
    const lang = shared.langCookie()
    window.enums.criteriaCategories.map(function (category) {
      const classificationCriteria = window.enums.classificationCriteria.filter(function (c) { return c.category === category })
      const $criteria = classificationCriteria.map(function (c) {
        const isVet = c.category === 'vet'
        const age = shared.langCookie() === 'sv' && c.age === 0 ? 't' : c.age
        return $('<div>', {class: 'criteria agelimit agelimit-' + age, 'data-id': c.id, 'data-cy': 'criteria' + c.id})
          .append($('<h5>').text(c[lang].title + ' ').append($('<span>').text(isVet ? '' : '(' + c.id + ')')))
          .append($('<p>').html(isVet ? '' : c[lang].description))
          .append(isVet ? '' : $('<textarea>', {name: 'classification.criteriaComments.' + c.id, placeholder: shared.i18nText('Kommentit...'), class: 'throttledInput', 'data-cy': 'criteria-text'}))
      })
      $form.find('.category-container .' + category).append($criteria)
    })
  }

  function replaceWithStoredClassificationCriteria($form) {
    const lang = shared.langCookie()
    $.get('/classification/criteria').done(function (storedCriteria) {
      storedCriteria.forEach(function (criteria) {
        const i = window.enums.classificationCriteria.map(function (c) { return c.id }).indexOf(criteria.id)
        const isVet = i !== -1 && window.enums.classificationCriteria[i].category === 'vet'
        const $div = $form.find('div[data-id=' + criteria.id + ']')
        $div.find('h5').empty().append($('<h5>').text(criteria[lang].title + ' ').append($('<span>').text(isVet ? '' : '(' + criteria.id + ')')))
        $div.find('p').html(isVet ? '' : criteria[lang].description)
      })
    })
  }
  function filterFields($form, program, classification, editMode) {
    const isReclassification = window.classificationUtils.isReclassification(program, classification)
    const isInternalReclassification = isReclassification && shared.hasRole('kavi')
    const isTvEpisode = window.enums.util.isTvEpisode(program)
    const isGame = window.enums.util.isGameType(program)

    const programInfoTitle = editMode || isReclassification ? 'Kuvaohjelman tiedot' : 'Uusi kuvaohjelma'
    $form.find('.program-info h2.main span:eq(0)').i18nText(programInfoTitle)
    $form.find('.program-info h2.main span:eq(1)').i18nText(window.enums.util.programTypeName(program.programType))

    const classificationTitle = editMode || !isReclassification ? 'Luokittelu' : 'Uudelleenluokittelu'
    $form.find('.classification-details h2.main').i18nText(classificationTitle)

    if (isTvEpisode) {
      $form.find('input[name="name.0"]').prev().i18nText('Jakson alkuperäinen nimi')
      $form.find('input[name="nameFi.0"]').prev().i18nText('Jakson suomalainen nimi')
      $form.find('input[name="nameSv.0"]').prev().i18nText('Jakson ruotsinkielinen nimi')
    }
    if (!isTvEpisode) $form.find('.tv-episode-field').remove()
    if (isGame) $form.find('.non-game-field').remove()
    if (!isGame) $form.find('.game-field').remove()

    const showDuration = !window.enums.util.isGameType(program) || shared.hasRole('kavi')
    if (!showDuration) $form.find('.duration-field').remove()
    if (showDuration && window.enums.util.isGameType(program)) $form.find('.duration-field label').i18nText('Luokittelun kesto')

    if (shared.hasRole('root')) {
      $form.find('.vet-container').removeClass('hide')
      $form.find('.preventSendingEmail').removeClass('hide')
    } else {
      $form.find('input[name="classification.registrationDate"]').prop('disabled', true)
    }
    if (!shared.hasRole('root') && isInternalReclassification && !window.enums.isOikaisupyynto(classification.reason)) {
      $form.find('input[name="classification.buyer"], input[name="classification.billing"]').prop('disabled', true)
    }
    if (isInternalReclassification) {
      $form.find('.kavi-type').remove()
    } else {
      $form.find('.author-and-reason-fields').remove()
      $form.find('.public-comments').remove()
    }
    if (shared.hasRole('kavi')) $form.find('.user-comments').remove()
    else {
      $form.find('.private-comments').remove()
      $form.find('.kavi-type').remove()
    }

    if (isReclassification && !editMode) {
      $form.find('.program-info input, .program-info textarea').prop('disabled', true)
      $form.find('.program-info button.addExtraName').remove()
      $form.find('.program-info button.removeExtraName').remove()
    }
  }

  function configureRootEditMode($form, p) {
    if (!shared.hasRole('root')) {
      $form.find('input[name="classification.buyer"], input[name="classification.billing"]').prop('disabled', true)
    }
    if (_.isEmpty(p.classifications)) {
      $form.find('.classification-details, .classification-summary, .classification-criteria, .classification-email').remove()
      if (!window.enums.util.isTvSeriesName(p)) {
        $form.find('.program-box-container').replaceWith($('<span>').text('Ohjelma ei näy ikärajat.fi-palvelussa, sillä sillä ei ole yhtään luokittelua.'))
      }
    }
    $form.find('.classification-author-field').replaceWith($('#templates > .root-edit-author-and-date-fields').clone().html())
    $form.find('.classification-email h3.main').text('Luokittelupäätös')
    $form.find('button[name=save]').show()
    $form.find('button[name=register]').hide()
  }

  function updateWarningOrdering($form, classification) {
    const summary = window.classificationUtils.summary(classification)
    const warnings = [$('<span>', {class: 'drop-target'})].concat(summary.warnings.map(function (w) {
      return $('<span>', {'data-id': w.category, class: 'warning ' + w.category, draggable: true}).add($('<span>', {class: 'drop-target'}))
    }))
    $form.find('.warning-order')
      .find('.agelimit img').attr('src', shared.ageLimitIcon(summary)).end()
      .find('.warnings').html(warnings).end()
  }

  function registrationEmails($form, saveFn) {
    const $preview = $form.find('.classification-email .email-preview')
    const $input = $form.find('input[name="classification.registrationEmailAddresses"]')
    let currentBuyerId = null

    function render(program, classification, rootEditMode) {
      const opts = {
        tags: [],
        minimumInputLength: 1,
        formatInputTooShort: '',
        formatNoMatches: '',
        formatResult: formatDropdownItem,
        formatSelection: function (item) { return item.id },
        createSearchChoice: function (term) { return {id: term.replace(/,/g, '&#44;'), text: term, isNew: true} },
        initSelection: function (e, callback) { callback([]) },
        query: function (query) {
          return $.get('/emails/search?q=' + encodeURIComponent(query.term)).done(function (data) { return query.callback({results: data}) })
        }
      }
      $input.select2(opts).on('change', function () {
        const manual = _($(this).select2('data')).filter(function (e) { return !e.locked }).map('id').value()
        saveFn($(this).attr('name'), manual)
      })
      update(program, classification, rootEditMode)
      return this
    }

    function formatDropdownItem(item) {
      if (!item.role) return item.id
      const icon = 'select2-dropdown-result-icon ' + (item.role === 'user' ? 'fa fa-male' : 'fa fa-university')
      return $('<div>').text(item.name + ' <' + item.id + '>').prepend($('<i>').addClass(icon))
    }

    function update(program, classification) {
      if (shouldUpdateBuyer(classification)) {
        currentBuyerId = classification.buyer._id
        $.get('/accounts/' + currentBuyerId + '/emailAddresses').done(function (account) {
          updateEmails('buyer', account.emailAddresses)
        })
      }

      const email = window.classificationUtils.registrationEmail(program, classification, window.user, location.protocol + '//' + location.host)

      if (window.user.role === 'kavi') $.get('/fixedKaviRecipients').done(updateAllEmails)
      else updateAllEmails([])

      function updateAllEmails(fixedKaviRecipients) {
        updateEmails('kavi', fixedKaviRecipients)
        updateEmails('sent', email.recipients)
        updateEmails('manual', classification.registrationEmailAddresses)
      }

      function updateEmails(source, emails) {
        const current = getCurrentEmailSelection()
        const bySource = _.curry(function (s, e) { return e.source === s })
        const toOption = _.curry(function (s, locked, e) { return {id: e, text: e, locked: locked, source: s} })
        const kavi = source === 'kavi' ? emails.map(toOption('kavi', true)) : current.filter(bySource('kavi'))
        const sent = source === 'sent' ? emails.map(toOption('sent', true)) : current.filter(bySource('sent'))
        const buyer = source === 'buyer' ? emails.map(toOption('buyer', true)) : current.filter(bySource('buyer'))
        const manual = source === 'manual' ? emails.map(toOption('manual', false)) : current.filter(bySource('manual'))
        $input.select2('data', sent.concat(buyer).concat(manual).concat(kavi)).trigger('validate')
      }

      function getCurrentEmailSelection() {
        return $input.length > 0 ? $input.select2('data') : []
      }

      $preview.find('.subject').text(email.subject)
      $preview.find('.body').html(email.body)
    }

    function shouldUpdateBuyer(cl) {
      return cl && cl.buyer && cl.buyer._id !== currentBuyerId
    }

    return {render: render, update: update}
  }

  function warningDragOrder($el, saveFn) {
    $el.on('dragstart', '.warnings .warning', function (e) {
      const $e = $(this)
      e.originalEvent.dataTransfer.effectAllowed = 'move'
      e.originalEvent.dataTransfer.setData('text', this.outerHTML)
      $el.find('.drop-target').not($e.next()).addClass('valid')
      setTimeout(function () { $e.add($e.next()).addClass('dragging') }, 0)
    })
    $el.on('dragenter', '.warnings .drop-target.valid', function (e) {
      e.preventDefault()
      return true
    })
    $el.on('dragover', '.warnings .drop-target.valid', function (e) {
      $(this).addClass('active')
      e.preventDefault()
    })
    $el.on('dragleave', '.warnings .drop-target.valid', function (e) {
      $(this).removeClass('active')
      e.preventDefault()
    })
    $el.on('dragend', '.warnings .warning', function () {
      $(this).add($(this).next()).removeClass('dragging')
      $el.find('.drop-target').removeClass('valid').removeClass('active')
    })
    $el.on('drop', '.warnings .drop-target', function (e) {
      e.preventDefault()
      e.originalEvent.dataTransfer.dropEffect = 'move'
      $el.find('.drop-target.valid').removeClass('valid')
      $el.find('.dragging').remove()
      $(this).replaceWith([
        $('<span>', {class: 'drop-target'}),
        $(e.originalEvent.dataTransfer.getData('text')),
        $('<span>', {class: 'drop-target'})
      ])
      const newOrder = $el.find('.warnings .warning').map(function () { return $(this).data('id') }).get()
      saveFn('classification.warningOrder', newOrder)
    })
  }

  function cloneForProgramBox(p, classificationFinder, rootEditMode) {
    const programClone = _.cloneDeep(p)
    const classificationClone = classificationFinder(programClone)
    delete programClone.draftClassifications
    const sensitiveClassificationFields = ['author', 'billing', 'buyer', 'authorOrganization', 'reason', 'kaviType', 'comments', 'criteriaComments']
    programClone.classifications.forEach(function (c) {
      sensitiveClassificationFields.forEach(function (f) { delete c[f] })
    })
    sensitiveClassificationFields.forEach(function (f) { delete classificationClone[f] })
    if (!rootEditMode) {
      programClone.classifications.unshift(classificationClone)
    }
    return programClone
  }

  function select2Opts($form) {
    return {
     series: {
        $el: $form.find('input[name=series]'),
        path: function (term) { return '/series/search?q=' + encodeURIComponent(term) },
        toOption: meku.idNamePairToSelect2Option,
        fromOption: meku.select2OptionToIdNamePair,
        allowAdding: true,
        termMinLength: 0
      },
      countries: {
        $el: $form.find('input[name="country"]'),
        data: Object.keys(window.enums.countries).map(function (key) { return {id: key, text: window.enums.countries[key]} }),
        multiple: true
      },
      productionCompanies: {
        $el: $form.find('input[name=productionCompanies]'),
        path: function (term) { return '/productionCompanies/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      gameFormat: {
        $el: $form.find('input[name=gameFormat]'),
        data: window.enums.gameFormat.map(function (f) { return {id: f, text: f} })
      },
      genre: function (program) {
        const data = window.enums.util.isMovieType(program) ? window.enums.movieGenre : window.enums.util.isGameType(program) ? window.enums.legacyGameGenres : window.enums.tvGenre
        return {
          $el: $form.find('input[name=genre]'),
          data: data.map(function (f) { return {id: f, text: f} }),
          multiple: true
        }
      },
      directors: {
        $el: $form.find('input[name=directors]'),
        path: function (term) { return '/directors/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      actors: {
        $el: $form.find('input[name=actors]'),
        path: function (term) { return '/actors/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      author: {
        $el: $form.find('input[name="classification.author"]'),
        path: function (term) { return '/users/search?q=' + encodeURIComponent(term) },
        toOption: meku.userToSelect2Option,
        fromOption: meku.select2OptionToUser,
        formatSelection: function (user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
        formatResultCssClass: function (user) { return user.active ? '' : 'grey' },
        termMinLength: 0
      },
      buyer: {
        $el: $form.find('input[name="classification.buyer"]'),
        path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber' },
        toOption: meku.idNamePairToSelect2Option,
        fromOption: meku.select2OptionToIdNamePair,
        termMinLength: 0
      },
      billing: {
        $el: $form.find('input[name="classification.billing"]'),
        path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber,Classifier' },
        toOption: meku.idNamePairToSelect2Option,
        fromOption: meku.select2OptionToIdNamePair,
        termMinLength: 0
      },
      format: {
        $el: $form.find('input[name="classification.format"]'),
        data: window.enums.format.map(function (f) { return {id: f, text: f} }),
        formatResult: function (obj, $container, query) {
          if (query.term === '' && obj.text === 'Verkkoaineisto') {
            $container.addClass('space-below')
          }
          return obj.text
        }
      },
      authorOrg: {
        $el: $form.find('input[name="classification.authorOrganization"]'),
          data: _.map(_.chain(window.enums.authorOrganization).toPairs().tail().value(), function (pair) { return {id: pair[0], text: pair[1]} }),
        fromOption: meku.select2OptionToInt
      },
      reason: {
        $el: $form.find('input[name="classification.reason"]'),
        data: _.map(window.enums.reclassificationReason, function (reason, id) { return {id: id, text: reason.uiText} }),
        fromOption: meku.select2OptionToInt
      },
      kaviType: {
        $el: $form.find('input[name="classification.kaviType"]'),
        data: _.map(window.enums.kaviType, function (reason, id) { return {id: id, text: reason.uiText} }),
        fromOption: meku.select2OptionToInt
      }
    }
  }
}

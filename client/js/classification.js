function classificationPage() {
  var $root = $('#classification-page')

  $root.on('show', function (e, programId, rootEditMode, classificationId) {
    if (rootEditMode) {
      setLocation('#luokittelu/' + programId + '/edit/' + (classificationId || ''))
      $.get('/programs/' + programId).done(function(program) {
        classificationForm(program, rootClassificationFinder(classificationId), true)
      })
    } else if (programId) {
      setLocation('#luokittelu/' + programId)
      $.get('/programs/' + programId).done(function(program) {
        classificationForm(program, draftClassificationFinder, false)
      })
    } else {
      setLocation('#luokittelu')
    }
    $('.navi li:first a').addClass('active')
  })

  function rootClassificationFinder(classificationId) {
    return function(program) {
      return _.find(program.classifications, { _id:classificationId }) || { criteria: [], warningOrder: [], registrationEmailAddresses: [] }
    }
  }
  function draftClassificationFinder(program) {
    return program.draftClassifications[user._id]
  }
}

function classificationForm(program, classificationFinder, rootEditMode) {
  var selectedClassification = classificationFinder(program)
  var rootModifiedFields = {}
  var cfu = classificationFormUtils()
  var $form = cfu.renderForm(program, selectedClassification, rootEditMode)
  var select2Opts = cfu.select2Opts($form)
  var detailRenderer = programBox()
  var emailRenderer = cfu.registrationEmails($form, save).render(program, selectedClassification, rootEditMode)

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
      .find('input[name="series.draft.name"]').val(utils.getProperty(p, 'series.draft.name') || '').end()
      .find('input[name="series.draft.nameFi"]').val(utils.getProperty(p, 'series.draft.nameFi') || '').end()
      .find('input[name="series.draft.nameSv"]').val(utils.getProperty(p, 'series.draft.nameSv') || '').end()
      .find('input[name="series.draft.nameOther"]').val(utils.getProperty(p, 'series.draft.nameOther') || '').end()

    cfu.nameFields.forEach(function(field) {
      p[field].forEach(function(val, index) {
        $form.find('input[name="'+field+'"]').eq(index).val(val).end()
      })
    })
    select2Autocomplete(select2Opts.series, save).trigger('setVal', p.series)
    select2EnumAutocomplete(select2Opts.countries, save).trigger('setVal', p.country)
    select2Autocomplete(select2Opts.productionCompanies, save).trigger('setVal', p.productionCompanies)
    select2EnumAutocomplete(select2Opts.gameFormat, save).trigger('setVal', p.gameFormat)
    select2EnumAutocomplete(select2Opts.genre(p), save).trigger('setVal', p.genre)
    select2Autocomplete(select2Opts.directors, save).trigger('setVal', p.directors)
    select2Autocomplete(select2Opts.actors, save).trigger('setVal', p.actors)
  }

  function setClassificationFields(c) {
    var authorOrgVal = typeof c.authorOrganization == 'number' ? c.authorOrganization.toString() : ''
    var reasonVal = typeof c.reason == 'number' ? c.reason.toString() : ''
    var isVetClassification =_.find(c.criteria.map(function(id) { return enums.classificationCriteria[id - 1].category === 'vet' })) != undefined

    $form
      .find('span.author').text(utils.getProperty(c, 'author.name') || '-').end()
      .find('input[name="classification.duration"]').val(c.duration).end()
      .find('textarea[name="classification.comments"]').val(c.comments).end()
      .find('textarea[name="classification.publicComments"]').val(c.publicComments).end()
      .find('input[name="classification.safe"]').prop('checked', !!c.safe).end()
      .find('input[name="classification.vet"]').prop('checked', isVetClassification).end()
      .find('.category-container').toggle(!c.safe).end()
      .find('.vet').toggle(isVetClassification).end()

    select2Autocomplete(select2Opts.author, save).trigger('setVal', c.author)
    select2Autocomplete(select2Opts.buyer, save).trigger('setVal', c.buyer)
    select2Autocomplete(select2Opts.billing, save).trigger('setVal', c.billing)
    select2EnumAutocomplete(select2Opts.format, save).trigger('setVal', c.format)
    select2EnumAutocomplete(select2Opts.authorOrg, save).trigger('setVal', authorOrgVal)
    select2EnumAutocomplete(select2Opts.reason, save).trigger('setVal', reasonVal)

    var $registrationDate = $form.find('input[name="classification.registrationDate"]')
    var pikadayOpts = {
      defaultDate: c.registrationDate ? moment(c.registrationDate).toDate() : '',
      onSelect: function() { $registrationDate.trigger('input') }
    }
    $registrationDate.pikaday(_.defaults(pikadayOpts, pikadayDefaults))

    c.criteria.forEach(function(id) { $form.find('.criteria[data-id=' + id + ']').addClass('selected') })
    Object.keys(c.criteriaComments || {}).forEach(function(id) {
      var txt = c.criteriaComments[id]
      if (isNotEmpty(txt)) {
        $form.find('textarea[name="classification.criteriaComments.'+id+'"]').val(txt).parents('.criteria').addClass('has-comment')
      }
    })
  }

  function configureValidation() {
    $form.on('validation throttled', function() {
      // For select2's, we only care about the original element from which the invalid class has been removed
      var required = $form.find('.required.invalid')
        .not('.select2-container.required.invalid')
        .not('.select2-drop.required.invalid')
        .not('input:disabled, textarea:disabled')
      // Enable to log validation:
      // required.length == 0 ? console.log('valid.') : console.log('invalid: ', required.map(function() { return $(this).prop('name') }).toArray())
      var throttled = $form.find('.throttled')
      $form.find('button[name=register]').prop('disabled', (required.length > 0 || throttled.length > 0) && !$('input[name="classification.vet"]').is(':checked'))
    })
    validateTextChange($form.find('.required'), isNotEmpty)
    validateTextChange($form.find('input[name=year]'), utils.isValidYear)
    validateTextChange($form.find('input[name="classification.registrationDate"]'), utils.isEmptyOrValidDate)
    validateTextChange($form.find('.duration'), utils.isValidDuration)
    validateTextChange($form.find('input[name="classification.registrationEmailAddresses"]'), isMultiEmail)
    $form.on('select2-blur', function(e) { $(e.target).addClass('touched') })
    $form.find('.required').trigger('validate')
  }

  function configureEventBinding() {
    $form.find('textarea').autosize()
    $form.on('submit', function(e) {
      $form.find('button[name=register]').prop('disabled', true)
      e.preventDefault()
      $.post('/programs/' + program._id + '/register', JSON.stringify({preventSendingEmail: $form.find('input[name="classification.preventSendingEmail"]:checked').length})).done(function(savedProgram) {
        $form.hide()
        $("#search-page").trigger('show').show()
        showDialog($('<div>', {class: 'registration-confirmation dialog'})
          .append($('<span>', {class: 'name'}).text(savedProgram.name))
          .append(renderWarningSummary(classificationUtils.fullSummary(savedProgram)))
          .append($('<p>', {class: 'registration-date'}).text(i18nText('Rekisteröity') + ' ' + utils.asDateTime(savedProgram.classifications[0].registrationDate)))
          .append($('<p>', {class: 'buttons'}).html($('<button>', { click: closeDialog, class: 'button' }).i18nText('Sulje'))))
        $(window).scrollTop(0)
      })
    })
    $form.find('button[name=save]').on('click', function(e) {
      $form.find('button[name=save]').prop('disabled', true)
      e.preventDefault()
      $.post('/programs/' + program._id, JSON.stringify(rootModifiedFields)).done(function(program) {
        $('#classification-page').trigger('show', [program._id, 'edit', selectedClassification._id]).show()
        showDialog($('#templates').find('.modify-success-dialog').clone().find('button.ok').click(closeDialog).end())
      })
    })
    $form.on('click', '.back-to-search', function(e) {
      e.preventDefault()
      $form.hide()
      $("#search-page").trigger('show').show()
    })
    $form.find('.throttledInput').throttledInput(function(txt) {
      if (($(this).is(':invalid') || $(this).hasClass('invalid')) && $(this).val().length > 0) return false
      save($(this).attr('name'), txt)
    })

    $form.find('.throttledNameInput').throttledInput(function() { saveNames($(this).attr('name'), $(this).parent()) })

    $form.on('click', 'button.addExtraName', function(e) {
      e.preventDefault()
      var fieldName = $(this).data('name-type')
      var $html = cfu.nameFieldHtml(fieldName).appendTo($(this).parent())
      $html.filter('input[type=text]').throttledInput(function() { saveNames(fieldName, $(this).parent()) })
    })
    $form.on('click', 'button.removeExtraName', function(e) {
      e.preventDefault()
      var $container = $(this).parent()
      $(this).prev().add($(this)).remove()
      saveNames($(this).data('name-type'), $container)
    })

    function saveNames(fieldName, $container) {
      var values = $container.find('input[type=text]').map(function() { return $(this).val() }).toArray()
      save(fieldName, values)
    }

    $form.find('input[name="classification.safe"]').change(function() {
      var safe = $(this).is(':checked')
      $form.find('.category-container').slideToggle()
      save($(this).attr('name'), safe)
    })
    $form.find('.safe-container span').click(function() {
      $(this).prev().click()
    })
    $form.find('input[name="classification.vet"]').change(function() {
      $('.vet').toggle($(this).is(':checked'))
      var ids = $form.find('.category .criteria.selected:visible').map(function(i, e) { return $(e).data('id') }).get()
      save('classification.criteria', ids)
      $form.find('.required').trigger('validate')
    })
    $form.find('.vet-container span').click(function() {
      $(this).prev().click()
    })
    $form.find('input[name="series"]').on('change', function() { onSeriesChanged(false) })
    onSeriesChanged(true)

    $form.find('input[name="series.draft.name"]').on('input', function() {
      var val = $(this).val()
      $form.find('input[name="series"]').select2('data', { id: val, text: val, isNew: true })
    })
    $form.find('input[name="classification.registrationDate"]').on('input', function() {
      if ($(this).hasClass('invalid')) return false
      var val = $.trim($(this).val())
      var date = val != '' ? moment(val, utils.dateFormat).toJSON() : ''
      save($(this).attr('name'), date)
    })
    $form.find('input[name="classification.buyer"]').on('change', function() {
      var $billing = $form.find('input[name="classification.billing"]')
      if (!$billing.select2('data')) $billing.select2('data', $(this).select2('data')).trigger('validate').trigger('change')
    })
    $form.find('input[name="classification.reason"]').on('change', function(e) {
      if (rootEditMode) return
      var $buyerAndBilling = $form.find('input[name="classification.buyer"], input[name="classification.billing"]')
      $buyerAndBilling.removeClass('touched').select2('enable', hasRole('root') || enums.isOikaisupyynto($(this).val())).select2('val', '').trigger('validate').trigger('change')
    })
    $form.on('click', '.category .criteria', function() {
      $(this).toggleClass('selected').toggleClass('has-comment', isNotEmpty($(this).find('textarea').val() || ''))
      var ids = $form.find('.category .criteria.selected').map(function(i, e) { return $(e).data('id') }).get()
      if ($(this).hasClass('selected')) $(this).find('textarea').focus()
      save('classification.criteria', ids)
    })
    $form.on('click', '.category .criteria textarea', stopPropagation)
    $form.on('blur', '.category .criteria.has-comment:not(.selected) textarea', function() {
      $(this).parents('.criteria').toggleClass('has-comment', isNotEmpty($(this).val()))
    })
    cfu.warningDragOrder($form.find('.classification-criteria .warning-order'), save)

    function onSeriesChanged(isInitial) {
      var data = $form.find('input[name="series"]').select2('data')
      if (!data) return
      var $container = $form.find('.new-series-fields')
      var $inputs = $container.find('input')
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

  function save(field, value) {
    if (rootEditMode) {
      var classificationIndex = _.findIndex(program.classifications, { _id: selectedClassification._id })
      field = field.replace(/^classification/, 'classifications.'+classificationIndex)
      rootModifiedFields[field] = value
      utils.setValueForPath(field.split('.'), program, value)
      onProgramUpdated(program)
      $form.find('button[name=save]').prop('disabled', false)
    } else {
      field = field.replace(/^classification/, 'draftClassifications.' + user._id)
      $form.find('button[name=register]').prop('disabled', true)
      $.post('/programs/autosave/' + program._id, JSON.stringify(utils.keyValue(field, value))).done(function(p) {
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
    if (rootEditMode) $form.find('.program-box-container .classifications .classification[data-id="'+selectedClassification._id+'"]').click()
    emailRenderer.update(updatedProgram, selectedClassification, rootEditMode)
  }

  function updateAuthorOrganizationDependantValidation() {
    var isClassificationInfoRequired = !(enums.authorOrganizationIsElokuvalautakunta(selectedClassification) || enums.authorOrganizationIsKuvaohjelmalautakunta(selectedClassification) || enums.authorOrganizationIsKHO(selectedClassification))
    var hiddenInputNames = ['classification.reason', 'classification.buyer', 'classification.billing']
    var hiddenInputs = hiddenInputNames.map(function (name) { return $('input[name="' + name + '"]') })

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
  var nameFields = ['name', 'nameFi', 'nameSv', 'nameOther']

  return {
    renderForm: renderForm, updateWarningOrdering: updateWarningOrdering,
    registrationEmails: registrationEmails, warningDragOrder: warningDragOrder,
    cloneForProgramBox: cloneForProgramBox,  select2Opts: select2Opts,
    nameFields: nameFields, nameFieldHtml: nameFieldHtml
  }

  function renderForm(program, classification, editMode) {
    $('#classification-page').html($('#templates .program-details').clone())
    var $form = $('#classification-page .program-details-form')
    renderClassificationCriteria($form)
    replaceWithStoredClassificationCriteria($form)
    renderExtraNameFields($form, program)
    filterFields($form, program, classification, editMode)
    if (editMode) configureRootEditMode($form, program, classification)
    return $form
  }

  function renderExtraNameFields($form, p) {
    nameFields.forEach(function(field) {
      _.range(1, p[field].length).forEach(function() {
        $form.find('.' + field + 'Container').append(nameFieldHtml(field))
      })
    })
  }

  function nameFieldHtml(name) {
    var $input = $('<input>', { name: name, class: 'throttledNameInput extraName', type: 'text' })
    var $removeButton = $('<button>', { class: 'button removeExtraName', 'data-name-type': name, tabindex: '-1' }).text('-')
    return $input.add($removeButton)
  }

  function renderClassificationCriteria($form) {
    var lang = langCookie()
    enums.criteriaCategories.map(function(category) {
      var classificationCriteria = enums.classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = classificationCriteria.map(function (c) {
        var isVet = c.category === 'vet'
        return $('<div>', {class: 'criteria agelimit ' + 'agelimit-' + c.age, 'data-id': c.id})
          .append($('<h5>').text(c[lang].title + ' ').append($('<span>').text(isVet ? '' : '(' + c.id + ')')))
          .append($('<p>').html(isVet ? '' : c[lang].description))
          .append(isVet ? '' : $('<textarea>', { name:'classification.criteriaComments.' + c.id, placeholder:i18nText('Kommentit...'), class:'throttledInput' }))
      })
      $form.find('.category-container .' + category).append($criteria)
    })
  }

  function replaceWithStoredClassificationCriteria($form) {
    var lang = langCookie()
    $.get('/classification/criteria').done(function (storedCriteria) {
      storedCriteria.forEach(function (criteria) {
        var isVet = enums.classificationCriteria.find(function (c) { return c.id == criteria.id}).category === 'vet'
        var $div = $form.find('div[data-id=' + criteria.id + ']')
        $div.find('h5').empty().append($('<h5>').text(criteria[lang].title + ' ').append($('<span>').text(isVet ? '' : '(' + criteria.id + ')')))
        $div.find('p').html(isVet ? '' : criteria[lang].description)
      })
    })
  }
  function filterFields($form, program, classification, editMode) {
    var isReclassification = classificationUtils.isReclassification(program, classification)
    var isInternalReclassification = isReclassification && hasRole('kavi')
    var isTvEpisode = enums.util.isTvEpisode(program)
    var isGame = enums.util.isGameType(program)

    var programInfoTitle = (editMode || isReclassification) ? 'Kuvaohjelman tiedot' : 'Uusi kuvaohjelma'
    $form.find('.program-info h2.main span:eq(0)').i18nText(programInfoTitle)
    $form.find('.program-info h2.main span:eq(1)').i18nText(enums.util.programTypeName(program.programType))

    var classificationTitle = (editMode || !isReclassification) ? 'Luokittelu' : 'Uudelleenluokittelu'
    $form.find('.classification-details h2.main').i18nText(classificationTitle)

    if (isTvEpisode) {
      $form.find('input[name="name.0"]').prev().i18nText('Jakson alkuperäinen nimi')
      $form.find('input[name="nameFi.0"]').prev().i18nText('Jakson suomalainen nimi')
      $form.find('input[name="nameSv.0"]').prev().i18nText('Jakson ruotsinkielinen nimi')
    }
    if (!isTvEpisode) $form.find('.tv-episode-field').remove()
    if (isGame) $form.find('.non-game-field').remove()
    if (!isGame) $form.find('.game-field').remove()

    var showDuration = !enums.util.isGameType(program) || hasRole('kavi')
    if (!showDuration) $form.find('.duration-field').remove()
    if (showDuration && enums.util.isGameType(program)) $form.find('.duration-field label').i18nText('Luokittelun kesto')

    if (hasRole('root')) {
      $form.find('.vet-container').removeClass('hide')
      $form.find('.preventSendingEmail').removeClass('hide')
    } else {
      $form.find('input[name="classification.registrationDate"]').prop('disabled', true)
    }
    if (!hasRole('root') && isInternalReclassification && !enums.isOikaisupyynto(classification.reason)) {
      $form.find('input[name="classification.buyer"], input[name="classification.billing"]').prop('disabled', true)
    }
    if (!isInternalReclassification) {
      $form.find('.author-and-reason-fields').remove()
      $form.find('.public-comments').remove()
    }
    if (!hasRole('kavi')) $form.find('.private-comments').remove()

    if (isReclassification && !editMode) {
      $form.find('.program-info input, .program-info textarea').prop('disabled', true)
      $form.find('.program-info button.addExtraName').remove()
      $form.find('.program-info button.removeExtraName').remove()
    }
  }

  function configureRootEditMode($form, p, c) {
    if (!hasRole('root')) {
      $form.find('input[name="classification.buyer"], input[name="classification.billing"]').prop('disabled', true)
    }
    if (_.isEmpty(p.classifications)) {
      $form.find('.classification-details, .classification-summary, .classification-criteria, .classification-email').remove()
      if (!enums.util.isTvSeriesName(p)) {
        $form.find('.program-box-container').replaceWith($('<span>').text('Ohjelma ei näy ikärajat.fi-palvelussa, sillä sillä ei ole yhtään luokittelua.'))
      }
    }
    $form.find('.classification-author-field').replaceWith($('#templates > .root-edit-author-and-date-fields').clone().html())
    $form.find('.classification-email h3.main').text('Luokittelupäätös')
    $form.find('button[name=save]').show()
    $form.find('button[name=register]').hide()
  }

  function updateWarningOrdering($form, classification) {
    var summary = classificationUtils.summary(classification)
    var warnings = [$('<span>', { class:'drop-target' })].concat(summary.warnings.map(function(w) { return $('<span>', { 'data-id': w.category, class:'warning ' + w.category, draggable:true }).add($('<span>', { class:'drop-target' })) }))
    $form.find('.warning-order')
      .find('.agelimit img').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warnings).end()
  }

  function registrationEmails($form, saveFn) {
    var $preview = $form.find('.classification-email .email-preview')
    var $input = $form.find('input[name="classification.registrationEmailAddresses"]')
    var currentBuyerId = null

    function render(program, classification, rootEditMode) {
      var opts = {
        tags: [],
        minimumInputLength: 1,
        formatInputTooShort: '',
        formatNoMatches: '',
        formatResult: formatDropdownItem,
        formatSelection: function(item) { return item.id },
        createSearchChoice: function(term) { return { id: term.replace(/,/g, '&#44;'), text: term, isNew: true } },
        initSelection: function(e, callback) { callback([]) },
        query: function(query) {
          return $.get('/emails/search?q='+encodeURIComponent(query.term)).done(function(data) {
            return query.callback({ results: data })
          })
        }
      }
      $input.select2(opts).on('change', function() {
        var manual = _($(this).select2('data')).filter(function(e) { return !e.locked }).pluck('id').value()
        saveFn($(this).attr('name'), manual)
      })
      if (rootEditMode) {
        $input.select2('enable', false)
      }
      update(program, classification, rootEditMode)
      return this
    }

    function formatDropdownItem(item) {
      if (!item.role) return item.id
      var icon = 'select2-dropdown-result-icon ' + (item.role == 'user' ? 'fa fa-male' : 'fa fa-university')
      return $('<div>').text(item.name+' <'+item.id+'>').prepend($('<i>').addClass(icon))
    }

    function update(program, classification) {
      if (shouldUpdateBuyer(classification)) {
        currentBuyerId = classification.buyer._id
        $.get('/accounts/' + currentBuyerId + '/emailAddresses').done(function(account) {
          updateEmails('buyer', account.emailAddresses)
        })
      }

      var email = classificationUtils.registrationEmail(program, classification, user, location.protocol + '//' + location.host)

      updateEmails('sent', email.recipients)
      updateEmails('manual', classification.registrationEmailAddresses)

      function updateEmails(source, emails) {
        var current = getCurrentEmailSelection()
        var bySource = _.curry(function(source, e) { return e.source == source })
        var toOption = _.curry(function(source, locked, e) { return {id: e, text: e, locked: locked, source: source } })
        var sent = source == 'sent' ? emails.map(toOption('sent', true)) : current.filter(bySource('sent'))
        var buyer = source == 'buyer' ? emails.map(toOption('buyer', true)) : current.filter(bySource('buyer'))
        var manual = source == 'manual' ? emails.map(toOption('manual', false)) : current.filter(bySource('manual'))
        $input.select2('data', sent.concat(buyer).concat(manual)).trigger('validate')
      }

      function getCurrentEmailSelection() {
        return $input.length > 0 ? $input.select2('data') : []
      }

      $preview.find('.subject').text(email.subject)
      $preview.find('.body').html(email.body)
    }

    function shouldUpdateBuyer(cl) {
      return cl && cl.buyer && cl.buyer._id != currentBuyerId
    }

    return { render: render, update: update}
  }

  function warningDragOrder($el, saveFn) {
    $el.on('dragstart', '.warnings .warning', function(e) {
      var $e = $(this)
      e.originalEvent.dataTransfer.effectAllowed = 'move'
      e.originalEvent.dataTransfer.setData('text', this.outerHTML)
      $el.find('.drop-target').not($e.next()).addClass('valid')
      setTimeout(function() { $e.add($e.next()).addClass('dragging') }, 0)
    })
    $el.on('dragenter', '.warnings .drop-target.valid', function(e) {
      e.preventDefault()
      return true
    })
    $el.on('dragover', '.warnings .drop-target.valid', function(e) {
      $(this).addClass('active')
      e.preventDefault()
    })
    $el.on('dragleave', '.warnings .drop-target.valid', function(e) {
      $(this).removeClass('active')
      e.preventDefault()
    })
    $el.on('dragend', '.warnings .warning', function(e) {
      $(this).add($(this).next()).removeClass('dragging')
      $el.find('.drop-target').removeClass('valid').removeClass('active')
    })
    $el.on('drop', '.warnings .drop-target', function(e) {
      e.preventDefault()
      e.originalEvent.dataTransfer.dropEffect = 'move'
      $el.find('.drop-target.valid').removeClass('valid')
      $el.find('.dragging').remove()
      $(this).replaceWith([
        $('<span>', { class:'drop-target' }),
        $(e.originalEvent.dataTransfer.getData('text')),
        $('<span>', { class:'drop-target' })
      ])
      var newOrder = $el.find('.warnings .warning').map(function() { return $(this).data('id') }).get()
      saveFn('classification.warningOrder', newOrder)
    })
  }

  function cloneForProgramBox(p, classificationFinder, rootEditMode) {
    var programClone = _.cloneDeep(p)
    var classificationClone = classificationFinder(programClone)
    delete programClone.draftClassifications
    var sensitiveClassificationFields = ['author', 'billing', 'buyer', 'authorOrganization', 'reason', 'comments', 'criteriaComments']
    programClone.classifications.forEach(function(c) {
      sensitiveClassificationFields.forEach(function(f) { delete c[f] })
    })
    sensitiveClassificationFields.forEach(function(f) { delete classificationClone[f] })
    if (!rootEditMode) {
      programClone.classifications.unshift(classificationClone)
    }
    return programClone
  }

  function select2Opts($form) {
    return {
     series: {
        $el: $form.find('input[name=series]'),
        path: function(term) { return '/series/search?q=' + encodeURIComponent(term) },
        toOption: idNamePairToSelect2Option,
        fromOption: select2OptionToIdNamePair,
        allowAdding: true,
        termMinLength: 0
      },
      countries: {
        $el: $form.find('input[name="country"]'),
        data: Object.keys(enums.countries).map(function(key) { return { id: key, text: enums.countries[key] }}),
        multiple: true
      },
      productionCompanies: {
        $el: $form.find('input[name=productionCompanies]'),
        path: function(term) { return '/productionCompanies/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      gameFormat: {
        $el: $form.find('input[name=gameFormat]'),
        data: enums.gameFormat.map(function(f) { return { id: f, text: f }})
      },
      genre: function(program) {
        var data = enums.util.isMovieType(program) ? enums.movieGenre : enums.util.isGameType(program) ? enums.legacyGameGenres : enums.tvGenre
        return {
          $el: $form.find('input[name=genre]'),
          data: data.map(function(f) { return { id: f, text: f }}),
          multiple: true
        }
      },
      directors: {
        $el: $form.find('input[name=directors]'),
        path: function(term) { return '/directors/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      actors: {
        $el: $form.find('input[name=actors]'),
        path: function(term) { return '/actors/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true,
        termMinLength: 0
      },
      author: {
        $el: $form.find('input[name="classification.author"]'),
        path: function(term) { return '/users/search?q=' + encodeURIComponent(term) },
        toOption: userToSelect2Option,
        fromOption: select2OptionToUser,
        formatSelection: function(user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
        formatResultCssClass: function(user) { return user.active ? '' : 'grey' },
        termMinLength: 0
      },
      buyer: {
        $el: $form.find('input[name="classification.buyer"]'),
        path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber' },
        toOption: idNamePairToSelect2Option,
        fromOption: select2OptionToIdNamePair,
        termMinLength: 0
      },
      billing: {
        $el: $form.find('input[name="classification.billing"]'),
        path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber,Classifier' },
        toOption: idNamePairToSelect2Option,
        fromOption: select2OptionToIdNamePair,
        termMinLength: 0
      },
      format: {
        $el: $form.find('input[name="classification.format"]'),
        data: enums.format.map(function(f) { return { id: f, text: f }}),
        formatResult: function(obj, $container, query) {
          if (query.term == '' && obj.text == 'Verkkoaineisto') {
            $container.addClass('space-below')
          }
          return obj.text
        }
      },
      authorOrg: {
        $el: $form.find('input[name="classification.authorOrganization"]'),
          data: _.map(_.chain(enums.authorOrganization).pairs().rest().value(), function(pair) { return { id: pair[0], text: pair[1] } }),
        fromOption: select2OptionToInt
      },
      reason: {
        $el: $form.find('input[name="classification.reason"]'),
        data: _.map(enums.reclassificationReason, function(reason, id) { return { id: id, text: reason.uiText } }),
        fromOption: select2OptionToInt
      }
    }
  }
}

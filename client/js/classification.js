function classificationPage() {
  var $root = $('#classification-page')

  $root.on('show', function (e, programId, edit) {
    if (edit) {
      setLocation('#luokittelu/' + programId + '/edit')
      $.get('/programs/' + programId).done(classificationForm(true).show)
    } else if (programId) {
      setLocation('#luokittelu/' + programId)
      $.get('/programs/' + programId).done(classificationForm(false).show)
    } else {
      setLocation('#luokittelu')
    }

    $('.navi li:first a').addClass('active')
  })
}

function classificationForm(editMode) {
  var $page = $('#classification-page').html($('#templates .program-details').clone())
  var $form = $page.find('.program-details-form')
  var $summary = $form.find('.summary')
  var $submit = $form.find('button[name=register]')
  var $buyer = $form.find('input[name="classifications.0.buyer"]')
  var $billing = $form.find('input[name="classifications.0.billing"]')
  var preview = registrationPreview()
  var modifiedFields = {}
  var currentProgram

  renderClassificationCriteria()

  var $throttledAutoSaveFields = $form.find('input[type=text], input[type=number], textarea').not('[name="registration-email"]')

  $form.find('textarea').autosize()

  $form.on('validation', function() {
    var required = $form.find('.required.invalid, .required-pseudo.invalid')
      .not('.exclude')
      // we only care about the original element from which the invalid class has been removed
      .not('.select2-container.required.invalid')
      .not('input:disabled, textarea:disabled')
    $submit.prop('disabled', required.length > 0)
  })

  validateTextChange($form.find('.required'), isNotEmpty)
  validateTextChange($form.find('.duration'), utils.isValidDuration)
  validateTextChange($form.find('.email'), isEmail)
  validateTextChange($form.find('input[name=year]'), utils.isValidYear)
  requiredCheckboxGroup($form.find('.classification-email .emails'))

  $form.on('submit', function(e) {
    e.preventDefault()
    $.post('/programs/' + $form.data('id') + '/register', function(program) {
      $form.data('id', '').hide().trigger('show')
      showDialog($('<div>', {class: 'registration-confirmation dialog'})
        .append($('<span>', {class: 'name'}).text(program.name))
        .append(renderWarningSummary(classification.fullSummary(program)))
        .append($('<p>', {class: 'registration-date'}).text('Rekisteröity ' + utils.asDate(program.classifications[0].registrationDate)))
        .append($('<p>', {class: 'buttons'}).html($('<button>', { click: closeDialog, class: 'button' }).text('Sulje'))))
      $("#search-page").trigger('show').show()
      $(window).scrollTop(0)
    })
  })

  $form.on('click', '.back-to-search', function(e) {
    e.preventDefault()
    $form.hide()
    $("#search-page").trigger('show').show()
  })

  $form.on('select2-blur', function(e) { $(e.target).addClass('touched') })

  $throttledAutoSaveFields.throttledInput(function(txt) {
    if (($(this).is(':invalid') || $(this).hasClass('invalid')) && $(this).val().length > 0) return false
    saveProgramField($form.data('id'), $(this).attr('name'), txt)
  })

  $form.find('input[name="classifications.0.safe"]').change(function() {
    var safe = $(this).is(':checked')
    $form.find('.category-container').slideToggle(!safe)
    saveProgramField($form.data('id'), $(this).attr('name'), safe)
  })

  $form.on('click', '.category .criteria', function() {
    $(this).toggleClass('selected').toggleClass('has-comment', isNotEmpty($(this).find('textarea').val()))
    var ids = $form.find('.category .criteria.selected').map(function(i, e) { return $(e).data('id') }).get()
    if ($(this).hasClass('selected')) $(this).find('textarea').focus()
    saveProgramField($form.data('id'), 'classifications.0.criteria', ids)
  })

  $form.on('click', '.category .criteria textarea', stopPropagation)

  $form.on('blur', '.category .criteria.has-comment:not(.selected) textarea', function() {
    $(this).parents('.criteria').toggleClass('has-comment', isNotEmpty($(this).val()))
  })

  $form.find('input[name="classifications.0.reason"]').on('change', function(e) {
    if (!editMode) {
      $buyer.add($billing).select2('enable', enums.isOikaisupyynto($(this).val())).trigger('validate')
    }
  })

  var $saveButton = $form.find('button[name=save]')

  $saveButton.on('click', function(e) {
    e.preventDefault()

    $.post('/programs/' + $form.data('id'), JSON.stringify(modifiedFields)).done(function(program) {
      updateSummary(program)
      preview.update(program)
      showDialog($('#templates').find('.modify-success-dialog').clone()
        .find('button.ok').click(closeDialog).end())
      modifiedFields = {}
      $saveButton.prop('disabled', true)
    })
  })

  selectEnumAutocomplete({
    $el: $form.find('input.country'),
    data: Object.keys(enums.countries).map(function(key) { return { id: key, text: enums.countries[key] }}),
    multiple: true
  })

  selectAutocomplete({
    $el: $form.find('input[name=productionCompanies]'),
    path: '/productionCompanies/search/',
    multiple: true,
    allowAdding: true
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name=gameFormat]'),
    data: enums.gameFormat.map(function(f) { return { id: f, text: f }})
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name=genre].movie-genre'),
    data: enums.movieGenre.map(function(f) { return { id: f, text: f }}),
    multiple: true
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name=genre].tv-genre'),
    data: enums.tvGenre.map(function(f) { return { id: f, text: f }}),
    multiple: true
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name=genre].game-genre'),
    data: enums.legacyGameGenres.map(function(f) { return { id: f, text: f }}),
    multiple: true
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name="classifications.0.reason"]'),
    data: _.map(enums.reclassificationReason, function(text, id) { return { id: id, text: text } }),
    fromOption: select2OptionToInt
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name="classifications.0.authorOrganization"]'),
    data: _.map(_.chain(enums.authorOrganization).pairs().rest().value(), function(pair) { return { id: pair[0], text: pair[1] } }),
    fromOption: select2OptionToInt
  })

  selectEnumAutocomplete({
    $el: $form.find('input[name="classifications.0.format"]'),
    data: enums.format.map(function(f) { return { id: f, text: f }})
  })

  selectAutocomplete({
    $el: $form.find('input[name=directors]'),
    path: '/directors/search/',
    multiple: true,
    allowAdding: true
  })

  selectAutocomplete({
    $el: $form.find('input[name=actors]'),
    path: '/actors/search/',
    multiple: true,
    allowAdding: true
  })

  selectAutocomplete({
    $el: $form.find('input[name="classifications.0.buyer"]'),
    path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber' },
    toOption: idNamePairToSelect2Option,
    fromOption: select2OptionToIdNamePair,
    termMinLength: 0
  })

  selectAutocomplete({
    $el: $form.find('input[name="classifications.0.billing"]'),
    path: function (term) { return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Subscriber,Classifier' },
    toOption: idNamePairToSelect2Option,
    fromOption: select2OptionToIdNamePair,
    termMinLength: 0
  })

  selectAutocomplete({
    $el: $form.find('input[name=series]'),
    path: '/series/search/',
    toOption: idNamePairToSelect2Option,
    fromOption: select2OptionToIdNamePair,
    allowAdding: true
  })

  warningDragOrder($form.find('.classification-summary .summary'))
  warningDragOrder($form.find('.classification-details .summary'))

  function selectAutocomplete(opts) {
    select2Autocomplete(opts, function(name, val) {
      saveProgramField($form.data('id'), name, val)
    })
  }

  return { show: show }

  function warningDragOrder($el) {
    $el.on('dragstart', '.warnings .warning', function(e) {
      var $e = $(this)
      e.originalEvent.dataTransfer.effectAllowed = 'move'
      e.originalEvent.dataTransfer.setData('text/plain', this.outerHTML)
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
        $(e.originalEvent.dataTransfer.getData('text/plain')),
        $('<span>', { class:'drop-target' })
      ])
      var newOrder = $el.find('.warnings .warning').map(function() { return $(this).data('id') }).get()
      saveProgramField($form.data('id'), 'classifications.0.warningOrder', newOrder)
    })
  }

  function show(program) {
    if (editMode) currentProgram = program

    $(window).scrollTop(0)
    var currentClassification = draftClassification(program)
    var isReclassification = classification.isReclassification(program, currentClassification)
    var isExternalReclassification = isReclassification && user.role == 'user'
    var reasonVal = typeof currentClassification.reason == 'number' ? currentClassification.reason.toString() : ''
    var authorOrgVal = typeof currentClassification.authorOrganization == 'number' ? currentClassification.authorOrganization.toString() : ''

    var programTypeName = enums.util.programTypeName(program.programType)

    $form.data('id', program._id).show()
      .find('.programTypeName').text(programTypeName).end()
      .toggleClass('type-movie', enums.util.isMovieType(program))
      .toggleClass('type-tv-episode', enums.util.isTvEpisode(program))
      .toggleClass('type-tv-other', enums.util.isOtherTv(program))
      .toggleClass('type-game', enums.util.isGameType(program))
      .toggleClass('classification', !isReclassification)
      .toggleClass('reclassification', isReclassification)
      .find('.touched').removeClass('touched').end()
      .find('.invalid').removeClass('invalid').end()
      .find('input[name="name.0"]').val(program.name[0]).end()
      .find('input[name="nameFi.0"]').val(program.nameFi[0]).end()
      .find('input[name="nameSv.0"]').val(program.nameSv[0]).end()
      .find('input[name="nameOther.0"]').val(program.nameOther[0]).end()
      .find('input[name=year]').val(program.year).end()
      .find('textarea[name=synopsis]').val(program.synopsis).end()
      .find('input[name="classifications.0.duration"]').val(currentClassification.duration).end()
      .find('input[name="classifications.0.safe"]').prop('checked', !!currentClassification.safe).end()
      .find('textarea[name="classifications.0.comments"]').val(currentClassification.comments).end()
      .find('textarea[name="classifications.0.publicComments"]').val(currentClassification.publicComments).end()

      .find('input.country').trigger('setVal', program.country).end()
      .find('input[name=productionCompanies]').trigger('setVal', program.productionCompanies).end()
      .find('input[name=gameFormat]').trigger('setVal', program.gameFormat).end()
      .find('input[name=genre]').trigger('setVal', program.genre).end()

      .find('span.author').text(utils.getProperty(currentClassification, 'author.name') || '-').end()

      .find('input[name="classifications.0.reason"]').trigger('setVal', reasonVal).end()
      .find('input[name="classifications.0.authorOrganization"]').trigger('setVal', authorOrgVal).end()
      .find('input[name="classifications.0.format"]').trigger('setVal', currentClassification.format).end()

      .find('input[name=directors]').trigger('setVal', program['directors'] || []).end()
      .find('input[name=actors]').trigger('setVal', program['actors'] || []).end()
      .find('input[name="classifications.0.buyer"]').trigger('setVal', currentClassification.buyer).end()
      .find('input[name="classifications.0.billing"]').trigger('setVal', currentClassification.billing).end()

      .find('input[name=series]').trigger('setVal', program.series).end()
      .find('input[name=season]').val(program.season).end()
      .find('input[name=episode]').val(program.episode).end()

      .find('.category-container').toggle(!currentClassification.safe).end()
      .find('.criteria').removeClass('selected').removeClass('has-comment').end()
      .find('.criteria textarea').val('').end()

      .find('.program-info input, .program-info textarea').prop('disabled', isReclassification && !editMode).end()
      .find('.reclassification .required').prop('disabled', !isReclassification).end()

    $saveButton.toggle(editMode).prop('disabled', true)

    $buyer.add($billing).select2('enable', !editMode && (!isReclassification || enums.isOikaisupyynto(currentClassification.reason)) || isExternalReclassification)

    $form.find('.comments .public-comments').toggleClass('hide', isExternalReclassification)
      .find('textarea').prop('disabled', isExternalReclassification || !isReclassification)

    $form.find('.private-comments').toggle(hasRole('kavi'))

    $form.find('.author-and-reason').toggleClass('hide', isExternalReclassification)
      .find('input')
      .prop('disabled', isExternalReclassification)
      .select2('enable', isReclassification && hasRole('kavi'))

    $form.find('input[name=series]').prop('disabled', isReclassification || !enums.util.isTvEpisode(program))

    $form.find('input[name=directors]').prop('disabled', enums.util.isGameType(program) || isReclassification && !editMode)
    $form.find('input[name=gameFormat]').prop('disabled', !enums.util.isGameType(program))

    $form.find('input[name="classifications.0.format"]').prop('disabled', enums.util.isGameType(program))
    var enableDuration = !enums.util.isGameType(program) || hasRole('kavi')
    $form.find('input[name="classifications.0.duration"]').prop('disabled', !enableDuration).parent().toggle(enableDuration)

    currentClassification.criteria.forEach(function(id) {
      $form.find('.criteria[data-id=' + id + ']').addClass('selected')
    })
    Object.keys(currentClassification.criteriaComments || {}).forEach(function(id) {
      var txt = currentClassification.criteriaComments[id]
      if (isNotEmpty(txt)) {
        $form.find('textarea[name="classifications.0.criteriaComments.'+id+'"]').val(txt).parents('.criteria').addClass('has-comment')
      }
    })

    $throttledAutoSaveFields.trigger('reset')
    $form.find('.required').trigger('validate')
    updateSummary(program)
    preview.reset(program)
    $form.find('textarea').trigger('autosize.resize')

    // Email functionality is disabled when using admin's editing tool
    $form.find('.classification-email .emails').toggle(!editMode)
    $form.find('.classification-email .preview').toggleClass('right', !editMode)

    var programInfoTitle = (editMode || isReclassification) ? 'Kuvaohjelman tiedot' : 'Uusi kuvaohjelma'
    var classificationTitle = (editMode || !isReclassification) ? 'Luokittelu' : 'Uudelleenluokittelu'

    $form.find('.classification-details, .classification-criteria').toggle(!(editMode && _.isEmpty(program.classifications)))
    $form.find('.program-info h2.main').text(programInfoTitle + ' - ' + (programTypeName || '?'))
    $form.find('.classification-details h2.main').text(classificationTitle)
    $form.find('input[name], textarea[name]').toggleClass('touched', editMode)
  }

  function selectEnumAutocomplete(opts) {
    opts = _.merge({
      data: opts.data,
      placeholder: 'Valitse...',
      multiple: opts.multiple || false,
      initSelection: initSelection,
      fromOption: function(x) { return x.id }
    }, opts)

    opts.$el.select2(opts).on('change', onChange).on('setVal', setValue)

    function initSelection(e, callback) {
      return callback(opts.multiple ? (opts.val || []).map(idToOption) : idToOption(opts.val))
    }
    function idToOption(id) {
      var opt = _.find(opts.data, function(item) { return item.id === id })
      return opt ? opt : { id: id, text: id }
    }
    function onChange() {
      var data = $(this).select2('data')
      var val = opts.multiple ? data.map(opts.fromOption) : opts.fromOption(data)
      saveProgramField($form.data('id'), $(this).attr('name'), val)
    }
    function setValue(e) {
      var arr = Array.prototype.slice.call(arguments, 1).map(idToOption)
      var data = opts.multiple ? arr : (arr[0] && arr[0] || '')
      $(this).select2('data', data).trigger('validate')
    }
  }

  function renderClassificationCriteria() {
    enums.criteriaCategories.map(function(category) {
      var criteria = enums.classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = criteria.map(function(c) {
        return $('<div>', {class: 'criteria agelimit ' + 'agelimit-' + c.age, 'data-id': c.id})
          .append($('<h5>').text(c.title + ' ').append($('<span>').text('(' + c.id + ')')))
          .append($('<p>').text(c.description))
          .append($('<textarea>', { name:'classifications.0.criteriaComments.' + c.id, placeholder:'Kommentit...' }))
      })
      $form.find('.category-container .' + category).append($criteria)
    })
  }

  function saveProgramField(id, field, value) {
    if (editMode) {
      modifiedFields[field] = value

      setValueForPath(field.split('.'), currentProgram, value)

      updateSummary(currentProgram)
      preview.update(currentProgram)

      $saveButton.prop('disabled', false)
    } else {
      field = field.replace(/^classifications\.0/, 'draftClassifications.' + user._id)
      $.post('/programs/autosave/' + id, JSON.stringify(utils.keyValue(field, value))).done(function(program) {
        updateSummary(program)
        preview.update(program)
      })
    }
  }

  function setValueForPath(path, property, value) {
    if (path.length === 1) property[path[0]] = value
    else {
      if (!property[path[0]]) {
        if (_.isNumber(path[0])) property[path[0]] = []
        else property[path[0]] = {}
      }

      setValueForPath(_.rest(path), property[path[0]], value)
    }
  }

  function updateSummary(program) {
    var currentClassification = draftClassification(program)
    var summary = classification.summary(currentClassification)
    var warnings = [$('<span>', { class:'drop-target' })].concat(summary.warnings.map(function(w) { return $('<span>', { 'data-id': w.category, class:'warning ' + w.category, draggable:true }).add($('<span>', { class:'drop-target' })) }))
    var synopsis = commentToHtml(program.synopsis ? program.synopsis : '-')
    var countries = enums.util.toCountryString(program.country)
    var comments = commentToHtml(currentClassification.publicComments || '')
    $summary
      .find('.name').text(program.name.join(', ') || '-').end()
      .find('.year').text(program.year || '-').end()
      .find('.synopsis').html(synopsis).end()
      .find('.country').text(countries || '-').end()
      .find('.directors').text((program.directors).join(', ') || '-').end()
      .find('.actors').text((program.actors).join(', ') || '-').end()
      .find('.agelimit img').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warnings).end()
      .find('.reason').html(enums.reclassificationReason[currentClassification.reason]).end()
      .find('.comments').html(comments).end()
  }

  function commentToHtml(text) {
    return text.split('\n\n').map(function (x) { return $('<p>').text(x) })
  }

  function registrationPreview() {
    var $emails = $form.find('.classification-email .emails')
    var $preview = $form.find('.classification-email .email-preview')
    var $input = $emails.find('input[name=registration-email]')
    var currentBuyerId = null

    $emails.find('ul').on('change', 'input', saveEmailState)

    $input.keypress(function(e) { if (e.which == 13) addEmail() })

    $emails.find('button.add-registration-email').on('click', function(e) {
      e.preventDefault()
      addEmail()
    })

    function addEmail() {
      if ($input.hasClass('invalid')) { return; }
      addManualEmailCheckbox(true, $input.val())
      $input.val('')
      saveEmailState()
    }

    function saveEmailState() {
      var buyerEmails = $emails.find('ul.buyer input:checked')
        .map(function() { return $(this).val() }).get()
        .map(function(email) { return {email: email, manual: false}})

      var manualEmails = $emails.find('ul.manual input:checked')
        .map(function() { return $(this).val() }).get()
        .map(function(email) { return {email: email, manual: true}})

      saveProgramField($form.data('id'), $emails.find('ul li input:first').attr('name'), buyerEmails.concat(manualEmails))
    }

    function updatePreview(program) {
      var cl = draftClassification(program)
      var buyerEmails = cl.registrationEmailAddresses
        .filter(function(email) { return !email.manual }).map(function(e) { return e.email })
      var manualEmails = cl.registrationEmailAddresses
        .filter(function(email) { return email.manual }).map(function(e) { return e.email })

      var manualInDom = $emails.find('ul.manual li input').map(function() { return $(this).val() }).get()
      manualEmails.filter(function(email) { return notIn(manualInDom, email) })
        .forEach(addManualEmailCheckbox(true))

      var email = classification.registrationEmail(program, cl, user)

      if (editMode) {
        $.get('/programs/'+program._id+'/registrationEmails', function(emails) {
          $preview.find('.recipients').text(_.pluck(emails, 'email').join(', '))
        })
      } else {
        $preview.find('.recipients').text(email.recipients.join(', '))
      }

      $preview.find('.subject').text(email.subject)
      $preview.find('.body').html(email.body)

      if (shouldUpdateBuyer(cl)) {
        currentBuyerId = cl.buyer._id
        $.get('/accounts/' + currentBuyerId).done(function(data) {
          // remove all email addresses linked to the selected buyer
          $emails.find('ul.buyer li').remove()
          data.emailAddresses.forEach(function(email) {
            if (notIn(buyerEmails, email)) {
              addBuyerEmailCheckbox(false, email)
            } else {
              addBuyerEmailCheckbox(true, email)
            }
          })
          $emails.find('ul li input:checkbox').trigger('validate')
        })
      } else {
        $emails.find('ul li input:checkbox').trigger('validate')
      }
    }

    function shouldUpdateBuyer(cl) {
      return cl && cl.buyer && cl.buyer._id != currentBuyerId
    }

    function reset(program) {
      currentBuyerId = null
      $emails.find('ul').empty()
      draftClassification(program).registrationEmailAddresses
        .filter(function(e) { return !e.manual })
         .map(function(e) { return e.email })
        .forEach(addBuyerEmailCheckbox(true))
      updatePreview(program)
    }

    function addEmailCheckbox($el, checked, email) {
      var $input = $('<input>', { type: 'checkbox', checked: !!checked, name: 'classifications.0.registrationEmailAddresses', value: email })
      $el.append($('<li>').append($('<label>').append($input).append($('<span>').text(email))))
    }

    var addBuyerEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.buyer'))
    var addManualEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.manual'))

    return { update: updatePreview, reset: reset }
  }

  function draftClassification(program) {
    if (editMode) return program.classifications[0] || {
      criteria: [],
      warningOrder: [],
      registrationEmailAddresses: []
    }
    return program.draftClassifications[user._id]
  }
}

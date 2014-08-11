function classificationPage() {
  var $root = $('#classification-page')

  $root.on('show', function (e, programId, edit) {
    if (edit) {
      setLocation('#luokittelu/' + programId + '/edit')
      $.get('/programs/' + programId).done(function(program) {
        classificationForm(program, classificationFinder(true), true)
      })
    } else if (programId) {
      setLocation('#luokittelu/' + programId)
      $.get('/programs/' + programId).done(function(program) {
        classificationForm(program, classificationFinder(false), false)
      })
    } else {
      setLocation('#luokittelu')
    }
    $('.navi li:first a').addClass('active')
  })

  function classificationFinder(rootEditMode) {
    return function(program) {
      if (rootEditMode) {
        return program.classifications[0] || { criteria: [], warningOrder: [], registrationEmailAddresses: [] }
      } else {
        return program.draftClassifications[user._id]
      }
    }
  }
}

function classificationForm(program, classificationFinder, rootEditMode) {
  var rootModifiedFields = {}
  var cfu = classificationFormUtils()
  var $form = cfu.renderForm(program, classificationFinder(program), rootEditMode)
  var select2Opts = cfu.select2Opts($form)
  var detailRenderer = programBox()
  var emailRenderer = cfu.registrationEmails($form, save).render(program, classificationFinder(program), rootEditMode)

  setProgramFields(program)
  setClassificationFields(classificationFinder(program))
  configureValidation()
  configureEventBinding()
  onProgramUpdated(program)

  function setProgramFields(p) {
    $form
      .find('input[name="name.0"]').val(p.name[0]).end()
      .find('input[name="nameFi.0"]').val(p.nameFi[0]).end()
      .find('input[name="nameSv.0"]').val(p.nameSv[0]).end()
      .find('input[name="nameOther.0"]').val(p.nameOther[0]).end()
      .find('input[name=year]').val(p.year).end()
      .find('input[name=season]').val(p.season).end()
      .find('input[name=episode]').val(p.episode).end()
      .find('textarea[name=synopsis]').val(p.synopsis).end()

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

    $form
      .find('span.author').text(utils.getProperty(c, 'author.name') || '-').end()
      .find('input[name="classification.duration"]').val(c.duration).end()
      .find('textarea[name="classification.comments"]').val(c.comments).end()
      .find('textarea[name="classification.publicComments"]').val(c.publicComments).end()
      .find('input[name="classification.safe"]').prop('checked', !!c.safe).end()
      .find('.category-container').toggle(!c.safe).end()

    select2Autocomplete(select2Opts.buyer, save).trigger('setVal', c.buyer)
    select2Autocomplete(select2Opts.billing, save).trigger('setVal', c.billing)
    select2EnumAutocomplete(select2Opts.format, save).trigger('setVal', c.format)
    select2EnumAutocomplete(select2Opts.authorOrg, save).trigger('setVal', authorOrgVal)
    select2EnumAutocomplete(select2Opts.reason, save).trigger('setVal', reasonVal)

    c.criteria.forEach(function(id) { $form.find('.criteria[data-id=' + id + ']').addClass('selected') })
    Object.keys(c.criteriaComments || {}).forEach(function(id) {
      var txt = c.criteriaComments[id]
      if (isNotEmpty(txt)) {
        $form.find('textarea[name="classification.criteriaComments.'+id+'"]').val(txt).parents('.criteria').addClass('has-comment')
      }
    })
  }

  function configureValidation() {
    $form.on('validation', function() {
      // For select2's, we only care about the original element from which the invalid class has been removed
      var required = $form.find('.required.invalid, .required-pseudo.invalid')
        .not('.select2-container.required.invalid')
        .not('input:disabled, textarea:disabled')
      $form.find('button[name=register]').prop('disabled', required.length > 0)
    })
    validateTextChange($form.find('.required'), isNotEmpty)
    validateTextChange($form.find('input[name=year]'), utils.isValidYear)
    validateTextChange($form.find('.duration'), utils.isValidDuration)
    $form.on('select2-blur', function(e) { $(e.target).addClass('touched') })
    $form.find('.required').trigger('validate')
  }

  function configureEventBinding() {
    $form.find('textarea').autosize()
    $form.on('submit', function(e) {
      e.preventDefault()
      $.post('/programs/' + program._id + '/register', function(savedProgram) {
        $form.hide()
        $("#search-page").trigger('show').show()
        showDialog($('<div>', {class: 'registration-confirmation dialog'})
          .append($('<span>', {class: 'name'}).text(savedProgram.name))
          .append(renderWarningSummary(classificationUtils.fullSummary(savedProgram)))
          .append($('<p>', {class: 'registration-date'}).text('Rekisteröity ' + utils.asDate(savedProgram.classifications[0].registrationDate)))
          .append($('<p>', {class: 'buttons'}).html($('<button>', { click: closeDialog, class: 'button' }).text('Sulje'))))
        $(window).scrollTop(0)
      })
    })
    $form.find('button[name=save]').on('click', function(e) {
      e.preventDefault()
      $.post('/programs/' + program._id, JSON.stringify(rootModifiedFields)).done(function(program) {
        onProgramUpdated(program)
        showDialog($('#templates').find('.modify-success-dialog').clone().find('button.ok').click(closeDialog).end())
        rootModifiedFields = {}
        $form.find('button[name=save]').prop('disabled', true)
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
    $form.find('input[name="classification.safe"]').change(function() {
      var safe = $(this).is(':checked')
      $form.find('.category-container').slideToggle(!safe)
      save($(this).attr('name'), safe)
    })
    $form.find('.safe-container span').click(function() {
      $(this).prev().click()
    })
    $form.find('input[name="classification.reason"]').on('change', function(e) {
      var $buyerAndBilling = $form.find('input[name="classification.buyer"], input[name="classification.billing"]')
      $buyerAndBilling.removeClass('touched').select2('enable', enums.isOikaisupyynto($(this).val())).select2('val', '').trigger('validate')
    })

    $form.on('click', '.category .criteria', function() {
      $(this).toggleClass('selected').toggleClass('has-comment', isNotEmpty($(this).find('textarea').val()))
      var ids = $form.find('.category .criteria.selected').map(function(i, e) { return $(e).data('id') }).get()
      if ($(this).hasClass('selected')) $(this).find('textarea').focus()
      save('classification.criteria', ids)
    })
    $form.on('click', '.category .criteria textarea', stopPropagation)
    $form.on('blur', '.category .criteria.has-comment:not(.selected) textarea', function() {
      $(this).parents('.criteria').toggleClass('has-comment', isNotEmpty($(this).val()))
    })
    cfu.warningDragOrder($form.find('.classification-details .summary'), save)
  }

  function save(field, value) {
    if (rootEditMode) {
      field = field.replace(/^classification/, 'classifications.0')
      rootModifiedFields[field] = value
      utils.setValueForPath(field.split('.'), program, value)
      onProgramUpdated(program)
      $form.find('button[name=save]').prop('disabled', false)
    } else {
      field = field.replace(/^classification/, 'draftClassifications.' + user._id)
      $.post('/programs/autosave/' + program._id, JSON.stringify(utils.keyValue(field, value))).done(onProgramUpdated)
    }
  }

  function onProgramUpdated(updatedProgram) {
    var updatedClassification = classificationFinder(updatedProgram)
    cfu.updateSummary($form, updatedProgram, updatedClassification)
    $form.find('.program-box-container').html(detailRenderer.render(cfu.cloneForProgramBox(updatedProgram, classificationFinder, rootEditMode)).show())
    emailRenderer.update(updatedProgram, updatedClassification, rootEditMode)
  }
}

function classificationFormUtils() {

  return {
    renderForm: renderForm, updateSummary: updateSummary,
    registrationEmails: registrationEmails, warningDragOrder: warningDragOrder,
    cloneForProgramBox: cloneForProgramBox,  select2Opts: select2Opts
  }

  function renderForm(program, classification, editMode) {
    $('#classification-page').html($('#templates .program-details').clone())
    var $form = $('#classification-page .program-details-form')
    renderClassificationCriteria($form)
    filterFields($form, program, classification, editMode)
    if (editMode) configureRootEditMode($form, program, classification)
    return $form
  }

  function renderClassificationCriteria($form) {
    enums.criteriaCategories.map(function(category) {
      var criteria = enums.classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = criteria.map(function(c) {
        return $('<div>', {class: 'criteria agelimit ' + 'agelimit-' + c.age, 'data-id': c.id})
          .append($('<h5>').text(c.title + ' ').append($('<span>').text('(' + c.id + ')')))
          .append($('<p>').text(c.description))
          .append($('<textarea>', { name:'classification.criteriaComments.' + c.id, placeholder:'Kommentit...', class:'throttledInput' }))
      })
      $form.find('.category-container .' + category).append($criteria)
    })
  }

  function filterFields($form, program, classification, editMode) {
    var isReclassification = classificationUtils.isReclassification(program, classification)
    var isInternalReclassification = isReclassification && hasRole('kavi')
    var isTvEpisode = enums.util.isTvEpisode(program)
    var isGame = enums.util.isGameType(program)

    var programInfoTitle = (editMode || isReclassification) ? 'Kuvaohjelman tiedot' : 'Uusi kuvaohjelma'
    var classificationTitle = (editMode || !isReclassification) ? 'Luokittelu' : 'Uudelleenluokittelu'
    var programTypeName = enums.util.programTypeName(program.programType)
    $form.find('.program-info h2.main').text(programInfoTitle + ' - ' + (programTypeName || '?'))
    $form.find('.classification-details h2.main').text(classificationTitle)

    if (isTvEpisode) {
      $form.find('input[name="name.0"]').prev().text('Jakson alkuperäinen nimi').end()
        .find('input[name="nameFi.0"]').prev().text('Jakson suomalainen nimi').end()
        .find('input[name="nameSv.0"]').prev().text('Jakson ruotsinkielinen nimi').end()
    }
    if (!isTvEpisode) $form.find('.tv-episode-field').remove()
    if (isGame) $form.find('.non-game-field').remove()
    if (!isGame) $form.find('.game-field').remove()

    var showDuration = !enums.util.isGameType(program) || hasRole('kavi')
    if (!showDuration) $form.find('.duration-field').remove()

    if (isInternalReclassification && !enums.isOikaisupyynto(classification.reason)) {
      $form.find('input[name="classification.buyer"], input[name="classification.billing"]').prop('disabled', true)
    }
    if (!isInternalReclassification) {
      $form.find('.author-and-reason-fields').remove()
      $form.find('.public-comments').remove()
    }
    if (!hasRole('kavi')) $form.find('.private-comments').remove()

    if (isReclassification && !editMode) $form.find('.program-info input, .program-info textarea').prop('disabled', true)
  }

  function configureRootEditMode($form, p, c) {
    $form.find('input[name="classification.buyer"]').replaceWith($('<span>').text(utils.getProperty(c, 'buyer.name') || '-'))
    $form.find('input[name="classification.billing"]').replaceWith($('<span>').text(utils.getProperty(c, 'billing.name') || '-'))
    if (_.isEmpty(p.classifications)) {
      $form.find('.classification-details, .classification-summary, .classification-criteria, .classification-email').remove()
      $form.find('.program-box-container').replaceWith($('<span>').text('Ohjelma ei näy ikärajat.fi-palvelussa, sillä sillä ei ole yhtään luokittelua.'))
    }
    $form.find('button[name=save]').show()
  }

  function updateSummary($form, program, classification) {
    var summary = classificationUtils.summary(classification)
    var warnings = [$('<span>', { class:'drop-target' })].concat(summary.warnings.map(function(w) { return $('<span>', { 'data-id': w.category, class:'warning ' + w.category, draggable:true }).add($('<span>', { class:'drop-target' })) }))
    $form.find('.summary')
      .find('.name').text(program.name.join(', ') || '-').end()
      .find('.agelimit img').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warnings).end()
  }

  function registrationEmails($form, saveFn) {
    var $emails = $form.find('.classification-email .emails')
    var $preview = $form.find('.classification-email .email-preview')
    var $input = $emails.find('input[name=registration-email]')
    var currentBuyerId = null

    validateTextChange($input, isEmail)
    requiredCheckboxGroup($emails)
    $input.trigger('validate')

    $emails.find('ul').on('change', 'input', saveEmailState)

    $input.keypress(function(e) {
      if (e.which == 13) {
        e.preventDefault()
        addEmail()
      }
    })

    $emails.find('button.add-registration-email').on('click', function(e) {
      e.preventDefault()
      addEmail()
    })

    function render(program, classification, rootEditMode) {
      classification.registrationEmailAddresses
        .filter(function(e) { return !e.manual })
        .map(function(e) { return e.email })
        .forEach(addBuyerEmailCheckbox(true))
      if (rootEditMode) {
        $emails.remove()
        $preview.parent().removeClass('right')
      }
      update(program, classification, rootEditMode)
      return this
    }

    function update(program, classification, rootEditMode) {
      var buyerEmails = classification.registrationEmailAddresses
        .filter(function(email) { return !email.manual }).map(function(e) { return e.email })
      var manualEmails = classification.registrationEmailAddresses
        .filter(function(email) { return email.manual }).map(function(e) { return e.email })

      var manualInDom = $emails.find('ul.manual li input').map(function() { return $(this).val() }).get()
      manualEmails.filter(function(email) { return notIn(manualInDom, email) })
        .forEach(addManualEmailCheckbox(true))

      var email = classificationUtils.registrationEmail(program, classification, user)

      if (rootEditMode) {
        $.get('/programs/'+program._id+'/registrationEmails', function(emails) {
          $preview.find('.recipients').text(_.pluck(emails, 'email').join(', '))
        })
      } else {
        $preview.find('.recipients').text(email.recipients.join(', '))
      }

      $preview.find('.subject').text(email.subject)
      $preview.find('.body').html(email.body)

      if (shouldUpdateBuyer(classification)) {
        currentBuyerId = classification.buyer._id
        $.get('/accounts/' + currentBuyerId).done(function(data) {
          // Remove all email addresses linked to the selected buyer
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

    function addEmail() {
      if ($input.hasClass('invalid')) return
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

      saveFn($emails.find('ul li input:first').attr('name'), buyerEmails.concat(manualEmails))
    }

    function shouldUpdateBuyer(cl) {
      return cl && cl.buyer && cl.buyer._id != currentBuyerId
    }

    function addEmailCheckbox($el, checked, email) {
      var $input = $('<input>', { type: 'checkbox', checked: !!checked, name: 'classification.registrationEmailAddresses', value: email })
      $el.append($('<li>').append($('<label>').append($input).append($('<span>').text(email))))
    }

    var addBuyerEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.buyer'))
    var addManualEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.manual'))

    return { render: render, update: update}
  }

  function warningDragOrder($el, saveFn) {
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
      classificationClone.registrationDate = new Date()
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
        allowAdding: true
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
        allowAdding: true
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
        allowAdding: true
      },
      actors: {
        $el: $form.find('input[name=actors]'),
        path: function(term) { return '/actors/search?q=' + encodeURIComponent(term) },
        multiple: true,
        allowAdding: true
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
        data: enums.format.map(function(f) { return { id: f, text: f }})
      },
      authorOrg: {
        $el: $form.find('input[name="classification.authorOrganization"]'),
          data: _.map(_.chain(enums.authorOrganization).pairs().rest().value(), function(pair) { return { id: pair[0], text: pair[1] } }),
        fromOption: select2OptionToInt
      },
      reason: {
        $el: $form.find('input[name="classification.reason"]'),
        data: _.map(enums.reclassificationReason, function(text, id) { return { id: id, text: text } }),
        fromOption: select2OptionToInt
      }
    }
  }
}

$(setup)

function setup() {
  $.fn.select2.defaults.formatNoMatches = 'Ei tuloksia'
  $.fn.select2.defaults.formatSearching = 'Haetaan...'
  $.fn.select2.defaults.adaptDropdownCssClass = function(c) {  return c == 'required' ? c : null }

  $.ajaxSetup({dataType: "json", processData: false, contentType: "application/json"})

  $('#overlay').on('click', function() {
    closeDialog()
  })

  $('body').on('click', '.dialog', function(e) {
    e.stopPropagation()
  })

  var navigation = navi()
  searchPage()
  movieDetails()
  buyerPage()
  billingPage()
  navigation.start()
}

function navi() {
  var $navi = $('#header .navi')

  $navi.find('a').on('click', function(e) {
    e.preventDefault()
    show($(this)).trigger('show')
  })

  function start() {
    var hash = location.hash
    if (hash == '') {
      $navi.find('a:first').click()
    } else {
      var parts = hash.split('/').map(decodeURIComponent)
      var $a = $navi.find('a[href='+parts.shift()+']')
      show($a).trigger('show', parts)
    }
  }

  function show($a) {
    $navi.find('a.active').removeClass('active')
    $a.addClass('active')
    $('body').children('.page').hide()
    return $($a.data('href')).show()
  }

  return { start: start }
}

function buyerPage() { $('#buyer-page').on('show', function() { location.hash = '#tilaajat' }) }
function billingPage() { $('#billing-page').on('show', function() { location.hash = '#laskutus'}) }

function searchPage() {
  var $page = $('#search-page')
  var $input = $page.find('.query')
  var $button = $page.find('button.search')
  var $filters = $page.find('.filters input[type=checkbox]')
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $noMoreResults = $page.find('.no-more-results')
  var $loading = $page.find('.loading')
  var $detailTemplate = $('#templates > .search-result-details').detach()
  var $newClassificationButton = $page.find('.new-classification button')

  var state = { q:'', page: 0 }

  $page.on('show', function(e, q, filters, programId) {
    $input.val(q || '').trigger('reset')
    setFilters(filters)
    queryChanged(q || '')
    loadUntil(programId)
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

  $('input[name="new-classification-type"]').select2({
    data: [
      {id: 1, text: 'Elokuva'},
      {id: 4, text: 'Extra'},
      {id: 5, text: 'Trailer'}
    ],
  }).select2('val', 1)

  $newClassificationButton.click(function() {
    var programType = $('input[name="new-classification-type"]').select2('val')
    $.post('/movies/new', JSON.stringify({'program-type': programType})).done(function(movie) {
      $('body').children('.page').hide()
      $('#classification-page').trigger('show', movie._id).show()
    })
  })

  function queryChanged(q) {
    state = { q:q, page: 0 }
    $noResults.add($noMoreResults).hide()
  }

  function loadUntil(selectedProgramId) {
    load(function() {
      if (!selectedProgramId) {
        updateLocationHash()
        return
      }
      var $selected = $results.find('.result[data-id='+selectedProgramId+']')
      if ($selected.length > 0) {
        openDetail($selected, false)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      } else if (state.page < 20) {
        state.page++
        loadUntil(selectedProgramId)
      }
    })
  }

  function load(callback) {
    $loading.show()
    var url = '/movies/search/'+encodeURIComponent(state.q)
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

  $results.on('click', '.result', function() {
    if ($(this).hasClass('selected')) {
      updateLocationHash()
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this), true)
    }
  })

  function openDetail($row, animate) {
    var p = $row.data('program')
    updateLocationHash(p._id)
    var $details = renderDetails(p)
    $row.addClass('selected').after($details)
    animate ? $details.slideDown() : $details.show()
  }

  function closeDetail() {
    $results.find('.result.selected').removeClass('selected')
    $results.find('.search-result-details').slideUp(function() { $(this).remove() }).end()
  }

  function updateLocationHash(selectedProgramId) {
    var filters = $filters.filter(':checked').map(function() { return $(this).data('id') }).toArray().join('')
    location.hash = '#haku/' + encodeURIComponent(state.q) + '/' + filters + '/' + (selectedProgramId || '')
  }

  function render(p, query) {
    var c = p.classifications[0]
    var queryParts = (query || '').trim().toLowerCase().split(/\s+/)
    return $('<div>', { class:'result', 'data-id': p._id })
      .data('program', p)
      .append($('<span>').text(p.name[0]).highlight(queryParts, { beginningsOnly: true, caseSensitive: false }))
      .append($('<span>').text(countryAndYear(p)))
      .append($('<span>').text(classificationAgeLimit(c)))
      .append($('<span>').text(enums.programType[p['program-type']].fi))
      .append($('<span>').text(enums.util.isGameType(p) ? p.gameFormat || '': duration(c)))

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

  function renderDetails(p) {
    var names = { n: p.name.join(', '), fi: p['name-fi'].join(', '), sv: p['name-sv'].join(', '), other: p['name-other'].join(', ')}
    var $e = $detailTemplate.clone()
      .find('.primary-name').text(p.name[0]).end()
      .find('.name').text(names.n).end()
      .find('.name-fi').text(names.fi).end()
      .find('.name-sv').text(names.sv).prev().toggleClass('hide', !names.sv).end().end()
      .find('.name-other').text(names.other).prev().toggleClass('hide', !names.other).end().end()
      .find('.country').text(enums.util.toCountryString(p.country)).end()
      .find('.year').text(p.year).end()
      .find('.production-companies').text(p['production-companies'].join(', ')).end()
      .find('.genre').text(p.genre.join(', ') || p['legacy-genre'].join(', ')).end()
      .find('.directors').text(p.directors.join(', ')).end()
      .find('.actors').text(p.actors.join(', ')).end()
      .find('.synopsis').text(p.synopsis).end()

    var c = p.classifications[0]
    if (c) {
      var summary = classification.summary(p, c)
      $e.find('.agelimit').attr('src', ageLimitIcon(summary)).end()
      .find('.status').text(classificationStatus(c)).end()
      .find('.warnings').html(warningIcons(summary)).end()
      .find('.buyer').text(c.buyer && c.buyer.name || '').end()
      .find('.billing').text(c.billing && c.billing.name || '').end()
      .find('.format').text(enums.util.isGameType(p) && p.gameFormat || c.format).end()
      .find('.duration').text(c.duration).end()
      .find('.criteria').html(renderClassificationCriteria(c)).end()
    }
    return $e
  }

  function renderClassificationCriteria(c) {
    if (!c.criteria) return ''
    return c.criteria.map(function(id) {
      var cr = enums.classificationCriteria[id - 1]
      var category = classificationCategory_FI[cr.category]
      return $('<div>')
        .append($('<label>').text(category + ' ('+cr.id+')'))
        .append($('<span>').text(c['criteria-comments'] && c['criteria-comments'][cr.id] || ''))
    })
  }
}

function movieDetails() {
  var $root = $('#classification-page')
  var $form = $('#movie-details')
  var $summary = $('.summary')
  var $submit = $form.find('button[name=register]')
  var preview = registrationPreview()

  renderClassificationCriteria()

  $root.on('show', function(e, programId) {
    if (programId) {
      location.hash = '#luokittelu/'+programId
      $.get('/movies/' + programId).done(show)
    } else if ($form.data('id')) {
      location.hash = '#luokittelu/'+$form.data('id')
    } else {
      location.hash = '#luokittelu'
    }
  })

  $form.on('validation', function() {
    if ($form.find(".required.invalid, .required-pseudo.invalid").not('.exclude').length === 0) {
      $submit.removeAttr('disabled')
    } else {
      $submit.attr('disabled', 'disabled')
    }
  })

  // validations
  validateTextChange($form.find('.required'), isNotEmpty)
  validateTextChange($form.find('.duration'), isValidDuration)
  validateTextChange($form.find('.email'), isEmail)
  validateTextChange($form.find('input[name=year]'), isValidYear)
  requiredCheckboxGroup($form.find('#email .emails'))

  $form.on('submit', function(e) {
    e.preventDefault()
    $.post('/movies/' + $form.data('id') + '/register', function(data) {
      $form.data('id', '')
      $form.hide().trigger('show')
      var summary = classification.summary(data, data.classifications[0])
      showDialog($('<div>', {id: 'registration-confirmation', class: 'dialog'})
        .append($('<span>', {class: 'name'}).text(data.name))
        .append($('<div>', {class: 'agelimit warning-summary'}).append([
           $('<img>', {src: ageLimitIcon(summary) }),
           $('<div>', {class: 'warnings'}).html(warningIcons(summary))
        ]))
        .append($('<p>', {class: 'registration-date'}).text(classificationStatus(data.classifications[0])))
        .append($('<p>', {class: 'buttons'}).html($('<button>', {click: closeDialog}).text('Sulje'))))
    })
  })

  function validateTextChange($el, validatorFn) {
    var validator = validate(validatorFn)
    $el.on('keyup change validate', validator)
       .on('blur', function() { $(this).addClass('touched') })
       .on('paste', function() { var me = this; setTimeout(function() { validator.call(me) }, 0) })
  }

  function requiredCheckboxGroup($el) {
    function validate() {
      var valid = $el.find('input:checkbox:checked').length > 0 ? true : false
      if (valid) {
        $el.removeClass('invalid')
      } else {
        $el.addClass('invalid')
      }
      $el.trigger('validation')
    }
    $el.on('change validate', 'input:checkbox', validate)
  }

  $form.on('select2-blur', function(e) { $(e.target).addClass('touched') })

  $form.find('input[type=text], textarea').not('[name="registration-email"]').throttledInput(function(txt) {
    if ($(this).hasClass('invalid') && $(this).val().length > 0) return false
    saveMovieField($form.data('id'), $(this).attr('name'), txt)
  })

  $form.find('input[name="classifications.0.safe"]').change(function() {
    var safe = $(this).is(':checked')
    $form.find('.category-container').toggle(!safe)
    saveMovieField($form.data('id'), $(this).attr('name'), safe)
  })

  $form.on('click', '.category .criteria', function() {
    $(this).toggleClass('selected').toggleClass('has-comment', isNotEmpty($(this).find('textarea').val()))
    var ids = $form.find('.category .criteria.selected').map(function(i, e) { return $(e).data('id') }).get()
    saveMovieField($form.data('id'), 'classifications.0.criteria', ids)
  })

  $form.on('click', '.category .criteria textarea', function(e) {
    e.stopPropagation()
  })
  $form.on('blur', '.category .criteria.has-comment:not(.selected) textarea', function() {
    $(this).parents('.criteria').toggleClass('has-comment', isNotEmpty($(this).val()))
  })

  warningDragOrder($("#summary .summary"))
  warningDragOrder($("#classification .summary"))

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
      saveMovieField($form.data('id'), 'classifications.0.warning-order', newOrder)
    })
  }

  function show(movie) {
    var classification = movie.classifications[0]

    $form.data('id', movie._id).show()
      .find('.touched').removeClass('touched').end()
      .find('input[name="name.0"]').val(movie.name[0]).end()
      .find('input[name="name-fi.0"]').val(movie['name-fi'][0]).end()
      .find('input[name="name-sv.0"]').val(movie['name-sv'][0]).end()
      .find('input[name="name-other.0"]').val(movie['name-other'][0]).end()
      .find('input[name=year]').val(movie.year).end()
      .find('textarea[name=synopsis]').val(movie.synopsis).end()
      .find('input[name="classifications.0.buyer"]').val(classification.buyer).end()
      .find('input[name="classifications.0.billing"]').val(classification.billing).end()
      .find('input[name="classifications.0.duration"]').val(classification.duration).end()
      .find('input[name="classifications.0.safe"]').check(classification.safe).end()
      .find('textarea[name="classifications.0.comments"]').val(classification.comments).end()

    selectEnumAutocomplete({
      $el: $form.find('input.country'),
      val: movie.country,
      data: Object.keys(enums.countries).map(function(key) { return { id: key, text: enums.countries[key] }}),
      multiple: true
    })

    selectEnumAutocomplete({
      $el: $form.find('input[name="production-companies"]'),
      val: movie['production-companies'],
      data: enums.productionCompanies.map(function(f) { return { id: f, text: f }}),
      multiple: true
    })

    selectEnumAutocomplete({
      $el: $form.find('input[name=genre]'),
      val: movie.genre,
      data: enums.genre.map(function(f) { return { id: f, text: f }}),
      multiple: true
    })

    selectAutocomplete({
      $el: $form.find('input[name="directors"]'),
      val: movie['directors'] || [],
      path: '/directors/search/',
      multiple: true,
      allowAdding: true
    })

    selectAutocomplete({
      $el: $form.find('input[name="actors"]'),
      val: movie['actors'] || [],
      path: '/actors/search/',
      multiple: true,
      allowAdding: true,
      termMinLength: 3
    })

    selectAutocomplete({
      $el: $form.find('input[name="classifications.0.buyer"]'),
      val: movie.classifications[0].buyer,
      path: function (term) { return '/accounts/search/' + encodeURIComponent(term) + '?roles=Subscriber' },
      toOption: companyToSelect2Option,
      fromOption: select2OptionToCompany
    })

    selectAutocomplete({
      $el: $form.find('input[name="classifications.0.billing"]'),
      val: movie.classifications[0].billing,
      path: function (term) { return '/accounts/search/' + encodeURIComponent(term) + '?roles=Subscriber,Classifier' },
      toOption: companyToSelect2Option,
      fromOption: select2OptionToCompany
    })

    selectEnumAutocomplete({
      $el: $form.find('input[name="classifications.0.format"]'),
      val: movie.classifications[0].format,
      data: enums.format.map(function(f) { return { id: f, text: f }})
    })

    $form.find('.category-container').toggle(!classification.safe)
    $form.find('.category-criteria input').removeAttr('checked')

    classification.criteria.forEach(function(id) {
      $form.find('.criteria[data-id=' + id + ']').addClass('selected')
    })
    $form.find('.category-criteria textarea').val()
    Object.keys(classification['criteria-comments'] || {}).forEach(function(id) {
      var txt = classification['criteria-comments'][id]
      if (isNotEmpty(txt)) {
        $form.find('textarea[name="classifications.0.criteria-comments.'+id+'"]').val(txt).parents('.criteria').addClass('has-comment')
      }
    })
    $form.find('.required').trigger('validate')
    updateSummary(movie)
    preview.update(movie)
  }

  function selectEnumAutocomplete(opts) {
    opts.$el.select2({
      data: opts.data,
      placeholder: "Valitse...",
      multiple: opts.multiple || false,
      initSelection: function(e, callback) {
        return callback(opts.multiple ? (opts.val || []).map(idToOption) : idToOption(opts.val))
      }
    }).on('change', function() {
      var data = $(this).select2('data')
      saveMovieField($form.data('id'), $(this).attr('name'), opts.multiple ? _.pluck(data, 'id') : data.id)
    }).select2('val', opts.val)

    function idToOption(id) {
      return _.find(opts.data, function(item) { return item.id === id })
    }
  }

  function selectAutocomplete(opts) {
    var defaults = {
      toOption: function(x) { return {id: x, text: x} },
      fromOption: function(x) { return x.id },
      multiple: false,
      allowAdding: false,
      termMinLength: 0
    }

    opts = _.merge(defaults, opts)

    var $select = opts.$el

    function createSearchChoice(term, data) {
      if (_.indexOf(data, term) === -1) {
        return {id: term, text: term}
      }
    }

    $select.select2({
      query: function(query) {
        var len = $.trim(query.term).length
        if (len === 0 || len < opts.termMinLength) {
          return query.callback({results: []})
        }
        var path = (typeof opts.path === 'function') ? opts.path(query.term) : opts.path + query.term
        return $.get(path).done(function(data) {
          return query.callback({results: data.map(opts.toOption)})
        })
      },
      initSelection: function(element, callback) {
        var val = opts.multiple ? opts.val.map(opts.toOption) : opts.toOption(opts.val)
        return callback(val)
      },
      multiple: opts.multiple,
      placeholder: "Valitse...",
      createSearchChoice: opts.allowAdding ? createSearchChoice : undefined
    })

    $select.on('change', function() {
      var data = $(this).select2('data')
      var val = opts.multiple ? data.map(opts.fromOption) : opts.fromOption(data)
      saveMovieField($form.data('id'), $(this).attr('name'), val)
    })

    $select.select2('val', opts.val)
    $select.trigger('validate')
  }

  function companyToSelect2Option(x) {
    return {id: x._id, text: x.name} 
  }

  function select2OptionToCompany(x) {
    return {_id: x.id, name: x.text}
  }

  function renderClassificationCriteria() {
    enums.criteriaCategories.map(function(category) {
      var criteria = enums.classificationCriteria.filter(function(c) { return c.category == category })
      var $criteria = criteria.map(function(c) {
        return $('<div>', {class: 'criteria agelimit ' + 'agelimit-' + c.age, 'data-id': c.id})
          .append($('<h5>').text(c.title + ' ').append($('<span>').text('(' + c.id + ')')))
          .append($('<p>').text(c.description))
          .append($('<textarea>', { name:'classifications.0.criteria-comments.' + c.id, placeholder:'Kommentit...' }))
      })
      $('.category-container .' + category).append($criteria)
    })
  }

  function saveMovieField(id, field, value) {
    $.post('/movies/' + id, JSON.stringify(keyValue(field, value))).done(function(movie) {
      updateSummary(movie)
      preview.update(movie)
    })
  }

  function updateSummary(movie) {
    var summary = classification.summary(movie, movie.classifications[0])
    var warnings = [$('<span>', { class:'drop-target' })].concat(summary.warnings.map(function(w) { return $('<span>', { 'data-id': w, class:'warning ' + w, draggable:true }).add($('<span>', { class:'drop-target' })) }))
    var synopsis = (movie.synopsis ? movie.synopsis : '-').split('\n\n').map(function (x) { return $('<p>').text(x) })
    var countries = enums.util.toCountryString(movie.country)
    $summary
      .find('.name').text(movie.name.join(', ') || '-').end()
      .find('.year').text(movie.year || '-').end()
      .find('.synopsis').html(synopsis).end()
      .find('.country').text(countries || '-').end()
      .find('.directors').text((movie.directors).join(', ') || '-').end()
      .find('.actors').text((movie.actors).join(', ') || '-').end()
      .find('.agelimit img').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warnings).end()
  }

  function registrationPreview() {
    var $emails = $('#email .emails')
    var $preview = $("#email .email-preview")

    $emails.find('ul').on('change', 'input', function(e) {
      saveEmailState()
    })

    $emails.find('button.add-registration-email').on('click', function(e) {
      e.preventDefault()
      var $input = $emails.find('input[name=registration-email]')
      if ($input.hasClass('invalid')) { return; }
      addManualEmailCheckbox(true, $input.val())
      $input.val('')
      saveEmailState()
    })

    function saveEmailState() {
      var buyerEmails = $emails.find('ul.buyer input:checked')
        .map(function() { return $(this).val() }).get()
        .map(function(email) { return {email: email, manual: false}})

      var manualEmails = $emails.find('ul.manual input:checked')
        .map(function() { return $(this).val() }).get()
        .map(function(email) { return {email: email, manual: true}})

      saveMovieField($form.data('id'), $emails.find('ul li input:first').attr('name'), buyerEmails.concat(manualEmails))
    }

    function updatePreview(movie) {
      var cl = _.first(movie.classifications)
      var buyerEmails = cl['registration-email-addresses']
        .filter(function(email) { return !email.manual }).map(function(e) { return e.email })
      var manualEmails = cl['registration-email-addresses']
        .filter(function(email) { return email.manual }).map(function(e) { return e.email })

      var manualInDom = $emails.find('ul.manual li input').map(function() { return $(this).val() }).get()
      manualEmails.filter(function(email) { return notIn(manualInDom, email) })
        .forEach(addManualEmailCheckbox(true))

      var email = classification.registrationEmail(movie)

      $preview.find('.recipients').text(email.recipients.join(', '))
      $preview.find('.subject').text(email.subject)
      $preview.find('.body').text(email.body)

      if (cl.buyer) {
        $.get('/accounts/' + cl.buyer._id).done(function(data) {
          // remove all email addresses linked to the selected buyer
          $emails.find('ul.buyer li').remove()

          data['email-addresses'].forEach(function(email) {
            if (notIn(buyerEmails, email)) {
              addBuyerEmailCheckbox(false, email)
            } else {
              addBuyerEmailCheckbox(true, email)
            }
          })
          $emails.find('ul li input:checkbox').trigger('validate')
        })
      }
    }

    function addEmailCheckbox($el, checked, email) {
      $el.append($('<li>').html([
         $('<input>', {
           type: 'checkbox',
           checked: checked || false,
           name: 'classifications.0.registration-email-addresses',
           value: email
         }),
         $('<span>').text(email)
      ]))
    }
    var addBuyerEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.buyer'))
    var addManualEmailCheckbox = _.curry(addEmailCheckbox)($emails.find('ul.manual'))

    return {update: updatePreview}
  }
}

function keyValue(key, value) {
  var data = {}
  data[key] = value
  return data
}

function isNotEmpty(val) {
  return (val.trim().length) > 0
}

function isValidDuration(txt) {
  return /(?:(\d+)?:)?(\d+):(\d+)$/.test(txt)
}

function isEmail(txt) {
  var regexp = /^([A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+(\.[A-Za-z0-9\x27\x2f!#$%&*+=?^_`{|}~-]+)*)@(([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63})(\.([a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]|[a-zA-Z0-9]{1,63}))*\.[a-zA-Z0-9]{2,63})$/
  return regexp.test(txt)
}

function isValidYear(txt) {
  return /^\d{4}$/.test(txt) && parseInt(txt) > 1889
}

function validate(f) {
  return function() {
    var $el = $(this)
    if (f($el.val())) {
      $el.removeClass('invalid')
    } else {
      $el.addClass('invalid')
    }
    $el.trigger('validation')
  }
}

function showDialog($html) {
  $('#overlay').show()
  $('#dialog').show().append($html)
}

function closeDialog() {
  $('#dialog').empty().hide()
  $('#overlay').hide()
}

$.fn.throttledInput = function(fn) {
  return $(this).each(function() {
    var prev = undefined
    var timeout = null
    var $input = $(this).on('keyup', function() {
      var txt = $input.val()
      var that = this
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(function() {
        if (prev == txt) return
        prev = txt
        fn.call(that, txt)
      }, 400)
    })
    $input.on('reset', reset)
    $input.on('fire', function() {
      reset()
      fn.call(this, prev)
    })

    function reset() {
      if (timeout) clearTimeout(timeout)
      prev = $input.val()
    }
  })
}

$.fn.check = function(on) {
  $(this).each(function() {
    on ? $(this).prop('checked', 'checked') : $(this).removeProp('checked')
  })
  return this
}

function classificationStatus(classification) {
  var df = 'D.M.YYYY [klo] H:mm';

  switch (classification.status) {
    case 'registered':
    case 'reclassification1':
    case 'reclassification3':
      return 'Rekisteröity '+moment(classification['registration-date']).format(df)
    case 'in_process':
      return 'Luonnos tallennettu '+moment(classification['creation-date']).format(df)
    default:
      return 'Unknown status: '+classification.status
  }
}

function classificationAgeLimit(classification) {
  if (!classification) return '-'
  if (classification.safe) return 'S'
  if (classification.criteria.length == 0 && classification['legacy-age-limit']) return classification['legacy-age-limit']
  return _(classification.criteria)
    .map(function(id) { return enums.classificationCriteria[id - 1] })
    .pluck('age')
    .reduce(maxAge) || 'S'

  function maxAge(prev, curr) {
    if (curr == 'S') return prev
    if (prev == 'S') return curr
    return parseInt(curr) > prev ? curr : prev
  }
}

function ageLimitIcon(summary) {
  return summary.pegi
    ? 'images/pegi-'+summary.age+'.png'
    : 'images/agelimit-'+summary.age+'.png'
}
function warningIcons(summary) {
  return summary.pegi
    ? summary.warnings.map(function(w) { return $('<span>', { class:'warning pegi-' + w.toLowerCase() }) })
    : summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w }) })
}


function notIn(arr, el) {
  return _.indexOf(arr, el) === -1
}

var classificationCategory_FI = {violence: 'väkivälta', fear: 'ahdistus', sex: 'seksi', drugs: 'päihteet'}


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
  var $results = $page.find('.results')
  var $noResults = $page.find('.no-results')
  var $detailTemplate = $('#templates > .search-result-details').detach()

  var selectedProgramId = null

  $page.on('show', function(e, q, programId) {
    selectedProgramId = programId
    $input.val(q || '').trigger('fire')
  })

  $button.click(function() {
    $input.trigger('fire')
  })

  $results.on('click', '.result', function() {
    if ($(this).hasClass('selected')) {
      var lastSlashIndex = location.hash.lastIndexOf('/')
      location.hash = location.hash.substring(0, lastSlashIndex) + '/'
      closeDetail()
    } else {
      closeDetail()
      openDetail($(this))
    }
  })

  $input.throttledInput(function() {
    var q = $input.val().trim()
    location.hash = '#haku/' + encodeURIComponent(q) + '/'
    $.get('/movies/search/'+q).done(function(results) {
      $noResults.toggle(results.length == 0)
      $results.html(results.map(function(p) { return render(p, q) }))
      if (selectedProgramId) {
        $results.find('.result[data-id='+selectedProgramId+']').click()
        selectedProgramId = null
      }
    })
  })

  function openDetail($row) {
    var p = $row.data('program')
    var lastSlashIndex = location.hash.lastIndexOf('/')
    location.hash = location.hash.substring(0, lastSlashIndex) + '/' + p._id
    var $details = renderDetails(p)
    $row.addClass('selected').after($details)
    $details.slideDown()
  }

  function closeDetail() {
    $results.find('.result.selected').removeClass('selected')
    $results.find('.search-result-details').slideUp(function() { $(this).remove() }).end()
  }

  function render(p, query) {
    var c = p.classifications[0]
    var queryParts = (query || '').trim().toLowerCase().split(/\s+/)
    return $('<div>', { class:'result', 'data-id': p._id })
      .data('program', p)
      .append($('<span>').text(p.name[0]).highlight(queryParts, { beginningsOnly: true, caseSensitive: false }))
      .append($('<span>').text(countryAndYear(p)))
      .append($('<span>').text(classificationAgeLimit(c)))
      .append($('<span>').text(duration(c)))

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
      .find('.name-sv').text(names.sv).prev().toggleClass('hide', !!names.sv).end().end()
      .find('.name-other').text(names.other).prev().toggleClass('hide', !!names.other).end().end()
      .find('.country').text(enums.util.toCountryString(p.country)).end()
      .find('.year').text(p.year).end()
      .find('.production-companies').text(p['production-companies'].join(', ')).end()
      .find('.genre').text(p.genre.join(', ') || p['legacy-genre'].join(', ')).end()
      .find('.directors').text(p.directors.join(', ')).end()
      .find('.actors').text(p.actors.join(', ')).end()
      .find('.synopsis').text(p.synopsis).end()

    var c = p.classifications[0]
    if (c) {
      var summary = classificationSummary(c)
      var warnings = summary.warnings.map(function(w) { return $('<span>', { class:'warning ' + w }) })
      $e.find('.agelimit').attr('src', 'images/agelimit-'+summary.age+'.png').end()
      .find('.status').text(classificationStatus(c)).end()
      .find('.warnings').html(warnings).end()
      .find('.buyer').text(c.buyer && c.buyer.name || '').end()
      .find('.billing').text(c.billing && c.billing.name || '').end()
      .find('.format').text(c.format).end()
      .find('.duration').text(c.duration).end()
      .find('.criteria').html(renderClassificationCriteria(c)).end()
    }
    return $e
  }

  function renderClassificationCriteria(c) {
    if (!c.criteria) return ''
    return c.criteria.map(function(id) {
      var cr = classificationCriteria[id - 1]
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

  $root.find('.new-movie').click(function() {
    $.post('/movies/new').done(function(movie) {
      location.hash = '#luokittelu/'+movie._id
      show(movie)
    })
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
      showDialog($('<div>', {id: 'registration-confirmation', class: 'dialog'})
        .append($('<h3>').text("Luokittelu rekisteröity"))
        .append($('<span>', {class: 'name'}).text(data.name))
        .append($('<p>').html($('<button>', {click: closeDialog}).text('Sulje'))))
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
    $('.new-movie').attr('disabled', 'true')
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
      var criteria = classificationCriteria.filter(function(c) { return c.category == category })
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
    var classification = classificationSummary(movie.classifications[0])
    var warnings = [$('<span>', { class:'drop-target' })].concat(classification.warnings.map(function(w) { return $('<span>', { 'data-id': w, class:'warning ' + w, draggable:true }).add($('<span>', { class:'drop-target' })) }))
    var synopsis = (movie.synopsis ? movie.synopsis : '-').split('\n\n').map(function (x) { return $('<p>').text(x) })
    var countries = enums.util.toCountryString(movie.country)
    $summary
      .find('.name').text(movie.name.join(', ') || '-').end()
      .find('.year').text(movie.year || '-').end()
      .find('.synopsis').html(synopsis).end()
      .find('.country').text(countries || '-').end()
      .find('.directors').text((movie.directors).join(', ') || '-').end()
      .find('.actors').text((movie.actors).join(', ') || '-').end()
      .find('.agelimit img').attr('src', 'images/agelimit-'+classification.age+'.png').end()
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
      var now = new Date()
      var dateString = now.getDate() + '.' + (now.getMonth() + 1) + '.' + now.getFullYear()
      var classification = _.first(movie.classifications)
      var buyer = classification.buyer ? classification.buyer.name : ''
      var summary = classificationSummary(classification)
      var buyerEmails = classification['registration-email-addresses']
        .filter(function(email) { return !email.manual }).map(function(e) { return e.email })
      var manualEmails = classification['registration-email-addresses']
        .filter(function(email) { return email.manual }).map(function(e) { return e.email })

      var manualInDom = $emails.find('ul.manual li input').map(function() { return $(this).val() }).get()
      manualEmails.filter(function(email) { return notIn(manualInDom, email) }).forEach(addManualEmailCheckbox(true))

      $preview.find('.date').text(dateString)
      $preview.find('.name').text(movie.name.join(', '))
      $preview.find('.year').text(movie.year || '')
      $preview.find('.buyer').text(buyer)
      $preview.find('.classification').text(classificationText(summary))
      $preview.find('.classification-short').text(summary.age + ' ' + classificationCriteriaText(summary.warnings))
      $preview.find('.recipients').text(buyerEmails.concat(manualEmails).join(', '))

      if (classification.buyer) {
        $.get('/accounts/' + classification.buyer._id).done(function(data) {
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
    $input.on('fire', function() {
      if (timeout) clearTimeout(timeout)
      prev = $input.val()
      fn.call(this, prev)
    })
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

function classificationSummary(classification) {
  if (classification.safe) return { age:'S', warnings:[] }
  var maxAgeLimit = classificationAgeLimit(classification)
  var warnings = _(classification.criteria)
    .map(function(id) { return classificationCriteria[id - 1] })
    .filter(function(c) { return c.age == maxAgeLimit })
    .map(function(c) { return c.category })
    .reduce(function(accum, c) { if (accum.indexOf(c) == -1) accum.push(c); return accum }, [])
  if (classification['warning-order'].length > 0) {
    var order = classification['warning-order']
    warnings = warnings.sort(function(a, b) {
      return order.indexOf(a) - order.indexOf(b)
    })
  }
  return { age: maxAgeLimit, warnings: warnings }
}

function classificationAgeLimit(classification) {
  if (!classification) return '-'
  if (classification.safe) return 'S'
  if (classification.criteria.length == 0 && classification['legacy-age-limit']) return classification['legacy-age-limit']
  return _(classification.criteria)
    .map(function(id) { return classificationCriteria[id - 1] })
    .pluck('age')
    .reduce(maxAge) || 'S'

  function maxAge(prev, curr) {
    if (curr == 'S') return prev
    if (prev == 'S') return curr
    return parseInt(curr) > prev ? curr : prev
  }
}

function classificationText(classification) {
  var criteria = classificationCriteriaText(classification.warnings)
  if (classification.age === 'S') {
    return 'Kuvaohjelma on sallittu.'
  } else {
    return 'Kuvaohjelman ikäraja on ' + classification.age
         + ' vuotta ja ' + (classification.warnings.length > 1 ? 'haitallisuuskriteerit' : 'haitallisuuskriteeri') + ' '
         + criteria
  }
}

function classificationCriteriaText(warnings) {
  return warnings.map(function(x) { return classificationCategory_FI[x] }).join(', ')
}

function notIn(arr, el) {
  return _.indexOf(arr, el) === -1
}

var classificationCategory_FI = {violence: 'väkivälta', fear: 'ahdistus', sex: 'seksi', drugs: 'päihteet'}

var classificationCriteria = [
  { id:1,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, realistista ja erittäin veristä ja yksityiskohtaista tai erittäin pitkäkestoista ja yksityiskohtaista tai erittäin pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa" },
  { id:2,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Aitoa ja yksityiskohtaisesti tai selväpiirteisesti sekä viihteellisesti tai ihannoiden esitettyä ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:3,  category: 'violence', age: '18', title: "Erittäin voimakasta väkivaltaa", description: "Fiktiivistä, selväpiirteisesti ja pitkäkestoisesti esitettyä seksiin liittyvää väkivaltaa (raiskaus, insesti, pedofilia)" },
  { id:4,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaista ja realistista tai hallitsevaa tai pitkäkestoista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:5,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä tai aitoa yksityiskohtaisesti ja korostetusti tai yksityiskohtaisesti ja viihteellistetysti esitettyä ihmisiin tai eläimiin kohdistuvaa väkivallan tai onnettomuuksien seurausten kuvausta." },
  { id:6,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Fiktiivistä, esitystavaltaan selvästi yliampuvaa tai parodista, veristä ja yksityiskohtaista tai pitkäkestoista ja yksityiskohtaista tai pitkäkestoista ja sadistista ihmisiin tai eläimiin kohdistuvaa väkivaltaa." },
  { id:7,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Aitoa yksityiskohtaisesti ta selväpiirteisesti esitettyä väkivaltaa, jossa uhrin kärsimykset tai väkivallan seuraukset tuodaan realistisesti esille." },
  { id:8,  category: 'violence', age: '16', title: "Voimakasta väkivaltaa", description: "Seksiin liittyvää fiktiivistä väkivaltaa, jossa uhrin kärsimys tulee selvästi esiin ja väkivalta on tarinan kannalta perusteltua tai voimakkaita viittauksia alaikäisiin kohdistuvaan seksuaaliseen väkivaltaan tai hyväksikäyttöön." },
  { id:9,  category: 'violence', age: '12', title: "Väkivaltaa", description: "Ei erityisen yksityiskohtaista tai ei hallitsevasti lapsiin, eläimiin tai lapsi-päähenkilön perheenjäseniin kohdistuvaa tai tarinan kannalta perusteltu yksittäinen, yksityiskohtainen ihmisiin tai eläimiin kohdistuva väkivaltakohtaus." },
  { id:10, category: 'violence', age: '12', title: "Väkivaltaa", description: "Epärealistisessa, etäännytetyssä yhteydessä esitettyä (joko epärealistinen väkivalta ihmis- tai eläinmäisiä hahmoja kohtaan tai realistinen väkivalta selkeän kuvitteellisia hahmoja kohtaan tai historiallinen, kulttuurinen jne. etäännytys!)" },
  { id:11, category: 'violence', age: '12', title: "Väkivaltaa", description: "Seksuaaliseen väkivaltaan viittaavaa (raiskaus, insesti, pedofilia)." },
  { id:12, category: 'violence', age: '7',  title: "Lievää väkivaltaa", description: "Epärealistista tai komediallista tai animaatio- tai slapstick-komediassa esitettyä yliampuvaa tai vähäistä väkivaltaa." },
  { id:13, category: 'violence', age: '7',  title: "Lievää väkivaltaa", description: "Yksittäinen, lievähkö ja lyhytkestoinen realistinen väkivaltakohtaus tai selkeät, mutta lievät tai lyhytkestoiset väkivaltaviitteet." },
  { id:14, category: 'violence', age: 'S',  title: "Väkivaltaa tai vain hyvin lievää väkivaltaa", description: "Kuvaohjelmassa ei ole lainkaan väkivaltaa tai se on vain hyvin lievää." },
  { id:15, category: 'sex',      age: '18', title: "Erittäin yksityiskohtaista seksuaalista sisältöä", description: "Hallitsevaa ja seksikohtauksissa sukuelimiä selväpiirteisesti näyttävää." },
  { id:16, category: 'sex',      age: '16', title: "Avointa seksuaalista sisältöä", description: "Avointa, mutta yksityiskohdiltaan peiteltyä kuvausta tai yksityiskohtainen, yksittäinen ja lyhyt seksikohtaus." },
  { id:17, category: 'sex',      age: '12', title: "Seksuaalista sisältöä", description: "Peiteltyjä seksikohtauksia tai runsaasti selkeitä seksiviitteitä." },
  { id:18, category: 'sex',      age: '12', title: "Seksuaalista sisältöä", description: "Yksittäinen avoin, mutta yksityiskohdiltaan peitelty seksikuvaus (seksikohtaus)." },
  { id:19, category: 'sex',      age: '7',  title: "Lievää seksuaalista sisältöä", description: "Lieviä seksuaalisia viittauksia tai yksittäisiä verhotusti esitettyjä eroottissävyisiä kohtauksia." },
  { id:20, category: 'sex',      age: 'S',  title: "Vain hyvin lievää seksuaalista sisältöä", description: "Halailua, syleilyä tai suudelmia tai alastomuutta muussa kuin seksuaalisessa kontekstissa." },
  { id:21, category: 'fear',     age: '18', title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Hallitsevaa, erittäin järkyttävää, yksityiskohtaista kuvausta ihmisiin tai eläimiin kohdistuvista julmuuksista tai perversioista." },
  { id:22, category: 'fear',     age: '18', title: "Erittäin voimakasta ahdistusta herättävää sisältöä", description: "Aitoa ongelmattomana tai ihannoiden esitettyä itseä tai muita vahingoittavaa, vakavasti henkeä uhkaavaa ja hengenvaarallista käyttäytymistä." },
  { id:23, category: 'fear',     age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa järkyttävää ja ahdistusta herättävää, pitkäkestoista ja intensiivistä kuoleman, vakavan väkivallan tai psyykkisen hajoamisen uhkaa. Myös itsemurhan ihannointi. Yliluonnolliseen liittyvää voimakasta ahdistavuutta. Yliluonnolliseen liittyvää voimakasta ahdistavuutta." },
  { id:24, category: 'fear',     age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Runsaasti realistisia ja yksityiskohtaisia (makaabereja) kuvia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:25, category: 'fear',     age: '16', title: "Voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, ihannoivasti esitettyä itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:26, category: 'fear',     age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ihmisiin tai eläimiin kohdistuvaa lyhytkestoista tai ei-hallitsevaa väkivallan tai kuoleman uhkaa tai kaltoin kohtelun tai psyykkisen kärsimyksen kuvausta. Menetysten, esim. perheenjäsenten sairauden tai kuoleman, voimakkaan surun, sekavuustilan tai itsemurhan kuvauksia." },
  { id:27, category: 'fear',     age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Ahdistusta herättäviä luonnonmullistusten, onnettomuuksien, katastrofien tai konfliktien ja niihin kytkeytyvän kuoleman uhan tai uhrien kuvauksia." },
  { id:28, category: 'fear',     age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Voimakkaita, äkillisiä ja yllättäviä ahdistusta, pelkoa tai kauhua herättäviä ääni- ja kuvatehosteita tai pitkäkestoista piinaavaa uhkaa. Yliluonnolliseen liittyvää melko voimakasta ahdistavuutta." },
  { id:29, category: 'fear',     age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Yksittäisiä realistisia ja yksityiskohtaisia kuvauksia silpoutuneista, pahoin vahingoittuneista tai mädäntyneistä ruumiista tai väkivallan uhreista." },
  { id:30, category: 'fear',     age: '12', title: "Melko voimakasta ahdistusta herättävää sisältöä", description: "Aitoa, itseä tai muita vahingoittavaa käyttäytymistä." },
  { id:31, category: 'fear',     age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Melko lieviä ja lyhytkestoisia kauhuelementtejä, pientä pelottavuutta tai jännittävyyttä tai väkivallan uhkaa esimerkiksi animaatiossa tai fantasiassa (hirviöhahmoja, muodonmuutoksia, synkähköä visuaalista kuvastoa, lyhytkestoisia takaa-ajoja tai kohtalaisia äänitehosteita)." },
  { id:32, category: 'fear',     age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Lasten universaaleja pelkoja käsitteleviä kuvauksia tai tilanteita (esimerkiksi yksin jääminen, vanhemmista eroon joutuminen, pimeä, eksyminen tai läheisen menettäminen)." },
  { id:33, category: 'fear',     age: '7',  title: "Lievää ahdistusta herättävää sisältöä", description: "Dokumentaarista ihmisiin/eläimiin kohdistuvaa  lyhytkestoista uhkaa ilman tehosteita." },
  { id:34, category: 'fear',     age: 'S',  title: "Vain hyvin lievää ahdistavaa sisältöä", description: "Hyvin lieviä ja lyhytkestoisia pelottavia tai jännittäviä elementtejä, jotka ratkeavat hyvin nopeasti positiiviseen suuntaan." },
  { id:35, category: 'drugs',    age: '18', title: "Ihannoivaa erittäin vaarallisten huumeiden käyttöä", description: "Hallitsevaa ja ihannoivassa valossa yksityiskohtaisesti esitettyä erittäin vaarallisten huumeiden käyttöä." },
  { id:36, category: 'drugs',    age: '16', title: "Huumeiden käyttöä", description: "Huumeiden realistista ja yksityiskohtaista ongelmakäyttöä tai yksittäisiä ongelmattomia tai ihannoivia huumeiden käytön kuvauksia." },
  { id:37, category: 'drugs',    age: '12', title: "Huumeiden ei-hallitsevaa käyttöä / alaikäisten alkoholin käyttöä", description: "Tällä tarkoitetaan huumeiden viitteellistä tai vähäistä käyttöä tai alaikäisten korostettua, viihteellistä tai ongelmatonta alkoholin käyttöä." }
]

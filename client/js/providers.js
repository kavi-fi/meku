window.providerPage = function () {
  const $page = $('#provider-page')
  const $providers = $page.find('.providers-list')
  const $unapproved = $page.find('.unapproved .results')
  const $allProviders = $providers.add($unapproved)
  const $providerNameQuery = $page.find('#provider-name-query')
  const $search = $page.find('.search')
  const $onlyK18 = $page.find('.k18-label input')
  const $yearlyBilling = $page.find('.yearly-billing')
  const $billing = $page.find('.billing')
  const $datePicker = $billing.find('.datepicker')
  const $billingContainer = $billing.find('.billing-container')
  const format = 'DD.MM.YYYY'

  const $spinner = shared.spinner().appendTo($page.find('.date-selection'))
  const latestAjax = meku.switchLatestDeferred()

  const datePickerOpts = {
    shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']}, customShortcuts: shared.yearShortcuts()
  }
  shared.setupDatePicker($datePicker, datePickerOpts, fetchNewProviders)

  $page.on('show', function (event, providerId) {
    updateLocationHash(providerId || '')
    $.get('/providers', function (providers) {
      renderProviders(providers)
      updateStatistics()

      // Apply provider search
      $providerNameQuery.trigger('input')

      if (providerId) {
        const $selected = $providers.add($unapproved).find('.result[data-id=' + providerId + ']')
        openDetails($selected)
        const top = $selected.offset().top - 25
        $('body,html').animate({scrollTop: top})
      }
    })

    $.get('/providers/unapproved', function (providers) {
      $unapproved.empty()
      _(providers).sortBy('name')
        .map(renderProvider)
        .value()
        .forEach(function (p) {
          $unapproved.append(p)
        })
    })

    const range = {
      begin: moment().subtract(1, 'days').startOf('month'),
      end: moment().subtract(1, 'days')
    }
    meku.setDatePickerSelection($datePicker, range, fetchNewProviders)
    updateMetadata()
    renderFilters()
    $page.find('form input[name=_csrf]').val($.cookie('_csrf_token'))
  })

  $page.on('click', 'button[name=new-provider]', function () {
    const $providerDetails = renderProviderDetails()
    $providerDetails.find('.modify-only').remove()
    const $selected = $providers.find('.selected')
    bindEventHandlers($selected, $providerDetails, function (provider) {
      $.post('/providers', JSON.stringify(_.merge(provider, {deleted: false})), function (newProvider) {
        const $providerRow = renderProvider(newProvider)
        $unapproved.prepend($providerRow)
        $providerRow.slideDown()
        closeDetails()
      })
    })
    closeDetails()
    $unapproved.prepend($providerDetails)
    $providerDetails.slideDown()
  })

  $page.find('button.export').on('click', function () {
    const $form = $(".providers-excel-export-form:visible")
    $form.submit()
  })

  $providerNameQuery.on('input', function () {
    const searchString = $(this).val().toLowerCase()
    const providingTypes = _.map($('#provider-page .filters input').filter(':checked'), function (input) { return $(input).attr('data-providing-type') })
    const onlyK18 = $onlyK18.is(':checked')
    $providers.find('.result').each(function (i, result) {
      const name = $(this).children('.name').text().toLowerCase()
      const matchesProviderName = searchString.length > 0 && _.includes(name, searchString)
      const providerLocations = $(this).data('provider').locations
      const isLocationRowVisible = _.map(providerLocations, function (providerLocation) {
        const matchesName = matchesProviderName || _.includes(providerLocation.name.toLowerCase(), searchString.toLowerCase())
        const matchesK18 = onlyK18 ? providerLocation.adultContent : true
        const matchesProvidingType = providingTypes.length === 0 || _.intersection(providingTypes, providerLocation.providingType).length > 0
        return matchesName && matchesK18 && matchesProvidingType
      })
      $(result).next('.locations').find('.location-row').each(function (j, locationRow) {
        $(locationRow).toggle(isLocationRowVisible[j])
      })
      $(this).parent('.provider-row').toggle(_.includes(isLocationRowVisible, true))
    })
    $search.find('.result-count .num').text($providers.find('.result:visible').length)
    closeDetails()
  })

  $onlyK18.on('change', function () {
    $providerNameQuery.trigger('input')
  })

  $allProviders.on('click', '.result', function () {
    const $this = $(this)
    const wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  $billing.on('click', '> h3', function () {
    $(this).toggleClass('selected').next().slideToggle()
  })
  $yearlyBilling.on('click', '> h3', function () {
    $(this).toggleClass('selected').next().slideToggle()
  })
  $page.find('.statistics').on('click', '> h3', function () {
    $(this).toggleClass('selected').next().slideToggle()
  })

  $yearlyBilling.on('click', 'button.yearly-billing-reminder', function () {
    const $button = $(this)
    $button.prop('disabled', true)
    $.get('/providers/yearlyBilling/info', function (info) {
      shared.showDialog($('#templates').find('.yearly-billing-reminder-dialog').clone()
        .find('.provider-count').text(info.providerCount).end()
        .find('.location-count').text(info.locationCount).end()
        .find('.providers-without-mail').html(renderProvidersWithoutMail(info.providersWithoutMail)).end()
        .find('.locations-without-mail').html(renderLocationsWithoutMail(info.locationsWithoutMail)).end()
        .find('.send').click(sendYearlyBillingReminderMail).end()
        .find('.cancel').click(shared.closeDialog).end())
      $button.prop('disabled', false)

      function renderProvidersWithoutMail(providers) {
        return _.map(providers, function (p) { return $('<div>').text(p.name) })
      }

      function renderLocationsWithoutMail(locations) {
        return _.map(locations, function (l) { return $('<div>').text(l.provider.name + ': ' + l.name) })
      }

      function sendYearlyBillingReminderMail() {
        shared.closeDialog()
        $.post('/providers/yearlyBilling/sendReminders', updateMetadata)
      }
    })
  })

  $yearlyBilling.on('click', 'button.yearly-billing-kieku', function () {
    $yearlyBilling.find('.most-recent .created').text(window.utils.asDateTime(moment()))
    setTimeout(function () { updateMetadata() }, 10000)
  })

  function fetchNewProviders(range) {
    const $list = $billing.find('.new-providers-list').empty()

    latestAjax($.get('/providers/billing/' + range.begin + '/' + range.end), $spinner).done(function (providers) {
      $page.find('.billing-container input[name=begin]').val(range.begin)
      $page.find('.billing-container input[name=end]').val(range.end)
      const $template = $('#templates').find('.invoice-provider').clone()

      $billingContainer.toggle(providers.length > 0)
      $billing.find('.no-results').toggle(providers.length === 0)

      _.forEach(providers, function (provider) {
        const $provider = $template.find('.invoice-provider-row').clone()

        $provider.find('.name').text(provider.name)
        $provider.find('.registrationDate').text(moment(provider.registrationDate).format(format))

        $list.append($provider)
        _.forEach(provider.locations, function (location) {
          const $location = $template.find('.invoice-location-row').clone()

          $location.find('.name').text(location.name)
          $location.find('.registrationDate').text(moment(location.registrationDate).format(format))

          $list.append($location)
          _.forEach(location.providingType, function (providingType) {
            const $providingType = $template.find('.invoice-providing-type-row').clone()

            $providingType.find('.name').text(' - ' + window.enums.providingType[providingType])
            $providingType.find('.price').text(window.enums.providingTypePrices[providingType] + '€')

            $list.append($providingType)
          })
        })
        $list.append($('<tr>').append($('<td>', {class: 'empty-row'})))
      })
    })
  }

  $billing.on('click', 'button[name="create-kieku"]', function () {
    const begin = $billingContainer.find('input[name=begin]').val()
    const end = $billingContainer.find('input[name=end]').val()
    $billingContainer.find('.most-recent .created').text(window.utils.asDateTime(new Date()))
    $billingContainer.find('.most-recent .dates').text(formatDate(begin) + ' - ' + formatDate(end))
    setTimeout(function () { updateMetadata() }, 10000)
    function formatDate(s) { return moment(s, format).format(window.utils.dateFormat) }
  })

  function openDetails($row) {
    $.get('/providers/' + $row.data('id'), function (provider) {
      $row.data('provider', provider)
      const $providerDetails = renderProviderDetails(provider)

      if (shared.hasRole('root')) $providerDetails.append(meku.changeLog(provider).render())

      bindEventHandlers($row, $providerDetails, function (providerData) {
        $.ajax('/providers/' + provider._id, {type: 'PUT', data: JSON.stringify(providerData)})
          .done(function (result) {
            const $parent = $row.parent()
            const $newRow = renderProvider(result)
            $parent.replaceWith($newRow)
            $newRow.find('.result').addClass('selected').after($providerDetails)
            $providerDetails.find('.touched').removeClass('touched')
            $providerDetails.find('form').trigger('validate')
            $providerDetails.find('.buttons .save-success:first').fadeIn(500).delay(5000).fadeOut()
            updateStatistics()
        })
      })

      $row.addClass('selected').after($providerDetails)
      updateLocationHash(provider._id)
      $providerDetails.slideDown()
    })
  }

  function bindEventHandlers($selected, $providerDetails, submitCallback) {
    const $form = $providerDetails.find('form')

    $providerDetails.find('input[name=provider-active]').iiToggle({onLabel: 'Rekisterissä', offLabel: 'Ei rekisterissä', callback: toggleActiveButton})

    $form.submit(function (event) {
      event.preventDefault()

      const specialFields = {
        emailAddresses: _.map($form.find('input[name=emailAddresses]').select2('data'), 'text'),
        billingPreference: $form.find('input[name=billing-extra]').prop('checked')
          ? $form.find('input[name=billing-extra-type]:checked').val() : ''
      }

      submitCallback(_.merge(createDataObjectFromForm($form), specialFields))
    })

    setCommonValidators($form)

    $providerDetails.find('button[name=remove]').click(function () {
      const $selectedResult = $page.find('.result.selected')
      const provider = $selectedResult.data('provider')
      shared.showDialog($('#templates').find('.remove-provider-dialog').clone()
        .find('.provider-name').text(provider.name).end()
        .find('button[name=remove]').click(removeProvider).end()
        .find('button[name=cancel]').click(shared.closeDialog).end())

      function removeProvider() {
        $.ajax('/providers/' + provider._id, {type: 'DELETE'}).done(function () {
          shared.closeDialog()
          closeDetails()
          $selectedResult.parent('.provider-row').slideUp(function () {
            $(this).remove()
            updateStatistics()
          })
        })
      }
    })
  }

  function toggleActiveButton() {
    const $selected = $allProviders.find('.selected')
    const provider = $selected.data('provider')
    $.ajax('/providers/' + provider._id + '/active', {type: 'PUT'}).done(function (activation) {
      provider.active = activation.active
      if (activation.wasFirstActivation) {
        const $dialog = $("#templates").find('.provider-registration-success-dialog').clone()
        $dialog.find('.name').text(provider.name)
        $dialog.find('.email-sent').toggle(activation.emailSent)
        $dialog.find('.no-email-sent').toggle(!activation.emailSent)
        $dialog.find('.without-email').toggle(activation.locationsWithoutEmail.length > 0)
          .find('ul').html(activation.locationsWithoutEmail.map(function (l) {
            return $('<li>').text(l.name)
          }))
        $dialog.find('.with-email').toggle(activation.locationsWithEmail.length > 0)
          .find('ul').html(activation.locationsWithEmail.map(function (l) {
            return $('<li>').text(l.name)
          }))
        $dialog.find('.ok').on('click', function () {
          $page.trigger('show', provider._id)
          shared.closeDialog($selected)
        })
        shared.showDialog($dialog)
      } else {
        $selected.toggleClass('inactive', !activation.active)
        updateStatistics()
      }
    })
  }

  function isUnapproved(provider) { return !provider.registrationDate }

  function closeDetails() {
    $allProviders.find('.result.selected').removeClass('selected')
    $allProviders.find('.location-row.selected').removeClass('selected')
    $allProviders.find('.provider-details').slideUp(function () { $(this).remove() })
    $allProviders.find('.location-details').slideUp(function () { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(providerId) {
    shared.setLocation('#tarjoajat/' + providerId)
  }

  function updateMetadata() {
    $.get('/providers/metadata', function (metadata) {
      $yearlyBilling.find('.most-recent .sent').text(metadata.yearlyBillingReminderSent ? window.utils.asDateTime(metadata.yearlyBillingReminderSent) : undefined)
      $yearlyBilling.find('.most-recent .created').text(metadata.yearlyBillingCreated ? window.utils.asDateTime(metadata.yearlyBillingCreated) : undefined)
      if (metadata.previousMidYearBilling) {
        $billingContainer.find('.most-recent .created').text(window.utils.asDateTime(metadata.previousMidYearBilling.created))
        $billingContainer.find('.most-recent .dates').text(window.utils.asDate(metadata.previousMidYearBilling.begin) + ' - ' + window.utils.asDate(metadata.previousMidYearBilling.end))
      }
    })
  }

  function updateStatistics() {
    const providers = $providers.find('.provider-row > .result').map(function () { return $(this).data('provider') }).toArray()
    const registeredProviders = _.filter(providers, function (p) { return !!p.active })
    const registeredLocationCount = _.reduce(registeredProviders, function (acc, p) { return acc + _.filter(p.locations, function (l) { return !!l.active }).length }, 0)
    const $rows = [$row('Rekisterissä', registeredProviders.length, registeredLocationCount).addClass('first')]

    Object.keys(window.enums.providingType).forEach(function (type) {
      const matchingLocationCounts = _(registeredProviders).map(countLocationsWithProvidingType(type)).compact().value()
      $rows.push($row(window.enums.providingType[type], matchingLocationCounts.length, matchingLocationCounts.reduce(sum, 0)))
    })

    const k18Counts = _(registeredProviders).map(countAdultContentLocations).compact().value()
    $rows.push($row('Tarjolla luokittelemattomia K-18 ohjelmia', k18Counts.length, k18Counts.reduce(sum, 0)).addClass('last'))

    $page.find('.statistics-rows').html($rows)

    function countAdultContentLocations(provider) {
      return _.filter(provider.locations, function (l) { return !!l.active && !!l.adultContent }).length
    }
    function countLocationsWithProvidingType(type) {
      return function (provider) {
        return _.filter(provider.locations, function (l) { return !!l.active && _.includes(l.providingType, type) }).length
      }
    }
    function $row(a, b, c) {
      return $('<tr>')
        .append($('<td>').text(a))
        .append($('<td>').text(b))
        .append($('<td>').text(c))
    }
    function sum(a, b) { return a + b }
  }

  function renderFilters() {
    const $filters = $('#provider-page .filters')
    const $providingTypes = _.map(Object.keys(window.enums.providingType), function (providingType) {
      const $input = $('<input>').attr({'type': 'checkbox', 'name': providingType, 'data-providing-type': providingType})
      $input.on('change', function () {
        $providerNameQuery.trigger('input')
      })
      const $span = $('<span>').attr('data-i18n', '').text(window.enums.providingType[providingType])
      return $('<label>').append($input, $span)
    })
    $filters.html($providingTypes)
  }

  function renderProviders(providers) {
    $providers.empty()
    _(providers).sortBy('name').map(renderProvider).value().forEach(function (acc) { $providers.append(acc) })
  }

  function renderProvider(provider) {
    if (isUnapproved(provider)) {
      return renderUnapproved(provider)
    }
    return renderApproved(provider)
  }

  function renderApproved(provider) {
    const $providerRow = $('#templates').find('.provider-row').clone()
    return $providerRow.find('div:first-child').attr('data-id', provider._id).addClass('result')
      .toggleClass('inactive', !provider.active)
      .data('provider', provider)
      .find('.name').text(provider.name).end()
      .find('.address').text(provider.address.street + ', ' + provider.address.city).end()
      .find('.date').text(window.utils.asDate(provider.registrationDate)).end().end()
      .find('.locations').replaceWith(renderProviderLocations($providerRow, provider)).end()
  }

  function renderUnapproved(provider) {
    const $providerRow = $('#templates').find('.provider-row').clone()
    return $providerRow.find('div:first-child').attr('data-id', provider._id).addClass('result unapproved')
      .data('provider', provider)
      .find('.name').text(provider.name).end()
      .find('.date').text(window.utils.asDate(provider.registrationDate)).end().end()
      .find('.locations').replaceWith(renderProviderLocations($providerRow, provider)).end()
  }

  function renderProviderDetails(provider) {
    const $providerDetails = $('#templates').find('.provider-details').clone()
    $providerDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, provider))
    $providerDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    $providerDetails
      .find('input[name="address.country"]').select2({data: meku.select2DataFromEnumObject(window.enums.countries)}).end()
      .find('input[name=emailAddresses]').select2({tags: [], multiple: true, tokenSeparators: [' ']}).end()
      .find('input[name=billing-extra]').prop('checked', provider && !!provider.billingPreference).end()
      .find('input[name=billing-extra-type][value=' + (provider && provider.billingPreference || 'address') + ']').prop('checked', true).end()
      .find('input[name="language"]').select2({data: meku.select2DataFromEnumObject(window.enums.billingLanguages)}).end()
      .find('input[name=provider-active][value=' + (provider && provider.active ? 'active' : 'inactive') + ']').prop('checked', true).end()
      .find('.locations-total').text(provider ? provider.locations.length : 0).end()


    toggleBillingExtra($providerDetails)

    return $providerDetails

    function toggleBillingExtra() {
      const extraBillingEnabled = $providerDetails.find('input[name=billing-extra]').prop('checked')
      $providerDetails.find('.billing-extra-fields input').prop('disabled', !extraBillingEnabled)

      if (extraBillingEnabled) {
        const type = $providerDetails.find('input[name=billing-extra-type]:checked').val()
        const $addressInputs = $providerDetails.find('.billing-extra-fields .billing-address input')
        const $eInvoiceInputs = $providerDetails.find('.billing-extra-fields .eInvoice input')

        $addressInputs.prop('disabled', type === 'eInvoice')
        $eInvoiceInputs.prop('disabled', type === 'address')
      }
    }
  }

  function setInputValWithProperty(object) {
    const name = $(this).attr('name')
    const property = window.utils.getProperty(object, name)

    if ($(this).attr('type') === 'checkbox') {
      $(this).prop('checked', property || false)
    } else if (property !== undefined) $(this).val(property)
  }

  function setCommonValidators($form) {
    $form.find('input, textarea').on('input change', function () {
      $(this).addClass('touched')
    })

    $form.find('input.select2-offscreen').on('change validate', function () {
      $(this).toggleClass('invalid', !this.checkValidity())
    })

    $form.find('input.select2-offscreen').trigger('validate')

    $form.on('input change', _.debounce(function () {
      $(this).trigger('validate')
    }, 200))

    $form.on('validate', function () {
      const enabled = $form.find('.touched').length > 0 && this.checkValidity()
      $(this).find('button[type=submit]').prop('disabled', !enabled)
    })

    $form.find('input[name=emailAddresses]').on('change', function (event) {
      const emails = event.val
      if (_.every(emails, validateEmail)) {
        this.setCustomValidity('')
      } else {
        this.setCustomValidity('Invalid email')
      }
      $(this).trigger('validate')

      function validateEmail(email) {
        return new RegExp('.+@.+\\..+').test(email)
      }
    })
  }

  function createDataObjectFromForm($form) {
    const object = {}

    $form.find('textarea[name], input[name]').each(function (index, elem) {
      window.utils.setValueForPath(elem.name.split('.'), object, elem.type === 'checkbox' ? elem.checked : elem.value)
    })

    return object
  }

  function renderProviderLocations($providerDetails, provider) {
    const $locations = $('<div>', {class: 'locations'})

    if (provider && provider.locations) {
      provider.locations.forEach(function (location) {
        $locations.append(renderLocation(location))
      })
    }

    $providerDetails.on('click', 'button[name=new-location]', function () {
      closeLocationDetails()

      const $locationDetails = renderLocationDetails()
      $locationDetails.find('.modify-only').remove()

      bindLocationEventHandlers($locationDetails, function (locationData) {
        $.post('/providers/' + provider._id + '/locations', JSON.stringify(locationData), function (l) {
          provider.locations.push(l)
          $providers.find('[data-id=' + provider._id + ']').data('provider', provider)
          $locations.find('.location-details').slideUp(function () {
            $locations.prepend(renderLocation(l))
            $providerDetails.find('.locations-total').text(provider.locations.length)
            updateStatistics()
          })
        })
      })

      $locations.prepend($locationDetails)
      $locationDetails.slideDown()
    })

    $locations.on('click', '.location-row', function () {
      const $this = $(this)
      const wasSelected = $this.hasClass('selected')

      closeLocationDetails()
      if (!wasSelected) {
        const location = $this.data('location')
        const providerResult = $this.parents('.provider-row').find('.result').data('provider')
        const $locationDetails = renderLocationDetails(location)

        if (shared.hasRole('root')) $locationDetails.append(meku.changeLog(location).render())

        $locationDetails.find('.new-only').remove()

        bindLocationEventHandlers($locationDetails, function (locationData) {
          $.ajax('/providers/' + providerResult._id + '/locations/' + location._id, {type: 'PUT', data: JSON.stringify(locationData)})
            .done(function (p) {
              $providers.find('[data-id=' + providerResult._id + ']').data('provider', p)

              $locationDetails.find('.touched').removeClass('touched')
              $locationDetails.find('form').trigger('validate')
              $locationDetails.find('.buttons .save-success').fadeIn(500).delay(5000).fadeOut()

              const $selected = $locations.find('.location-row.selected')
              $selected.replaceWith(renderLocation(_.find(p.locations, {_id: location._id})).addClass('selected'))
              updateStatistics()
            })
        })

        $this.addClass('selected').after($locationDetails)
        $locationDetails.slideDown()
      }
    })

    $locations.on('click', 'button[name=remove]', function () {
      const $selected = $locations.find('.selected')
      const location = $selected.data('location')
      const providerResult = $selected.parents('.provider-row').find('.result').data('provider')
      shared.showDialog($('#templates').find('.remove-location-dialog').clone()
        .find('.location-name').text(location.name).end()
        .find('button[name=remove]').click(removeLocation).end()
        .find('button[name=cancel]').click(shared.closeDialog).end())

      function removeLocation() {
        $.ajax('/providers/' + providerResult._id + '/locations/' + location._id, {type: 'delete'}).done(function (p) {
          shared.closeDialog()
          closeLocationDetails()
          $providers.find('[data-id=' + providerResult._id + ']').data('provider', p)
          $selected.slideUp(function () {
            $(this).remove()
            $providerDetails.find('.locations-total').text(providerResult.locations.length - 1)
            updateStatistics()
          })
        })
      }
    })

    return $locations

    function closeLocationDetails() {
      $locations.find('.selected').removeClass('selected')
      $locations.find('.location-details').slideUp(function () { $(this).remove() })
    }

    function renderLocationDetails (location) {
      const $locationDetails = $('#templates').find('.location-details').clone()
      $locationDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, location))
      $locationDetails.find('input[name=emailAddresses]').select2({tags: [], multiple: true, tokenSeparators: [' ']}).end()
        .find('input[name=providingType]').select2({data: meku.select2DataFromEnumObject(window.enums.providingType), multiple: true}).end()
        .find('input[name=location-active][value=' + (location && location.active ? 'active' : 'inactive') + ']').prop('checked', true).end()

      $locationDetails.find('input[name=location-active]').iiToggle({onLabel: 'Rekisterissä', offLabel: 'Ei rekisterissä', callback: toggleLocationActiveButton})

      return $locationDetails
    }

    function toggleLocationActiveButton() {
      const $selected = $locations.find('.location-row.selected')
      const location = $selected.data('location')
      const providerResult = $selected.parents('.provider-row').find('.result').data('provider')
      $.ajax('/providers/' + providerResult._id + '/locations/' + location._id + '/active', {type: 'PUT'}).done(function (activation) {
        location.active = activation.active
        location.registrationDate = activation.registrationDate
        $selected.data('location', location)
        if (activation.wasFirstActivation) {
          const $dialog = $("#templates").find('.location-registration-success-dialog').clone()
          $dialog.find('.name').text(location.name)
          $dialog.find('.email').toggle(activation.emailSent)
          $dialog.find('.no-email').toggle(!activation.emailSent)
          $dialog.find('.ok').on('click', function () {
            shared.closeDialog()
            $selected.replaceWith(renderLocation(location).addClass('selected'))
            updateStatistics()
          })
          shared.showDialog($dialog)
        } else {
          $selected.toggleClass('inactive', !activation.active)
          updateStatistics()
        }
      })
    }

    function renderLocation(location) {
      return $('<div>', {'data-id': location._id, class: 'location-row'})
        .data('location', location).toggleClass('inactive', !location.active)
        .append($('<i>', {class: 'rotating fa fa-play'}))
        .append($('<span>').text(location.name))
        .append($('<span>').text(window.utils.getProperty(location, 'address.street') ? location.address.street + ', ' + location.address.city : ''))
        .append($('<span>').text(location.isPayer ? 'Laskutetaan' : ''))
        .append($('<span>').text(window.utils.asDate(location.registrationDate)))
    }

    function bindLocationEventHandlers($locationDetails, submitCallback) {
      const $form = $locationDetails.find('form')

      $form.submit(function (event) {
        event.preventDefault()

        const specialFields = {
          emailAddresses: _.map($form.find('input[name=emailAddresses]').select2('data'), 'text'),
          providingType: _.map($form.find('input[name=providingType]').select2('data'), 'id')
        }

        submitCallback(_.merge(createDataObjectFromForm($form), specialFields))
      })

      setCommonValidators($form)
    }
  }
}

function providerPage() {
  var $page = $('#provider-page')
  var $providers = $page.find('.providers-list')
  var $unapproved = $page.find('.unapproved .results')
  var $allProviders = $providers.add($unapproved)
  var $providerNameQuery = $page.find('#provider-name-query')
  var $search = $page.find('.search')
  var $onlyK18 = $page.find('.k18-label input')
  var $yearlyBilling = $page.find('.yearly-billing')
  var $billing = $page.find('.billing')
  var $datePicker = $billing.find('.datepicker')
  var $billingContainer = $billing.find('.billing-container')
  var format = 'DD.MM.YYYY'

  var $spinner = spinner().appendTo($page.find('.date-selection'))
  var latestAjax = switchLatestDeferred()

  var datePickerOpts = {
    shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']}
  }
  setupDatePicker($datePicker, datePickerOpts, fetchNewProviders)

  $page.on('show', function(event, providerId) {
    updateLocationHash(providerId || '')
    $.get('/providers', function(providers) {
      renderProviders(providers)
      updateStatistics()

      // Apply provider search
      $providerNameQuery.trigger('input')

      if (providerId) {
        var $selected = $providers.add($unapproved).find('.result[data-id=' + providerId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })

    $.get('/providers/unapproved', function(providers) {
      $unapproved.empty()
      _(providers).sortBy('name')
        .map(renderProvider)
        .forEach(function(p) {
          $unapproved.append(p)
        })
    })

    var range = {
      begin: moment().subtract(1, 'days').startOf('month'),
      end: moment().subtract(1, 'days')
    }
    setDatePickerSelection($datePicker, range, fetchNewProviders)
    updateMetadata()
    $page.find('form input[name=_csrf]').val($.cookie('_csrf_token'))
  })

  $page.on('click', 'button[name=new-provider]', function() {
    var $providerDetails = renderProviderDetails()
    $providerDetails.find('.modify-only').remove()
    var $selected = $providers.find('.selected')
    bindEventHandlers($selected, $providerDetails, function(provider) {
      $.post('/providers', JSON.stringify(_.merge(provider, { deleted: false })), function(newProvider) {
        var $providerRow = renderProvider(newProvider)
        $unapproved.prepend($providerRow)
        $providerRow.slideDown()
        closeDetails()
      })
    })
    closeDetails()
    $unapproved.prepend($providerDetails)
    $providerDetails.slideDown()
  })

  $providerNameQuery.on('input', function() {
    var searchString = $(this).val().toLowerCase()
    var onlyK18 = $onlyK18.is(':checked')
    $providers.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      var providerLocations = $(this).data('provider').locations
      name += _.map(providerLocations, function(l) { return l.name.toLowerCase() }).join(' ')
      var matchesName = _.contains(name, searchString)
      var matchesK18 = onlyK18 ? _.any(providerLocations, 'adultContent'): true
      $(this).parent('.provider-row').toggle(matchesName && matchesK18)
    })
    $search.find('.result-count .num').text($providers.find('.result:visible').length)
    closeDetails()
  })

  $onlyK18.on('change', function() {
    $providerNameQuery.trigger('input')
  })

  $allProviders.on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  $billing.on('click', '> h3', function() {
    $(this).toggleClass('selected').next().slideToggle()
  })
  $yearlyBilling.on('click', '> h3', function() {
    $(this).toggleClass('selected').next().slideToggle()
  })
  $page.find('.statistics').on('click', '> h3', function() {
    $(this).toggleClass('selected').next().slideToggle()
  })

  $yearlyBilling.on('click', 'button.yearly-billing-reminder', function() {
    var $button = $(this)
    $button.prop('disabled', true)
    $.get('/providers/yearlyBilling/info', function(info) {
      showDialog($('#templates').find('.yearly-billing-reminder-dialog').clone()
        .find('.provider-count').text(info.providerCount).end()
        .find('.location-count').text(info.locationCount).end()
        .find('.providers-without-mail').html(renderProvidersWithoutMail(info.providersWithoutMail)).end()
        .find('.locations-without-mail').html(renderLocationsWithoutMail(info.locationsWithoutMail)).end()
        .find('.send').click(sendYearlyBillingReminderMail).end()
        .find('.cancel').click(closeDialog).end())
      $button.prop('disabled', false)

      function renderProvidersWithoutMail(providers) {
        return _.map(providers, function(p) {
          return $('<div>').text(p.name)
        })
      }

      function renderLocationsWithoutMail(locations) {
        return _.map(locations, function(l) {
          return $('<div>').text(l.provider.name + ': ' + l.name)
        })
      }

      function sendYearlyBillingReminderMail() {
        closeDialog()
        $.post('/providers/yearlyBilling/sendReminders', updateMetadata)
      }
    })
  })

  $yearlyBilling.on('click', 'button.yearly-billing-kieku', function() {
    $yearlyBilling.find('.most-recent .created').text(utils.asDateTime(moment()))
    setTimeout(function() { updateMetadata() }, 10000)
  })

  function findSelected() {
    return $allProviders.find('.result.selected')
  }

  function fetchNewProviders(range) {
    var $list = $billing.find('.new-providers-list').empty()

    latestAjax($.get('/providers/billing/'+ range.begin + '/' + range.end), $spinner).done(function(providers) {
      $page.find('.billing-container input[name=begin]').val(range.begin)
      $page.find('.billing-container input[name=end]').val(range.end)
      var $template = $('#templates').find('.invoice-provider').clone()

      $billingContainer.toggle(providers.length > 0)
      $billing.find('.no-results').toggle(providers.length == 0)

      _.forEach(providers, function(provider) {
        var $provider = $template.find('.invoice-provider-row').clone()

        $provider.find('.name').text(provider.name)
        $provider.find('.registrationDate').text(moment(provider.registrationDate).format(format))

        $list.append($provider)
        _.forEach(provider.locations, function(location) {
          var $location = $template.find('.invoice-location-row').clone()

          $location.find('.name').text(location.name)
          $location.find('.registrationDate').text(moment(location.registrationDate).format(format))

          $list.append($location)
          _.forEach(location.providingType, function(providingType) {
            var $providingType = $template.find('.invoice-providing-type-row').clone()

            $providingType.find('.name').text(' - ' + enums.providingType[providingType])
            $providingType.find('.price').text(enums.providingTypePrices[providingType] + '€')

            $list.append($providingType)
          })
        })
        $list.append($('<tr>').append($('<td>', { class: 'empty-row' })))
      })
    })
  }

  $billing.on('click', 'button[name="create-kieku"]', function() {
    var begin = $billingContainer.find('input[name=begin]').val()
    var end = $billingContainer.find('input[name=end]').val()
    $billingContainer.find('.most-recent .created').text(utils.asDateTime(new Date()))
    $billingContainer.find('.most-recent .dates').text(formatDate(begin) + ' - ' + formatDate(end))
    setTimeout(function() { updateMetadata() }, 10000)
    function formatDate(s) { return moment(s, format).format(utils.dateFormat) }
  })

  function openDetails($row) {
    $.get('/providers/' + $row.data('id'), function(provider) {
      $row.data('provider', provider)
      var $providerDetails = renderProviderDetails(provider)

      if (hasRole('root')) $providerDetails.append(changeLog(provider).render())

      bindEventHandlers($row, $providerDetails, function(providerData) {
        $.ajax('/providers/' + provider._id, { type: 'PUT', data: JSON.stringify(providerData) })
          .done(function(provider) {
            var $parent = $row.parent()
            var $newRow = renderProvider(provider)
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
    var $form = $providerDetails.find('form')
    var provider = $selected.data('provider')

    $providerDetails.find('input[name=provider-active]').iiToggle({ onLabel: 'Rekisterissä', offLabel: 'Ei rekisterissä', callback: toggleActiveButton })

    $form.submit(function(event) {
      event.preventDefault()

      var specialFields = {
        emailAddresses: _.pluck($form.find('input[name=emailAddresses]').select2('data'), 'text'),
        billingPreference: $form.find('input[name=billing-extra]').prop('checked')
          ? $form.find('input[name=billing-extra-type]:checked').val() : ''
      }

      submitCallback(_.merge(createDataObjectFromForm($form), specialFields))
    })

    setCommonValidators($form)

    $providerDetails.find('button[name=remove]').click(function() {
      var $selected = $page.find('.result.selected')
      var provider = $selected.data('provider')
      showDialog($('#templates').find('.remove-provider-dialog').clone()
        .find('.provider-name').text(provider.name).end()
        .find('button[name=remove]').click(removeProvider).end()
        .find('button[name=cancel]').click(closeDialog).end())

      function removeProvider() {
        $.ajax('/providers/' + provider._id, { type: 'DELETE' }).done(function() {
          closeDialog()
          closeDetails()
          $selected.parent('.provider-row').slideUp(function() {
            $(this).remove()
            updateStatistics()
          })
        })
      }
    })
  }

  function toggleActiveButton(newState) {
    var $selected = $allProviders.find('.selected')
    var provider = $selected.data('provider')
    $.ajax('/providers/' + provider._id + '/active', { type: 'PUT' }).done(function(activation) {
      provider.active = activation.active
      if (activation.wasFirstActivation) {
        var $dialog = $("#templates").find('.provider-registration-success-dialog').clone()
        $dialog.find('.name').text(provider.name)
        $dialog.find('.email-sent').toggle(activation.emailSent)
        $dialog.find('.no-email-sent').toggle(!activation.emailSent)
        $dialog.find('.without-email').toggle(activation.locationsWithoutEmail.length > 0)
          .find('ul').html(activation.locationsWithoutEmail.map(function(l) {
            return $('<li>').text(l.name)
          }))
        $dialog.find('.with-email').toggle(activation.locationsWithEmail.length > 0)
          .find('ul').html(activation.locationsWithEmail.map(function(l) {
            return $('<li>').text(l.name)
          }))
        $dialog.find('.ok').on('click', function() {
          $page.trigger('show', provider._id)
          closeDialog($selected)
        })
        showDialog($dialog)
      } else {
        $selected.toggleClass('inactive', !activation.active)
        updateStatistics()
      }
    })
  }

  function isUnapproved(provider) { return !provider.registrationDate }

  function closeDetails() {
    $allProviders.find('.result.selected').removeClass('selected')
    $allProviders.find('.provider-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(providerId) {
    setLocation('#tarjoajat/' + providerId)
  }

  function updateMetadata() {
    $.get('/providers/metadata', function(metadata) {
      $yearlyBilling.find('.most-recent .sent').text(metadata.yearlyBillingReminderSent ? utils.asDateTime(metadata.yearlyBillingReminderSent) : undefined)
      $yearlyBilling.find('.most-recent .created').text(metadata.yearlyBillingCreated ? utils.asDateTime(metadata.yearlyBillingCreated) : undefined)
      if (metadata.previousMidYearBilling) {
        $billingContainer.find('.most-recent .created').text(utils.asDateTime(metadata.previousMidYearBilling.created))
        $billingContainer.find('.most-recent .dates').text(utils.asDate(metadata.previousMidYearBilling.begin) + ' - ' + utils.asDate(metadata.previousMidYearBilling.end))
      }
    })
  }

  function updateStatistics() {
    var providers = $providers.find('.provider-row > .result').map(function() { return $(this).data('provider') }).toArray()
    var registeredProviders = _.filter(providers, function(p) { return !!p.active })
    var registeredLocationCount = _.reduce(registeredProviders, function(acc, p) { return acc + _.filter(p.locations, function(l) { return !!l.active }).length }, 0)
    var $rows = [$row('Rekisterissä', registeredProviders.length, registeredLocationCount).addClass('first')]

    Object.keys(enums.providingType).forEach(function(type) {
      var matchingLocationCounts = _(registeredProviders).map(countLocationsWithProvidingType(type)).compact().value()
      $rows.push($row(enums.providingType[type], matchingLocationCounts.length, matchingLocationCounts.reduce(sum)))
    })

    var k18Counts = _(registeredProviders).map(countAdultContentLocations).compact().value()
    $rows.push($row('Tarjolla luokittelemattomia K-18 ohjelmia', k18Counts.length, k18Counts.reduce(sum)).addClass('last'))

    $page.find('.statistics-rows').html($rows)

    function countAdultContentLocations(provider) {
      return _.filter(provider.locations, function(l) { return !!l.active && !!l.adultContent }).length
    }
    function countLocationsWithProvidingType(type) {
      return function(provider) {
        return _.filter(provider.locations, function(l) { return !!l.active && _.contains(l.providingType, type) }).length
      }
    }
    function $row(a,b,c) {
      return $('<tr>')
        .append($('<td>').text(a))
        .append($('<td>').text(b))
        .append($('<td>').text(c))
    }
    function sum(a, b) { return a + b }
  }

  function renderProviders(providers) {
    $providers.empty()
    _(providers).sortBy('name').map(renderProvider).forEach(function(acc) { $providers.append(acc) })
  }

  function renderProvider(provider) {
    if (isUnapproved(provider)) {
      return renderUnapproved(provider)
    } else {
      return renderApproved(provider)
    }
  }

  function renderApproved(provider) {
    var $providerRow = $('#templates').find('.provider-row').clone()
    return $providerRow.find('div:first-child').attr('data-id', provider._id).addClass('result')
      .toggleClass('inactive', !provider.active)
      .data('provider', provider)
      .find('.name').text(provider.name).end()
      .find('.address').text(provider.address.street + ', ' + provider.address.city).end()
      .find('.date').text(utils.asDate(provider.registrationDate)).end().end()
      .find('.locations').replaceWith(renderProviderLocations($providerRow, provider)).end()
  }

  function renderUnapproved(provider) {
    var $providerRow = $('#templates').find('.provider-row').clone()
    return $providerRow.find('div:first-child').attr('data-id', provider._id).addClass('result unapproved')
      .data('provider', provider)
      .find('.name').text(provider.name).end()
      .find('.date').text(utils.asDate(provider.registrationDate)).end().end()
      .find('.locations').replaceWith(renderProviderLocations($providerRow, provider)).end()
  }

  function renderProviderDetails(provider) {
    var $providerDetails = $('#templates').find('.provider-details').clone()
    $providerDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, provider))
    $providerDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    $providerDetails
      .find('input[name="address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=emailAddresses]').select2({ tags: [], multiple: true, tokenSeparators: [' '] }).end()
      .find('input[name=billing-extra]').prop('checked', provider && !!provider.billingPreference).end()
      .find('input[name=billing-extra-type][value=' + (provider && provider.billingPreference || 'address') + ']').prop('checked', true).end()
      .find('input[name="language"]').select2({ data: select2DataFromEnumObject(enums.billingLanguages) }).end()
      .find('input[name=provider-active][value=' + (provider && provider.active ? 'active' : 'inactive') + ']').prop('checked', true).end()
      .find('.locations-total').text(provider ? provider.locations.length : 0).end()


    toggleBillingExtra($providerDetails)

    return $providerDetails

    function toggleBillingExtra() {
      var extraBillingEnabled = $providerDetails.find('input[name=billing-extra]').prop('checked')
      $providerDetails.find('.billing-extra-fields input').prop('disabled', !extraBillingEnabled)

      if (extraBillingEnabled) {
        var type = $providerDetails.find('input[name=billing-extra-type]:checked').val()
        var $addressInputs = $providerDetails.find('.billing-extra-fields .billing-address input')
        var $eInvoiceInputs = $providerDetails.find('.billing-extra-fields .eInvoice input')

        $addressInputs.prop('disabled', type === 'eInvoice')
        $eInvoiceInputs.prop('disabled', type === 'address')
      }
    }
  }

  function setInputValWithProperty(object) {
    var name = $(this).attr('name')
    var property = utils.getProperty(object, name)

    if ($(this).attr('type') === 'checkbox') {
      $(this).prop('checked', property || false)
    } else {
      if (property !== undefined) $(this).val(property)
    }
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
      var enabled = $form.find('.touched').length > 0 && this.checkValidity()
      $(this).find('button[type=submit]').prop('disabled', !enabled)
    })

    $form.find('input[name=emailAddresses]').on('change', function (event) {
      var emails = event.val
      if (_.all(emails, validateEmail)) {
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
    var object = {}

    $form.find('textarea[name], input[name]').each(function(index, elem) {
      utils.setValueForPath(elem.name.split('.'), object, elem.type === 'checkbox' ? elem.checked : elem.value)
    })

    return object
  }

  function renderProviderLocations($providerDetails, provider) {
    var $locations = $('<div>', { class: 'locations' })

    if (provider && provider.locations) {
      provider.locations.forEach(function(location) {
        $locations.append(renderLocation(location))
      })
    }

    $providerDetails.on('click', 'button[name=new-location]',  function() {
      closeLocationDetails()

      var $locationDetails = renderLocationDetails()
      $locationDetails.find('.modify-only').remove()

      bindEventHandlers(provider, $locationDetails, function(locationData) {
        $.post('/providers/' + provider._id + '/locations', JSON.stringify(locationData), function(l) {
          provider.locations.push(l)
          $providers.find('[data-id='+provider._id+']').data('provider', provider)
          $locations.find('.location-details').slideUp(function() {
            $locations.prepend(renderLocation(l))
            $providerDetails.find('.locations-total').text(provider.locations.length)
            updateStatistics()
          })
        })
      })

      $locations.prepend($locationDetails)
      $locationDetails.slideDown()
    })

    $locations.on('click', '.location-row', function() {
      var $this = $(this)
      var wasSelected = $this.hasClass('selected')

      closeLocationDetails()
      if (!wasSelected) {
        var location = $this.data('location')
        var provider = $this.parents('.provider-row').find('.result').data('provider')
        var $locationDetails = renderLocationDetails(location)

        if (hasRole('root')) $locationDetails.append(changeLog(location).render())

        $locationDetails.find('.new-only').remove()

        bindEventHandlers(provider, $locationDetails, function(locationData) {
          $.ajax('/providers/' + provider._id + '/locations/' + location._id, { type: 'PUT', data: JSON.stringify(locationData) })
            .done(function(p) {
              $providers.find('[data-id='+provider._id+']').data('provider', p)

              $locationDetails.find('.touched').removeClass('touched')
              $locationDetails.find('form').trigger('validate')
              $locationDetails.find('.buttons .save-success').fadeIn(500).delay(5000).fadeOut()

              var $selected = $locations.find('.location-row.selected')
              $selected.replaceWith(renderLocation(_.find(p.locations, { _id: location._id })).addClass('selected'))
              updateStatistics()
            })
        })

        $this.addClass('selected').after($locationDetails)
        $locationDetails.slideDown()
      }
    })

    $locations.on('click', 'button[name=remove]', function() {
      var $selected = $locations.find('.selected')
      var location = $selected.data('location')
      var provider = $selected.parents('.provider-row').find('.result').data('provider')
      showDialog($('#templates').find('.remove-location-dialog').clone()
        .find('.location-name').text(location.name).end()
        .find('button[name=remove]').click(removeLocation).end()
        .find('button[name=cancel]').click(closeDialog).end())

      function removeLocation() {
        $.ajax('/providers/' + provider._id + '/locations/' + location._id, { type: 'delete' }).done(function(p) {
          closeDialog()
          closeLocationDetails()
          $providers.find('[data-id='+provider._id+']').data('provider', p)
          $selected.slideUp(function() {
            $(this).remove()
            $providerDetails.find('.locations-total').text(provider.locations.length - 1)
            updateStatistics()
          })
        })
      }
    })

    return $locations

    function closeLocationDetails() {
      $locations.find('.selected').removeClass('selected')
      $locations.find('.location-details').slideUp(function() { $(this).remove() })
    }

    function renderLocationDetails(location) {
      var $locationDetails = $('#templates').find('.location-details').clone()
      $locationDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, location))
      $locationDetails.find('input[name=emailAddresses]').select2({ tags: [], multiple: true, tokenSeparators: [' '] }).end()
        .find('input[name=providingType]').select2({ data: select2DataFromEnumObject(enums.providingType), multiple: true}).end()
        .find('input[name=location-active][value=' + (location && location.active ? 'active' : 'inactive') + ']').prop('checked', true).end()

      $locationDetails.find('input[name=location-active]').iiToggle({ onLabel: 'Rekisterissä', offLabel: 'Ei rekisterissä', callback: toggleActiveButton })

      return $locationDetails
    }

    function toggleActiveButton(newState) {
      var $selected = $locations.find('.location-row.selected')
      var location = $selected.data('location')
      var provider = $selected.parents('.provider-row').find('.result').data('provider')
      var data = JSON.stringify({ active: newState === 'on' })
      $.ajax('/providers/' + provider._id + '/locations/' + location._id + '/active', { type: 'PUT' }).done(function(activation) {
        location.active = activation.active
        location.registrationDate = activation.registrationDate
        $selected.data('location', location)
        if (activation.wasFirstActivation) {
          var $dialog = $("#templates").find('.location-registration-success-dialog').clone()
          $dialog.find('.name').text(location.name)
          $dialog.find('.email').toggle(activation.emailSent)
          $dialog.find('.no-email').toggle(!activation.emailSent)
          $dialog.find('.ok').on('click', function() {
            closeDialog()
            $selected.replaceWith(renderLocation(location).addClass('selected'))
            updateStatistics()
          })
          showDialog($dialog)
        } else {
          $selected.toggleClass('inactive', !activation.active)
          updateStatistics()
        }
      })
    }

    function renderLocation(location) {
      return $('<div>', { 'data-id': location._id, class: 'location-row' })
        .data('location', location).toggleClass('inactive', !location.active)
        .append($('<i>', { class: 'rotating fa fa-play' }))
        .append($('<span>').text(location.name))
        .append($('<span>').text(
          utils.getProperty(location, 'address.street')? (location.address.street + ', ' + location.address.city) : ''))
        .append($('<span>').text(location.isPayer ? 'Laskutetaan' : ''))
        .append($('<span>').text(utils.asDate(location.registrationDate)))
    }

    function bindEventHandlers(provider, $locationDetails, submitCallback) {
      var $form = $locationDetails.find('form')

      $form.submit(function (event) {
        event.preventDefault()

        var specialFields = {
          emailAddresses: _.pluck($form.find('input[name=emailAddresses]').select2('data'), 'text'),
          providingType: _.pluck($form.find('input[name=providingType]').select2('data'), 'id')
        }

        submitCallback(_.merge(createDataObjectFromForm($form), specialFields))
      })

      setCommonValidators($form)
    }
  }
}

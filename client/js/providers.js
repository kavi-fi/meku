function providerPage() {
  var $page = $('#provider-page')
  var $providers = $page.find('.providers-list')
  var $providerNameQuery = $page.find('#provider-name-query')
  var $unapproved = $page.find('.unapproved .results')

  $page.on('show', function(event, providerId) {
    updateLocationHash(providerId || '')
    $.get('/providers', function(providers) {
      renderProviders(providers)

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
      $page.find('.unapproved').toggle(providers.length > 0)
      _(providers).sortBy('name')
        .map(renderUnapproved)
        .forEach(function(p) {
          $unapproved.append(p)
        })
    })
  })

  $page.on('click', 'button[name=new-provider]', function() {
    var $providerDetails = renderProviderDetails()
    $providerDetails.find('.modify-only').remove()
    var $selected = $providers.find('.selected')
    bindEventHandlers($selected, $providerDetails, function(provider) {
      $.post('/providers', JSON.stringify(_.merge(provider, { deleted: false })), function(newProvider) {
        var $providerRow = renderProvider(newProvider)
        $providers.prepend($providerRow)
        $providerRow.slideDown()
        closeDetails($providers.find('.provider-details'))
      })
    })
    closeDetails($selected)
    $providers.prepend($providerDetails)
    $providerDetails.slideDown()
  })

  $providerNameQuery.on('input', function() {
    var searchString = $(this).val().toLowerCase()
    $providers.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.contains(name, searchString))
    })
    closeDetails($providers.find('.provider-details'))
  })

  $providers.add($unapproved).on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails($this)
    if (!wasSelected) {
      openDetails($this)
    }
  })

  function openDetails($row) {
    $.get('/providers/' + $row.data('id'), function(provider) {
      var $providerDetails = renderProviderDetails(provider)

      if (hasRole('root')) $providerDetails.append(changeLog(provider).render())

      bindEventHandlers($row, $providerDetails, function(providerData) {
        $.ajax('/providers/' + provider._id, { type: 'PUT', data: JSON.stringify(providerData) })
          .done(function(provider) {
            var $parent = $row.parent()
            $row.replaceWith(renderProvider(provider))
            closeDetails($parent.find('.provider-details'))
        })
      })

      $row.addClass('selected').after($providerDetails)
      updateLocationHash(provider._id)
      $providerDetails.slideDown()
    })
  }

  function bindEventHandlers($selected, $providerDetails, submitCallback) {
    var $form = $providerDetails.find('form')
    var toggle = _.curry(toggleActiveButton)($selected)

    $providerDetails.find('input[name=provider-active]').iiToggle({ onLabel: 'Aktiivinen', offLabel: 'Inaktiivinen', callback: toggle })

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
          closeDetails($providers.find('.selected'))
          $selected.slideUp(function() { $(this).remove() })
        })
      }
    })
  }

  function toggleActiveButton($selected, newState) {
    var provider = $selected.data('provider')
    $.ajax('/providers/' + provider._id + '/active', { type: 'PUT' }).done(function(updatedProvider) {
      $selected.replaceWith(renderProvider(updatedProvider).addClass('selected'))
    })
  }

  function closeDetails($selected) {
    $selected.removeClass('selected')
    $selected.parent().find('.provider-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(providerId) {
    setLocation('#tarjoajat/' + providerId)
  }

  function renderProviders(providers) {
    $providers.empty()
    _(providers).sortBy('name').map(renderProvider).forEach(function(acc) { $providers.append(acc) })
  }

  function renderProvider(provider) {
    return $('<div>', { class: 'result', 'data-id': provider._id })
      .data('provider', provider)
      .toggleClass('inactive', !provider.active)
      .append($('<span>', { class: 'name' }).text(provider.name))
  }

  function renderUnapproved(provider) {
    return $('<div>', { class: 'result', 'data-id': provider._id })
      .data('provider', provider)
      .append($('<span>', { class: 'date' }).text(utils.asDate(provider.creationDate)))
      .append($('<span>', { class: 'name' }).text(provider.name))
  }

  function renderProviderDetails(provider) {
    var $providerDetails = $('#templates').find('.provider-details').clone()
    $providerDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, provider))
    $providerDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    $providerDetails
      .find('input[name="address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=emailAddresses]').select2({ tags: [], multiple: true }).end()
      .find('input[name="billing.address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=billing-extra]').prop('checked', provider && !!provider.billingPreference).end()
      .find('input[name=billing-extra-type][value=' + (provider && provider.billingPreference || 'address') + ']').prop('checked', true).end()
      .find('input[name="billing.language"]').select2({ data: select2DataFromEnumObject(enums.billingLanguages) }).end()
      .find('input[name=provider-active][value=' + (provider && provider.active ? 'active' : 'inactive') + ']').prop('checked', true).end()
      .find('.locations').replaceWith(renderProviderLocations($providerDetails, provider))


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
      if (!_.isEmpty(emails) && _.all(emails, validateEmail)) {
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

    $providerDetails.find('button[name=new-location]').on('click', function() {
      closeLocationDetails()

      var $locationDetails = renderLocationDetails()
      $locationDetails.find('.modify-only').remove()

      bindEventHandlers(provider, $locationDetails, function(locationData) {
        $.post('/providerlocations/', JSON.stringify(locationData), function(location) {
          $locations.find('.location-details').slideUp(function() {
            $locations.prepend(renderLocation(location))
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
        var $locationDetails = renderLocationDetails(location)

        if (hasRole('root')) $locationDetails.append(changeLog(location).render())

        $locationDetails.find('.new-only').remove()

        bindEventHandlers(provider, $locationDetails, function(locationData) {
          $.ajax('/providerlocations/' + location._id, { type: 'PUT', data: JSON.stringify(locationData) })
            .done(function(location) {
              var $selected = $locations.find('.location-row.selected').removeClass('selected')
              $locations.find('.location-details').slideUp(function() {
                $(this).remove()
                $selected.replaceWith(renderLocation(location))
              })
            })
        })

        $this.addClass('selected').after($locationDetails)
        $locationDetails.slideDown()
      }
    })

    $locations.on('click', 'button[name=remove]', function() {
      var $selected = $locations.find('.selected')
      var location = $selected.data('location')
      showDialog($('#templates').find('.remove-location-dialog').clone()
        .find('.location-name').text(location.name).end()
        .find('button[name=remove]').click(removeLocation).end()
        .find('button[name=cancel]').click(closeDialog).end())

      function removeLocation() {
        $.ajax('/providerlocations/' + location._id, { type: 'DELETE' }).done(function() {
          closeDialog()
          closeLocationDetails()
          $selected.slideUp(function() { $(this).remove() })
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
      $locationDetails.find('input[name=emailAddresses]').select2({ tags: [], multiple: true }).end()
        .find('input[name=providingType]').select2({ data: select2DataFromEnumObject(enums.providingType), multiple: true}).end()
        .find('input[name=location-active][value=' + (location && location.active ? 'active' : 'inactive') + ']').prop('checked', true).end()

      $locationDetails.find('input[name=location-active]').iiToggle({ onLabel: 'Aktiivinen', offLabel: 'Inaktiivinen', callback: toggleActiveButton })

      return $locationDetails
    }

    function toggleActiveButton(newState) {
      var $selected = $locations.find('.location-row.selected')
      var location = $selected.data('location')
      var data = JSON.stringify({ active: newState === 'on' })
      $.ajax('/providerlocations/' + location._id, { type: 'PUT', data: data}).done(function(updatedLocation) {
        $selected.replaceWith(renderLocation(updatedLocation).addClass('selected'))
      })
    }

    function renderLocation(location) {
      var $location = $('<div>', { 'data-id': location._id, class: 'location-row' })
        .data('location', location).toggleClass('inactive', !location.active)
        .append($('<i>', { class: 'rotating fa fa-play' }))
        .append($('<span>').text(location.name))

      if (location.isPayer) {
        $location.append($('<span>', { class: 'right' }).text('Tarjoamispaikka maksaa laskun'))
      }

      return $location
    }

    function bindEventHandlers(provider, $locationDetails, submitCallback) {
      var $form = $locationDetails.find('form')

      $form.submit(function (event) {
        event.preventDefault()

        var specialFields = {
          emailAddresses: _.pluck($form.find('input[name=emailAddresses]').select2('data'), 'text'),
          providingType: _.pluck($form.find('input[name=providingType]').select2('data'), 'id'),
          provider: provider._id
        }

        submitCallback(_.merge(createDataObjectFromForm($form), specialFields))
      })

      setCommonValidators($form)

      $form.find('input[name=isPayer]').on('change', function() {
        $form.find('.required-if-payer').prop('required', this.checked)
      })
    }
  }
}
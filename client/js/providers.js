function providerPage() {
  var $page = $('#provider-page')
  var $providers = $page.find('.providers-list')
  var $providerNameQuery = $page.find('#provider-name-query')

  $page.on('show', function(event, providerId) {
    updateLocationHash(providerId || '')
    $.get('/providers', function(providers) {
      renderProviders(providers)

      // Apply provider search
      $providerNameQuery.trigger('input')

      if (providerId) {
        var $selected = $providers.find('.result[data-id=' + providerId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })
  })

  $page.on('click', 'button[name=new-provider]', function() {
    var $providerDetails = renderProviderDetails()
    bindEventHandlers($providerDetails, function(provider) {
      $.post('/providers', JSON.stringify(_.merge(provider, { deleted: false })), function(newProvider) {
        var $providerRow = renderProvider(newProvider)
        $providers.prepend($providerRow)
        $providerRow.slideDown()
        closeDetails()
      })
    })
    closeDetails()
    $providers.prepend($providerDetails)
    $providerDetails.slideDown()
  })

  $providerNameQuery.on('input', function() {
    var searchString = $(this).val().toLowerCase()
    $providers.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.contains(name, searchString))
    })
    closeDetails()
  })

  $providers.on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  function openDetails($row) {
    $.get('/providers/' + $row.data('id'), function(provider) {
      var $providerDetails = renderProviderDetails(provider)

      if (hasRole('root')) $providerDetails.append(changeLog(provider).render())

      bindEventHandlers($providerDetails, function(providerData) {
        $.ajax('/providers/' + provider._id, { type: 'PUT', data: JSON.stringify(providerData) })
          .done(function(provider) {
            $providers.find('.result.selected').replaceWith(renderProvider(provider))
            closeDetails()
        })
      })

      $row.addClass('selected').after($providerDetails)
      updateLocationHash(provider._id)
      $providerDetails.slideDown()
    })
  }

  function bindEventHandlers($providerDetails, submitCallback) {
    var $form = $providerDetails.find('form')

    $form.submit(function(event) {
      event.preventDefault()

      var specialFields = {
        emailAddresses: _.pluck($form.find('input[name=emailAddresses').select2('data'), 'text'),
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
          $selected.slideUp(function() { $(this).remove() })
        })
      }
    })
  }

  function closeDetails() {
    $providers.find('.result.selected').removeClass('selected')
    $providers.find('.provider-details').slideUp(function() { $(this).remove() })
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

    var $locations = $providerDetails.find('.locations')

    if (provider.locations) {
      provider.locations.forEach(function(location) {
        $locations.append(renderLocation(location))
      })
    }

    $locations.on('click', '.location-row', function() {
      var $this = $(this)
      var wasSelected = $this.hasClass('selected')

      $locations.find('.selected').removeClass('selected')
      $locations.find('.location-details').slideUp(function() { $(this).remove() })

      if (!wasSelected) {
        var $locationDetails = renderLocationDetails($this.data('location'))

        $this.addClass('selected').after($locationDetails)
        $locationDetails.slideDown()
      }
    })

    toggleBillingExtra($providerDetails)

    return $providerDetails

    function setInputValWithProperty(object) {
      var name = $(this).attr('name')
      var property = utils.getProperty(object, name)

      if ($(this).attr('type') === 'checkbox') {
        $(this).prop('checked', property || false)
      } else {
        if (property !== undefined) $(this).val(property)
      }
    }

    function userToSelect2Option(user) {
      if (!user) return null
      return {
        id: user._id,
        text: user.name + (user.username ? ' (' + user.username + ')' : ''),
        name: user.username ? user.username : user.name
      }
    }

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

    function renderLocationDetails(location) {
      var $locationDetails = $('#templates').find('.location-details').clone()
      $locationDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, location))
      $locationDetails.find('input[name=emailAddresses]').select2({ tags: [], multiple: true }).end()
        .find('input[name=providingType]').select2({ data: select2DataFromEnumObject(enums.providingType), multiple: true}).end()

      bindEventHandlers($locationDetails, function(locationData) {
        $.ajax('/providerlocations/' + location._id, { type: 'PUT', data: JSON.stringify(locationData) })
          .done(function(location) {
            $locations.find('.selected').replaceWith(renderLocation(location)).removeClass('selected')
            $locations.find('.location-details').slideUp(function() { $(this).remove() })
          })
      })

      return $locationDetails
    }

    function renderLocation(location) {
      return $('<div>', { 'data-id': location._id, class: 'location-row' }).text(location.name).data('location', location)
    }

    function bindEventHandlers($locationDetails, submitCallback) {
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

      $form.find('input[name=isPayer]').on('change', function() {
        $form.find('.required-if-payer').prop('required', this.checked)
      })
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
}

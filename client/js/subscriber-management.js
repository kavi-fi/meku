function subscriberManagementPage() {
  var $page = $('#subscriber-management-page')
  var $subscribers = $page.find('.subscribers-list')
  var $subscriberNameQuery = $page.find('#subscriber-name-query')

  $page.on('show', function(event, subscriberId) {
    updateLocationHash(subscriberId || '')
    $.get('/subscribers?' + $.param({ roles: currentFilters() }), function(subscribers) {
      renderSubscribers(subscribers)

      // Apply subscriber search
      $subscriberNameQuery.trigger('input')

      if (subscriberId) {
        var $selected = $subscribers.find('.result[data-id=' + subscriberId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })
  })

  $subscriberNameQuery.on('input', function() {
    var searchString = $(this).val().toLowerCase()
    $subscribers.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.includes(name, searchString))
    })
    closeDetails()
  })

  $page.find('.filters').change(function() { $page.trigger('show') })

  $subscribers.on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  $page.find('button[name=new-subscriber]').on('click', function() {
    var $newSubscriberForm = renderSubscriberDetails()
    $newSubscriberForm.find('.modify-only').remove()
    bindEventHandlers($newSubscriberForm, function(subscriberData) {
      $.post('/accounts/', JSON.stringify(subscriberData), function(subscriber) {
        $subscribers.find('.result.selected').data('subscriber', subscriber)
        var $subscriber = renderSubscriber(subscriber).css('display', 'none')
        $subscribers.prepend($subscriber)
        $subscriber.slideToggle()
        closeDetails()
      })
    })

    // This triggers validation for roles checkboxes, which are by default invalid
    $newSubscriberForm.find('input[name=roles]').trigger('change')

    closeDetails()
    $subscribers.addClass('selected').prepend($newSubscriberForm)
    $newSubscriberForm.slideDown()
  })

  function openDetails($row) {
    var subscriber = $row.data('subscriber')
    var $subscriberDetails = renderSubscriberDetails(subscriber)

    $subscriberDetails.find('.new-only').remove()
    $subscriberDetails.find('button[name=remove]').toggle(utils.hasRole(user, 'root'))

    if (hasRole('root')) $subscriberDetails.append(changeLog(subscriber).render())

    bindEventHandlers($subscriberDetails, function(subscriberData) {
      $.ajax('/accounts/' + subscriber._id, { type: 'PUT', data: JSON.stringify(subscriberData) })
        .done(function(subscriber) {
          $subscribers.find('.result.selected').replaceWith(renderSubscriber(subscriber))
          closeDetails()
      })
    })

    $row.addClass('selected').after($subscriberDetails)
    updateLocationHash(subscriber._id)
    $subscriberDetails.slideDown()
  }

  function bindEventHandlers($subscriberDetails, submitCallback) {
    var $form = $subscriberDetails.find('form')

    $form.submit(function(event) {
      event.preventDefault()
      $form.find('button[name=save]').prop('disabled', true)
      var subscriberData = {
        roles: findInput('roles').filter(':checked').map(function() {
          return $(this).val()
        }).toArray(),
        customerNumber: findInput('customerNumber').val(),
        name: findInput('name').val(),
        emailAddresses: _.map(findInput('emailAddresses').select2('data'), 'text'),
        yTunnus: findInput('yTunnus').val(),
        ssn: findInput('ssn').val(),
        address: {
          street: findInput('address.street').val(),
          city: findInput('address.city').val(),
          zip: findInput('address.zip').val(),
          country: findInput('address.country').val()
        },
        billing: {
          customerNumber: findInput('billing.customerNumber').val(),
          invoiceText: $form.find('textarea[name="billing.invoiceText"]').val(),
          language: findInput('billing.language').val(),
          address: {
            street: findInput('billing.address.street').val(),
            city: findInput('billing.address.city').val(),
            zip: findInput('billing.address.zip').val(),
            country: findInput('billing.address.country').val()
          }
        },
        eInvoice: {
          address: findInput('eInvoice.address').val(),
          operator: findInput('eInvoice.operator').val()
        },
        message: $form.find('textarea[name="message"]').val(),
        contactName: findInput('contactName').val(),
        phoneNumber: findInput('phoneNumber').val(),
        users: findInput('classifiers').select2('data').map(select2OptionToUser),
        billingPreference: $form.find('input[name=billing-extra]').prop('checked')
          ? $form.find('input[name=billing-extra-type]:checked').val() : ''
      }
      if (hasRole('root')) {
        subscriberData.apiToken = findInput('apiToken').val()
      }
      submitCallback(subscriberData)

      function findInput(name) {
        return $subscriberDetails.find('input[name="' + name + '"]')
      }
    })

    $form.find('input, textarea').on('input change', function() { $(this).addClass('touched') })

    $form.find('input.select2-offscreen').on('change validate', function() {
      $(this).toggleClass('invalid', !this.checkValidity())
    })

    $form.find('input.select2-offscreen').trigger('validate')

    $form.on('input change', _.debounce(function() { $(this).trigger('validate') }, 200))

    $form.on('validate', function() {
      var enabled = $form.find('.touched').length > 0 && this.checkValidity()
      $(this).find('button[type=submit]').prop('disabled', !enabled)
    })

    $form.find('input[name=emailAddresses]').on('change', function(event) {
      var emails = event.val
      if (!_.isEmpty(emails) && _.every(emails, validateEmail)) {
        this.setCustomValidity('')
      } else {
        this.setCustomValidity('Invalid email')
      }
      $(this).trigger('validate')

      function validateEmail(email) {
        return new RegExp('.+@.+\\..+').test(email)
      }
    })

    $form.find('.apiToken a').click(function(e) {
      e.preventDefault()
      $.get('/apiToken').done(function(data) {
        $form.find('.apiToken input').val(data.apiToken).addClass('touched').trigger('validate').end()
      })
    })

    $subscriberDetails.find('button[name=remove]').click(function() {
      var $selected = $page.find('.result.selected')
      var subscriber = $selected.data('subscriber')
      showDialog($('#templates').find('.remove-subscriber-dialog').clone()
        .find('.subscriber-name').text(subscriber.name).end()
        .find('button[name=remove]').one('click', removeSubscriber).end()
        .find('button[name=cancel]').one('click', closeDialog).end())

      function removeSubscriber() {
        $.ajax('/accounts/' + subscriber._id, { type: 'DELETE' }).done(function() {
          closeDialog()
          closeDetails()
          $selected.slideUp(function() { $(this).remove() })
        })
      }
    })

    $subscriberDetails.find('input[name=roles]').on('change', function() {
      var $roles = $subscriberDetails.find('input[name=roles]')
      if ($subscriberDetails.find('input[name=roles]:checked').length >= 1) {
        $roles.get().forEach(function(e) { e.setCustomValidity('') })
      } else {
        $roles.get().forEach(function(e) { e.setCustomValidity('You must choose at least one role') })
      }
    })
  }

  function closeDetails() {
    $subscribers.find('.result.selected').removeClass('selected')
    $subscribers.find('.subscriber-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(subscriberId) {
    setLocation('#tilaajat/' + subscriberId)
  }

  function renderSubscribers(subscribers) {
    $subscribers.empty()
    _(subscribers).sortBy('name').map(renderSubscriber).value().forEach(function(acc) { $subscribers.append(acc) })
  }

  function renderSubscriber(subscriber) {
    return $('<div>', { class: 'result', 'data-id': subscriber._id })
      .data('subscriber', subscriber)
      .append($('<span>', { class: 'name' }).text(subscriber.name))
      .append($('<span>', { class: 'roles' }).html(renderRoles(subscriber.roles)))

    function renderRoles(roles) {
      if (_.isEmpty(roles)) return '<i class="fa fa-warning"></i>'
      return _.map(roles, function(role) { return enums.roles[role] }).join(', ')
    }
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function() { return $(this).attr('name') }).toArray()
  }

  function renderSubscriberDetails(subscriber) {
    var $subscriberDetails = $('#templates').find('.subscriber-details').clone()
    $subscriberDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, subscriber))
    $subscriberDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    select2Autocomplete({
      $el: $subscriberDetails.find('input[name=classifiers]'),
      path: function(term) { return '/users/search?q=' + encodeURIComponent(term) },
      multiple: true,
      toOption: userToSelect2Option,
      fromOption: select2OptionToUser,
      formatSelection: function(user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
      formatResultCssClass: function(user) { return user.active ? '' : 'grey' },
      termMinLength: 0
    })

    $subscriberDetails
      .find('input[name="address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=emailAddresses]').select2({ tags: [], multiple: true }).end()
      .find('input[name="billing.address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=billing-extra]').prop('checked', subscriber && !!subscriber.billingPreference).end()
      .find('input[name=billing-extra-type][value=' + (subscriber && subscriber.billingPreference || 'address') + ']').prop('checked', true).end()
      .find('input[name="billing.language"]').select2({ data: select2DataFromEnumObject(enums.billingLanguages) }).end()

    populateClassifiers(subscriber ? subscriber.users : [])
    toggleBillingExtra()
    apiToken()

    return $subscriberDetails

    function setInputValWithProperty(object) {
      var name = $(this).attr('name')
      var property = utils.getProperty(object, name)
      if (property !== undefined) $(this).val(property)
    }

    function populateClassifiers(users) {
      var names = _.map(users, 'username').join(',')
      if (names.length === 0) return
      $.get('/users/names/' + names, function(data) {
        var usersWithNames = _.map(users, function(user) {
          var userdata = data[user.username] || {}
          return _.merge({}, user, { name: userdata.name, active: userdata.active })
        })
        $subscriberDetails.find('input[name=classifiers]').trigger('setVal', usersWithNames).end()
      })
    }

    function toggleBillingExtra() {
      var extraBillingEnabled = $subscriberDetails.find('input[name=billing-extra]').prop('checked')
      $subscriberDetails.find('.billing-extra-fields input').prop('disabled', !extraBillingEnabled)

      if (extraBillingEnabled) {
        var type = $subscriberDetails.find('input[name=billing-extra-type]:checked').val()
        var $addressInputs = $subscriberDetails.find('.billing-extra-fields .billing-address input')
        var $eInvoiceInputs = $subscriberDetails.find('.billing-extra-fields .eInvoice input')

        $addressInputs.prop('disabled', type === 'eInvoice')
        $eInvoiceInputs.prop('disabled', type === 'address')
      }
    }

    function apiToken() {
      if (!hasRole('root')) $subscriberDetails.find('.apiToken').remove()
    }
  }
}

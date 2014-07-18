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
      $(this).toggle(_.contains(name, searchString))
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
      subscriberData.roles = $newSubscriberForm.find('input[name=roles]')
        .filter(':checked').map(function() { return $(this).val() }).toArray()

      $.post('/accounts/', JSON.stringify(subscriberData), function(subscriber) {
        $subscribers.find('.result.selected').data('subscriber', subscriber)
        var $subscriber = renderSubscriber(subscriber).css('display', 'none')
        $subscribers.prepend($subscriber)
        $subscriber.slideToggle()
        closeDetails()
      })
    })

    $newSubscriberForm.find('input[name=roles]').on('change', function() {
      var $roles = $newSubscriberForm.find('input[name=roles]')
      if ($newSubscriberForm.find('input[name=roles]:checked').length >= 1) {
        $roles.get().forEach(function(e) { e.setCustomValidity('') })
      } else {
        $roles.get().forEach(function(e) { e.setCustomValidity('You must choose at least one role') })
      }
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

      var subscriberData = {
        name: findInput('name').val(),
        emailAddresses: _.pluck(findInput('emailAddresses').select2('data'), 'text'),
        yTunnus: findInput('yTunnus').val(),
        address: {
          street: findInput('address.street').val(),
          city: findInput('address.city').val(),
          zip: findInput('address.zip').val(),
          country: findInput('address.country').val()
        },
        billing: {
          invoiceText: $form.find('textarea[name="billing.invoiceText"]').val(),
          language: findInput('billing.language').val()
        },
        eInvoice: {},
        contactName: findInput('contactName').val(),
        phoneNumber: findInput('phoneNumber').val(),
        users: findInput('classifiers').select2('data').map(select2OptionToIdNamePair)
      }
      if ($form.find('input[name=billing-extra]').prop('checked')) {
        var extraBillingType = $form.find('input[name=billing-extra-type]:checked').val()
        if (extraBillingType === 'address') {
          subscriberData.billing.address = {
            street: findInput('billing.address.street').val(),
            city: findInput('billing.address.city').val(),
            zip: findInput('billing.address.zip').val(),
            country: findInput('billing.address.country').val()
          }
        } else if (extraBillingType === 'eInvoice') {
          subscriberData.eInvoice = {
            address: findInput('eInvoice.address').val(),
            operator: findInput('eInvoice.operator').val()
          }
        }
      }

      submitCallback(subscriberData)

      function findInput(name) {
        return $subscriberDetails.find('input[name="' + name + '"]')
      }
    })

    $form.find('input').on('blur select2-blur', function() { $(this).addClass('touched') })

    $form.find('input.select2-offscreen').on('change validate', function() {
      $(this).toggleClass('invalid', !this.checkValidity())
    })

    $form.on('input change', _.debounce(function() { $(this).trigger('validate') }, 200))

    $form.on('validate', function() {
      $(this).find('button[type=submit]').prop('disabled', !this.checkValidity())
    })

    $form.find('input[name=emailAddresses]').on('change', function(event) {
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

    $subscriberDetails.find('button[name=remove]').click(function() {
      var $selected = $page.find('.result.selected')
      var subscriber = $selected.data('subscriber')
      showDialog($('#templates').find('.remove-subscriber-dialog').clone()
        .find('.subscriber-name').text(subscriber.name).end()
        .find('button[name=remove]').click(removeSubscriber).end()
        .find('button[name=cancel]').click(closeDialog).end())

      function removeSubscriber() {
        $.ajax('/accounts/' + subscriber._id, { type: 'DELETE' }).done(function() {
          closeDialog()
          closeDetails()
          $selected.slideUp(function() { $(this).remove() })
        })
      }
    })
  }

  function closeDetails() {
    $subscribers.find('.result.selected').removeClass('selected')
    $subscribers.find('.subscriber-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(subscriberId) {
    location.hash = '#tilaajat/' + subscriberId
  }

  function renderSubscribers(subscribers) {
    $subscribers.empty()
    _(subscribers).sortBy('name').map(renderSubscriber).forEach(function(acc) { $subscribers.append(acc) })
  }

  function renderSubscriber(subscriber) {
    return $('<div>', { class: 'result', 'data-id': subscriber._id })
      .data('subscriber', subscriber)
      .append($('<span>', { class: 'name' }).text(subscriber.name))
      .append($('<span>', { class: 'roles' }).html(renderRoles(subscriber.roles)))

    function renderRoles(roles) {
      if (_.isEmpty(roles)) return '<i class="icon-warning-sign"></i>'
      return _.map(roles, function(role) { return enums.roles[role] }).join(', ')
    }
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function() { return $(this).attr('name') }).toArray()
  }

  function renderSubscriberDetails(subscriber) {
    var $subscriberDetails = $('#templates').find('.subscriber-details').clone()
    var eInvoice = utils.getProperty(subscriber, 'eInvoice')
    var billingAddress = utils.getProperty(subscriber, 'billing.address')
    var extraBillingType = _.isEmpty(billingAddress) ? 'eInvoice' : 'address'

    $subscriberDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, subscriber))

    $subscriberDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    select2Autocomplete({
      $el: $subscriberDetails.find('input[name=classifiers]'),
      path: function(term) { return '/users/search?q=' + encodeURIComponent(term) },
      multiple: true,
      toOption: accountToSelect2Option,
      fromOption: select2OptionToIdNamePair
    })

    $subscriberDetails
      .find('input[name=classifiers]').trigger('setVal', utils.getProperty(subscriber, 'users')).end()
      .find('input[name="address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=emailAddresses]').select2({ tags: [], multiple: true }).end()
      .find('input[name="billing.address.country"]').select2({ data: select2DataFromEnumObject(enums.countries) }).end()
      .find('input[name=billing-extra]').prop('checked', !(_.isEmpty(billingAddress) && _.isEmpty(eInvoice))).end()
      .find('input[name=billing-extra-type][value=' + extraBillingType + ']').prop('checked', true).end()
      .find('input[name="billing.language"]').select2({ data: select2DataFromEnumObject(enums.billingLanguages) }).end()

    toggleBillingExtra($subscriberDetails)

    return $subscriberDetails

    function setInputValWithProperty(object) {
      var name = $(this).attr('name')
      var property = utils.getProperty(object, name)
      if (property !== undefined) $(this).val(property)
    }

    function accountToSelect2Option(account) {
      if (!account) return null
      return {
        id: account._id,
        text: account.name + (account.username ? ' (' + account.username + ')' : ''),
        name: account.username ? account.username : account.name
      }
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
  }

  function select2OptionToIdNamePair(x) {
    if (!x) return null
    return { _id: x.id, name: x.name }
  }

}

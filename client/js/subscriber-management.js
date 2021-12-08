window.subscriberManagementPage = function () {
  const $page = $('#subscriber-management-page')
  const $search = $page.find('.search')
  const $subscribers = $page.find('.subscribers-list')
  const $subscriberNameQuery = $page.find('#subscriber-name-query')

  $page.on('show', function (event, subscriberId) {
    updateLocationHash(subscriberId || '')
    $.get('/subscribers?' + $.param({roles: currentFilters()}), function (subscribers) {
      renderSubscribers(subscribers)

      // Apply subscriber search
      $subscriberNameQuery.trigger('input')

      if (subscriberId) {
        const $selected = $subscribers.find('.result[data-id=' + subscriberId + ']')
        openDetails($selected)
        const top = $selected.offset().top - 25
        $('body,html').animate({scrollTop: top})
      }
    })
    $page.find('form input[name="_csrf"]').val($.cookie('_csrf_token'))
  })

  $subscriberNameQuery.on('input', function () {
    const searchString = $(this).val().toLowerCase()
    $subscribers.find('.result').each(function () {
      const name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.includes(name, searchString))
    })
    $search.find('.result-count .num').text($subscribers.find('.result:visible').length)
    closeDetails()
  })

  $page.find('.filters').change(function () { $page.trigger('show') })

  $page.find('button.export').on('click', function () { const $form = $(".subscribers-excel-export-form:visible")
    $form.submit()
  })

  $subscribers.on('click', '.result', function () {
    const $this = $(this)
    const wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  $page.find('button[name=new-subscriber]').on('click', function () { const $newSubscriberForm = renderSubscriberDetails()
    $newSubscriberForm.find('.modify-only').remove()
    bindEventHandlers($newSubscriberForm, function (subscriberData) {
      $.post('/accounts/', JSON.stringify(subscriberData), function (subscriber) {
        $subscribers.find('.result.selected').data('subscriber', subscriber)
        const $subscriber = renderSubscriber(subscriber).css('display', 'none')
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
    const subscriber = $row.data('subscriber')
    const $subscriberDetails = renderSubscriberDetails(subscriber)

    $subscriberDetails.find('.new-only').remove()
    $subscriberDetails.find('button[name=remove]').toggle(shared.hasRole('root'))

    if (shared.hasRole('root')) $subscriberDetails.append(meku.changeLog(subscriber).render())

    bindEventHandlers($subscriberDetails, function (subscriberData) {
      $.ajax('/accounts/' + subscriber._id, {type: 'PUT', data: JSON.stringify(subscriberData)})
        .done(function (s) {
          $subscribers.find('.result.selected').replaceWith(renderSubscriber(s))
          closeDetails()
      })
    })

    $row.addClass('selected').after($subscriberDetails)
    updateLocationHash(subscriber._id)
    $subscriberDetails.slideDown()
  }

  function bindEventHandlers($subscriberDetails, submitCallback) {
    const $form = $subscriberDetails.find('form')

    $form.submit(function (event) {
      event.preventDefault()
      $form.find('button[name=save]').prop('disabled', true)
      const subscriberData = {
        roles: findInput('roles').filter(':checked').map(function () {
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
        users: findInput('classifiers').select2('data').map(meku.select2OptionToUser),
        billingPreference: $form.find('input[name=billing-extra]').prop('checked')
          ? $form.find('input[name=billing-extra-type]:checked').val() : ''
      }
      if (shared.hasRole('root')) {
        subscriberData.apiToken = findInput('apiToken').val()
      }
      submitCallback(subscriberData)

      function findInput(name) {
        return $subscriberDetails.find('input[name="' + name + '"]')
      }
    })

    $form.find('input, textarea').on('input change', function () { $(this).addClass('touched') })

    $form.find('input.select2-offscreen').on('change validate', function () {
      $(this).toggleClass('invalid', !this.checkValidity())
    })

    $form.find('input.select2-offscreen').trigger('validate')

    $form.on('input change', _.debounce(function () { $(this).trigger('validate') }, 200))

    $form.on('validate', function () {
      const enabled = $form.find('.touched').length > 0 && this.checkValidity()
      $(this).find('button[type=submit]').prop('disabled', !enabled)
    })

    $form.find('input[name=emailAddresses]').on('change', function (event) {
      const emails = event.val
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

    $form.find('.apiToken a').click(function (e) {
      e.preventDefault()
      $.get('/apiToken').done(function (data) {
        $form.find('.apiToken input').val(data.apiToken).addClass('touched').trigger('validate').end()
      })
    })

    $subscriberDetails.find('button[name=remove]').click(function () { const $selected = $page.find('.result.selected')
      const subscriber = $selected.data('subscriber')
      shared.showDialog($('#templates').find('.remove-subscriber-dialog').clone()
        .find('.subscriber-name').text(subscriber.name).end()
        .find('button[name=remove]').one('click', removeSubscriber).end()
        .find('button[name=cancel]').one('click', shared.closeDialog).end())

      function removeSubscriber() {
        $.ajax('/accounts/' + subscriber._id, {type: 'DELETE'}).done(function () { shared.closeDialog()
          closeDetails()
          $selected.slideUp(function () { $(this).remove() })
        })
      }
    })

    $subscriberDetails.find('input[name=roles]').on('change', function () { const $roles = $subscriberDetails.find('input[name=roles]')
      if ($subscriberDetails.find('input[name=roles]:checked').length >= 1) {
        $roles.get().forEach(function (e) { e.setCustomValidity('') })
      } else {
        $roles.get().forEach(function (e) { e.setCustomValidity('You must choose at least one role') })
      }
    })
  }

  function closeDetails() {
    $subscribers.find('.result.selected').removeClass('selected')
    $subscribers.find('.subscriber-details').slideUp(function () { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(subscriberId) {
    shared.setLocation('#tilaajat/' + subscriberId)
  }


  function renderSubscribers(subscribers) {
    $subscribers.empty()
    _(subscribers).sortBy('name').map(renderSubscriber).value().forEach(function (acc) { $subscribers.append(acc) })
  }

  function renderSubscriber(subscriber) {
    return $('<div>', {class: 'result', 'data-id': subscriber._id})
      .data('subscriber', subscriber)
      .append($('<span>', {class: 'name'}).text(subscriber.name))
      .append($('<span>', {class: 'roles'}).html(renderRoles(subscriber.roles)))

    function renderRoles(roles) {
      if (_.isEmpty(roles)) return '<i class="fa fa-warning"></i>'
      return _.map(roles, function (role) { return window.enums.roles[role] }).join(', ')
    }
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function () { return $(this).attr('name') }).toArray()
  }

  function renderSubscriberDetails(subscriber) {
    const $subscriberDetails = $('#templates').find('.subscriber-details').clone()
    $subscriberDetails.find('input[name], textarea[name]').each(_.partial(setInputValWithProperty, subscriber))
    $subscriberDetails.find('input[name=billing-extra], input[name=billing-extra-type]').on('click', toggleBillingExtra)

    shared.select2Autocomplete({
      $el: $subscriberDetails.find('input[name=classifiers]'),
      path: function (term) { return '/users/search?q=' + encodeURIComponent(term) },
      multiple: true,
      toOption: meku.userToSelect2Option,
      fromOption: meku.select2OptionToUser,
      formatSelection: function (user, $container) { $container.toggleClass('grey', !user.active).text(user.text) },
      formatResultCssClass: function (user) { return user.active ? '' : 'grey' },
      termMinLength: 0
    })

    $subscriberDetails
      .find('input[name="address.country"]').select2({data: meku.select2DataFromEnumObject(window.enums.countries)}).end()
      .find('input[name=emailAddresses]').select2({tags: [], multiple: true}).end()
      .find('input[name="billing.address.country"]').select2({data: meku.select2DataFromEnumObject(window.enums.countries)}).end()
      .find('input[name=billing-extra]').prop('checked', subscriber && !!subscriber.billingPreference).end()
      .find('input[name=billing-extra-type][value=' + (subscriber && subscriber.billingPreference || 'address') + ']').prop('checked', true).end()
      .find('input[name="billing.language"]').select2({data: meku.select2DataFromEnumObject(window.enums.billingLanguages)}).end()

    populateClassifiers(subscriber ? subscriber.users : [])
    toggleBillingExtra()
    apiToken()

    return $subscriberDetails

    function setInputValWithProperty(object) {
      const name = $(this).attr('name')
      const property = window.utils.getProperty(object, name)
      if (property !== undefined) $(this).val(property)
    }

    function populateClassifiers(users) {
      const names = _.map(users, 'username').join(',')
      if (names.length === 0) return
      $.get('/users/names/' + names, function (data) {
        const usersWithNames = _.map(users, function (user) {
          const userdata = data[user.username] || {}
          return _.merge({}, user, {name: userdata.name, active: userdata.active})
        })
        $subscriberDetails.find('input[name=classifiers]').trigger('setVal', usersWithNames).end()
      })
    }

    function toggleBillingExtra() {
      const extraBillingEnabled = $subscriberDetails.find('input[name=billing-extra]').prop('checked')
      $subscriberDetails.find('.billing-extra-fields input').prop('disabled', !extraBillingEnabled)

      if (extraBillingEnabled) {
        const type = $subscriberDetails.find('input[name=billing-extra-type]:checked').val()
        const $addressInputs = $subscriberDetails.find('.billing-extra-fields .billing-address input')
        const $eInvoiceInputs = $subscriberDetails.find('.billing-extra-fields .eInvoice input')

        $addressInputs.prop('disabled', type === 'eInvoice')
        $eInvoiceInputs.prop('disabled', type === 'address')
      }
    }

    function apiToken() {
      if (!shared.hasRole('root')) $subscriberDetails.find('.apiToken').remove()
    }
  }
}

function subscriberManagementPage() {
  var $page = $('#subscriber-management-page')
  var $subscribers = $page.find('.subscribers-list')

  $page.on('show', function(event, subscriberId) {
    updateLocationHash(subscriberId || '')
    $.get('/subscribers?' + $.param({ roles: currentFilters() }), function(subscribers) {
      renderSubscribers(subscribers)
      if (subscriberId) {
        var $selected = $subscribers.find('.result[data-id=' + subscriberId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })
  })

  $page.find('#subscriber-name-query').on('input', function() {
    var searchString = $(this).val().toLowerCase()
    $subscribers.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.contains(name, searchString))
    })
  })

  $('.filters').change(function() { $page.trigger('show') })

  $subscribers.on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  $page.find('.new-subscriber button').on('click', function() {
    var $newSubscriberForm = renderNewSubscriberForm()

    bindEventHandlers($newSubscriberForm, function(subscriberData) {
      subscriberData.roles = [ 'Subscriber' ]

      $.post('/accounts/', JSON.stringify(subscriberData), function(subscriber) {
        $subscribers.find('.result.selected').data('subscriber', subscriber)
        var $subscriber = renderSubscriber(subscriber).css('display', 'none')
        $subscribers.prepend($subscriber)
        $subscriber.slideToggle()
        closeDetails()
      })
    })

    closeDetails()
    $subscribers.addClass('selected').prepend($newSubscriberForm)
    $newSubscriberForm.slideDown()
  })

  function openDetails($row) {
    var subscriber = $row.data('subscriber')
    var $subscriberDetails = renderSubscriberDetails(subscriber)

    bindEventHandlers($subscriberDetails, function(subscriberData) {
      $.post('/accounts/' + subscriber._id, JSON.stringify(subscriberData), function(subscriber) {
        $subscribers.find('.result.selected').replaceWith(renderSubscriber(subscriber))
        closeDetails()
      })
    })

    $row.addClass('selected').after($subscriberDetails)
    updateLocationHash(subscriber._id)
    $subscriberDetails.slideDown()
  }

  function bindEventHandlers($e, submitCallback) {
    $e.submit(function(event) {
      event.preventDefault()

      var subscriberData = {
        name: findInput('name').val(),
        emailAddresses: findInput('emails').select2('data').map(function(select2Pair) { return select2Pair.text }),
        yTunnus: findInput('yTunnus').val(),
        address: {
          street: findInput('street').val(),
          city: findInput('city').val(),
          zip: findInput('zip').val(),
          country: findInput('country').val()
        },
        contactName: findInput('contactName').val(),
        phoneNumber: findInput('phoneNumber').val(),
        users: findInput('classifiers').select2('data').map(select2OptionToIdUsernamePair)
      }

      submitCallback(subscriberData)

      function findInput(name) {
        return $e.find('input[name=' + name + ']')
      }
    })

    var $form = $e.find('form')

    $form.find('input').on('blur', function() {
      $(this).addClass('touched')
    })

    $form.on('input change', _.debounce(function() { $(this).trigger('validate') }, 200))

    $form.on('validate', function() {
      $(this).find('button[type=submit]').prop('disabled', !this.checkValidity())
    })

    $form.find('input[name=emails]').on('change', function(event) {
      $(this).addClass('touched')
      var emails = event.val
      if (!_.isEmpty(emails) && _.all(emails, validateEmail)) {
        this.setCustomValidity('')
        $(this).removeClass('invalid')
      } else {
        this.setCustomValidity('Invalid email')
        $(this).addClass('invalid')
      }

      function validateEmail(email) {
        return new RegExp('.+@.+\\..+').test(email)
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
  }

  function renderRoles(roles) {
    if (_.isEmpty(roles)) return '<i class="icon-warning-sign"></i>'

    return _.map(roles, function(role) { return enums.roles[role] }).join(', ')
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function() { return $(this).attr('name') }).toArray()
  }

  function renderSubscriberDetails(subscriber) {
    var $detailTemplate = renderSubscriberTemplate()

    $detailTemplate
      .find('input[name=classifiers]').trigger('setVal', subscriber.users).end()
      .find('input[name=name]').val(subscriber.name).end()
      .find('input[name=yTunnus]').val(subscriber.yTunnus).end()
      .find('input[name=street]').val(subscriber.address.street).end()
      .find('input[name=zip]').val(subscriber.address.zip).end()
      .find('input[name=city]').val(subscriber.address.city).end()
      .find('input[name=country]').val(subscriber.address.country).end()
      .find('input[name=contactName]').val(subscriber.contactName).end()
      .find('input[name=phoneNumber]').val(subscriber.phoneNumber).end()
      .find('input[name=emails]').val(subscriber.emailAddresses).select2({
        tags: subscriber.emailAddresses,
        multiple: true
      }).end()

    return $detailTemplate
  }

  function select2OptionToIdUsernamePair(x) {
    if (!x) return null
    return { _id: x.id, name: x.name }
  }

  function renderSubscriberTemplate() {
    var $detailTemplate = $('#templates').find('.subscriber-details').clone()

    select2Autocomplete({
      $el: $detailTemplate.find('input[name=classifiers]'),
      path: function(term) { return '/users/search?q=' + encodeURIComponent(term) },
      multiple: true,
      toOption: function(x) {
        if (!x) return null
        return {
          id: x._id,
          text: x.name + (x.username ? ' (' + x.username + ')' : ''),
          name: x.username ? x.username : x.name
        }
      },
      fromOption: select2OptionToIdUsernamePair
    })

    return $detailTemplate
  }

  function renderNewSubscriberForm() {
    var $detailTemplate = renderSubscriberTemplate()

    $detailTemplate.find('input[name=emails]').select2({
      tags: [],
      multiple: true
    }).end()

    return $detailTemplate
  }
}

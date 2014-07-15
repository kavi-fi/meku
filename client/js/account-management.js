function accountManagementPage() {
  var $page = $('#account-management-page')
  var $accounts = $page.find('.accounts-list')

  $page.on('show', function(event, accountId) {
    updateLocationHash(accountId || '')
    $.get('/accounts?' + $.param({ roles: currentFilters() }), function(accounts) {
      renderAccounts(accounts)
      if (accountId) {
        var $selected = $accounts.find('.result[data-id=' + accountId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })
  })

  $page.find('#account-name-query').on('input', function() {
    var searchString = $(this).val().toLowerCase()
    $accounts.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      $(this).toggle(_.contains(name, searchString))
    })
  })

  $('.filters').change(function() { $page.trigger('show') })

  $accounts.on('click', '.result', function() {
    var $this = $(this)
    var wasSelected = $this.hasClass('selected')
    closeDetails()
    if (!wasSelected) {
      openDetails($this)
    }
  })

  function openDetails($row) {
    var account = $row.data('account')
    var $accountDetails = renderAccountDetails(account)

    bindEventHandlers($accountDetails, account)

    $row.addClass('selected').after($accountDetails)
    updateLocationHash(account._id)
    $accountDetails.slideDown()
  }

  function bindEventHandlers($e, account) {
    $e.submit(function(event) {
      event.preventDefault()

      var accountData = {
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
        phoneNumber: findInput('phoneNumber').val()
      }

      $.post('/accounts/' + account._id, JSON.stringify(accountData), function(account) {
        $accounts.find('.result.selected').replaceWith(renderAccount(account))
        closeDetails()
      })

      function findInput(name) {
        return $e.find('input[name=' + name + ']')
      }
    })

    var $form = $e.find('form')

    $form.on('input change', _.debounce(function() { $(this).trigger('validate') }, 200))
    $form.on('validate', function() {
      $(this).find('button[type=submit]').prop('disabled', !this.checkValidity())
    })
  }

  function closeDetails() {
    $accounts.find('.result.selected').removeClass('selected')
    $accounts.find('.account-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function updateLocationHash(accountId) {
    location.hash = '#tilaajat/' + accountId
  }

  function renderAccounts(accounts) {
    $accounts.empty()
    _(accounts).sortBy('name').map(renderAccount).forEach(function(acc) { $accounts.append(acc) })
  }

  function renderAccount(account) {
    return $('<div>', { class: 'result', 'data-id': account._id })
      .data('account', account)
      .append($('<span>', { class: 'name' }).text(account.name))
      .append($('<span>', { class: 'roles' }).html(renderRoles(account.roles)))
  }

  function renderRoles(roles) {
    if (_.isEmpty(roles)) return '<i class="icon-warning-sign"></i>'

    return _.map(roles, function(role) { return enums.roles[role] }).join(', ')
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function() { return $(this).attr('name') }).toArray()
  }

  function renderAccountDetails(account) {
    var $detailTemplate = $('#templates').find('.account-details').clone()

    $detailTemplate
      .find('input[name=name]').val(account.name).end()
      .find('input[name=yTunnus]').val(account.yTunnus).end()
      .find('input[name=street]').val(account.address.street).end()
      .find('input[name=zip]').val(account.address.zip).end()
      .find('input[name=city]').val(account.address.city).end()
      .find('input[name=country]').val(account.address.country).end()
      .find('input[name=contactName]').val(account.contactName).end()
      .find('input[name=phoneNumber]').val(account.phoneNumber).end()
      .find('input[name=emails]').val(account.emailAddresses).select2({
        tags: account.emailAddresses,
        multiple: true
      }).end()

    return $detailTemplate
  }

}

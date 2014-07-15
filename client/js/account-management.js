function accountManagementPage() {
  var $page = $('#account-management-page')
  var $accounts = $page.find('.accounts-list')
  var accountDetails = accountDetailsRenderer()

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
    var $accountDetails = accountDetails.render(account)
    $row.addClass('selected').after($accountDetails)
    updateLocationHash(account._id)
    $accountDetails.slideDown()
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

}

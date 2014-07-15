function accountManagementPage() {
  var $page = $('#account-management-page')
  var $accounts = $page.find('.accounts-list')

  $page.on('show', function() {
    updateLocationHash()
    $.get('/accounts?' + $.param({ roles: currentFilters() }), function(accounts) {
      renderAccounts(accounts)
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
    if ($this.hasClass('selected')) {
      closeDetails()
    } else {
      closeDetails()
      openDetails($this)
    }
  })

  function openDetails($row) {
    var account = $row.data('account')
    var $accountDetails = renderAccountDetails(account)
    $row.addClass('selected').after($accountDetails)
    updateLocationHash(account._id)
    $accountDetails.slideDown()
  }

  function closeDetails() {
    $accounts.find('.result.selected').removeClass('selected')
    $accounts.find('.account-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function renderAccountDetails(account) {
    var $detailTemplate = $('#templates').find('.account-details').clone()

    $detailTemplate.find('input[name=name]').val(account.name)

    $detailTemplate.submit(function(event) {
      event.preventDefault()

      // todo: $.post here

      closeDetails()
    })

    return $detailTemplate
  }

  function updateLocationHash() {
    location.hash = '#tilaajat/'
  }

  function renderAccounts(accounts) {
    $accounts.empty()
    _(accounts).sortBy('name').map(renderAccount).forEach(function(acc) { $accounts.append(acc) })
  }

  function renderAccount(account) {
    return $('<div>', { class: 'result' })
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

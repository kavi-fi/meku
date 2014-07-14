function accountManagementPage() {
  var $page = $('#account-management-page')
  var $accounts = $page.find('.accounts-list')

  $page.on('show', function() {
    updateLocationHash()
    $.get('/accounts', function(accounts) {
      renderAccounts(accounts)
    })
  })

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
}

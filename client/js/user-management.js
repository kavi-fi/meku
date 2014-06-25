function userManagementPage() {
  var $page = $('#user-management-page')
  var $userList = $page.find('.user-list')

  $page.on('show', function() {
    location.hash = '#kayttajat'
    $.get('/users', renderUsers)
  })

  function renderUsers(users) {
    _(users).sortBy('name').map(renderUser).forEach(function(u) { $userList.append(u) })
  }

  function renderUser(user) {
   return $('<div>', { class: 'result' })
     .data('user', user)
     .append($('<span>', { class: 'name' }).text(user.name))
     .append($('<span>', { class: 'role' }).html(user.role || '<i class="icon-warning-sign"></i>'))
     .append($('<span>', { class: 'cert-end '}).html('<i class="icon-warning-sign"></i>'))
  }
}

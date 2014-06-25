function userManagementPage() {
  var $page = $('#user-management-page')

  $page.on('show', function() {
    location.hash = '#kayttajat'
  })
}

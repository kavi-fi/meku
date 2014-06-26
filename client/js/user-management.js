function userManagementPage() {
  var $page = $('#user-management-page')
  var $userList = $page.find('.user-list')

  $page.on('show', function(event, userId) {
    updateLocationHash(userId || '')
    $.get('/users', function(users) {
      renderUsers(users)
      if (userId) {
        var $selected = $userList.find('.result[data-id=' + userId + ']')
        openDetails($selected)
        var top = $selected.offset().top - 25
        $('body,html').animate({ scrollTop: top })
      }
    })
  })

  $userList.on('click', '.result', function() {
    var $this = $(this)
    if ($this.hasClass('selected')) {
      closeDetails()
    } else {
      closeDetails()
      openDetails($this)
    }
  })

  function updateLocationHash(userId) {
    location.hash = '#kayttajat/' + userId
  }

  function renderUsers(users) {
    _(users).sortBy('name').map(renderUser).forEach(function(u) { $userList.append(u) })
  }

  function renderUser(user) {
   return $('<div>', { class: 'result', 'data-id': user._id })
     .data('user', user).data('id', user._id)
     .append($('<span>', { class: 'name' }).text(user.name))
     .append($('<span>', { class: 'role' }).html(user.role || '<i class="icon-warning-sign"></i>'))
     .append($('<span>', { class: 'cert-end '}).html('<i class="icon-warning-sign"></i>'))
  }

  function openDetails($row) {
    var user = $row.data('user')
    var $userDetails = renderUserDetails(user)
    $row.addClass('selected').after($userDetails)
    updateLocationHash(user._id)
    $userDetails.slideDown()
  }

  function closeDetails() {
    $userList.find('.result.selected').removeClass('selected')
    $userList.find('.user-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function renderUserDetails(user) {
    var $detailTemplate = $('#templates > .user-details').clone()
    $detailTemplate.find('input[name=name]').val(user.name).end()
      .find('input[name=email]').val(user.emails[0]).end()
      .find('input[name=username]').val(user.username).end()
      .find('input[name=active]').prop('checked', user.active).end()

    $detailTemplate.submit(function(event) {
      event.preventDefault()
      var $this = $(this)
      var data = {
        name: $this.find('input[name=name]').val(),
        emails: [ $this.find('input[name=email]').val() ],
        username: $this.find('input[name=username]').val(),
        active: $this.find('input[name=active]').prop('checked')

      }
      $.post('/users/' + user._id, JSON.stringify(data), function(updatedUser) {
        $userList.find('.result.selected').data('user', updatedUser)
        closeDetails()
      })
    })
    return $detailTemplate.css('display', 'none')
  }
}

function userManagementPage() {
  var $page = $('#user-management-page')
  var $userList = $page.find('.user-list')
  var $userNameQuery = $page.find('#user-name-query')

  var userRoleLabels = {
    'kavi': 'kavi',
    'user': 'Luokittelija',
    'root': 'Admin'
  }
  var userTypes = enums.userRoles.map(function(role, index) {
    return { id: index, text: userRoleLabels[role] }
  })

  var $newUserType = $page.find('.new-user input[name="new-user-type"]').select2({
    data: userTypes,
    minimumResultsForSearch: -1
  }).select2('val', 1)

  $page.on('show', function(event, userId) {
    updateLocationHash(userId || '')
    $userList.empty()
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

  $page.find('.new-user button').on('click', function() {
    var $newUserForm = renderNewUserForm($newUserType.val())

    closeDetails()
    $userList.addClass('selected').prepend($newUserForm)
    $newUserForm.slideDown()
  })

  $userNameQuery.on('input', function() {
    var searchString = $(this).val().toLowerCase()

    $userList.find('.result').each(function() {
      var name = $(this).children('.name').text().toLowerCase()
      if (_.contains(name, searchString)) {
        $(this).show()
      } else {
        $(this).hide()
      }
    })
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

  function getUserData($details) {
    return {
      name: $details.find('input[name=name]').val(),
      emails: [ $details.find('input[name=email]').val() ],
      username: $details.find('input[name=username]').val(),
      active: $details.find('input[name=active]').prop('checked'),
      phoneNumber: $details.find('input[name=phoneNumber]').val()
    }
  }

  function renderNewUserForm(role) {
    var $detailTemplate = $('#templates').find('.user-details').clone()
    $detailTemplate.submit(function(event) {
      event.preventDefault()
      var userData = getUserData($(this))
      userData.role = enums.userRoles[role]
      $.post('/users/new', JSON.stringify(userData), function(newUser) {
        $userList.find('.result.selected').data('user', newUser)
        closeDetails()
        // todo: insert feedback here
      })
    })

    return $detailTemplate.css('display', 'none')
  }

  function renderUserDetails(user) {
    var $detailTemplate = $('#templates').find('.user-details').clone()
    $detailTemplate.find('input[name=name]').val(user.name).end()
      .find('input[name=email]').val(user.emails[0]).end()
      .find('input[name=username]').val(user.username).end()
      .find('input[name=active]').prop('checked', user.active).end()
      .find('input[name=phoneNumber]').val(user.phoneNumber).end()

    $detailTemplate.submit(function(event) {
      event.preventDefault()
      var data = getUserData($(this))
      $.post('/users/' + user._id, JSON.stringify(data), function(updatedUser) {
        $userList.find('.result.selected').data('user', updatedUser)
        closeDetails()
      })
    })
    return $detailTemplate.css('display', 'none')
  }
}

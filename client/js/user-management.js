function userManagementPage() {
  var $page = $('#user-management-page')
  var $userList = $page.find('.user-list')
  var $userNameQuery = $page.find('#user-name-query')

  var $newUserType = $page.find('.new-user input[name="new-user-type"]')
  $newUserType.select2({
    data: _.map(enums.userRoles, function(roleValue, roleKey) {
      return { id: roleKey, text: roleValue.name }
    }),
    minimumResultsForSearch: -1
  }).select2('val', 'user')

  $page.on('show', function(event, userId) {
    updateLocationHash(userId || '')
    $userList.empty()
    $.get('/users?' + $.param({ filters: currentFilters() }), function(users) {
      renderUsers(users)

      // Apply username search
      $userNameQuery.trigger('input')

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
    var $newUserForm = renderNewUserForm($newUserType.select2('val'))

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
    closeDetails()
  })

  $page.find('.filters').change(function() { $page.trigger('show') })

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
     .append($('<span>', { class: 'role' }).html(enums.util.userRoleName(user.role) || '<i class="icon-warning-sign"></i>'))
     .append($('<span>', { class: 'cert-end' }).html(renderCertEnd(user)))
     .toggleClass('inactive', user.active === false)
  }

  function renderCertEnd(user) {
    if (!enums.util.isClassifier(user.role)) return ''

    if (user.certificateEndDate) {
      var certEnd = moment(user.certificateEndDate)
      return $('<span>').text(certEnd.format(utils.dateFormat))
        .toggleClass('expires-soon', certEnd.isBefore(moment().add(3, 'months')))
    } else {
      return '<i class="icon-warning-sign"></i>'
    }
  }

  function openDetails($row) {
    var user = $row.data('user')
    var $userDetails = renderExistingUserDetails(user)
    $row.addClass('selected').after($userDetails)
    updateLocationHash(user._id)
    $userDetails.slideDown()
  }

  function closeDetails() {
    $userList.find('.result.selected').removeClass('selected')
    $userList.find('.user-details').slideUp(function() { $(this).remove() })
    updateLocationHash('')
  }

  function renderNewUserForm(role) {
    var $detailTemplate = renderUserDetails(null, role)

    $detailTemplate.submit(function(event) {
      event.preventDefault()

      var $this = $(this)
      var userData = getUserData($this)
      userData.role = role
      userData.active = true

      if (enums.util.isClassifier(role)) {
        userData = _.merge(userData, getClassifierData($this))
      }

      $.post('/users/new', JSON.stringify(userData), function(newUser) {
        $userList.find('.result.selected').data('user', newUser)
        var $user = renderUser(newUser).css('display', 'none')
        $userList.prepend($user)
        $user.slideToggle()
        closeDetails()
      })
    })

    return $detailTemplate
  }

  function renderExistingUserDetails(user) {
    var $detailTemplate = renderUserDetails(user)

    $detailTemplate.submit(function(event) {
      event.preventDefault()

      var $this = $(this)
      var userData = getUserData($this)

      if (enums.util.isClassifier(user.role)) {
        userData = _.merge(userData, getClassifierData($this))
      }

      $.post('/users/' + user._id, JSON.stringify(userData), function(updatedUser) {
        $userList.find('.result.selected').replaceWith(renderUser(updatedUser))
        closeDetails()
      })
    })

    return $detailTemplate
  }

  function renderUserDetails(user, role) {
    var $detailTemplate = $('#templates').find('.user-details').clone()
    var isNewUser = user == null
    var isClassifier = enums.util.isClassifier(role) || user && enums.util.isClassifier(user.role)

    if (isClassifier) {
      $detailTemplate.find('form').append($('#templates').find('.classifier-details').clone())

      var $endDate = $detailTemplate.find('input[name=certificateEndDate]')
        .pikaday(_.defaults({ defaultDate: moment().add('years', 5).toDate() }, pikadayDefaults))

      $detailTemplate.find('input[name=certificateStartDate]')
        .pikaday(_.defaults({ onSelect: function(date) {
          $endDate.pikaday('setMoment', moment(date).add('years', 5))
      }}, pikadayDefaults))

      select2Autocomplete({
        $el: $detailTemplate.find('input[name=employers]'),
        path: employersSearch,
        multiple: true,
        toOption: idNamePairToSelect2Option,
        fromOption: select2OptionToIdNamePair
      })
    }

    if (isNewUser) {
      $detailTemplate.find('.modify-only').remove()
      $detailTemplate.find('input:required:disabled').prop('disabled', false)
    } else {
      populate($detailTemplate, user)
    }

    $detailTemplate.find('form').on('input change', _.debounce(function() { $(this).trigger('validate') }, 200))

    $detailTemplate.find('form').on('validate', function() {
      $(this).find('button[type=submit]').prop('disabled', !this.checkValidity())
    })

    $detailTemplate.find('input').on('blur', function() {
      $(this).addClass('touched')
    })

    $detailTemplate.find('input[name=username]').on('input', function() {
      var $username = $(this)
      validateUsername($username, $detailTemplate)
    })

    $detailTemplate.find('input[name=employers]').change(toggleInvalid).each(toggleInvalid)

    $detailTemplate.find('button[name=remove]').click(function() {
      var $selected = $page.find('.result.selected')
      var user = $selected.data('user')
      showDialog($('#templates').find('.remove-user-dialog').clone()
        .find('.user-name').text(user.name).end()
        .find('button[name=remove]').click(removeUser).end()
        .find('button[name=cancel]').click(closeDialog).end())

      function removeUser() {
        $.ajax('/users/' + user._id, { type: 'DELETE' }).done(function() {
          closeDialog()
          closeDetails()
          $selected.slideUp(function() { $(this).remove() })
        })
      }
    })

    return $detailTemplate.css('display', 'none')

    function employersSearch(term) {
      return '/accounts/search?q=' + encodeURIComponent(term) + '&roles=Classifier' // todo: only classifier?
    }

    function populate($element, user) {
      var cStartDate = user.certificateStartDate ? moment(user.certificateStartDate).format(utils.dateFormat) : ''
      var cEndDate = user.certificateEndDate ? moment(user.certificateEndDate).format(utils.dateFormat) : ''

      $element.find('input[name=name]').val(user.name).end()
        .find('input[name=email]').val(user.emails[0]).end()
        .find('input[name=username]').val(user.username).end()
        .find('input[name=active]').prop('checked', user.active).end()
        .find('input[name=phoneNumber]').val(user.phoneNumber).end()
        .find('input[name=certificateStartDate]').val(cStartDate).end()
        .find('input[name=certificateEndDate]').val(cEndDate).end()
        .find('textarea[name=comment]').val(user.comment).end()
        .find('input[name=employers]').trigger('setVal', user.employers).end()
    }

    function toggleInvalid() {
      $(this).toggleClass('invalid', !this.checkValidity())
    }
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

  function getClassifierData($details) {
    return {
      certificateStartDate: moment($details.find('input[name=certificateStartDate]').val(), utils.dateFormat),
      certificateEndDate: moment($details.find('input[name=certificateEndDate]').val(), utils.dateFormat),
      employers: $details.find('input[name=employers]').select2('data').map(select2OptionToIdNamePair),
      comment: $details.find('textarea[name=comment]').val()
    }
  }

  var usernameValidator = _.debounce((function() {
    var getLatestAjax = switchLatestDeferred()
    return function(username, $username, $detailTemplate) {
      getLatestAjax($.get('/users/exists/' + encodeURIComponent(username)), $username.siblings('i.icon-spinner'))
        .done(function(data) {
          $username.get(0).setCustomValidity(data.exists ? 'Username taken' : '')
          $username.removeClass('pending')
          $detailTemplate.find('form').trigger('validate')
        })
      }
  })(), 300)

  function validateUsername($username, $detailTemplate) {
    $username.get(0).setCustomValidity('Checking username')
    $username.addClass('touched')
    var username = $username.val().trim()
    if (username) {
      $username.addClass('pending')
      usernameValidator(username, $username, $detailTemplate)
    }
  }

  function currentFilters() {
    return $page.find('.filters input').filter(':checked').map(function() { return $(this).attr('name') }).toArray()
  }
}

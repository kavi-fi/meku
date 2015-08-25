var user

function classificationCriteria() {
  user = parseUserCookie()
  $.ajaxSetup({ dataType: 'json', processData: false, contentType: 'application/json',
    beforeSend: function(xhr, settings) {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/.test(xhr.type)) {
        xhr.setRequestHeader('x-csrf-token', $.cookie('_csrf_token'))
      }
    }
  })
  $.get('/classification/criteria').done(function (criteria) {
    var $criteriaBlock = _.flatten(_.map(enums.classificationCriteria, function (enumCriteria) {
      var storedCriteria = _.find(criteria, function (c) { return c.id == enumCriteria.id})
      var c = storedCriteria ? storedCriteria : enumCriteria
      var $criteria = $('#templates .classification-criteria-edit').clone()
      $criteria
        .find('input[name="id"]').val(c.id).end()
        .find('input[name="category"]').val(enumCriteria.category).end()
        .find('input[name="age"]').val(enumCriteria.age).end()
        .find('input[name="fi.title"]').val(c.fi.title).end()
        .find('textarea[name="fi.description"]').val(c.fi.description).end()
        .find('input[name="sv.title"]').val(c.sv.title).end()
        .find('textarea[name="sv.description"]').val(c.sv.description).end()
        .find('button').on('click', function (e) {
          var $target = $(e.target).closest('.form')
          $.post('/classification/criteria/' + c.id, postData($target), function (c) { setStored($target.find(".stored"), c.date) })
            .done(function (res) { criteriaSaved(res, enumCriteria.age, enumCriteria.category) })
        }).end()
      setStored($criteria.find(".stored"), c.date)
      return $criteria
    }))
    if (hasRole('kavi')) {
      $('#criteria-page').append($('<div>').addClass('category').append($criteriaBlock))
    } else {
      $('#criteria-page').append($('<div>').text('Kirjaudu järjestelmään pääkäyttäjänä ja yritä uudelleen.'))
    }
    $('#criteria-page').show()
  })

  function postData($criteria) {
    return JSON.stringify({
      fi: { title: $criteria.find('input[name="fi.title"]').val(), description: $criteria.find('textarea[name="fi.description"]').val() },
      sv: { title: $criteria.find('input[name="sv.title"]').val(), description: $criteria.find('textarea[name="sv.description"]').val() }
    })
  }

  function criteriaSaved(stored, age, category) {
    var $fi = $('<div>').addClass('criteria agelimit agelimit-' + age)
    $fi.append($('<h5>'))
    $fi.append($('<p>'))
    var $id = $('<span>').html('&nbsp;' + (category === 'vet' ? '' : '(' + stored.id + ')'))
    var $sv = $fi.clone()
    $fi.find('h5').text(stored.fi.title).append($id)
    $fi.find('p').html(stored.fi.description)
    $sv.find('h5').text(stored.sv.title).append($id.clone())
    $sv.find('p').html(stored.sv.description)
    var $buttons = $('<div>').addClass('buttons').append($('<button>').addClass('ok  button').text('Ok'))
    $buttons.find('button.ok').click(closeDialog)
    showDialog($('<div>').addClass('dialog').append($('<div>').addClass('classification-criteria').append($('<div>').addClass('category').text('Tallennettu').append($fi, $sv, $buttons))))
  }

  function setStored($elem, date) {
    if (date) $elem.text('Viimeksi tallennettu ' + utils.asDate(date))
  }

  function parseUserCookie() {
    var cookie = $.cookie('user')
    if (!cookie) return null
    return JSON.parse(cookie.substring(4, cookie.lastIndexOf('.')))
  }
}

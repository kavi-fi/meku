window.classificationCriteria = function () {
  window.user = shared.parseUserCookie()
  $.ajaxSetup({dataType: 'json', processData: false, contentType: 'application/json',
    beforeSend: function (xhr) {
      if (!(/^(GET|HEAD|OPTIONS|TRACE)$/).test(xhr.type)) {
        xhr.setRequestHeader('x-csrf-token', $.cookie('_csrf_token'))
      }
    }
  })
  $.get('/classification/criteria').done(function (result) {
    const $criteriaBlock = _.flatten(_.map(window.enums.classificationCriteria, function (enumCriteria) {
      const storedCriteria = _.find(result, function (c) { return c.id === enumCriteria.id })
      const criteria = storedCriteria ? storedCriteria : enumCriteria
      const $criteria = $('#templates .classification-criteria-edit').clone()
      $criteria.attr('data-cy', `criteria-${criteria.id}`)
      $criteria
        .find('input[name="id"]').val(criteria.id).end()
        .find('input[name="category"]').val(enumCriteria.category).end()
        .find('input[name="age"]').val(enumCriteria.age).end()
        .find('input[name="fi.title"]').val(criteria.fi.title).end()
        .find('textarea[name="fi.description"]').val(criteria.fi.description).end()
        .find('textarea[name="fi.instructions"]').val(criteria.fi.instructions).end()
        .find('input[name="sv.title"]').val(criteria.sv.title).end()
        .find('textarea[name="sv.description"]').val(criteria.sv.description).end()
        .find('textarea[name="sv.instructions"]').val(criteria.sv.instructions).end()
        .find('button').on('click', function (e) {
          const $target = $(e.target).closest('.form')
          $.post('/classification/criteria/' + criteria.id, postData($target), function (c) { setStored($target.find(".stored"), c.date) })
            .done(function (res) { criteriaSaved(res, enumCriteria.age, enumCriteria.category) })
        }).end()
      setStored($criteria.find(".stored"), criteria.date)
      return $criteria
    }))
    if (shared.hasRole('root')) {
      $('#criteria-page').append($('<div>').addClass('category').append($criteriaBlock))
    } else {
      $('#criteria-page').append($('<div>').text('Kirjaudu järjestelmään pääkäyttäjänä ja yritä uudelleen.'))
    }
    $('#criteria-page').show()
  })

  function postData($criteria) {
    return JSON.stringify({
      fi: {title: $criteria.find('input[name="fi.title"]').val(), description: $criteria.find('textarea[name="fi.description"]').val(), instructions: $criteria.find('textarea[name="fi.instructions"]').val()},
      sv: {title: $criteria.find('input[name="sv.title"]').val(), description: $criteria.find('textarea[name="sv.description"]').val(), instructions: $criteria.find('textarea[name="sv.instructions"]').val()}
    })
  }

  function criteriaSaved(stored, age, category) {
    const isVet = category === 'vet'
    const $fi = $('<div>').addClass('criteria agelimit agelimit-' + age)
    $fi.append($('<h5>'))
    $fi.append($('<p>').attr('data-cy', 'description-content'))
    const $id = $('<span>').html('&nbsp;' + (isVet ? '' : '(' + stored.id + ')'))
    const $sv = $fi.clone()

    $fi.attr('data-cy', 'saved-criteria-' + stored.id + '-fi')
    if (!isVet && stored.fi.instructions) {
      $fi.append(shared.criteriaInstructionsSection(stored.fi.instructions))
    }
    $fi.find('h5').text(stored.fi.title).append($id)
    $fi.find('p').first().html(stored.fi.description)

    $sv.attr('data-cy', 'saved-criteria-' + stored.id + '-sv')
    $sv.find('h5').text(stored.sv.title).append($id.clone())
    $sv.find('p').first().html(stored.sv.description)
    if (!isVet && stored.sv.instructions) {
      $sv.append(shared.criteriaInstructionsSection(stored.sv.instructions))
    }

    const $buttons = $('<div>').addClass('buttons').append($('<button>').addClass('ok  button').text('Ok'))
    $buttons.find('button.ok').click(shared.closeDialog)
    shared.showDialog($('<div>').addClass('dialog').append($('<div>').addClass('classification-criteria').append($('<div>').addClass('category').text('Tallennettu').append($fi, $sv, $buttons))))
  }

  function setStored($elem, date) {
    if (date) $elem.text('Viimeksi tallennettu ' + window.utils.asDate(date))
  }
}

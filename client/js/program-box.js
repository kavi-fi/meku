function programBox() {
  var $detailTemplate = $('#templates > .program-box').clone()
  var $draftTemplate = $('<div>').html('Luokittelusta on käyttäjän <b></b> <span></span> tallentama luonnos.')

  return { render: render }

  function render(p) {
    var names = { n: p.name.join(', '), fi: p.nameFi.join(', '), sv: p.nameSv.join(', '), other: p.nameOther.join(', ')}
    var series = p.series && p.series.name || undefined
    var episode = utils.seasonEpisodeCode(p)
    var selectedIcon = '<i class="icon-play"></i> '

    var classifications = p.classifications.map(function(c, index) {
      var registrationDate = utils.asDate(c.registrationDate) || 'Tuntematon rekisteröintiaika'
      var $classification = $('<span>', { class: 'classification' })
        .data(c).text(registrationDate)
      if (index === 0) {
        $classification.addClass('selected').prepend(selectedIcon)
      }
      return $classification
    })

    var drafts = _.values(p.draftClassifications || {}).map(function(draft) {
      return $draftTemplate.clone().find('b').text(draft.author.name).end().find('span').text(utils.asDate(draft.creationDate)).end()
    })

    var $e = $detailTemplate.clone()
      .data('id', p._id)
      .find('.sequenceId').text(p.sequenceId).end()
      .find('.primary-name').text(p.name[0]).end()
      .find('.name').text(names.n).end()
      .find('.nameFi').labeledText(names.fi).end()
      .find('.nameSv').labeledText(names.sv).end()
      .find('.nameOther').labeledText(names.other).end()
      .find('.series').labeledText(series).end()
      .find('.episode').labeledText(episode).end()
      .find('.country').labeledText(enums.util.toCountryString(p.country)).end()
      .find('.year').labeledText(p.year).end()
      .find('.productionCompanies').labeledText(p.productionCompanies.join(', ')).end()
      .find('.genre').labeledText(p.genre.join(', ') || p.legacyGenre.join(', ')).end()
      .find('.directors').labeledText(p.directors.join(', ')).end()
      .find('.actors').labeledText(p.actors.join(', ')).end()
      .find('.synopsis').labeledText(p.synopsis).end()
      .find('.classifications').html(classifications).end()
      .find('.drafts').html(drafts).end()

    var selectedClassification = p.classifications[0]
    if (selectedClassification) {
      renderClassification($e, p, selectedClassification)
    }

    $e.on('click', '.classification', function() {
      $(this).addClass('selected').siblings('.selected').removeClass('selected')
      $(this).parent().find('i').remove()
      $(this).prepend(selectedIcon)
      renderClassification($e, p, $(this).data())
    })

    return $e
  }

  function renderClassification($e, p, c) {
    var summary = classification.summary(p, c)
    $e.find('.agelimit').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warningIcons(summary)).end()
      .find('.reason').labeledText(enums.reclassificationReason[c.reason]).end()
      .find('.author').labeledText(c.author ? c.author.name : '').end()
      .find('.authorOrganization').labeledText(enums.authorOrganization[c.authorOrganization]).end()
      .find('.buyer').labeledText(c.buyer && c.buyer.name || '').end()
      .find('.billing').labeledText(c.billing && c.billing.name || '').end()
      .find('.format').labeledText(enums.util.isGameType(p) && p.gameFormat || c.format).end()
      .find('.duration').labeledText(c.duration).end()
      .find('.comments').labeledText(c.comments).end()
      .find('.publicComments').labeledText(c.publicComments).end()
      .find('.criteria').html(renderClassificationCriteria(c)).end()

  }

  function renderClassificationCriteria(c) {
    if (!c.criteria) return ''
    return c.criteria.map(function(id) {
      var cr = enums.classificationCriteria[id - 1]
      var category = enums.classificationCategoriesFI[cr.category]
      return $('<div>')
        .append($('<label>').text(category + ' ('+cr.id+')'))
        .append($('<span>').text(c.criteriaComments && c.criteriaComments[cr.id] || ''))
    })
  }
}


function programBox() {
  var $detailTemplate = $('#templates > .program-box').clone()

  return { render: render }

  function render(p) {
    var names = { n: p.name.join(', '), fi: p.nameFi.join(', '), sv: p.nameSv.join(', '), other: p.nameOther.join(', ')}
    var series = p.series && p.series.name || undefined
    var episode = utils.seasonEpisodeCode(p)
    var classificationStatusText = classification.fullStatus(p.classifications).map(function(t) { return $('<span>').text(t) })
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
      .find('.status').html(classificationStatusText).end()

    var c = classification.mostValid(p.classifications)
    if (c) {
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
    return $e
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


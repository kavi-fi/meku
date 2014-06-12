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
      .find('.primary-name').text(p.name[0]).end()
      .find('.name').text(names.n).end()
      .find('.nameFi').text(names.fi).end()
      .find('.nameSv').text(names.sv).prev().toggleClass('hide', !names.sv).end().end()
      .find('.nameOther').text(names.other).prev().toggleClass('hide', !names.other).end().end()
      .find('.series').text(series).prev().toggleClass('hide', !series).end().end()
      .find('.episode').text(episode).prev().toggleClass('hide', !episode).end().end()
      .find('.country').text(enums.util.toCountryString(p.country)).end()
      .find('.year').text(p.year).end()
      .find('.productionCompanies').text(p.productionCompanies.join(', ')).end()
      .find('.genre').text(p.genre.join(', ') || p.legacyGenre.join(', ')).end()
      .find('.directors').text(p.directors.join(', ')).prev().toggleClass('hide', p.directors.length == 0).end().end()
      .find('.actors').text(p.actors.join(', ')).prev().toggleClass('hide', p.actors.length == 0).end().end()
      .find('.synopsis').text(p.synopsis).end()
      .find('.status').html(classificationStatusText).end()

    var c = classification.mostValid(p.classifications)
    if (c) {
      var summary = classification.summary(p, c)
      $e.find('.agelimit').attr('src', ageLimitIcon(summary)).end()
        .find('.warnings').html(warningIcons(summary)).end()
        .find('.reason').text(enums.reclassificationReason[c.reason]).prev().toggleClass('hide', c.reason == undefined).end().end()
        .find('.author').text(c.author ? c.author.name : '').prev().toggleClass('hide', c.author == undefined).end().end()
        .find('.authorOrganization').text(enums.authorOrganization[c.authorOrganization]).prev().toggleClass('hide', c.authorOrganization == undefined).end().end()
        .find('.buyer').text(c.buyer && c.buyer.name || '').end()
        .find('.billing').text(c.billing && c.billing.name || '').end()
        .find('.format').text(enums.util.isGameType(p) && p.gameFormat || c.format).end()
        .find('.duration').text(c.duration).prev().toggleClass('hide', c.duration == undefined).end().end()
        .find('.comments').text(c.comments).end()
        .find('.criteria').html(renderClassificationCriteria(c)).end()

      var $comments = $e.find('.comments')
      $comments.add($comments.prev()).toggleClass('hide', !hasRole('kavi'))
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


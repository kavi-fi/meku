function programBox() {
  var $detailTemplate = $('#templates > .program-box').clone()
  var $classificationTemplates = {
    normal: $('#templates > .program-box-normal-classification-details').clone(),
    tvSeries: $('#templates > .program-box-tv-series-classification-details').clone()
  }
  var $draftTemplate = $('<div>').html('Luokittelusta on käyttäjän <b></b> <span></span> tallentama luonnos.')

  return { render: render }

  function render(p) {
    var $e = renderProgram(p)
    enums.util.isTvSeriesName(p) ? renderTvSeries($e, p) : renderClassifications($e, p)
    return $e
  }

  function renderProgram(p) {
    var names = { n: p.name.join(', '), fi: p.nameFi.join(', '), sv: p.nameSv.join(', '), other: p.nameOther.join(', ')}
    var series = p.series && p.series.name || undefined
    var episode = utils.seasonEpisodeCode(p)
    return $detailTemplate.clone()
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
  }

  function renderTvSeries($e, p) {
    var summary = classificationUtils.fullSummary(p)
    $e.find('.classification-container').html($classificationTemplates.tvSeries.clone()).end()
      .find('.agelimit').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warningIcons(summary)).end()
      .find('.current-duration, .current-format').labeledText().end()
      .find('.comment-container').remove().end()

    var $episodes = $e.find('.episodes')
    var $episodeHeader = $e.find('.episode-container > h3')

    $.get('/episodes/'+ p._id).done(function(episodes) {
      if (episodes.length == 0) {
        $episodeHeader.find('.fa-play').remove().end().text('Ei jaksoja.')
        $episodes.remove()
      } else {
        $episodeHeader.append(' '+episodes.length + ' kpl').click(function() {
          $(this).toggleClass('open')
          $episodes.slideToggle()
        })
        $episodes.append(episodes.map(function(p) {
          return $('<div>').addClass('result').data('id', p._id).data('program', p)
            .append($('<span>').text(utils.seasonEpisodeCode(p)))
            .append($('<span>').text(p.name[0]))
            .append($('<span>').text(utils.asDate(utils.getProperty(p, 'classifications.0.registrationDate'))))
            .append($('<span>').append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
        }))
      }
    })
    $episodes.on('click', '.result', function(e) {
      e.stopPropagation()
      var $result = $(this)
      $result.siblings('.selected').removeClass('selected').next('.program-box').slideUp(function() { $(this).remove() }).end()
      if ($result.hasClass('selected')) {
        $result.removeClass('selected').next('.program-box').slideUp(function() { $(this).remove() }).end()
      } else {
        $result.addClass('selected').after(programBox().render($result.data('program')).slideDown())
      }
    })
  }

  function renderClassifications($e, p) {
    var classificationLinks = p.classifications.map(function(c, index) {
      var registrationDate = utils.asDateTime(c.registrationDate) || 'Tuntematon rekisteröintiaika'
      return $('<span>', { 'data-id': c._id }).addClass('classification').toggleClass('selected', index == 0).data('classification', c).text(registrationDate).prepend($('<i>').addClass('fa fa-play'))
    })
    var drafts = _.values(p.draftClassifications || {}).map(function(draft) {
      return $draftTemplate.clone().attr('data-userId', draft.author._id).find('b').text(draft.author.name).end().find('span').text(utils.asDateTime(draft.creationDate)).end()
    })

    $e.find('.classification-container').html($classificationTemplates.normal.clone()).end()
      .find('.classifications').html(classificationLinks).end()
      .find('.drafts').html(drafts).end()
      .find('.episode-container').remove().end()

    if (p.classifications[0]) {
      var c = p.classifications[0]
      renderClassification($e, p, c)
      $e.find('.current-format').labeledText(enums.util.isGameType(p) && p.gameFormat || c.format).end()
        .find('.current-duration').labeledText(c.duration).end()
    }
    $e.on('click', '.classification', function() {
      $(this).addClass('selected').siblings('.selected').removeClass('selected')
      renderClassification($e, p, $(this).data('classification'))
    })
  }

  function renderClassification($e, p, c) {
    var summary = classificationUtils.summary(c)
    $e.find('.agelimit').attr('src', ageLimitIcon(summary)).end()
      .find('.warnings').html(warningIcons(summary)).end()
      .find('.reason').labeledText(enums.reclassificationReason[c.reason]).end()
      .find('.author').labeledText(c.author ? c.author.name + ' (' + c.author.username + ')' : '').end()
      .find('.authorOrganization').labeledText(enums.authorOrganization[c.authorOrganization]).end()
      .find('.buyer').labeledText(c.buyer && c.buyer.name || '').end()
      .find('.billing').labeledText(c.billing && c.billing.name || '').end()
      .find('.format').labeledText(txtIfNotCurrent(enums.util.isGameType(p) && p.gameFormat || c.format)).end()
      .find('.duration').labeledText(txtIfNotCurrent(c.duration)).end()
      .find('.criteria').html(renderClassificationCriteria(c)).end()
      .find('.comments').labeledText(c.comments).end()
      .find('.publicComments').labeledText(c.publicComments).end()
      .find('.commentHeader').toggle(!!(c.comments || c.publicComments)).end()

    function txtIfNotCurrent(txt) { return (p.classifications[0]._id == c._id) ? '' : txt }
  }

  function renderClassificationCriteria(c) {
    if (!c.criteria || c.safe) return ''
    return c.criteria.map(function(id) {
      var cr = enums.classificationCriteria[id - 1]
      var category = enums.classificationCategoriesFI[cr.category]
      return $('<div>')
        .append($('<label>', { title: cr.description }).text(category + ' ('+cr.id+')'))
        .append($('<p>').text(c.criteriaComments && c.criteriaComments[cr.id] || ''))
    })
  }
}


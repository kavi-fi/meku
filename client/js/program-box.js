function programBox() {
  var $detailTemplate = $('#templates > .program-box').clone()
  var $classificationTemplates = {
    normal: $('#templates > .program-box-normal-classification-details').clone(),
    tvSeries: $('#templates > .program-box-tv-series-classification-details').clone(),
    empty: $('#templates > .program-box-empty-classification-details').clone()
  }
  var $draftTemplate = $('<div>').html('Luokittelu kesken käyttäjällä <b></b>. Luonnos tallennettu <span></span>.')

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
    if (p.episodes.count > 0) {
      var $spinner = spinner()
      $episodeHeader.append(' '+p.episodes.count + ' kpl').append($spinner).one('click', function() {
        $spinner.addClass('active')
        $.get('/episodes/'+ p._id).done(function(allEpisodes) {
          $spinner.remove()
          $episodeHeader.click(toggleEpisodesOpen)
          renderEpisodes(allEpisodes)
          toggleEpisodesOpen()
        })
      })
    } else {
      $episodeHeader.empty().addClass('disabled').text('Ei jaksoja.')
      $episodes.remove()
    }

    $episodes.on('click', '.result', function(e) {
      e.stopPropagation()
      var $result = $(this)
      $result.siblings('.selected').removeClass('selected').next('.program-box').slideUp(function() { $(this).remove() }).end()
      if ($result.hasClass('selected')) {
        $result.removeClass('selected').next('.program-box').slideUp(function() { $(this).remove() }).end()
      } else {
        var p = $result.data('program')
        var $details = programBox().render(p)
        $result.addClass('selected').after($details)
        $details.slideDown().trigger('showDetails', p)
      }
    })

    function toggleEpisodesOpen() {
      $episodeHeader.toggleClass('open')
      $episodes.slideToggle()
    }

    function renderEpisodes(allEpisodes) {
      var grouped = _.groupBy(allEpisodes, 'season')
      var seasons = Object.keys(grouped).sort()
      seasons.forEach(function(season) {
        var episodes = grouped[season]
        $episodes.append($('<div>').addClass('season-header')
          .append($('<span>').text(season == 'undefined' ? 'Tuntematon tuotantokausi' : 'Tuotantokausi '+season))
          .append($('<span>').append(renderWarningSummary(classificationUtils.aggregateSummary(episodes)))))
          .append(episodes.map(function(p) {
            return $('<div>').addClass('result').data('id', p._id).data('program', p)
              .append($('<span>').text(utils.seasonEpisodeCode(p)))
              .append($('<span>').text(p.name[0]))
              .append($('<span>').text(utils.asDate(utils.getProperty(p, 'classifications.0.registrationDate'))))
              .append($('<span>').append(renderWarningSummary(classificationUtils.fullSummary(p)) || ' - '))
          }))
      })
    }
  }

  function renderClassifications($e, p) {
    if (p.classifications[0]) {
      var c = p.classifications[0]
      $e.find('.classification-container').html($classificationTemplates.normal.clone()).end()
        .find('.current-format').labeledText(enums.util.isGameType(p) && p.gameFormat || c.format).end()
        .find('.current-duration').labeledText(c.duration).end()
        .find('.classifications').html(classificationLinks()).end()
      renderClassification($e, p, c)
    } else {
      $e.find('.classification-container').html($classificationTemplates.empty.clone()).end()
        .find('.current-format, .current-duration').labeledText().end()
        .find('.comment-container').remove().end()
    }

    $e.find('.drafts').html(drafts()).end()
      .find('.episode-container').remove().end()

    $e.on('click', '.classification', function() {
      $(this).addClass('selected').siblings('.selected').removeClass('selected')
      renderClassification($e, p, $(this).data('classification'))
    })

    function classificationLinks() {
      return p.classifications.map(function(c, index) {
        var registrationDate = utils.asDateTime(c.registrationDate) || 'Tuntematon rekisteröintiaika'
        return $('<span>', { 'data-id': c._id }).addClass('classification').toggleClass('selected', index == 0).data('classification', c).text(registrationDate).prepend($('<i>').addClass('fa fa-play'))
      })
    }
    function drafts() {
      return _.values(p.draftClassifications || {}).map(function(draft) {
        return $draftTemplate.clone().attr('data-userId', draft.author._id)
          .find('b').text(draft.author.name + ' ('+draft.author.username+')').end()
          .find('span').text(utils.asDateTime(draft.creationDate)).end()
      })
    }
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
        .append($('<p>').text(renderCriteriaComments()))

      function renderCriteriaComments() {
        if (!hasRole('kavi') && utils.getProperty(c, 'author._id') !== user._id) return ''
        else return c.criteriaComments && c.criteriaComments[cr.id] || ''
      }
    })
  }
}

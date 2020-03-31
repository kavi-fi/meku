window.programBox = function () {
  const $detailTemplate = $('#templates > .program-box').clone()
  const $classificationTemplates = {
    normal: $('#templates > .program-box-normal-classification-details').clone(),
    tvSeries: $('#templates > .program-box-tv-series-classification-details').clone(),
    empty: $('#templates > .program-box-empty-classification-details').clone()
  }
  const $draftTemplate = $('#templates > .draft-notice').clone()

  return {render: render}

  function render(p, episodes) {
    const $e = renderProgram(p)
    enums.util.isTvSeriesName(p) ? renderTvSeries($e, p, episodes) : renderClassifications($e, p)
    return $e
  }

  function renderProgram(p) {
    const names = {n: join(p.name), fi: join(p.nameFi), sv: join(p.nameSv), other: join(p.nameOther)}
    const series = p.series && p.series.name || undefined
    const episode = utils.seasonEpisodeCode(p)
    const $details = $detailTemplate.clone()
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

    if (utils.getProperty(p, 'series._id')) $.get('/programs/' + p.series._id, function (s) {
      $details.find('.series').attr('href', '#haku/' + s.sequenceId + '//')
    })

    return $details
  }

  function join(arr) { return _.reject(arr, _.isEmpty).join(', ') }

  function renderTvSeries($e, p, preloadedEpisodes) {
    const summary = window.classificationUtils.fullSummary(p)
    $e.find('.classification-container').html($classificationTemplates.tvSeries.clone()).end()
      .find('.agelimit').attr('src', shared.ageLimitIcon(summary)).end()
      .find('.warnings').html(shared.warningIcons(summary)).end()
      .find('.current-duration, .current-format').labeledText().end()
      .find('.comment-container').remove().end()

    const $episodes = $e.find('.episodes')
    const $episodeHeader = $e.find('.episode-container > h3')
    if (p.episodes.count > 0) {
      if (preloadedEpisodes) {
        renderEpisodes(preloadedEpisodes)
        toggleEpisodesOpen(false)
        $episodeHeader.click(function () { toggleEpisodesOpen(true) })
      } else {
        const $spinner = shared.spinner()
        $episodeHeader.append(' ' + p.episodes.count + ' ' + shared.i18nText('kpl')).append($spinner).one('click', function () {
          $spinner.addClass('active')
          $.get('/episodes/' + p._id).done(function (allEpisodes) {
            $spinner.remove()
            $episodeHeader.click(function () { toggleEpisodesOpen(true) })
            renderEpisodes(allEpisodes)
            toggleEpisodesOpen(true)
          })
        })
      }
    } else {
      $episodeHeader.empty().addClass('disabled').i18nText('Ei jaksoja.')
      $episodes.remove()
    }

    $episodes.on('click', '.result', function (e) {
      shared.stopPropagation(e)
      const $result = $(this)
      $result.siblings('.selected').removeClass('selected').next('.program-box').slideUp(function () { $(this).remove() }).end()
      if ($result.hasClass('selected')) {
        $result.removeClass('selected').next('.program-box').slideUp(function () { $(this).remove() }).end()
      } else {
        const prg = $result.data('program')
        const $details = window.programBox().render(prg)
        $result.addClass('selected').after($details)
        $details.slideDown().trigger('showDetails', prg)
      }
    })

    function toggleEpisodesOpen(animate) {
      $episodeHeader.toggleClass('open')
      animate ? $episodes.slideToggle() : $episodes.toggle()
    }

    function renderEpisodes(allEpisodes) {
      const grouped = _.groupBy(allEpisodes, 'season')
      const seasons = _.sortBy(Object.keys(grouped), function (s) { return parseInt(s) })
      seasons.forEach(function (season) {
        const episodes = grouped[season]
        $episodes.append($('<div>').addClass('season-header')
          .append($('<span>').text(season === undefined ? shared.i18nText('Tuntematon tuotantokausi') : shared.i18nText('Tuotantokausi') + ' ' + season))
          .append($('<span>').append(shared.renderWarningSummary(window.classificationUtils.aggregateSummary(episodes)))))
          .append(episodes.map(function (prg) {
            return $('<div>').addClass('result').data('id', prg._id).data('program', prg)
              .append($('<span>').text(utils.seasonEpisodeCode(prg)))
              .append($('<span>').text(prg.name[0]))
              .append($('<span>').text(utils.asDate(utils.getProperty(prg, 'classifications.0.registrationDate'))))
              .append($('<span>').append(shared.renderWarningSummary(window.classificationUtils.fullSummary(prg)) || ' - '))
          }))
      })
    }
  }

  function renderClassifications ($e, p) {
    if (p.classifications[0]) {
      const c = p.classifications[0]
      $e.find('.classification-container').html($classificationTemplates.normal.clone()).end()
        .find('.current-format').labeledText(enums.util.isGameType(p) && p.gameFormat || c.format).end()
        .find('.current-duration').labeledText(c.duration).end()
        .find('.classifications').html(classificationLinks()).end()
      if (!window.user && enums.util.isGameType(p)) {
        $e.find('.current-duration').prev('label').remove();
        $e.find('.current-duration').remove();
      }
      renderClassification($e, p, c)
    } else {
      $e.find('.classification-container').html($classificationTemplates.empty.clone()).end()
        .find('.current-format, .current-duration').labeledText().end()
        .find('.comment-container').remove().end()
    }

    $e.find('.drafts').html(drafts()).end()
      .find('.episode-container').remove().end()

    $e.on('click', '.classification', function () {
      $(this).addClass('selected').siblings('.selected').removeClass('selected')
      renderClassification($e, p, $(this).data('classification'))
    })

    function classificationLinks() {
      return p.classifications.map(function (c, index) {
        const registrationDate = utils.asDate(c.registrationDate) || shared.i18nText('Tuntematon rekisteröintiaika')
        return $('<span>', {'data-id': c._id}).addClass('classification').toggleClass('selected', index === 0).data('classification', c).text(registrationDate).prepend($('<i>').addClass('fa fa-play'))
      })
    }
    function drafts() {
      return _.values(p.draftClassifications || {}).map(function (draft) {
        return $draftTemplate.clone().attr('data-userId', draft.author._id)
          .find('b').text(draft.author.name + (shared.hasRole('kavi') ? ' (' + draft.author.username + ')' : '')).end()
          .find('span').text(utils.asDateTime(draft.creationDate)).end()
      })
    }
  }

  function renderClassification($e, program, classification) {
    $.get('/classification/criteria').done(function (criteria) {
      renderClassificationWithStoredCriteria($e, program, classification, criteria)
    }).fail(function (err) { console.error(err.statusText) })
  }

  function renderClassificationWithStoredCriteria($e, program, classification, criteria) {
    const summary = window.classificationUtils.summary(classification)
    const showAuthor = !(enums.authorOrganizationIsElokuvalautakunta(classification) || enums.authorOrganizationIsKuvaohjelmalautakunta(classification) || enums.authorOrganizationIsKHO(classification))
    $e.find('.agelimit').attr('src', shared.ageLimitIcon(summary)).end()
      .find('.warnings').html(shared.warningIcons(summary)).end()
      .find('.reason').labeledText(utils.getProperty(enums.reclassificationReason[classification.reason], 'uiText')).end()
      .find('.author').labeledText(classification.author && showAuthor ? classification.author.name + (shared.hasRole('kavi') ? ' (' + classification.author.username + ')' : '') : '').end()
      .find('.authorOrganization').labeledText(enums.authorOrganization[classification.authorOrganization]).end()
      .find('.buyer').labeledText(classification.buyer && classification.buyer.name || '').end()
      .find('.billing').labeledText(classification.billing && classification.billing.name || '').end()
      .find('.format').labeledText(txtIfNotCurrent(enums.util.isGameType(program) && program.gameFormat || classification.format)).end()
      .find('.duration').labeledText(txtIfNotCurrent(classification.duration)).end()
      .find('.criteria').html(renderClassificationCriteria(classification, criteria)).end()
      .find('.comments').labeledText(classification.comments).end()
      .find('.userComments').labeledText(classification.userComments).end()
      .find('.publicComments').labeledText(classification.publicComments).end()
      .find('.commentHeader').toggle(!!(classification.comments || classification.userComments || classification.publicComments)).end()

    function txtIfNotCurrent(txt) { return program.classifications[0]._id === classification._id ? '' : txt }
  }

  function renderClassificationCriteria(classification, criteria) {
    if (!classification.criteria || classification.safe) return ''
    const lang = shared.langCookie()
    return classification.criteria.map(function (id) {
      const enumCriteria = enums.classificationCriteria[id - 1]
      if (enumCriteria.category === 'vet') return ''
      const storedCriteria = _.find(criteria, function (c) { return c.id === enumCriteria.id })
      const cr = storedCriteria ? storedCriteria : enumCriteria
      const category = enums.classificationCategoriesFI[enumCriteria.category]

      return $('<div>')
        .append($('<label>', {title: cr[lang].title + ': ' + $('<div>').html(cr[lang].description).text()}).text(shared.i18nText(category) + ' (' + cr.id + ')'))
        .append($('<p>').text(renderCriteriaComments()))

      function renderCriteriaComments() {
        if (!shared.hasRole('kavi') && utils.getProperty(classification, 'author._id') !== utils.getProperty(this, 'user._id')) return ''
        return classification.criteriaComments && classification.criteriaComments[cr.id] || ''
      }
    })
  }
}

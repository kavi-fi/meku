window.reportsPage = function () {
  const $page = $('#reports-page')
  const $datePicker = $page.find('.datepicker')
  const $spinner = shared.spinner().appendTo($page.find('.date-selection'))
  const $reportSelection = $page.find('.report-selection')
  const $report = $page.find('.report')

  const format = 'DD.MM.YYYY'
  const datePickerOpts = {shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month', 'year']}, customShortcuts: shared.yearShortcuts()}
  const latestAjax = meku.switchLatestDeferred()

  $page.on('show', function (e, reportName, begin, end) {
    if (reportName) {
      setSelectedReport($reportSelection.find('div[data-name="' + reportName + '"]'))
    }
    const range = begin && end
      ? {begin: moment(begin, format), end: moment(end, format)}
      : {begin: moment().subtract(1, 'months').startOf('month'), end: moment().subtract(1, 'months').endOf('month')}
    meku.setDatePickerSelection($datePicker, range, update)
  })

  shared.setupDatePicker($datePicker, datePickerOpts, update, true)

  $reportSelection.find('div').click(function () {
    setSelectedReport($(this))
    update()
  })

  function setSelectedReport($selected) {
    $reportSelection.find('.selected').removeClass('selected')
    $selected.addClass('selected')
  }

  function update() {
    const reportName = $reportSelection.find('.selected').data('name')
    const range = $datePicker.data('selection')
    updateLocation(reportName, range)
    latestAjax($.get('/report/' + reportName, $.param(range)), $spinner).done(function (report) {
      render(reportName, report)
    })
  }

  function updateLocation(reportName, stringRange) {
    shared.setLocation('#raportit/' + reportName + '/' + stringRange.begin + '/' + stringRange.end)
  }

  function render(reportName, report) {
    if (reportName === 'durations') {
      renderDurations(report)
    } else if (reportName === 'kaviDurations') {
      renderKaviDurations(report)
    } else if (reportName === 'kaviClassificationList') {
      renderKaviClassificationList(report)
    } else {
      renderDefaultReport(reportName, report)
    }
  }

  function renderDurations(report) {
    const $table = $('#templates > .report-durations-table').clone()
    const $rowTemplate = $table.find('tbody tr').clone()
    $table.find('thead .id').text($reportSelection.find('.selected').text())
    const $tbody = $table.find('tbody').empty()
    $tbody.append((report || []).map(renderRow))

    function renderRow(row) {
      return $rowTemplate.clone()
        .find('.id').text(enums.programType[row._id].fi).end()
        .find('.count').text(row.count).end()
        .find('.duration').text(window.classificationUtils.secondsToDuration(row.value)).end()
    }
    $report.html($table)
  }
  function renderKaviDurations(report) {
    const $table = $('#templates > .report-kavi-durations-table').clone()
    $table.find('thead .id').text($reportSelection.find('.selected').text())
    fillRow($table.find('tr.classifications'), report.classifications)
    fillRow($table.find('tr.reclassifications'), report.reclassifications)
    fillRow($table.find('tr.kavi'), report.kavi)
    fillRow($table.find('tr.other'), report.other)
    fillRow($table.find('tr.unknown'), report.unknown)
    $report.html($table)

    function fillRow($row, data) {
      const d = data ? data : {count: 0, duration: 0}
      $row
        .find('.count').text(d.count).end()
        .find('.duration').text(window.classificationUtils.secondsToDuration(d.duration)).end()
    }
  }

  function renderKaviClassificationList(report) {
    const $table = $('#templates > .report-classification-list-table').clone()
    const $rowTemplate = $table.find('tbody tr').clone()
    const $tbody = $table.find('tbody').empty()
    const totalDuration = report.reduce(function (acc, row) { return acc + window.classificationUtils.durationToSeconds(row.duration) }, 0)

    $table.find('thead .id').text($reportSelection.find('.selected').text())
    $table.find('thead .duration').text('Kesto ' + window.classificationUtils.secondsToDuration(totalDuration))
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      const href = '#haku/' + row.sequenceId + '//' + row._id
      return $rowTemplate.clone()
        .find('.id').html($('<a>', {href: href, target: '_blank'}).text(row.name[0])).end()
        .find('.sequenceId').text(row.sequenceId).end()
        .find('.programType').text(enums.programType[row.programType].fi).end()
        .find('.date').text(moment(row.date).format(format)).end()
        .find('.author').text(authorColumn(row)).end()
        .find('.duration').text(row.duration).end()
        .find('.type').text(row.isReclassification ? 'Uudelleenluokittelu' : 'Luokittelu').end()
        .find('.kaviType').text(utils.getProperty(enums.kaviType[row.kaviType], 'uiText')).end()
        .find('.reason').text(row.isReclassification ? utils.getProperty(enums.reclassificationReason[row.reason], 'uiText') || 'Ei tiedossa' : '').end()
        .find('.buyer').text(row.buyer ? row.buyer.name : '').end()
        .find('.comments').text(row.comments).end()
    }
  }

  function authorColumn(c) {
    return enums.authorOrganizationIsElokuvalautakunta(c) || enums.authorOrganizationIsKuvaohjelmalautakunta(c) || enums.authorOrganizationIsKHO(c) ? enums.authorOrganization[c.authorOrganization] : c.author
  }

  function renderDefaultReport(reportName, report) {
    const idMapper = idMappers[reportName] || function (id) { return id || 'Ei tiedossa' }
    const $table = $('#templates > .report-table').clone()
    const $rowTemplate = $table.find('tbody tr').clone()

    const $tbody = $table.find('tbody').empty()
    $table.find('thead .id').text($reportSelection.find('.selected').text())

    const total = report.reduce(function (acc, row) { return acc + row.value }, 0)
    $table.find('thead .count').text(total)
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      return $rowTemplate.clone()
        .find('.id').text(idMapper(row._id)).end()
        .find('.count').text(row.value).end()
        .find('.percent').text((row.value * 100 / total).toFixed(2)).end()
    }
  }

  const idMappers = {
    programType: function (id) { return enums.programType[id].fi },
    agelimit: agelimitMapper,
    kaviAgelimit: agelimitMapper,
    warnings: warningMapper,
    agelimitChanges: agelimitChangeMapper,
    kaviAgelimitChanges: agelimitChangeMapper,
    kaviReclassificationReason: function (id) { return utils.getProperty(enums.reclassificationReason[id], 'uiText') || 'Ei tiedossa' }
  }

  function agelimitMapper(id) {
    return id === null || id === undefined ? 'Ei tiedossa' : window.classificationUtils.ageAsText(id)
  }
  function warningMapper(id) {
    if (id === '-') return 'Ei varoituksia'
    return enums.warnings[id]
      ? enums.warnings[id] + ' yksin'
      : enums.warnings[id.substring(0, id.length - 1)] + ' muita'
  }

  function agelimitChangeMapper(id) {
    if (id === 'up') return 'Nousi'
    if (id === 'down') return 'Laski'
    return 'Pysyi'
  }
}

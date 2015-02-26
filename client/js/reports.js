function reportsPage() {
  var $page = $('#reports-page')
  var $datePicker = $page.find('.datepicker')
  var $spinner = spinner().appendTo($page.find('.date-selection'))
  var $reportSelection = $page.find('.report-selection')
  var $report = $page.find('.report')

  var format = 'DD.MM.YYYY'
  var datePickerOpts = { shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month', 'year'] }, customShortcuts: yearShortcuts() }
  var latestAjax = switchLatestDeferred()

  $page.on('show', function(e, reportName, begin, end) {
    if (reportName) {
      setSelectedReport($reportSelection.find('div[data-name="'+reportName+'"]'))
    }
    var range = (begin && end)
      ? { begin: moment(begin, format), end: moment(end, format) }
      : { begin: moment().subtract(1, 'months').startOf('month'), end: moment().subtract(1, 'months').endOf('month') }
    setDatePickerSelection($datePicker, range, update)
  })

  setupDatePicker($datePicker, datePickerOpts, update, true)

  $reportSelection.find('div').click(function() {
    setSelectedReport($(this))
    update()
  })

  function setSelectedReport($selected) {
    $reportSelection.find('.selected').removeClass('selected')
    $selected.addClass('selected')
  }

  function update() {
    var reportName = $reportSelection.find('.selected').data('name')
    var range = $datePicker.data('selection')
    updateLocation(reportName, range)
    latestAjax($.get('/report/' + reportName, $.param(range)), $spinner).done(function(report) {
      render(reportName, report)
    })
  }

  function updateLocation(reportName, stringRange) {
    setLocation('#raportit/'+reportName+'/'+stringRange.begin+'/'+stringRange.end)
  }

  function render(reportName, report) {
    if (reportName == 'kaviDurations') {
      renderKaviDurations(report)
    } else if (reportName == 'kaviClassificationList') {
      renderKaviClassificationList(report)
    } else {
      renderDefaultReport(reportName, report)
    }
  }

  function renderKaviDurations(report) {
    var $table = $('#templates > .report-kavi-durations-table').clone()
    $table.find('thead .id').text($reportSelection.find('.selected').text())
    fillRow($table.find('tr.classifications'), report.classifications)
    fillRow($table.find('tr.reclassifications'), report.reclassifications)
    fillRow($table.find('tr.kavi'), report.kavi)
    fillRow($table.find('tr.other'), report.other)
    fillRow($table.find('tr.unknown'), report.unknown)
    $report.html($table)

    function fillRow($row, data) {
      if (!data) data = { count: 0, duration: 0 }
      $row
        .find('.count').text(data.count).end()
        .find('.duration').text(classificationUtils.secondsToDuration(data.duration)).end()
    }
  }

  function renderKaviClassificationList(report) {
    var $table = $('#templates > .report-classification-list-table').clone()
    var $rowTemplate = $table.find('tbody tr').clone()
    var $tbody = $table.find('tbody').empty()
    var totalDuration = report.reduce(function(acc, row) {
      return acc + classificationUtils.durationToSeconds(row.duration)
    }, 0)

    $table.find('thead .id').text($reportSelection.find('.selected').text())
    $table.find('thead .duration').text('Kesto ' + classificationUtils.secondsToDuration(totalDuration))
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      var href = '#haku/'+row.sequenceId+'//'+row._id
      return $rowTemplate.clone()
        .find('.id').html($('<a>', { href: href, target:'_blank' }).text(row.name[0])).end()
        .find('.sequenceId').text(row.sequenceId).end()
        .find('.programType').text(enums.programType[row.programType].fi).end()
        .find('.date').text(moment(row.date).format(format)).end()
        .find('.author').text(row.author).end()
        .find('.duration').text(row.duration).end()
        .find('.type').text(row.isReclassification ? 'Uudelleenluokittelu' : 'Luokittelu').end()
        .find('.comments').text(row.comments).end()
    }
  }

  function renderDefaultReport(reportName, report) {
    var idMapper = idMappers[reportName] || function(id) { return id || 'Ei tiedossa' }
    var $table = $('#templates > .report-table').clone()
    var $rowTemplate = $table.find('tbody tr').clone()

    var $tbody = $table.find('tbody').empty()
    $table.find('thead .id').text($reportSelection.find('.selected').text())

    var total = report.reduce(function(acc, row) { return acc + row.value }, 0)
    $table.find('thead .count').text(total)
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      return $rowTemplate.clone()
        .find('.id').text(idMapper(row._id)).end()
        .find('.count').text(row.value).end()
        .find('.percent').text(((row.value * 100) / total).toFixed(2)).end()
    }
  }

  var idMappers = {
    programType: function(id) { return enums.programType[id].fi },
    agelimit: agelimitMapper,
    kaviAgelimit: agelimitMapper,
    warnings: warningMapper,
    agelimitChanges: agelimitChangeMapper,
    kaviAgelimitChanges: agelimitChangeMapper,
    kaviReclassificationReason: function(id) { return utils.getProperty(enums.reclassificationReason[id], 'uiText') || 'Ei tiedossa' }
  }

  function agelimitMapper(id) {
    return id == null ? 'Ei tiedossa' : classificationUtils.ageAsText(id)
  }
  function warningMapper(id) {
    if (id == '-') return 'Ei varoituksia'
    return enums.warnings[id]
      ? enums.warnings[id] + ' yksin'
      : enums.warnings[id.substring(0, id.length - 1)] + ' muita'
  }

  function agelimitChangeMapper(id) {
    if (id == 'up') return 'Nousi'
    if (id == 'down') return 'Laski'
    return 'Pysyi'
  }
}

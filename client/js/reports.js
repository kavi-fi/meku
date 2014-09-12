function reportsPage() {
  var $page = $('#reports-page')
  var $datePicker = $page.find('.datepicker')
  var $spinner = spinner().appendTo($page.find('.date-selection'))
  var $reportSelection = $page.find('.report-selection')
  var $report = $page.find('.report')

  var $defaultReportTemplate = $('#templates > .report-table').clone()
  var $defaultRowTemplate = $defaultReportTemplate.find('tbody tr').clone()

  var $classificationListTemplate = $('#templates > .report-classification-list-table').clone()
  var $classificationListRowTemplate = $classificationListTemplate.find('tbody tr').clone()

  var format = 'DD.MM.YYYY'
  var latestAjax = switchLatestDeferred()

  $page.on('show', function(e, reportName, begin, end) {
    if (reportName) {
      setSelectedReport($reportSelection.find('div[data-name="'+reportName+'"]'))
    }
    var range = (begin && end)
      ? { begin: moment(begin, format), end: moment(end, format) }
      : { begin: moment().subtract(1, 'months').startOf('month'), end: moment().subtract(1, 'months').endOf('month') }
    var rangeAsString = stringDateRange(range)
    $datePicker.data('dateRangePicker').setDateRange(rangeAsString.begin, rangeAsString.end)
    if (!$datePicker.data('dateRangePicker').isInitiated()) {
      $datePicker.data('selection', rangeAsString)
      update()
    }
  })

  $datePicker.dateRangePicker({
    language: 'fi',
    format: format,
    separator: ' - ',
    startOfWeek: 'monday',
    shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month', 'year']},
    getValue: function() { return $datePicker.find('span').text() },
    setValue: function(s) { $datePicker.find('span').text(s) }
  }).bind('datepicker-change',function(event, obj) {
    var selection = stringDateRange({ begin: moment(obj.date1), end: moment(obj.date2) })
    if (!_.isEqual(selection, $datePicker.data('selection'))) {
      $datePicker.data('selection', selection)
      update()
    }
  })

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

  function stringDateRange(range) {
    return { begin: range.begin.format(format), end: range.end.format(format) }
  }

  function render(reportName, report) {
    if (reportName == 'kaviClassificationList') {
      renderKaviClassificationList(report)
    } else {
      renderDefaultReport(reportName, report)
    }
  }

  function renderKaviClassificationList(report) {
    var $table = $classificationListTemplate.clone()
    var $tbody = $table.find('tbody').empty()
    var totalDuration = report.reduce(function(acc, row) {
      if (row.duration.indexOf(' ') != -1) console.log(row)
      return acc + classificationUtils.durationToSeconds(row.duration)
    }, 0)

    $table.find('thead .id').text($reportSelection.find('.selected').text())
    $table.find('thead .duration').text('Kesto ' + classificationUtils.secondsToDuration(totalDuration))
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      var href = '#haku/'+row.sequenceId+'//'+row._id
      return $classificationListRowTemplate.clone()
        .find('.id').html($('<a>', { href: href, target:'_blank' }).text(row.name[0])).end()
        .find('.sequenceId').text(row.sequenceId).end()
        .find('.programType').text(enums.programType[row.programType].fi).end()
        .find('.date').text(moment(row.date).format(format)).end()
        .find('.duration').text(row.duration).end()
        .find('.comments').text(row.comments).end()
    }
  }

  function renderDefaultReport(reportName, report) {
    var idMapper = idMappers[reportName] || function(id) { return id || 'Ei tiedossa' }
    var $table = $defaultReportTemplate.clone()
    var $tbody = $table.find('tbody').empty()
    $table.find('thead .id').text($reportSelection.find('.selected').text())

    var total = report.reduce(function(acc, row) { return acc + row.value }, 0)
    $table.find('thead .count').text(total)
    $tbody.append((report || []).map(renderRow))
    $report.html($table)

    function renderRow(row) {
      return $defaultRowTemplate.clone()
        .find('.id').text(idMapper(row._id)).end()
        .find('.count').text(row.value).end()
        .find('.percent').text(((row.value * 100) / total).toFixed(2)).end()
    }
  }

  var idMappers = {
    programType: function(id) { return enums.programType[id].fi },
    agelimit: classificationUtils.ageAsText,
    kaviAgelimit: classificationUtils.ageAsText,
    warnings: warningMapper,
    agelimitChanges: agelimitChangeMapper,
    kaviAgelimitChanges: agelimitChangeMapper
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

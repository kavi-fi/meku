window.billingPage = function () {
  const $page = $('#billing-page')
  const $datePicker = $page.find('.datepicker')
  const $kiekuButton = $page.find('button')
  const $accounts = $page.find('.accounts')
  const $noResults = $page.find('.no-results')
  const detailRenderer = window.programBox()
  const datePickerOpts = {shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']}, customShortcuts: shared.yearShortcuts()}
  const format = 'DD.MM.YYYY'
  const $spinner = shared.spinner().appendTo($page.find('.date-selection'))
  const latestAjax = meku.switchLatestDeferred()

  $page.on('click', 'input[name=invoiceId]', function () {
    updateSum($(this).parents('.rows'))
    $(this).parents('tr').toggleClass('deselected', !$(this).prop('checked'))
    toggleLoadButton()
  })

  $page.on('click', 'input[name="account-select"]', function () {
    const check = $(this).prop('checked')
    const $rows = $(this).parent().find('.rows')
    $rows.find('input[name=invoiceId]').prop('checked', check)
    $rows.find('tbody tr').toggleClass('deselected', !check)
    updateSum($rows)
    toggleLoadButton()
  })

  $page.on('click', '.rows .name', function () {
    const $row = $(this).parents('tr')
    if ($row.hasClass('selected')) {
      closeDetail()
    } else {
      closeDetail()
      $.get('/programs/' + $(this).data('id')).done(function (p) { openDetail($row, p) })
    }
  })

  $page.find('form').submit(function () {
    $kiekuButton.prop('disabled', true)
    setTimeout(function () { $kiekuButton.prop('disabled', false) }, 4000)
  })

  shared.setupDatePicker($datePicker, datePickerOpts, fetchInvoiceRows, true)

  function fetchInvoiceRows(range) {
    shared.setLocation('#laskutus/' + range.begin + '/' + range.end)
    latestAjax($.get('/invoicerows/' + range.begin + '/' + range.end), $spinner).done(function (invoiceRows) {
      $page.find('input[name=begin]').val(range.begin)
      $page.find('input[name=end]').val(range.end)
      $accounts.empty()
      $noResults.toggle(invoiceRows.length === 0)
      _(invoiceRows).groupBy(function (x) { return x.account.name }).toPairs().sortBy(function (t) { return t[0] }).value().forEach(function (account) {
        const name = account[0]
        const rows = account[1]
        const $account = $("#templates").find('.invoice-account').clone()
        const $rows = $account.find('table')
        $account.find('.name').text(name)
        rows.forEach(function (row) {
          const $row = $("#templates").find('.invoicerow tr').clone()
          $row.data(row)
            .find('input[type=checkbox]').val(row._id).end()
            .find('.type').text(window.enums.invoiceRowType[row.type]).end()
            .find('.name').text(row.name).data('id', row.program).end()
            .find('.duration').text(window.utils.secondsToDuration(row.duration)).end()
            .find('.registrationDate').text(moment(row.registrationDate).format(format)).end()
            .find('.price').text(formatCentsAsEuros(row.price)).end()
          $rows.find('tbody').append($row)
        })
        updateSum($rows)
        $accounts.append($account)
      })
      toggleLoadButton()
    })
  }

  function toggleLoadButton() {
    $kiekuButton.toggle($page.find('.rows input[type=checkbox]:checked').length > 0)
  }

  function updateSum($rows) {
    const sum = $rows.find('input[name=invoiceId]:checked').parents('tr').map(function () { return $(this).data().price }).toArray().reduce(function (a, b) { return a + b }, 0)
    $rows.find('tfoot span').text(formatCentsAsEuros(sum))
  }

  function formatCentsAsEuros(cents) {
    return (cents / 100).toFixed(2) + ' €'
  }

  function openDetail($row, program) {
    const $detail = detailRenderer.render(program)
    $row.addClass('selected').after($detail)
    $detail.wrap('<tr><td colspan="6" class="program-box-container"></td></tr>').slideDown()
  }

  function closeDetail() {
    $accounts.find('.rows tr.selected').removeClass('selected')
    $accounts.find('.program-box').slideUp(function () { $(this).parents('.program-box-container').remove() }).end()
  }

  $page.on('show', function (e, begin, end) {
    $page.find('form input[name=_csrf]').val($.cookie('_csrf_token'))
    const range = begin && end
      ? {begin: moment(begin, format), end: moment(end, format)}
      : {begin: moment().subtract(1, 'months').startOf('month'), end: moment().subtract(1, 'months').endOf('month')}
    meku.setDatePickerSelection($datePicker, range, fetchInvoiceRows)
  })
}

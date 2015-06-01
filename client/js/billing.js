function billingPage() {
  var $page = $('#billing-page')
  var $datePicker = $page.find('.datepicker')
  var $kiekuButton = $page.find('button')
  var $accounts = $page.find('.accounts')
  var $noResults = $page.find('.no-results')
  var detailRenderer = programBox()
  var datePickerOpts = { shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']}, customShortcuts: yearShortcuts() }
  var format = 'DD.MM.YYYY'
  var $spinner = spinner().appendTo($page.find('.date-selection'))
  var latestAjax = switchLatestDeferred()

  $page.on('click', 'input[name=invoiceId]', function() {
    updateSum($(this).parents('.rows'))
    $(this).parents('tr').toggleClass('deselected', !$(this).prop('checked'))
    toggleLoadButton()
  })

  $page.on('click', 'input[name="account-select"]', function() {
    var check = $(this).prop('checked')
    var $rows = $(this).parent().find('.rows')
    $rows.find('input[name=invoiceId]').prop('checked', check)
    $rows.find('tbody tr').toggleClass('deselected', !check)
    updateSum($rows)
    toggleLoadButton()
  })

  $page.on('click', '.rows .name', function() {
    var $row = $(this).parents('tr')
    if ($row.hasClass('selected')) {
      closeDetail()
    } else {
      closeDetail()
      $.get('/programs/' + $(this).data('id')).done(function (p) { openDetail($row, p) })
    }
  })

  $page.find('form').submit(function() {
    $kiekuButton.prop('disabled', true)
    setTimeout(function() { $kiekuButton.prop('disabled', false) }, 4000)
  })

  setupDatePicker($datePicker, datePickerOpts, fetchInvoiceRows)

  function fetchInvoiceRows(range) {
    setLocation('#laskutus/'+range.begin+'/'+range.end)
    latestAjax($.get('/invoicerows/' + range.begin + '/' + range.end), $spinner).done(function(rows) {
      $page.find('input[name=begin]').val(range.begin)
      $page.find('input[name=end]').val(range.end)
      var $accounts = $page.find('.accounts').empty()
      $noResults.toggle(rows.length == 0)
      _(rows).groupBy(function(x) { return x.account.name }).pairs().sortBy(function(t) { return t[0] }).forEach(function(account) {
        var name = account[0]
        var rows = account[1]
        var $account = $("#templates").find('.invoice-account').clone()
        var $rows = $account.find('table')
        $account.find('.name').text(name)
        rows.forEach(function(row) {
          var $row = $("#templates").find('.invoicerow tr').clone()
          $row.data(row)
            .find('input[type=checkbox]').val(row._id).end()
            .find('.type').text(enums.invoiceRowType[row.type]).end()
            .find('.name').text(row.name).data('id', row.program).end()
            .find('.duration').text(utils.secondsToDuration(row.duration)).end()
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
    var sum = $rows.find('input[name=invoiceId]:checked').parents('tr').map(function() { return $(this).data().price }).toArray().reduce(function(a,b) { return a + b }, 0)
    $rows.find('tfoot span').text(formatCentsAsEuros(sum))
  }

  function formatCentsAsEuros(cents) {
    return (cents / 100).toFixed(2) + ' €'
  }

  function openDetail($row, program) {
    var $detail = detailRenderer.render(program)
    $row.addClass('selected').after($detail)
    $detail.wrap('<tr><td colspan="6" class="program-box-container"></td></tr>').slideDown()
  }

  function closeDetail() {
    $accounts.find('.rows tr.selected').removeClass('selected')
    $accounts.find('.program-box').slideUp(function() { $(this).parents('.program-box-container').remove() }).end()
  }

  $page.on('show', function(e, begin, end) {
    $page.find('form input[name=_csrf]').val($.cookie('_csrf_token'))
    var range = (begin && end)
      ? { begin: moment(begin, format), end: moment(end, format) }
      : { begin: moment().subtract(1, 'months').startOf('month'), end: moment().subtract(1, 'months').endOf('month') }
    setDatePickerSelection($datePicker, range, fetchInvoiceRows)
  })
}

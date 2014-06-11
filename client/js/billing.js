function billingPage() {
  var $page = $('#billing-page')
  var $datePicker = $page.find('.datepicker')
  var $proeButton = $page.find('button')
  var $accounts = $page.find('.accounts')
  var detailRenderer = programBox()
  var format = 'DD.MM.YYYY'

  $page.on('click', 'input[name=invoiceId]', toggleLoadButton)

  $page.on('click', 'input[name="account-select"]', function() {
    $(this).parent().find('.rows input[name=invoiceId]').prop('checked', $(this).prop('checked'))
    toggleLoadButton()
  })

  $page.on('click', '.name', function() {
    var $row = $(this).parents('tr')
    if ($row.hasClass('selected')) {
      closeDetail()
    } else {
      closeDetail()
      $.get('/programs/' + $(this).data('id')).done(function (p) { openDetail($row, p) })
    }
  })

  $datePicker.dateRangePicker({
    language: 'fi',
    format: format,
    separator: ' - ',
    startOfWeek: 'monday',
    shortcuts: {'next-days': null, 'next': null, 'prev-days': null, prev: ['month']},
    getValue: function() { return $datePicker.find('span').text() },
    setValue: function(s) { $datePicker.find('span').text(s) }
  }).bind('datepicker-change',function(event, obj) {
    fetchInvoiceRows(obj.date1, obj.date2)
  })

  function toggleLoadButton() {
    $proeButton.toggle($page.find('.rows input[type=checkbox]:checked').length > 0)
  }

  function fetchInvoiceRows(date1, date2) {
    var begin = moment(date1).format(format)
    var end = moment(date2).format(format)
    location.hash = '#laskutus/'+begin+'/'+end
    $.get('/invoicerows/' + begin + '/' + end).done(function(rows) {
      $page.find('input[name=begin]').val(begin)
      $page.find('input[name=end]').val(end)
      var $accounts = $page.find('.accounts').empty()

      _(rows).groupBy(function(x) { return x.account.name }).pairs().sortBy(function(t) { return t[0] }).forEach(function(account) {
        var name = account[0]
        var rows = account[1]
        var $account = $("#templates").find('.invoice-account').clone()
        var $rows = $account.find('table')
        $account.find('.name').text(name)
        rows.forEach(function(row) {
          var $row = $("#templates").find('.invoicerow tr').clone()
          $row
            .find('input[type=checkbox]').val(row._id).end()
            .find('.type').text(enums.invoiceRowType[row.type]).end()
            .find('.name').text(row.name).data('id', row.program).end()
            .find('.duration').text(utils.secondsToDuration(row.duration)).end()
            .find('.registrationDate').text(moment(row.registrationDate).format(format)).end()
            .find('.price').text(formatCentsAsEuros(row.price)).end()
          $rows.find('tbody').append($row)
        })
        $rows.find('tfoot span').text(formatCentsAsEuros(_.reduce(rows, function(acc, row) { return acc + row.price }, 0)))
        $accounts.append($account)
      })
      toggleLoadButton()
    })
  }

  function formatCentsAsEuros(cents) {
    return cents / 100 + ' €'
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
    if (begin && end) {
      begin = moment(begin, format)
      end = moment(end, format)
    } else {
      begin = moment().subtract('months', 1).startOf('month')
      end = moment().subtract('months', 1).endOf('month')
    }
    $datePicker.data('dateRangePicker').setDateRange(begin.format(format), end.format(format))
    fetchInvoiceRows(begin, end)
  })
}

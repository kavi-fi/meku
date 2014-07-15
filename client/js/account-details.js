function accountDetailsRenderer() {

  return { render: render }

  function render(account) {
    var $detailTemplate = $('#templates').find('.account-details').clone()

    $detailTemplate
      .find('input[name=name]').val(account.name).end()
      .find('input[name=yTunnus]').val(account.yTunnus).end()
      .find('input[name=street]').val(account.billing.street).end()
      .find('input[name=zip]').val(account.billing.zip).end()
      .find('input[name=city]').val(account.billing.city).end()
      .find('input[name=country]').val(account.billing.country).end()

    return $detailTemplate
  }
}

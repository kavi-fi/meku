function accountDetailsRenderer() {

  return { render: render }

  function render(account) {
    var $detailTemplate = $('#templates').find('.account-details').clone()

    $detailTemplate
      .find('input[name=name]').val(account.name).end()
      .find('input[name=yTunnus]').val(account.yTunnus).end()
      .find('input[name=street]').val(account.address.street).end()
      .find('input[name=zip]').val(account.address.zip).end()
      .find('input[name=city]').val(account.address.city).end()
      .find('input[name=country]').val(account.address.country).end()
      .find('input[name=contactName]').val(account.contactName).end()
      .find('input[name=phoneNumber]').val(account.phoneNumber).end()
      .find('input[name=emails]').val(account.emailAddresses).select2({
        tags: account.emailAddresses,
        multiple: true
      }).end()

    return $detailTemplate
  }
}

describe('Providers', () => {
  it('uploading providers via empty excel file is rejected with validation errors', () => {
    cy.visit('/register-provider.html')
    const filepath = 'tarjoajaksi-ilmoittautuminen-missing-params.xls'
    cy.get('input[type=file]').attachFile(filepath)
    cy.getDataCy("providerFile-submit").click()
    cy.getDataCy("validation-feedback").should("be.visible")
    cy.getDataCy("validation-errors").should("have.text", "Rivillä 66. Tarjoajan tiedot: pakollinen kenttä \"Nimi\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"Y-tunnus\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"yhteyshenkilö\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"lähiosoite\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"postinro\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"postitoimipaikka\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"maa\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"puhelinnumero\" puuttuuRivillä 66. Tarjoajan tiedot: pakollinen kenttä \"asiointikieli\" puuttuuTarjoamispaikkojen tiedot puuttuvat")
  })
  it('uploading providers with valid excel file succeeds', () => {
    cy.visit('/register-provider.html')
    const filepath = 'tarjoajaksi-ilmoittautuminen-full-params.xls'
    cy.get('input[type=file]').attachFile(filepath)
    cy.getDataCy("providerFile-submit").click()
    cy.getDataCy("validation-feedback").should("not.be.visible")
    cy.getDataCy("validation-errors").should("be.empty")
    cy.getDataCy("error").should("not.be.visible")
    cy.getDataCy("success").should("be.visible")
  })
})

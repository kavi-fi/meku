describe('Subscribers', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('root', 'root')
  })

  it('search result total is shown', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '4')
  })

  it('should inactivate subscriber', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '4')
    //remove DEMO tilaaja 4 account
    cy.getDataCy('result').eq(3).click()
    cy.getDataCy('inactivate-subscriber-button:first').click()
    cy.getDataCy('inactivate-subscriber-dialog').should('be.visible')
    cy.getDataCy('inactivate-subscriber-dialog:last buttons confirm-inactivate').click()
    cy.getDataCy('result').eq(3).should('have.class', 'inactive')
    cy.getDataCy('subcriber-result-count').should('have.text', '3')
  })

  it('inactivated subscribers should not show in classification buyer and billing options', () => {
    cy.visit("#haku/")
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls create').click()
    cy.select2one('#classification-page .select2-container.x-buyer', 'DEMO tilaaja 4')
    cy.get('#classification-page .select2-container.x-buyer').should('not.contain', 'DEMO tilaaja 3')
    cy.closeSelect2()
    cy.select2one('#classification-page .select2-container.x-billing', 'DEMO tilaaja 4')
    cy.get('#classification-page .select2-container.x-billing').should('not.contain', 'DEMO tilaaja 3')
  })

  it('adding a subscriber is possible', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '3')
    cy.getDataCy('new-subscriber-button').click()
    cy.getDataCy('save-subscriber-button:visible').should('be.disabled')
    cy.getDataCy('subscriber-checkbox:visible').click()
    cy.getDataCy('kieku-number-input:visible').type("123")
    cy.getDataCy('name-input:visible').type("testifirma")
    cy.getDataCy('ytunnus-input:visible').type("123")
    cy.getDataCy('ssn-input:visible').type("123")
    cy.getDataCy('address-input:visible').type("testikatu 1")
    cy.getDataCy('zip-input:visible').type("00550")
    cy.getDataCy('city-input:visible').type("testikaupunki")
    cy.select2one('.select2-container.x-country', 'Suomi')
    cy.getDataCy('phoneNumber-input:visible').type("123567890")
    cy.select2('.select2-container.x-emailaddresses', 'test@example.com')
    cy.getDataCy('save-subscriber-button:visible').should('be.enabled')
    cy.getDataCy('save-subscriber-button:visible').click()
    cy.getDataCy('subcriber-result-count').should('have.text', '4')
  })
})


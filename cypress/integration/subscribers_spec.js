describe('Subscribers', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('root', 'root')
  })

  it('search result total is shown', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '3')
  })

  it('should inactivate subscriber', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '3')
    cy.getDataCy('result').eq(2).click()
    cy.getDataCy('inactivate-subscriber-button:first').click()
    cy.getDataCy('inactivate-subscriber-dialog').should('be.visible')
    cy.getDataCy('inactivate-subscriber-dialog:last buttons confirm-inactivate').click()
    cy.getDataCy('result').eq(2).should('have.class', 'inactive')
    cy.getDataCy('subcriber-result-count').should('have.text', '2')
  })

  it('inactivated subscribers should not show in classification buyer and billing options', () => {
    cy.visit("#haku/")
    cy.get('a[href="#haku"].active').should('be.visible')
    cy.getDataCy('search-page controls create').click()
    cy.select2one('#classification-page .select2-container.x-buyer', 'DEMO tilaaja 3')
    cy.get('#classification-page .select2-container.x-buyer').should('not.contain', 'DEMO tilaaja 3')
    cy.closeSelect2()
    cy.select2one('#classification-page .select2-container.x-billing', 'DEMO tilaaja 3')
    cy.get('#classification-page .select2-container.x-billing').should('not.contain', 'DEMO tilaaja 3')
  })
})


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
    //TODO: verify users are removed
    cy.getDataCy('subcriber-result-count').should('have.text', '2')
  })
})
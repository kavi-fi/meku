describe('Subscribers', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('root', 'root')
  })

  it('search result total is shown', () => {
    cy.visit("#tilaajat/")
    cy.getDataCy('subcriber-result-count').should('have.text', '3')
  })
})
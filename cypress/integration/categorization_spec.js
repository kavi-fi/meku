describe('Categorization', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.login('user', 'user')
  })

  it('can categorize as USER', () => {
    cy.getDataCy('search-page').should('be.visible')
    cy.getDataCy('results result:first name').should('have.text', 'The Cirkus')
    cy.getDataCy('results result:first duration-or-game').should('have.text', '')
    cy.getDataCy('results result:first program-type').should('have.text', '')
    cy.getDataCy('results result:first agelimit').should('have.attr', 'src').and('include', 'images/agelimit-0.png')
    cy.getDataCy('results result:first country-year-date').should('have.text', '(26.1.1955, Serbia ja Montenegro / Tsekkoslovakia)')
    cy.getDataCy('results program-box categorize').click()
    cy.select2one('#search-page .categorization-form .select2-container.x-category-select', 'trai')
    cy.getDataCy('results program-box save-category').click()
    cy.getDataCy('results result:first program-type').should('have.text', 'Traileri')
  })
})

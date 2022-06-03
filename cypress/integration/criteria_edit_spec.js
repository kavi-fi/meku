describe('Classification criteria editor', () => {
  describe("as admin user", () => {
    beforeEach(() => {
      cy.visit('/')
      cy.login('root', 'root')
      cy.get('.logout').should('be.visible')
      cy.visit('/classification-criteria.html')
    })

    it('allows updating category descriptions and instructions', () => {
      const texts = [
        {lang: 'fi', texts: ['Uusi kuvaus kategorialle 1', 'Uusi ohje kategorialle 1']},
        {lang: 'sv', texts: ['Ny beskrivning till kategori 1', 'Nya instruktioner för kategori 1']}
      ]
      texts.forEach((txt) => {
        cy.get(`[data-cy=criteria-1] [data-cy=description-${txt.lang}]`).clear().type(txt.texts[0])
        cy.get(`[data-cy=criteria-1] [data-cy=instructions-${txt.lang}]`).clear().type(txt.texts[1])
      })
      cy.get('[data-cy=criteria-1] [data-cy=save-btn]').click()

      texts.forEach((txt) => {
        cy.get(`[data-cy=saved-criteria-1-${txt.lang}] [data-cy=description-content]`).should('have.text', txt.texts[0])
        cy.get(`[data-cy=saved-criteria-1-${txt.lang}] [data-cy=show-instructions]`).click()
        cy.get(`[data-cy=saved-criteria-1-${txt.lang}] .instructions-content`).should('have.text', txt.texts[1])
      })
    })
  })

  describe("as regular user", () => {
    beforeEach(() => {
      cy.visit('/')
      cy.login('user', 'user')
      cy.get('.logout').should('be.visible')
    })

    it('access to criteria editr is denied', () => {
      cy.visit('/classification-criteria.html')
      cy.get('#criteria-page > div').should('have.text', 'Kirjaudu järjestelmään pääkäyttäjänä ja yritä uudelleen.')
    })
  })
})

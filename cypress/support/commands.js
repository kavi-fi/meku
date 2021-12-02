const axios = require('axios')

const selector = (datacy) => {
  if (datacy.indexOf(':') === -1) return `[data-cy=${datacy}]`
  const splitted = datacy.split(':')
  return `[data-cy=${splitted[0]}]:${splitted[1]}`
}

Cypress.Commands.add('getDataCy', (selectors) => {
  return cy.get(selectors.split(' ').map(selector).join(' '))
})

Cypress.Commands.add('login', (user, password) => {
  cy.get('[data-cy=username]').type(user)
  cy.get('[data-cy=password]').type(password)
  cy.get('[data-cy=login]').click()
})

Cypress.Commands.add('select2one', (selector, query) => {
  cy.get(selector + ' a').click()
  cy.get('#select2-drop input[type=text]').type(query)
  cy.get('#select2-drop input[type=text]').type('{enter}')
  cy.wait(10)
})

Cypress.Commands.add('select2', (selector, query) => {
  const queryArray = typeof query === 'string' ? [query] : query
  cy.get(selector + ' input').click()
  queryArray.forEach((q) => {
    cy.get(selector + ' input').type(q)
    cy.get(selector + ' input').type('{enter}')
    cy.wait(10)
  })
})

Cypress.Commands.add('assertAgelimitAndWarnings', {prevSubject: true}, (subject, ageAndWarnings) => {
  const splitted = ageAndWarnings.split(' ')
  const agelimit = splitted[0]
  const expectedWarnings = splitted.splice(1).join(' ')
  cy.get(subject.selector + ' ' + selector('agelimit')).should('have.attr', 'src').and('include', agelimit)
  cy.get(subject.selector + ' ' + selector('warning')).should(($els) => {
    const actualWarnings = $els.toArray().reduce((acc, f) => acc.concat(f.className.split(' ')), []).filter(f => f !== 'warning').join(' ')
    expect(actualWarnings).to.equal(expectedWarnings)
  })
})

Cypress.Commands.add('assertProgramBox', (parent, program) => {
  cy.getDataCy(parent + ' primary-name').should('have.text', program.name)
  cy.getDataCy(parent + ' name').should('have.text', program.name)
  cy.getDataCy(parent + ' name-fi').should('have.text', program.nameFi)
  cy.getDataCy(parent + ' name-sv').should('have.text', program.nameSv)
  cy.getDataCy(parent + ' name-other').should('have.text', program.nameOther)
  cy.getDataCy(parent + ' country').should('have.text', program.country)
  cy.getDataCy(parent + ' year').should('have.text', program.year)
  cy.getDataCy(parent + ' genre').should('have.text', program.genre || '')
  cy.getDataCy(parent + ' directors').should('have.text', program.directors || '')
  cy.getDataCy(parent + ' actors').should('have.text', program.actors || '')
  cy.getDataCy(parent + ' current-format').should('have.text', program.format)
  cy.getDataCy(parent + ' current-duration').should('have.text', program.duration)
//  cy.getDataCy(parent + ' criteria').should('have.text', program.criteria.join('\n'))
  cy.getDataCy(parent + ' author').should('have.text', program.author)
  cy.getDataCy(parent + ' buyer').should('have.text', program.buyer)
  cy.getDataCy(parent + ' billing').should('have.text', program.billing)
  cy.getDataCy(parent + ' warning-summary').assertAgelimitAndWarnings(program.ageAndWarnings)
})

Cypress.Commands.add('assertSearchResultRow', (parent, expectedRow) => {
  cy.getDataCy(parent + ' name').should('have.text', expectedRow.name)
  cy.getDataCy(parent + ' duration-or-game').should('have.text', expectedRow.duration)
  cy.getDataCy(parent + ' program-type').should('have.text', expectedRow.type)
  cy.getDataCy(parent + ' warning-summary').assertAgelimitAndWarnings(expectedRow.ageAndWarnings)
})

Cypress.Commands.add('assertSearchResult', (rowSelector, expectedRow, expectedProgram) => {
  cy.assertSearchResultRow(rowSelector, expectedRow)
  cy.getDataCy(rowSelector).click()
  cy.assertProgramBox('search-page results program-box', expectedProgram)
})

Cypress.Commands.add('assertLatestEmail', async (expectedEmail) => {
  const response = await axios.get('http://localhost:4000/emails/latest')
  const msg = response.data
  expect(msg.to.join(':')).to.equal(Array.isArray(expectedEmail.to) ? expectedEmail.to.join(':') : expectedEmail.to)
  expect(msg.subject).to.equal(expectedEmail.subject)
  expect(stripTags(msg.html)).to.equal(expectedEmail.body)
})

function stripTags(emailHtml) {
  return emailHtml.replace(/(<([^>]+)>)/ig, "\n").replace(/\n+/g, '\n').replace(/(^\n)|(\n$)/g, '')
}

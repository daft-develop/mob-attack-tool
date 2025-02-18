describe('Basic Login Tests', () => {
  it('login as gamemaster', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
  })

  it('login as player', () => {
    cy.login('Player')
    cy.visit('/game')
  })
})

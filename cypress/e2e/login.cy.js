describe('Basic Login Tests', () => {
  it('login as gamemaster', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
  })

  it('login as player', () => {
    cy.login('Player')
    cy.visit('/game')
  })

  it('Clear tokens', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
    cy.clearTokens()
  })

  it('Disable all modules', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
    cy.disableAllModules()
  })
})

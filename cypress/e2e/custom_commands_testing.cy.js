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

  it('Enable MAT Only', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
    cy.enableMat()
  })

  it('Enable All Testing Mods', () => {
    cy.login('Gamemaster')
    cy.visit('/game')
    cy.enableTestingMods()
  })
})

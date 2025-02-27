Cypress.Commands.add('enableMat', () => {
  cy.waitTillReady()
  cy.window().then((win) => {
    // check if any modules are active before trying to make changes
    let activeModCount = win.game.modules.filter(m => m.active).length

    if (activeModCount != 1) {
      cy.get('#sidebar-tabs > [data-tab="settings"]').click()
      cy.get('[data-action="modules"]').click()
      cy.get('footer.flexrow > [name="deactivate"]').click()
      cy.get('[data-module-id="mob-attack-tool"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="mob-attack-tool"] > .package-overview > .package-title > .active').check()
      cy.get('[type="submit"]').click()
      cy.get('#reload-world-confirm [data-action=yes]').click()
    }
  })
  cy.waitTillReady()
  cy.window().then((win) => {
    // check if any modules are active before trying to make changes
    let activeModCount = win.game.modules.filter(m => m.active).length
    cy.wrap(activeModCount).should('equal', 1)
  })
})

Cypress.Commands.add('enableTestingMods', () => {
  cy.waitTillReady()
  cy.window().then((win) => {
    // check if any modules are active before trying to make changes
    let activeModCount = win.game.modules.filter(m => m.active).length

    if (activeModCount != 9) {
      cy.get('#sidebar-tabs > [data-tab="settings"]').click()
      cy.get('[data-action="modules"]').click()
      cy.get('footer.flexrow > [name="deactivate"]')
      cy.get('[data-module-id="midi-qol"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="midi-qol"] > .package-overview > .package-title > .active').check()
      cy.contains(' Activate').click() // add dependencies
      cy.contains(' Activate').should('not.exist') // pause after dialogue

      cy.get('[data-module-id="itemacro"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="itemacro"] > .package-overview > .package-title > .active').check()
      cy.get('[data-module-id="autoanimations"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="autoanimations"] > .package-overview > .package-title > .active').check()
      cy.contains(' Activate').click() // add dependencies
      cy.contains(' Activate').should('not.exist') // pause after dialogue

      cy.get('[data-module-id="dice-so-nice"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="dice-so-nice"] > .package-overview > .package-title > .active').check()
      cy.get('[data-module-id="mob-attack-tool"] > .package-overview > .package-title > .active').scrollIntoView()
      cy.get('[data-module-id="mob-attack-tool"] > .package-overview > .package-title > .active').check()
      cy.get('[type="submit"]').click()
      cy.get('#reload-world-confirm [data-action=yes]').click()
    }
  })
  cy.waitTillReady()
  cy.window().then((win) => {
    // check if any modules are active before trying to make changes
    let activeModCount = win.game.modules.filter(m => m.active).length
    cy.wrap(activeModCount).should('equal', 9)
  })
})

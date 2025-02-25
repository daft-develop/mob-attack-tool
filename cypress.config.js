import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    experimentalStudio: true,
    setupNodeEvents(/* on, config */) {
      // implement node event listeners here
    },
    baseUrl: 'http://localhost:30000/',
  },
  viewportWidth: 1920,
  viewportHeight: 1080,
})

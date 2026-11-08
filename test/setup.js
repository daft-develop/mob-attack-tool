/**
 * Shared test setup for Vitest unit tests.
 *
 * NOTE: These tests run outside Foundry, so we provide minimal mocks
 * for any Foundry globals that pure logic functions may depend on.
 */

// Minimal mocks for Foundry globals that pure logic may reference
globalThis.foundry = {
  utils: {
    isNewerVersion: (a, b) => {
      // Simple semantic version comparison for testing
      const parse = v => v.split('.').map(Number)
      const A = parse(a), B = parse(b)
      for (let i = 0; i < Math.max(A.length, B.length); i++) {
        const aVal = A[i] || 0
        const bVal = B[i] || 0
        if (aVal > bVal) return true
        if (aVal < bVal) return false
      }
      return false
    },
  },
}

// Mock game global for functions that access it
globalThis.game = {
  system: { version: '4.0.0' },
  version: '13.0.0',
}

// Math.clamp is a Foundry global - provide it for testing
if (typeof Math.clamp !== 'function') {
  Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value))
}

// Mock dnd5e.dice for simplifyFormula tests
globalThis.dnd5e = {
  dice: {
    simplifyRollFormula: formula => formula,
  },
}

// Mock Foundry classes referenced in the module graph
globalThis.FormApplication = class FormApplication {
  static get defaultOptions() {
    return {}
  }
}

globalThis.Application = class Application {
  static get defaultOptions() {
    return {}
  }
}

globalThis.mergeObject = (...args) => {
  return Object.assign({}, ...args)
}

// Mock foundry.applications for v13+ code
globalThis.foundry.applications = {
  api: {
    HandlebarsApplicationMixin: class HandlebarsApplicationMixin {},
    ApplicationV2: class ApplicationV2 {
      static get defaultOptions() {
        return {}
      }
    },
  },
}

globalThis.foundry.utils = {
  ...globalThis.foundry.utils,
  expandObject: obj => obj,
}

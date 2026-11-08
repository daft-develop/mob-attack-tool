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

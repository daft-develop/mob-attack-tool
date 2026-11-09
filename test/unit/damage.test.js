import { describe, it, expect, vi, beforeEach } from 'vitest'
import { simplifyFormula } from '../../scripts/core/damage.js'

// Mock only the dnd5e dependency, not the module under test. The system helper
// does the real simplification; simplifyFormula is responsible for calling it
// correctly and, before dnd5e 5.0, normalizing spacing around negative terms.
let simplifyRollFormula

beforeEach(() => {
  simplifyRollFormula = vi.fn(formula => formula)
  globalThis.dnd5e = { dice: { simplifyRollFormula } }
  globalThis.game.system.version = '5.0.0'
})

describe('simplifyFormula', () => {
  it('delegates to dnd5e with preserveFlavor enabled', () => {
    simplifyFormula('1d6 + 3')
    expect(simplifyRollFormula).toHaveBeenCalledWith('1d6 + 3', { preserveFlavor: true })
  })

  describe('dnd5e 5.0+', () => {
    it('returns the system result unchanged', () => {
      simplifyRollFormula.mockReturnValue('1d6-3')
      expect(simplifyFormula('1d6 + -3')).toBe('1d6-3')
    })
  })

  describe('dnd5e before 5.0', () => {
    beforeEach(() => {
      globalThis.game.system.version = '4.3.0'
    })

    it('adds spacing around an unspaced negative modifier', () => {
      simplifyRollFormula.mockReturnValue('1d6-3')
      expect(simplifyFormula('1d6-3')).toBe('1d6 - 3')
    })

    it('leaves an already-spaced negative modifier alone', () => {
      simplifyRollFormula.mockReturnValue('1d6 - 3')
      expect(simplifyFormula('1d6 - 3')).toBe('1d6 - 3')
    })

    it('leaves positive modifiers alone', () => {
      simplifyRollFormula.mockReturnValue('1d6 + 3')
      expect(simplifyFormula('1d6 + 3')).toBe('1d6 + 3')
    })

    it('handles a negative modifier after flavor text', () => {
      simplifyRollFormula.mockReturnValue('1d4[fire]-2')
      expect(simplifyFormula('1d4[fire] - 2')).toBe('1d4[fire] - 2')
    })

    it('spaces a leading negative constant', () => {
      simplifyRollFormula.mockReturnValue('-3')
      expect(simplifyFormula('-3')).toBe(' - 3')
    })
  })
})

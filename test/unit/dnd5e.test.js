import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatAttackTargets, getCasterLevel, getDamageOptions, getSpellMethod, simplifyFormula } from '../../scripts/system/dnd5e.js'

// These helpers are where dnd5e version differences live, so each version
// branch gets its own test. dnd5e's own APIs are mocked as globals.

describe('getSpellMethod', () => {
  it('reads preparation.mode before dnd5e 5.1', () => {
    game.system.version = '4.3.0'
    expect(getSpellMethod({ system: { preparation: { mode: 'atwill' } } })).toBe('atwill')
  })

  it('reads method on dnd5e 5.1+', () => {
    game.system.version = '5.1.0'
    expect(getSpellMethod({ system: { method: 'innate', preparation: { mode: 'atwill' } } })).toBe('innate')
  })

  it('does not throw when preparation is missing on dnd5e 6.x', () => {
    game.system.version = '6.0.5'
    expect(() => getSpellMethod({ system: { method: 'spell' } })).not.toThrow()
  })
})

describe('getCasterLevel', () => {
  it('reads attributes.spell.level for NPCs', () => {
    expect(getCasterLevel({ type: 'npc', system: { attributes: { spell: { level: 11 } } } })).toBe(11)
  })

  it('reads the character level for other actors', () => {
    expect(getCasterLevel({ type: 'character', system: { details: { level: 5 } } })).toBe(5)
  })

  it('falls back to details.spellLevel without a character level', () => {
    expect(getCasterLevel({ type: 'character', system: { details: { level: 0, spellLevel: 7 } } })).toBe(7)
  })
})

describe('simplifyFormula', () => {
  let simplifyRollFormula

  beforeEach(() => {
    simplifyRollFormula = vi.fn(formula => formula)
    globalThis.dnd5e = { dice: { simplifyRollFormula } }
    game.system.version = '5.0.0'
  })

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
      game.system.version = '4.3.0'
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

describe('formatAttackTargets', () => {
  const descriptors = [{ uuid: 'Actor.a' }]

  beforeEach(() => {
    globalThis.dnd5e = {
      dataModels: { chatMessage: { fields: { TargetsField: { getDescriptors: vi.fn(() => descriptors) } } } },
      utils: { getTargetDescriptors: vi.fn(() => descriptors) },
    }
  })

  it('uses TargetsField.getDescriptors on dnd5e 6.0+', () => {
    game.system.version = '6.0.0'
    expect(formatAttackTargets()).toBe(descriptors)
    expect(dnd5e.dataModels.chatMessage.fields.TargetsField.getDescriptors).toHaveBeenCalled()
    expect(dnd5e.utils.getTargetDescriptors).not.toHaveBeenCalled()
  })

  it('uses dnd5e.utils.getTargetDescriptors before 6.0', () => {
    game.system.version = '5.3.3'
    expect(formatAttackTargets()).toBe(descriptors)
    expect(dnd5e.utils.getTargetDescriptors).toHaveBeenCalled()
  })
})

describe('getDamageOptions', () => {
  beforeEach(() => {
    game.system.version = '6.0.0'
    const descriptors = [{ uuid: 'Actor.a' }, { uuid: 'Actor.b' }]
    globalThis.dnd5e = {
      dataModels: { chatMessage: { fields: { TargetsField: { getDescriptors: () => descriptors } } } },
    }
    globalThis.canvas = { tokens: { get: id => ({ tokenB: { actor: { uuid: 'Actor.b' } } })[id] } }
  })

  it('keeps only the descriptor of the given target', () => {
    const options = getDamageOptions(true, 'tokenB')
    expect(options.message['data.flags.dnd5e.targets']).toEqual([{ uuid: 'Actor.b' }])
  })

  it('passes the critical flag and skips the configuration dialog', () => {
    const options = getDamageOptions(false, 'tokenB')
    expect(options.damage).toEqual({ isCritical: false })
    expect(options.dialog).toEqual({ configure: false })
  })

  it('keeps no descriptors without a target', () => {
    expect(getDamageOptions(true, null).message['data.flags.dnd5e.targets']).toEqual([])
  })
})

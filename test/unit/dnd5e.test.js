import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatAttackTargets, getCasterLevel, getDamageMessageData, getDamageOptions, getSpellMethod, simplifyFormula } from '../../scripts/system/dnd5e.js'

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

describe('damage card targets', () => {
  // Two targeted tokens (A and B); each damage card must list only the one its attacks were assigned to.
  // The descriptor shapes mirror dnd5e's: 6.0 TargetsField.getDescriptors(tokens) describes the tokens it
  // is given as { actor, token, ... }; before 6.0 a descriptor is { name, img, uuid: <actor uuid>, ac }
  const actor = (uuid, ac, statuses = []) => ({ uuid, img: `${uuid}.png`, statuses: new Set(statuses), system: { attributes: { ac: { value: ac } } } })
  const tokens = {
    tokenA: { name: 'A', document: { uuid: 'Scene.s.Token.tokenA' }, actor: actor('Actor.a', 12) },
    tokenB: { name: 'B', document: { uuid: 'Scene.s.Token.tokenB' }, actor: actor('Actor.b', 15) },
    covered: { name: 'C', document: { uuid: 'Scene.s.Token.covered' }, actor: actor('Actor.c', 14, ['coverTotal']) },
  }
  const targetB = [{ name: 'B', img: 'Actor.b.png', uuid: 'Actor.b', ac: 15 }]
  const descriptor60 = token => ({ actor: token.actor.uuid, token: token.document.uuid })
  const targetB60 = [{ actor: 'Actor.b', token: 'Scene.s.Token.tokenB' }]

  beforeEach(() => {
    globalThis.dnd5e = {
      dataModels: { chatMessage: { fields: { TargetsField: {
        getDescriptors: vi.fn((list = Object.values(tokens)) => [...list].map(descriptor60)),
      } } } },
    }
    globalThis.canvas = { tokens: { get: id => tokens[id] } }
  })

  describe('getDamageOptions', () => {
    it('sets system.targets to only the given token on dnd5e 6.0+', () => {
      game.system.version = '6.0.6'
      const { message } = getDamageOptions(true, 'tokenB')
      expect(message).toEqual({ data: { system: { targets: targetB60 } } })
      expect(dnd5e.dataModels.chatMessage.fields.TargetsField.getDescriptors).toHaveBeenCalledWith([tokens.tokenB])
    })

    it('sets flags.dnd5e.targets to the given target before 6.0', () => {
      game.system.version = '5.3.3'
      const { message } = getDamageOptions(true, 'tokenB')
      expect(message).toEqual({ data: { flags: { dnd5e: { targets: targetB } } } })
    })

    it('describes the token before 6.0 even when it is not targeted, hiding AC behind total cover', () => {
      game.system.version = '5.3.3'
      expect(getDamageOptions(true, 'covered').message.data.flags.dnd5e.targets).toEqual([{ name: 'C', img: 'Actor.c.png', uuid: 'Actor.c', ac: null }])
    })

    it('passes the critical flag and skips the configuration dialog', () => {
      game.system.version = '6.0.6'
      const options = getDamageOptions(false, 'tokenB')
      expect(options.damage).toEqual({ isCritical: false })
      expect(options.dialog).toEqual({ configure: false })
    })

    it('asks for the two-handed attack mode for a versatile roll', () => {
      game.system.version = '6.0.6'
      expect(getDamageOptions(false, 'tokenB', true).damage).toEqual({ isCritical: false, attackMode: 'twoHanded' })
      expect(getDamageOptions(false, 'tokenB').damage).toEqual({ isCritical: false })
    })

    it('lists no targets without a target', () => {
      game.system.version = '6.0.6'
      expect(getDamageOptions(true, null).message.data.system.targets).toEqual([])
    })
  })

  describe('getDamageMessageData', () => {
    it('makes a damage-type message with system.targets on dnd5e 6.0+', () => {
      game.system.version = '6.0.6'
      expect(getDamageMessageData('tokenB')).toEqual({ type: 'damage', system: { targets: targetB60 } })
    })

    it('uses the dnd5e roll flags before 6.0', () => {
      game.system.version = '4.3.0'
      expect(getDamageMessageData('tokenB')).toEqual({
        flags: { dnd5e: { messageType: 'roll', roll: { type: 'damage' }, targets: targetB } },
      })
    })

    it('does not throw without a target', () => {
      game.system.version = '6.0.6'
      expect(getDamageMessageData(null).system.targets).toEqual([])
    })
  })
})

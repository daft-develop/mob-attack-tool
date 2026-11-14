import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearStaleDiceSoNiceSuspension, isDiceSoNiceEnabled, isPublicRollMode, registerDiceSoNiceHooks, restoreDiceSoNice, showDiceSoNiceRoll, suspendDiceSoNice, withDiceSoNiceSuspended, withHiddenDiceFlag } from '../../scripts/integrations/dice-so-nice.js'

let settings
let moduleActive

beforeEach(() => {
  moduleActive = true
  settings = { 'mob-attack-tool.enableDiceSoNice': true, 'core.rollMode': 'publicroll', 'mob-attack-tool.hiddenDSNactiveFlag': true }
  game.modules = { get: id => (id === 'dice-so-nice' && moduleActive !== undefined ? { active: moduleActive } : undefined) }
  game.settings = {
    get: (scope, key) => settings[`${scope}.${key}`],
    set: vi.fn(async (scope, key, value) => { settings[`${scope}.${key}`] = value }),
  }
  game.user = { isGM: true }
  game.dice3d = { showForRoll: vi.fn(async () => true) }
  game.messages = new Map()
})

describe('isDiceSoNiceEnabled', () => {
  it('needs the module active and the setting on', () => {
    expect(isDiceSoNiceEnabled()).toBe(true)
    settings['mob-attack-tool.enableDiceSoNice'] = false
    expect(isDiceSoNiceEnabled()).toBe(false)
  })

  it('is false when the module is inactive or not installed', () => {
    moduleActive = false
    expect(isDiceSoNiceEnabled()).toBe(false)
    moduleActive = undefined
    expect(isDiceSoNiceEnabled()).toBe(false)
  })
})

describe('isPublicRollMode', () => {
  it.each([['publicroll', true], ['roll', true], ['gmroll', false], ['blindroll', false], ['selfroll', false]])(
    'roll mode %s is public: %s', (mode, expected) => {
      settings['core.rollMode'] = mode
      expect(isPublicRollMode()).toBe(expected)
    })
})

describe('showDiceSoNiceRoll', () => {
  const roll = { total: 7 }

  it('shows the roll for the current user, synchronized when asked', async () => {
    await showDiceSoNiceRoll(roll, { synchronize: true })
    expect(game.dice3d.showForRoll).toHaveBeenCalledWith(roll, game.user, true)
  })

  it('does not synchronize by default', () => {
    showDiceSoNiceRoll(roll)
    expect(game.dice3d.showForRoll).toHaveBeenCalledWith(roll, game.user, false)
  })

  it('does nothing when Dice So Nice is disabled', () => {
    settings['mob-attack-tool.enableDiceSoNice'] = false
    expect(showDiceSoNiceRoll(roll)).toBeUndefined()
    expect(game.dice3d.showForRoll).not.toHaveBeenCalled()
  })
})

describe('suspending Dice So Nice during a mob attack', () => {
  it('suspends only when the setting is off and the user is the GM', async () => {
    await suspendDiceSoNice()
    expect(game.settings.set).not.toHaveBeenCalled()

    settings['mob-attack-tool.enableDiceSoNice'] = false
    game.user.isGM = false
    await suspendDiceSoNice()
    expect(game.settings.set).not.toHaveBeenCalled()

    game.user.isGM = true
    await suspendDiceSoNice()
    expect(game.settings.set).toHaveBeenCalledWith('mob-attack-tool', 'hiddenDSNactiveFlag', false)
  })

  it('restores the flag for the GM', async () => {
    settings['mob-attack-tool.hiddenDSNactiveFlag'] = false
    await restoreDiceSoNice()
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })

  it('blinds rolls in the hook only while suspended', () => {
    let hook
    globalThis.Hooks = {
      on: vi.fn((name, fn) => {
        hook = fn
      }),
    }
    registerDiceSoNiceHooks()
    expect(Hooks.on).toHaveBeenCalledWith('diceSoNiceRollStart', expect.any(Function))

    const visible = {}
    hook('message1', visible)
    expect(visible.blind).toBeUndefined()

    settings['mob-attack-tool.hiddenDSNactiveFlag'] = false
    const hidden = {}
    hook('message2', hidden)
    expect(hidden.blind).toBe(true)
  })
})

describe('withDiceSoNiceSuspended', () => {
  beforeEach(() => {
    settings['mob-attack-tool.enableDiceSoNice'] = false
  })

  it('suspends during the callback and restores afterwards', async () => {
    let flagDuring
    const result = await withDiceSoNiceSuspended(async () => {
      flagDuring = settings['mob-attack-tool.hiddenDSNactiveFlag']
      return 'done'
    })
    expect(flagDuring).toBe(false)
    expect(result).toBe('done')
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })

  it('restores when the callback throws', async () => {
    await expect(withDiceSoNiceSuspended(async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })
})

describe('withHiddenDiceFlag', () => {
  it('flags the message when the module’s Dice So Nice setting is off, keeping other flags', () => {
    settings['mob-attack-tool.enableDiceSoNice'] = false
    const data = { type: 'damage', flags: { dnd5e: { targets: [] } } }
    expect(withHiddenDiceFlag(data)).toEqual({ type: 'damage', flags: { 'dnd5e': { targets: [] }, 'mob-attack-tool': { hideDice: true } } })
    expect(data.flags['mob-attack-tool']).toBeUndefined()
  })

  it('leaves the message alone when the setting is on', () => {
    const data = { type: 'damage' }
    expect(withHiddenDiceFlag(data)).toBe(data)
  })
})

describe('the Dice So Nice roll hook', () => {
  let hook

  beforeEach(() => {
    globalThis.Hooks = {
      on: (name, fn) => {
        hook = fn
      },
    }
    registerDiceSoNiceHooks()
  })

  it('blinds a flagged message even when nothing is suspended, e.g. a player’s attack', () => {
    game.messages.set('flagged', { getFlag: (scope, key) => scope === 'mob-attack-tool' && key === 'hideDice' })
    game.messages.set('plain', { getFlag: () => undefined })
    const flagged = {}
    const plain = {}
    hook('flagged', flagged)
    hook('plain', plain)
    expect(flagged.blind).toBe(true)
    expect(plain.blind).toBeUndefined()
  })
})

describe('clearStaleDiceSoNiceSuspension', () => {
  it('clears a suspension left over from an interrupted attack', async () => {
    settings['mob-attack-tool.hiddenDSNactiveFlag'] = false
    await clearStaleDiceSoNiceSuspension()
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })

  it('leaves the flag alone when nothing is suspended, and for players', async () => {
    await clearStaleDiceSoNiceSuspension()
    expect(game.settings.set).not.toHaveBeenCalled()

    settings['mob-attack-tool.hiddenDSNactiveFlag'] = false
    game.user.isGM = false
    await clearStaleDiceSoNiceSuspension()
    expect(game.settings.set).not.toHaveBeenCalled()
  })
})

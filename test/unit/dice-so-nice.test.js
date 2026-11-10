import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isDiceSoNiceEnabled, isPublicRollMode, registerDiceSoNiceHooks, restoreDiceSoNice, showDiceSoNiceRoll, suspendDiceSoNice } from '../../scripts/integrations/dice-so-nice.js'

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

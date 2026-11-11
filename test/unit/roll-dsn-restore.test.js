import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rollMobAttack } from '../../scripts/mobRules.js'
import { rollMobAttackIndividually } from '../../scripts/individualRolls.js'

// A mob attack with nothing to roll returns before any damage is processed.
// Dice So Nice must still be restored, or every later roll in the world stays hidden.
let settings

beforeEach(() => {
  settings = {
    'mob-attack-tool.enableDiceSoNice': false,
    'mob-attack-tool.hiddenDSNactiveFlag': true,
    'mob-attack-tool.hiddenTableCheckBox': false,
  }
  game.settings = {
    get: (scope, key) => settings[`${scope}.${key}`],
    set: vi.fn(async (scope, key, value) => { settings[`${scope}.${key}`] = value }),
  }
  game.user = { isGM: true }
})

describe('Dice So Nice is restored after a mob attack with nothing to roll', () => {
  const data = { attacks: {}, targets: [] }

  it('mob rules', async () => {
    await rollMobAttack(data, 'mob2024')
    expect(game.settings.set).toHaveBeenCalledWith('mob-attack-tool', 'hiddenDSNactiveFlag', false)
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })

  it('individual rolls', async () => {
    await rollMobAttackIndividually(data)
    expect(game.settings.set).toHaveBeenCalledWith('mob-attack-tool', 'hiddenDSNactiveFlag', false)
    expect(settings['mob-attack-tool.hiddenDSNactiveFlag']).toBe(true)
  })
})

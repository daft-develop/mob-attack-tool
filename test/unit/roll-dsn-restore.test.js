import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rollMobAttack } from '../../scripts/mobRules.js'
import { rollMobAttackIndividually } from '../../scripts/individualRolls.js'

// With midi-qol, whose damage cards can't be flagged to hide their dice, a mob
// attack suspends Dice So Nice. An attack with nothing to roll returns before
// any damage is processed; Dice So Nice must still be restored, or every later
// roll in the world stays hidden.
let settings
let midiActive

beforeEach(() => {
  midiActive = true
  settings = {
    'mob-attack-tool.enableDiceSoNice': false,
    'mob-attack-tool.enableMidi': true,
    'mob-attack-tool.hiddenDSNactiveFlag': true,
    'mob-attack-tool.hiddenTableCheckBox': false,
  }
  game.settings = {
    get: (scope, key) => settings[`${scope}.${key}`],
    set: vi.fn(async (scope, key, value) => { settings[`${scope}.${key}`] = value }),
  }
  game.modules = { get: id => (id === 'midi-qol' ? { active: midiActive } : undefined) }
  game.user = { isGM: true }
})

const data = { attacks: {}, targets: [] }

describe('Dice So Nice is restored after a mob attack with nothing to roll', () => {
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

describe('without midi-qol, Dice So Nice is not suspended', () => {
  // the attack's own damage cards are flagged instead, so other rolls stay visible
  it.each([
    ['mob rules', () => rollMobAttack(data, 'mob2024')],
    ['individual rolls', () => rollMobAttackIndividually(data)],
  ])('%s', async (name, roll) => {
    midiActive = false
    await roll()
    expect(game.settings.set).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { buildMacroName, buildQuickRollCommand } from '../../scripts/core/macro-export.js'

describe('buildMacroName', () => {
  it('combines weapon, count and mob name with the localized words', () => {
    expect(buildMacroName('Scimitar', 4, 'Goblin', { prefix: 'Mob Attack of', postfix: '(s)' }))
      .toBe('Scimitar Mob Attack of 4 Goblin(s)')
  })
})

describe('buildQuickRollCommand', () => {
  const mobAttackData = {
    numSelected: 3,
    weaponLocators: [{ actorID: 'a1', weaponName: 'Scimitar', weaponID: 'w1' }],
    attacks: { w1: [{ targetId: 't1', targetNumAttacks: 3 }] },
    withAdvantage: false,
    withDisadvantage: false,
    rollTypeValue: 0,
    rollTypeMessage: '',
    monsters: { a1: { amount: 3 } },
  }

  // Run the macro command the way Foundry runs a script macro, with a stand-in MobAttacks
  const runMacro = (command, event = {}) => {
    const MobAttacks = { quickRoll: vi.fn() }
    new Function('MobAttacks', 'event', command)(MobAttacks, event)
    return MobAttacks.quickRoll.mock.calls[0][0]
  }

  it('produces a command that passes the mob attack data to quickRoll', () => {
    const data = runMacro(buildQuickRollCommand(mobAttackData, 0))
    expect(data).toMatchObject({
      numSelected: 3,
      weaponLocators: mobAttackData.weaponLocators,
      attacks: mobAttackData.attacks,
      rollTypeValue: 0,
      rollTypeMessage: '',
      monsters: mobAttackData.monsters,
    })
  })

  it('reads advantage from alt and disadvantage from meta with key binding 0', () => {
    const command = buildQuickRollCommand(mobAttackData, 0)
    expect(runMacro(command, { altKey: true, metaKey: false, ctrlKey: true })).toMatchObject({ withAdvantage: true, withDisadvantage: false })
    expect(runMacro(command, { altKey: false, metaKey: true })).toMatchObject({ withAdvantage: false, withDisadvantage: true })
  })

  it('reads disadvantage from ctrl with any other key binding', () => {
    const command = buildQuickRollCommand(mobAttackData, 1)
    expect(runMacro(command, { altKey: false, ctrlKey: true, metaKey: false })).toMatchObject({ withDisadvantage: true })
  })

  it('fixes advantage when the attack was exported with it, ignoring keys', () => {
    const command = buildQuickRollCommand({ ...mobAttackData, withAdvantage: true, rollTypeValue: 5, rollTypeMessage: ' + 5 [adv]' }, 0)
    expect(runMacro(command, { altKey: false, metaKey: true })).toMatchObject({ withAdvantage: true, withDisadvantage: false, rollTypeMessage: ' + 5 [adv]' })
  })
})

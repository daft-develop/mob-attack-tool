import { describe, it, expect, vi, beforeEach } from 'vitest'

// With midi-qol active, a mob attack passes its hits to the weapon's On Use macro.
// The macro data's advantage/disadvantage come from the mob attack data, so the
// damage step must receive that data, not the per-attack record wrapping it.

vi.mock('../../scripts/integrations/midi-qol.js', () => ({
  isMidiQolEnabled: () => true,
  runDamageOnlyWorkflow: vi.fn(async () => ({ attackTotal: 0 })),
  callOnUseMacroForHits: vi.fn(async () => {}),
  waitForMidiRollComplete: vi.fn(async () => {}),
}))
vi.mock('../../scripts/integrations/automated-animations.js', () => ({ playAttackAnimations: vi.fn() }))
vi.mock('../../scripts/integrations/multilevel-tokens.js', () => ({ getTargetToken: t => t, getDamageTargetId: id => id }))
vi.mock('../../scripts/utils.js', () => ({
  endGroupedMobTurn: vi.fn(),
  getDamageFormulaAndType: () => [['1d6'], ['slashing'], ['slashing']],
  calcD20Needed: () => 10,
  calcAttackersNeeded: () => 2,
  calcSuccessfulAttacks: () => 2,
  sendChatMessage: vi.fn(),
  getAttackBonus: () => 4,
  getAttackData: () => ({ ability: 'none' }),
  getDamageOptions: vi.fn(),
  getDamageMessageData: vi.fn(),
  getTextFromAttackBonus: () => '+4',
}))

const { rollMobAttack } = await import('../../scripts/mobRules.js')
const { rollMobAttackIndividually } = await import('../../scripts/individualRolls.js')
const { callOnUseMacroForHits } = await import('../../scripts/integrations/midi-qol.js')

function mobAttackData(numAttacks) {
  return {
    withAdvantage: true,
    numSelected: 4,
    selectedTokenIds: [{ tokenId: 'tok1' }],
    targets: [{ targetId: 'target1', targetAC: 12 }],
    weapons: { w1: { name: 'Scimitar', type: 'weapon', actor: { id: 'a1', name: 'Goblin', getFlag: () => undefined } } },
    attacks: { w1: [{ targetId: 'target1', targetNumAttacks: numAttacks }] },
  }
}

beforeEach(() => {
  const settings = { 'mob-attack-tool.noResultsMessage': true }
  game.settings = { get: (scope, key) => settings[`${scope}.${key}`], set: vi.fn() }
  game.user = { isGM: false, getFlag: () => undefined }
  game.modules = { get: () => undefined }
  game.i18n = { localize: key => key, format: key => key }
  globalThis.canvas = { tokens: { get: id => ({ id, actor: { id: 'a1' } }) } }
  // Every attack roll is a natural 16 + 4
  globalThis.Roll = class {
    async evaluate() {
      return { total: 20, dice: [{ results: [{ result: 16 }] }] }
    }
  }
  globalThis.CONFIG = {
    Dice: {
      DamageRoll: class {
        terms = []
        formula = '1d6'

        alter() {
          return this
        }

        async roll() {
          return this
        }

        async evaluate() {
          return this
        }
      },
    },
  }
  foundry.applications.handlebars = { renderTemplate: async () => '' }
  foundry.dice = { terms: { Die: class {} } }
  callOnUseMacroForHits.mockClear()
})

describe('On Use macro data', () => {
  it('mob rules passes the mob attack data, with its advantage flag', async () => {
    const data = mobAttackData(4)
    await rollMobAttack(data, 'mob2024')

    expect(callOnUseMacroForHits).toHaveBeenCalledTimes(1)
    const hit = callOnUseMacroForHits.mock.calls[0][2]
    expect(hit.data).toBe(data)
    expect(hit.data.withAdvantage).toBe(true)
  })

  it('individual rolls passes the mob attack data, with its advantage flag', async () => {
    const data = mobAttackData(2)
    await rollMobAttackIndividually(data)

    expect(callOnUseMacroForHits).toHaveBeenCalledTimes(1)
    const hit = callOnUseMacroForHits.mock.calls[0][2]
    expect(hit.data).toBe(data)
    expect(hit.data.withAdvantage).toBe(true)
  })
})

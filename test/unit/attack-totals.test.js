import { describe, it, expect } from 'vitest'
import { sumCheckedAttacks, sumTargetAttacks } from '../../scripts/core/attack-totals.js'

describe('sumCheckedAttacks', () => {
  const monsters = {
    goblin: {
      amount: 4,
      weapons: {
        scimitar: { useButtonValue: 'checked', numAttack: 1, averageDamage: 5 },
        shortbow: { useButtonValue: '', numAttack: 1, averageDamage: 5 },
      },
    },
    ogre: {
      amount: 2,
      weapons: { club: { useButtonValue: 'checked', numAttack: 2, averageDamage: 13 } },
    },
  }

  it('totals only checked weapons, scaled by attacks and monster amount', () => {
    // goblins: 1 attack x 4 = 4 attacks, 20 damage; ogres: 2 attacks x 2 = 4 attacks, 52 damage
    expect(sumCheckedAttacks(monsters)).toEqual({ numAttacks: 8, averageDamage: 72 })
  })

  it('treats a numAttack read from an input as a number', () => {
    const fromInput = { orc: { amount: 3, weapons: { axe: { useButtonValue: 'checked', numAttack: '2', averageDamage: 9 } } } }
    expect(sumCheckedAttacks(fromInput)).toEqual({ numAttacks: 6, averageDamage: 54 })
  })

  it('returns zeros when nothing is checked', () => {
    expect(sumCheckedAttacks({})).toEqual({ numAttacks: 0, averageDamage: 0 })
  })
})

describe('sumTargetAttacks', () => {
  it('counts each entry as one attack and sums their average damage', () => {
    expect(sumTargetAttacks([{ averageDamage: 5 }, { averageDamage: 5 }, { averageDamage: 13 }]))
      .toEqual({ numAttacks: 3, averageDamage: 23 })
  })

  it('returns zeros for a target with no attacks', () => {
    expect(sumTargetAttacks([])).toEqual({ numAttacks: 0, averageDamage: 0 })
  })
})

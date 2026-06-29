import { describe, it, expect } from '@jest/globals'
import { getSpellScalingFactor, getFighterScalingFactor } from '../scripts/scaling.js'

describe('getSpellScalingFactor', () => {
  it('scales spells correctly with actor level', () => {
    const makeWeaponData = level => ({
      type: 'spell',
      actor: {
        type: 'player',
        system: {
          details: {
            level,
          },
        },
      },
    })

    expect(getSpellScalingFactor(makeWeaponData(1))).toBe(1)
    expect(getSpellScalingFactor(makeWeaponData(2))).toBe(1)
    expect(getSpellScalingFactor(makeWeaponData(6))).toBe(2)
    expect(getSpellScalingFactor(makeWeaponData(12))).toBe(3)
    expect(getSpellScalingFactor(makeWeaponData(17))).toBe(4)
  })

  it('doesn\'t apply to non-spell type weapons', () => {
    const nonSpellWeapon = {
      type: 'not-a-spell',
    }

    expect(getSpellScalingFactor(nonSpellWeapon)).toBe(1)
  })

  it('defaults 1 when missing actor details', () => {
    const noActor = {
      type: 'spell',
    }

    expect(getSpellScalingFactor(noActor)).toBe(1)
  })

  it('handles older NPC structure', () => {
    const oldNPC = {
      type: 'spell',
      actor: {
        system: {
          details: {
            spellLevel: 12,
          },
        },
      },
    }

    expect(getSpellScalingFactor(oldNPC)).toBe(3)
  })

  it('handles newer NPC structure (system 4.3.0 and newer', () => {
    const newNPC = {
      type: 'spell',
      actor: {
        type: 'npc',
        system: {
          attributes: {
            spell: {
              level: 12,
            },
          },
        },
      },
    }

    expect(getSpellScalingFactor(newNPC)).toBe(3)
  })
})

describe('getFighterScalingFactor', () => {
  it('scales correctly', () => {
    expect(getFighterScalingFactor(10)).toBe(2)
    expect(getFighterScalingFactor(15)).toBe(3)
    expect(getFighterScalingFactor(20)).toBe(4)
  })
})

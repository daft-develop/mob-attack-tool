import { describe, it, expect, vi } from 'vitest'
import { getSpellMethod } from '../../scripts/system/dnd5e.js'
import { getActivityFromItem, getAttackBonus, isMobAttackItem } from '../../scripts/core/attack.js'

// How the spell method is read per dnd5e version is tested in dnd5e.test.js
vi.mock('../../scripts/system/dnd5e.js', () => ({ getSpellMethod: vi.fn() }))

const damagingAttack = { type: 'attack', damage: { parts: [{ formula: '1d10' }] } }
const nonDamagingAttack = { type: 'attack', damage: { parts: [] } }
const save = { type: 'save', damage: { parts: [{ formula: '2d6' }] } }

// minimal stand-in for dnd5e's activity collection
const activities = list => ({
  getByType: type => list.filter(a => a.type === type),
})

const weapon = list => ({ type: 'weapon', system: { activities: activities(list) } })

const spell = (level, method, list = [damagingAttack]) => {
  getSpellMethod.mockReturnValue(method)
  return { type: 'spell', system: { level, activities: activities(list) } }
}

describe('getActivityFromItem', () => {
  it('returns the only attack activity', () => {
    expect(getActivityFromItem(weapon([damagingAttack]))).toBe(damagingAttack)
  })

  it('prefers an attack that deals damage over an earlier one that does not', () => {
    expect(getActivityFromItem(weapon([nonDamagingAttack, damagingAttack]))).toBe(damagingAttack)
  })

  it('falls back to the first attack when none deal damage', () => {
    expect(getActivityFromItem(weapon([save, nonDamagingAttack]))).toBe(nonDamagingAttack)
  })

  it('returns undefined without an attack activity', () => {
    expect(getActivityFromItem(weapon([save]))).toBeUndefined()
  })

  it('returns undefined without activities', () => {
    expect(getActivityFromItem({ type: 'feat', system: {} })).toBeUndefined()
  })
})

describe('getAttackBonus', () => {
  const withModifier = modifier => weapon([{ ...damagingAttack, labels: { modifier } }])

  it('parses a positive modifier', () => {
    expect(getAttackBonus(withModifier('+7'))).toBe(7)
  })

  it('parses a negative modifier with a space after the sign', () => {
    expect(getAttackBonus(withModifier('- 1'))).toBe(-1)
  })

  it('returns 0 without an attack activity instead of throwing', () => {
    expect(getAttackBonus(weapon([save]))).toBe(0)
  })

  it('returns 0 when the activity has no modifier label', () => {
    expect(getAttackBonus(weapon([damagingAttack]))).toBe(0)
  })
})

describe('isMobAttackItem', () => {
  describe('weapons', () => {
    it('accepts a weapon with a damaging attack', () => {
      expect(isMobAttackItem(weapon([damagingAttack]))).toBe(true)
    })

    it('accepts a weapon whose damaging attack is not the first attack', () => {
      expect(isMobAttackItem(weapon([nonDamagingAttack, damagingAttack]))).toBe(true)
    })

    it('rejects a weapon whose attack has no damage', () => {
      expect(isMobAttackItem(weapon([nonDamagingAttack]))).toBe(false)
    })

    it('rejects an item with only a save activity', () => {
      expect(isMobAttackItem(weapon([save]))).toBe(false)
    })

    it('rejects an item without activities', () => {
      expect(isMobAttackItem({ type: 'feat', system: {} })).toBe(false)
    })
  })

  describe('spells', () => {
    it('accepts a cantrip whatever its method', () => {
      expect(isMobAttackItem(spell(0, 'spell'))).toBe(true)
    })

    it('accepts an at-will levelled spell', () => {
      expect(isMobAttackItem(spell(3, 'atwill'))).toBe(true)
    })

    it('rejects a prepared levelled spell', () => {
      expect(isMobAttackItem(spell(3, 'spell'))).toBe(false)
    })

    it('rejects a levelled spell with an unknown method', () => {
      expect(isMobAttackItem(spell(3, undefined))).toBe(false)
    })

    it('rejects a cantrip without a damaging attack', () => {
      expect(isMobAttackItem(spell(0, 'atwill', [save]))).toBe(false)
    })
  })
})

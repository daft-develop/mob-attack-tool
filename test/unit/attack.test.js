import { describe, it, expect, beforeEach } from 'vitest'
import { getActivityFromItem, getAttackBonus, getSpellMethod, isMobAttackItem } from '../../scripts/core/attack.js'

const damagingAttack = { type: 'attack', damage: { parts: [{ formula: '1d10' }] } }
const nonDamagingAttack = { type: 'attack', damage: { parts: [] } }
const save = { type: 'save', damage: { parts: [{ formula: '2d6' }] } }

// minimal stand-in for dnd5e's activity collection
const activities = list => ({
  getByType: type => list.filter(a => a.type === type),
})

// dnd5e 4.3 - 5.0 spell shape
const spell43 = (level, mode, list = [damagingAttack]) => ({
  type: 'spell',
  system: { level, preparation: { mode, prepared: true }, activities: activities(list) },
})

// dnd5e 6.x spell shape: preparation no longer exists
const spell60 = (level, method, list = [damagingAttack]) => ({
  type: 'spell',
  system: { level, method, prepared: 1, activities: activities(list) },
})

const weapon = list => ({ type: 'weapon', system: { activities: activities(list) } })

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

describe('getSpellMethod', () => {
  it('reads preparation.mode before dnd5e 5.1', () => {
    game.system.version = '4.3.0'
    expect(getSpellMethod(spell43(3, 'atwill'))).toBe('atwill')
  })

  it('reads method on dnd5e 5.1+', () => {
    game.system.version = '5.1.0'
    expect(getSpellMethod(spell60(3, 'innate'))).toBe('innate')
  })

  it('does not throw when preparation is missing on dnd5e 6.x', () => {
    game.system.version = '6.0.5'
    expect(() => getSpellMethod(spell60(3, 'spell'))).not.toThrow()
  })
})

describe('isMobAttackItem', () => {
  describe('weapons', () => {
    beforeEach(() => {
      game.system.version = '6.0.5'
    })

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

  describe.each([
    ['4.3.0', spell43],
    ['6.0.5', spell60],
  ])('spells on dnd5e %s', (version, makeSpell) => {
    beforeEach(() => {
      game.system.version = version
    })

    it('accepts a cantrip', () => {
      expect(isMobAttackItem(makeSpell(0, version === '4.3.0' ? 'prepared' : 'spell'))).toBe(true)
    })

    it('accepts an at-will levelled spell', () => {
      expect(isMobAttackItem(makeSpell(3, 'atwill'))).toBe(true)
    })

    it('rejects a prepared levelled spell', () => {
      expect(isMobAttackItem(makeSpell(3, version === '4.3.0' ? 'prepared' : 'spell'))).toBe(false)
    })

    it('rejects a cantrip without a damaging attack', () => {
      expect(isMobAttackItem(makeSpell(0, 'atwill', [save]))).toBe(false)
    })
  })
})

import { describe, it, expect } from 'vitest'
import { calcD20Needed, calcAttackersNeeded, calcSuccessfulAttacks, getTextFromAttackBonus } from '../../scripts/core/roll-math.js'

describe('calcSuccessfulAttacks', () => {
  it('should return 1 when d20Needed is 20 (rounds 0.5 up)', () => {
    // (20-20+1)/20 * 10 = 0.5 → round → 1
    expect(calcSuccessfulAttacks(20, 10)).toBe(1)
  })

  it('should return totalAttacks when d20Needed is 1', () => {
    expect(calcSuccessfulAttacks(1, 10)).toBe(10)
  })

  it('should return 11 when d20Needed is 0 (rounds 10.5 up)', () => {
    // (20-0+1)/20 * 10 = 10.5 → round → 11
    expect(calcSuccessfulAttacks(0, 10)).toBe(11)
  })

  it('should calculate 50% success at middle value', () => {
    expect(calcSuccessfulAttacks(11, 10)).toBe(5)
  })

  it('should handle large attacker counts (11 not 10)', () => {
    // (20-10+1)/20 * 20 = 11
    expect(calcSuccessfulAttacks(10, 20)).toBe(11)
  })

  it('should round down for odd results', () => {
    // (20-15+1)/20 * 11 = 6/20 * 11 = 3.3 → 3
    expect(calcSuccessfulAttacks(15, 11)).toBe(3)
  })

  it('should round up for odd results', () => {
    // (20-14+1)/20 * 11 = 7/20 * 11 = 3.85 → 4
    expect(calcSuccessfulAttacks(14, 11)).toBe(4)
  })

  it('should return positive value for negative d20Needed (no lower clamp)', () => {
    // (20-(-5)+1)/20 * 10 = 26/20 * 10 = 13
    expect(calcSuccessfulAttacks(-5, 10)).toBe(13)
  })

  it('should return 1 for d20Needed=19 (DMG 2024 threshold)', () => {
    // (20-19+1)/20 * 10 = 1
    expect(calcSuccessfulAttacks(19, 10)).toBe(1)
  })

  it('should return 0 for zero totalAttacks', () => {
    expect(calcSuccessfulAttacks(10, 0)).toBe(0)
  })
})

describe('getTextFromAttackBonus', () => {
  it('should add + prefix for positive values', () => {
    expect(getTextFromAttackBonus(7)).toBe('+7')
  })

  it('should add + prefix for zero', () => {
    expect(getTextFromAttackBonus(0)).toBe('+0')
  })

  it('should keep existing + prefix', () => {
    expect(getTextFromAttackBonus(+5)).toBe('+5')
  })

  it('should keep existing - prefix', () => {
    expect(getTextFromAttackBonus(-3)).toBe('-3')
  })

  it('should handle negative numbers', () => {
    expect(getTextFromAttackBonus(-1)).toBe('-1')
  })

  it('should handle large positive numbers', () => {
    expect(getTextFromAttackBonus(25)).toBe('+25')
  })

  it('should handle large negative numbers', () => {
    expect(getTextFromAttackBonus(-10)).toBe('-10')
  })
})

describe('calcD20Needed', () => {
  it('should return (targetAC - attackBonus) for normal roll', () => {
    // AC 15, bonus 5 → need 10
    expect(calcD20Needed(5, 15, 0, 'mob2014')).toBe(10)
  })

  it('should return 1 when attackBonus exceeds AC', () => {
    // AC 10, bonus 15 → need -5, clamped to 1
    expect(calcD20Needed(15, 10, 0, 'mob2014')).toBe(1)
  })

  it('should return 20 when attackBonus is far below AC', () => {
    // AC 20, bonus -5 → need 25, clamped to 20
    expect(calcD20Needed(-5, 20, 0, 'mob2014')).toBe(20)
  })

  it('should subtract rollTypeValue for mob2014 advantage', () => {
    // AC 15, bonus 5, adv 2 → need 8
    expect(calcD20Needed(5, 15, 2, 'mob2014')).toBe(8)
  })

  it('should add rollTypeValue for mob2014 disadvantage', () => {
    // AC 15, bonus 5, dis 2 → need 12
    expect(calcD20Needed(5, 15, -2, 'mob2014')).toBe(12)
  })

  it('should clamp to 1 for negative result', () => {
    // AC 10, bonus 20, adv 10 → need -10, clamped to 1
    expect(calcD20Needed(20, 10, 10, 'mob2014')).toBe(1)
  })

  it('should clamp to 20 for result > 20', () => {
    // AC 20, bonus -10, dis 5 → need 35, clamped to 20
    expect(calcD20Needed(-10, 20, -5, 'mob2014')).toBe(20)
  })

  it('should return exact value when no adjustment needed', () => {
    // AC 11, bonus 0 → need 11
    expect(calcD20Needed(0, 11, 0, 'mob2014')).toBe(11)
  })

  it('should apply mob2024 advantage formula', () => {
    // AC 15, bonus 5 → d20Needed = 10
    // With adv 2: round(pow(9,2)/20 + 1) = round(81/20 + 1) = round(5.05) = 5
    expect(calcD20Needed(5, 15, 2, 'mob2024')).toBe(5)
  })

  it('should apply mob2024 disadvantage formula', () => {
    // AC 15, bonus 5 → d20Needed = 10
    // With dis 2: round(-pow(10-21,2)/20 + 21) = round(-121/20 + 21) = round(14.95) = 15
    expect(calcD20Needed(5, 15, -2, 'mob2024')).toBe(15)
  })
})

describe('calcAttackersNeeded', () => {
  it('should return 1 for d20Needed 1-5', () => {
    expect(calcAttackersNeeded(1)).toBe(1)
    expect(calcAttackersNeeded(3)).toBe(1)
    expect(calcAttackersNeeded(5)).toBe(1)
  })

  it('should return 2 for d20Needed 6-12', () => {
    expect(calcAttackersNeeded(6)).toBe(2)
    expect(calcAttackersNeeded(9)).toBe(2)
    expect(calcAttackersNeeded(12)).toBe(2)
  })

  it('should return 3 for d20Needed 13-14', () => {
    expect(calcAttackersNeeded(13)).toBe(3)
    expect(calcAttackersNeeded(14)).toBe(3)
  })

  it('should return 4 for d20Needed 15-16', () => {
    expect(calcAttackersNeeded(15)).toBe(4)
    expect(calcAttackersNeeded(16)).toBe(4)
  })

  it('should return 5 for d20Needed 17-18', () => {
    expect(calcAttackersNeeded(17)).toBe(5)
    expect(calcAttackersNeeded(18)).toBe(5)
  })

  it('should return 10 for d20Needed 19', () => {
    expect(calcAttackersNeeded(19)).toBe(10)
  })

  it('should return 20 for d20Needed >= 20', () => {
    expect(calcAttackersNeeded(20)).toBe(20)
    expect(calcAttackersNeeded(25)).toBe(20)
  })

  it('should return 0 for d20Needed below 1', () => {
    expect(calcAttackersNeeded(0)).toBe(0)
    expect(calcAttackersNeeded(-5)).toBe(0)
  })
})

describe('calcAttackersNeeded with a custom table', () => {
  // the tempSetting default, which mirrors the DMG 2014 table
  const defaultTable = [1, 5, 1, 6, 12, 2, 13, 14, 3, 15, 16, 4, 17, 18, 5, 19, 19, 10, 20, 20, 20]

  it('matches the DMG table when given the default custom table', () => {
    for (let d20Needed = 1; d20Needed <= 20; d20Needed++) {
      expect(calcAttackersNeeded(d20Needed, defaultTable)).toBe(calcAttackersNeeded(d20Needed))
    }
  })

  it('uses the custom rows instead of the DMG table', () => {
    const table = [1, 10, 2, 11, 20, 6]
    expect(calcAttackersNeeded(5, table)).toBe(2)
    expect(calcAttackersNeeded(15, table)).toBe(6)
  })

  it('parses string values saved from the settings form', () => {
    expect(calcAttackersNeeded(8, ['1', '10', '3', '11', '20', '7'])).toBe(3)
  })

  it('uses the absolute attacker count', () => {
    expect(calcAttackersNeeded(4, [1, 20, -4])).toBe(4)
  })

  it('returns 0 when no row covers the roll', () => {
    expect(calcAttackersNeeded(15, [1, 10, 2])).toBe(0)
  })
})

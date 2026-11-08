import { describe, it, expect, vi } from 'vitest'

// Mock modules that depend on Foundry globals
vi.mock('../../scripts/ui/RollSettingsMenu.js', () => ({
  RollSettingsMenu: class RollSettingsMenu {},
}))

vi.mock('../../scripts/ui/RollSettingsMenuV2.js', () => ({
  RollSettingsMenuV2: class RollSettingsMenuV2 {},
}))

vi.mock('../../scripts/ui/mobAttackDialog.js', () => ({
  MobAttackDialog: class MobAttackDialog {},
}))

vi.mock('../../scripts/ui/mobAttackDialogV2.js', () => ({
  MobAttackDialogV2: class MobAttackDialogV2 {},
}))

vi.mock('../../scripts/mobAttack.js', () => ({}))

vi.mock('../../scripts/macroObject.js', () => ({}))

// Import after mocking
const { calcSuccessfulAttacks, getTextFromAttackBonus } = await import('../../scripts/utils.js')

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

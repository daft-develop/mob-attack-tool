import { describe, it, expect, vi } from 'vitest'
import { getCasterLevel } from '../../scripts/system/dnd5e.js'
import { getScalingFactor } from '../../scripts/core/damage.js'

// dnd5e data access is tested in dnd5e.test.js; here only the scaling table matters
vi.mock('../../scripts/system/dnd5e.js', () => ({ getCasterLevel: vi.fn(), simplifyFormula: vi.fn() }))

const spell = { type: 'spell', actor: {} }

describe('getScalingFactor', () => {
  it.each([
    [1, 1], [4, 1],
    [5, 2], [10, 2],
    [11, 3], [16, 3],
    [17, 4], [20, 4],
  ])('caster level %i scales cantrips by %i', (level, factor) => {
    getCasterLevel.mockReturnValue(level)
    expect(getScalingFactor(spell)).toBe(factor)
  })

  it('returns 1 when the caster level is unknown', () => {
    getCasterLevel.mockReturnValue(undefined)
    expect(getScalingFactor(spell)).toBe(1)
  })

  it('returns 1 for non-spells without reading the caster level', () => {
    getCasterLevel.mockClear()
    expect(getScalingFactor({ type: 'weapon', actor: {} })).toBe(1)
    expect(getCasterLevel).not.toHaveBeenCalled()
  })
})

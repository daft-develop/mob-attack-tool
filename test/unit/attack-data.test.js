import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAttackData } from '../../scripts/core/attack.js'
import { getDamageFormulaAndType } from '../../scripts/core/damage.js'
import { getCasterLevel } from '../../scripts/system/dnd5e.js'

// dnd5e version differences are tested in dnd5e.test.js
vi.mock('../../scripts/system/dnd5e.js', () => ({
  getSpellMethod: vi.fn(),
  getCasterLevel: vi.fn(() => 1),
  simplifyFormula: formula => formula,
}))

// Stand-in for Foundry's Roll: substitutes @mod and implements alter() on the first dice term
beforeEach(() => {
  globalThis.Roll = class {
    constructor(formula, data = {}) {
      this.formula = formula.replace('@mod', data.mod ?? 0)
    }

    alter(multiply, add) {
      this.formula = this.formula.replace(/(\d+)d(\d+)/, (match, number, faces) => `${number * multiply + add}d${faces}`)
      return this
    }
  }
  getCasterLevel.mockReturnValue(1)
})

const activities = list => ({ getByType: type => list.filter(a => a.type === type) })

function attackActivity(parts, ability = 'str') {
  return {
    type: 'attack',
    ability,
    damage: { parts: parts.map(([formula, type, base = false]) => ({ formula, types: new Set([type]), base })) },
    range: { value: 5, units: 'ft' },
    rollDamage: vi.fn(),
  }
}

// a dnd5e damage field: dice number and denomination with a formula
function damageField(number, denomination, types = new Set(['slashing'])) {
  return {
    number,
    denomination,
    types,
    get formula() {
      return `${this.number}d${this.denomination}`
    },
    clone() {
      return damageField(this.number, this.denomination, this.types)
    },
    steppedDenomination() {
      return this.denomination + 2
    },
  }
}

function weapon({ parts, ability = 'str', versatile = null, magicalBonus = 0, mod = 3 } = {}) {
  const properties = new Set(versatile ? ['ver'] : [])
  return {
    type: 'weapon',
    name: 'Longsword',
    system: {
      activities: activities([attackActivity(parts, ability)]),
      properties,
      damage: { base: damageField(1, 8), versatile: versatile ?? damageField(0, 0) },
      magicAvailable: magicalBonus > 0,
      magicalBonus,
    },
    actor: { system: { abilities: { str: { mod }, int: { mod: 4 } } } },
  }
}

function cantrip(name, formula, { ability = 'int', level = 0 } = {}) {
  return {
    type: 'spell',
    name,
    system: { level, activities: activities([attackActivity([[formula, 'fire']], ability)]), properties: new Set() },
    actor: { system: { abilities: { int: { mod: 4 } } } },
  }
}

describe('getAttackData', () => {
  it('adds @mod to the base damage part only', () => {
    const data = getAttackData(weapon({ parts: [['1d8', 'slashing', true], ['1d6', 'fire']] }))
    expect(data.damage.parts).toEqual([['1d8 + @mod', 'slashing'], ['1d6', 'fire']])
  })

  it('does not add @mod twice', () => {
    const data = getAttackData(weapon({ parts: [['1d8 + @mod', 'slashing', true]] }))
    expect(data.damage.parts).toEqual([['1d8 + @mod', 'slashing']])
  })

  it('builds the versatile formula, stepping up the base die when it has none', () => {
    const data = getAttackData(weapon({ parts: [['1d8', 'slashing', true]], versatile: damageField(0, 0) }))
    expect(data.damage.versatile).toBe('1d10 + @mod')
  })

  it('keeps an explicit versatile die', () => {
    const data = getAttackData(weapon({ parts: [['1d8', 'slashing', true]], versatile: damageField(2, 6) }))
    expect(data.damage.versatile).toBe('2d6 + @mod')
  })

  it('has no versatile formula for a weapon without the property', () => {
    expect(getAttackData(weapon({ parts: [['1d8', 'slashing', true]] })).damage.versatile).toBe('')
  })

  it('reads the ability, or none', () => {
    expect(getAttackData(weapon({ parts: [['1d8', 'slashing']] })).ability).toBe('str')
    expect(getAttackData(weapon({ parts: [['1d8', 'slashing']], ability: null })).ability).toBe('none')
  })

  it('marks cantrips for scaling, except Eldritch Blast', () => {
    expect(getAttackData(cantrip('Fire Bolt', '1d10')).scaling).toEqual({ mode: 'cantrip' })
    expect(getAttackData(cantrip('Eldritch Blast', '1d10')).scaling).toBeUndefined()
    expect(getAttackData(cantrip('Scorching Ray', '2d6', { level: 2 })).scaling).toBeUndefined()
  })

  it('binds rollDamage to the activity', () => {
    const item = weapon({ parts: [['1d8', 'slashing']] })
    const activity = item.system.activities.getByType('attack')[0]
    getAttackData(item).rollDamage('config')
    expect(activity.rollDamage).toHaveBeenCalledWith('config')
    expect(activity.rollDamage.mock.contexts[0]).toBe(activity)
  })

  it('returns an empty object for an item without an attack', () => {
    const item = { type: 'weapon', system: { activities: activities([]), properties: new Set() } }
    expect(getAttackData(item)).toEqual({})
  })
})

describe('getDamageFormulaAndType', () => {
  it('substitutes the ability modifier and capitalizes the types', () => {
    const [formulas, types, labels] = getDamageFormulaAndType(weapon({ parts: [['1d8', 'slashing', true], ['1d6', 'fire']] }))
    expect(formulas).toEqual(['1d8 + 3', '1d6'])
    expect(types).toEqual(['Slashing', 'Fire'])
    expect(labels).toEqual(['slashing', 'fire'])
  })

  it('uses 0 for the modifier when the ability is none', () => {
    const [formulas] = getDamageFormulaAndType(weapon({ parts: [['1d8 + @mod', 'slashing']], ability: null }))
    expect(formulas).toEqual(['1d8 + 0'])
  })

  it('uses the versatile formula for the first part only', () => {
    const item = weapon({ parts: [['1d8', 'slashing', true], ['1d6', 'fire']], versatile: damageField(0, 0) })
    expect(getDamageFormulaAndType(item, true)[0]).toEqual(['1d10 + 3', '1d6'])
  })

  it('adds the magical bonus to the first part', () => {
    const item = weapon({ parts: [['1d8', 'slashing', true], ['1d6', 'fire']], magicalBonus: 2 })
    expect(getDamageFormulaAndType(item)[0]).toEqual(['1d8 + 3+ 2', '1d6'])
  })

  it.each([[1, '1d10'], [5, '2d10'], [11, '3d10'], [17, '4d10']])(
    'scales a cantrip at caster level %i to %s', (level, expected) => {
      getCasterLevel.mockReturnValue(level)
      expect(getDamageFormulaAndType(cantrip('Fire Bolt', '1d10'))[0]).toEqual([expected])
    })

  it('substitutes the modifier in a leveled spell without scaling it', () => {
    getCasterLevel.mockReturnValue(11)
    expect(getDamageFormulaAndType(cantrip('Scorching Ray', '2d6 + @mod', { level: 2 }))[0]).toEqual(['2d6 + 4'])
  })
})

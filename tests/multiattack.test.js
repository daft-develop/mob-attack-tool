import { jest, beforeAll, beforeEach, describe, test, expect } from '@jest/globals'

const mockFlattenMultiExtraDesc = jest.fn()

jest.unstable_mockModule('../scripts/utils.js', () => ({
  flattenMultiExtraDesc: mockFlattenMultiExtraDesc,
}))

let getMultiattackFromActor

beforeAll(async () => {
  ; ({ getMultiattackFromActor } = await import('../scripts/multiattack.js'))
})

beforeEach(() => {
  mockFlattenMultiExtraDesc.mockReset()
  mockFlattenMultiExtraDesc.mockImplementation(async (actor) => {
    const multiattackItem = actor.items.contents.find(i => i.name.startsWith('Multiattack') || i.name.startsWith('Extra Attack'))
    return multiattackItem?.system?.description?.value ?? ''
  })
})

function createMockItem({ name = 'Longsword', type = 'weapon', actionType = 'mwak', weaponType = 'martialM', description = '' } = {}) {
  return {
    name,
    type,
    actor: null,
    system: {
      actionType,
      weaponType,
      description: { value: description },
    },
  }
}

function createMockMulti(name, description) {
  return {
    name,
    type: 'feat',
    actor: null,
    system: {
      description: { value: description },
    },
  }
}

function createMockActor(items = [], level = 5) {
  const actor = {
    name: 'Mock Actor',
    type: 'character',
    system: {
      details: { level },
    },
    items: {
      contents: items,
      getName(itemName) {
        return this.contents.find(i => i.name === itemName)
      },
      filter(predicate) {
        return this.contents.filter(predicate)
      },
    },
  }

  items.forEach((item) => {
    item.actor = actor
  })

  return actor
}

describe('getMultiattackFromActor', () => {
  describe('Max Damage Search', () => {
    test('returns [x, true] if maxDamageWeapon and option enabled', async () => {
      const sword = createMockItem({ name: 'Sword' })
      const spear = createMockItem({ name: 'Spear' })

      const actor = createMockActor([sword, spear])

      let [, autoSelectSpear] = await getMultiattackFromActor('Spear', actor, {}, { checkMaxDamageWeapon: true, maxDamageWeapon: spear })
      expect(autoSelectSpear).toBe(true)

      let [, autoSelectSword] = await getMultiattackFromActor('Sword', actor, {}, { checkMaxDamageWeapon: true, maxDamageWeapon: spear })
      expect(autoSelectSword).toBe(false)
    })
  })

  describe('Default Case', () => {
    test('returns one weapon and auto-selects it when no multiattack is found', async () => {
      const weapon = createMockItem()
      const actor = createMockActor([weapon])

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, { longsword: weapon }, {})

      expect(count).toBe(1)
      expect(autoSelect).toBe(true)
    })
  })

  describe('Eldritch Blast', () => {
    test('scales Eldritch Blast with actor level', async () => {
      const eb = createMockItem({ name: 'Eldritch Blast', type: 'spell' })
      const actor = createMockActor([eb], 14)

      const [count, autoSelect] = await getMultiattackFromActor('Eldritch Blast', actor, {}, {})

      expect(count).toBe(3)
      expect(autoSelect).toBe(false)
    })

    test('prioritizes Eldritch Blast over Extra Attack', async () => {
      const eb = createMockItem({ name: 'Eldritch Blast', type: 'spell' })
      const multiattackItem = createMockItem({ name: 'Extra Attack', description: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.' })
      const actor = createMockActor([eb, multiattackItem], 14)

      const [count, autoSelect] = await getMultiattackFromActor('Eldritch Blast', actor, {}, {})

      expect(count).toBe(3)
      expect(autoSelect).toBe(false)
    })
  })

  describe('Extra Attack, Non-Fighter', () => {
    test('defaults to two attacks for Extra Attack when the actor is not a fighter', async () => {
      const weapon = createMockItem()
      const multiattackItem = createMockMulti('Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action on your turn.')
      const actor = createMockActor([weapon, multiattackItem], 20)

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

      expect(count).toBe(2)
      expect(autoSelect).toBe(false)
    })
  })

  describe('Extra Attack, Fighter', () => {
    test('trigger based on feat name', async () => {
      const weapon = createMockItem()
      const fighterExtraAttackItem = createMockItem({ name: 'Extra Attack (Fighter)', type: 'feat' })
      const actor = createMockActor([fighterExtraAttackItem, weapon], 15)

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

      expect(count).toBe(3)
      expect(autoSelect).toBe(false)
    })

    test('trigger based on general feat description', async () => {
      const weapon = createMockItem()
      const fighterExtraAttackItem = createMockItem({
        name: 'Extra Attack', type: 'feat', description:
          'You can attack twice, instead of once, whenever you take the Attack action on your turn. \
          The number of attacks increases to three when you reach 11th level in this class and to four when you reach 20th level in this class.' })
      const actor = createMockActor([fighterExtraAttackItem, weapon], 15)

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

      expect(count).toBe(3)
      expect(autoSelect).toBe(false)
    })

    test('trigger based on explicit description for third attack', async () => {
      const weapon = createMockItem()
      const fighterExtraAttackItem = createMockItem({
        name: 'Extra Attack', type: 'feat', description: 'You can attack three times',
      })
      const actor = createMockActor([fighterExtraAttackItem, weapon], 15)

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

      expect(count).toBe(3)
      expect(autoSelect).toBe(false)
    })

    test('trigger based on explicit description for fourth attack', async () => {
      const weapon = createMockItem()
      const fighterExtraAttackItem = createMockItem({
        name: 'Extra Attack', type: 'feat', description: 'You can attack four times',
      })
      const actor = createMockActor([fighterExtraAttackItem, weapon], 20)

      const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

      expect(count).toBe(4)
      expect(autoSelect).toBe(false)
    })
  })

  describe('Multiattack', () => {
    describe('not enough information', () => {
      test('no matching weapon', async () => {
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two longsword attacks')
        const actor = createMockActor([multiattackItem])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(0)
        expect(autoSelect).toBe(false)
      })

      test('no Multiattack description', async () => {
        const multiattackItem = createMockMulti('Multiattack', '')
        const actor = createMockActor([multiattackItem])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(0)
        expect(autoSelect).toBe(false)
      })
    })

    describe('single weapon in description', () => {
      test('specific description', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two longsword attacks')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test('specific description, inverted structure', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two attacks with its longsword')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test.skip('specific description, using twice', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature uses it\'s longsword twice')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test.skip('specific description, using twice, inverted structure', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature attacks twice with it\'s longsword')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test('general description, melee', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two melee attacks')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test('general description, ranged', async () => {
        const weapon = createMockItem({ name: 'Bow', type: 'weapon', actionType: 'rsak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two ranged attacks')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Bow', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test.skip('vague description', async () => {
        const weapon = createMockItem({ name: 'Claws', type: 'weapon', actionType: 'msak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes three attacks')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Claws', actor, {}, {})

        expect(count).toBe(3)
        expect(autoSelect).toBe(false)
      })
    })

    describe('multiple weapons in description', () => {
      test('parses multiple weapons from a basic, specific description, AND structure', async () => {
        const longsword = createMockItem({ name: 'Longsword' })
        const bow = createMockItem({ name: 'Longbow', actionType: 'rmak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two longsword attacks and one longbow attack')
        const actor = createMockActor([multiattackItem, longsword, bow])

        const [countSword, autoSelectSword] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(countSword).toBe(2)
        expect(autoSelectSword).toBe(true)

        const [countBow, autoSelectBow] = await getMultiattackFromActor('Longbow', actor, {}, {})
        expect(countBow).toBe(1)
        expect(autoSelectBow).toBe(true)
      })

      test.skip('parses multiple weapons from a basic, specific description, OR structure', async () => {
        const longsword = createMockItem({ name: 'Longsword' })
        const bow = createMockItem({ name: 'Bow' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two longsword attacks or one bow attack')
        const actor = createMockActor([multiattackItem, longsword, bow])

        const [countSword, autoSelectSword] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(countSword).toBe(2)
        expect(autoSelectSword).toBe(false)

        const [countBow, autoSelectBow] = await getMultiattackFromActor('Bow', actor, {}, {})
        expect(countBow).toBe(1)
        expect(autoSelectBow).toBe(false)
      })

      test('broad, general description', async () => {
        const longsword = createMockItem({ name: 'Longsword' })
        const bow = createMockItem({ name: 'Bow', actionType: 'rsak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two melee attacks or three ranged attacks')
        const actor = createMockActor([multiattackItem, longsword, bow])

        const [countSword, autoSelectSword] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(countSword).toBe(2)
        expect(autoSelectSword).toBe(false)

        const [countBow, autoSelectBow] = await getMultiattackFromActor('Bow', actor, {}, {})
        expect(countBow).toBe(3)
        expect(autoSelectBow).toBe(false)
      })
    })

    describe('random tests to hit coverage', () => {
      test('melee then ranged in description (assumes OR and doesn\'t autoselect)', async () => {
        const longsword = createMockItem({ name: 'Longsword' })
        const bow = createMockItem({ name: 'Bow', actionType: 'rsak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two melee attacks or three ranged attacks')
        const actor = createMockActor([multiattackItem, longsword, bow])

        const [countSword, autoSelectSword] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(countSword).toBe(2)
        expect(autoSelectSword).toBe(false)

        const [countBow, autoSelectBow] = await getMultiattackFromActor('Bow', actor, {}, {})
        expect(countBow).toBe(3)
        expect(autoSelectBow).toBe(false)
      })

      test('attack is melee but weapon isn\'t', async () => {
        const bow = createMockItem({ name: 'Bow', actionType: 'rsak' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two melee attacks')
        const actor = createMockActor([multiattackItem, bow])

        const [countBow, autoSelectBow] = await getMultiattackFromActor('Bow', actor, {}, {})
        expect(countBow).toBe(1)
        expect(autoSelectBow).toBe(false)
      })

      test('attack is ranged but weapon isn\'t', async () => {
        const longsword = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes two ranged attacks')
        const actor = createMockActor([multiattackItem, longsword])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(count).toBe(1)
        expect(autoSelect).toBe(false)
      })

      test('interpunction', async () => {
        const weapon = createMockItem()
        const multiattackItem = createMockMulti('Multiattack', 'The creature, makes two longsword attacks, then: we have more text.')
        const actor = createMockActor([multiattackItem, weapon])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

        expect(count).toBe(2)
        expect(autoSelect).toBe(true)
      })

      test('description has options, but not the word twice', async () => {
        const weapon = createMockItem()
        const claw = createMockItem({ name: 'Claw' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature uses two claw attacks, or three longsword attacks')
        const actor = createMockActor([multiattackItem, weapon, claw])

        const [countC, autoSelectC] = await getMultiattackFromActor('Claw', actor, {}, {})
        expect(countC).toBe(2)
        expect(autoSelectC).toBe(false)

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(count).toBe(3)
        expect(autoSelect).toBe(false)
      })

      test('description has options, with the word twice', async () => {
        const weapon = createMockItem()
        const claw = createMockItem({ name: 'Claw' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature makes three claw attacks. Alternatively, it can use it\'s longsword twice')
        const actor = createMockActor([multiattackItem, weapon, claw])

        const [countC, autoSelectC] = await getMultiattackFromActor('Claw', actor, {}, {})
        expect(countC).toBe(3)
        expect(autoSelectC).toBe(false)

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(count).toBe(2)
        expect(autoSelect).toBe(false)
      })

      test('description ends in \'twice\' and there are multiple weapons', async () => {
        const weapon = createMockItem()
        const spear = createMockItem({ name: 'Spear' })
        const claw = createMockItem({ name: 'Claw' })
        const multiattackItem = createMockMulti('Multiattack', 'The creature uses it\'s claw or longsword twice')
        const actor = createMockActor([multiattackItem, weapon, spear, claw])

        const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})
        expect(count).toBe(1)
        expect(autoSelect).toBe(false)

        const [countC, autoSelectC] = await getMultiattackFromActor('Claw', actor, {}, {})
        expect(countC).toBe(1)
        expect(autoSelectC).toBe(false)
      })
    })
  })
})

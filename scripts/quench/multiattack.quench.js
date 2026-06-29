import { getMultiattackFromActor } from '../multiattack.js'
import { getSpellScalingFactor } from '../scaling.js'

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

function createMockMulti(itemName, description = '') {
  return createMockItem({
    name: itemName,
    type: 'feat',
    description: description,
  })
}

function createMockActor(items = [], level = 5) {
  const actor = {
    name: 'Mock Actor',
    type: 'character',
    system: {
      details: { level: level },
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

export function registerMultiattackBatch(quench) {
  quench.registerBatch(
    'mat.multiattack',
    (context) => {
      const { describe, it, expect } = context

      describe('Fallback', function () {
        it('should return one weapon and one attack if no multiattack found', async function () {
          const weapon = createMockItem()
          const actor = createMockActor([weapon])

          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, { longsword: weapon }, {})

          expect(count).to.equal(1)
          expect(autoSelect).to.equal(true)
        })
      })

      describe('Extra Attack (Non-Fighter)', function () {
        it('should default to two attacks if Extra Attack available', async function () {
          const weapon = createMockItem()
          const multiattackItem = createMockMulti('Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action on your turn.')
          const actor = createMockActor([weapon, multiattackItem], 20)
          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

          expect(count).to.equal(2)
          expect(autoSelect).to.equal(false)
        })
      })

      describe('Extra Attack (Fighter)', function () {
        it('should use fighter-specific extra attack progression by level (level < 11)', async function () {
          const weapon = createMockItem()
          const fighterExtraAttackItem = createMockItem({ name: 'Extra Attack (Fighter)', type: 'feat' })
          const actor = createMockActor([fighterExtraAttackItem, weapon], 10)

          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

          expect(count).to.equal(2)
          expect(autoSelect).to.equal(false)
        })
        it('should use fighter-specific extra attack progression by level (11 <= level < 20)', async function () {
          const weapon = createMockItem()
          const fighterExtraAttackItem = createMockItem({ name: 'Extra Attack (Fighter)', type: 'feat' })
          const actor = createMockActor([fighterExtraAttackItem, weapon], 15)

          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

          expect(count).to.equal(3)
          expect(autoSelect).to.equal(false)
        })
        it('should use fighter-specific extra attack progression by level (level = 20)', async function () {
          const weapon = createMockItem()
          const fighterExtraAttackItem = createMockItem({ name: 'Extra Attack (Fighter)', type: 'feat' })
          const actor = createMockActor([fighterExtraAttackItem, weapon], 20)

          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

          expect(count).to.equal(4)
          expect(autoSelect).to.equal(false)
        })
      })

      describe('Eldritch Blast', function () {
        it('should scale Eldritch Blast with actor level', async function () {
          const eb = createMockItem({ name: 'Eldritch Blast', type: 'spell' })
          const actor = createMockActor([eb], 14)

          const [count, autoSelect] = await getMultiattackFromActor('Eldritch Blast', actor, {}, {})

          expect(count).to.equal(3)
          expect(autoSelect).to.equal(false)
        })

        it('should should prioritize Eldritch Blast over Extra Attack', async function () {
          const eb = createMockItem({ name: 'Eldritch Blast', type: 'spell' })
          const multiattackItem = createMockItem('Extra Attack', 'You can attack twice, instead of once, whenever you take the Attack action on your turn.')

          const actor = createMockActor([eb, multiattackItem], 14)

          const [count, autoSelect] = await getMultiattackFromActor('Eldritch Blast', actor, {}, {})

          expect(count).to.equal(3)
          expect(autoSelect).to.equal(false)
        })
      })

      describe('MultiAttack Parsing', function () {
        it('should resolve multiattack from basic description', async function () {
          const weapon = createMockItem()
          const multiattackItem = createMockMulti('Multiattack', 'The creature makes two attacks with its longsword')
          const actor = createMockActor([multiattackItem, weapon])

          const [count, autoSelect] = await getMultiattackFromActor('Longsword', actor, {}, {})

          expect(count).to.equal(2)
          expect(autoSelect).to.equal(true)
        })
      })
    },
    { displayName: 'MAT: Multiattack Checks' },
  )
}

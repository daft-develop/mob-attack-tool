// Combat: with "Autoselect saved mob combatants" on, a saved mob's tokens
// are selected when the combat tracker reaches one of their turns
import { test, expect } from './fixtures.mjs'
import { deleteTokens, placeTokens, selectTokens, setModuleSettings } from './scene.mjs'

const MOB = 'MAT e2e combat mob'

test.describe.serial('combat', () => {
  let mob, other, combatId, previousSettings

  test.beforeAll(async ({ gm }) => {
    previousSettings = await setModuleSettings(gm, { autoSelectMobCombatants: true, hiddenMobList: {} })
    mob = (await placeTokens(gm, 'Skeleton', 2, { row: 0 })).sort()
    ;[other] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    await gm.evaluate(async ({ name, ids }) => {
      const tokens = ids.map(id => canvas.tokens.get(id))
      await globalThis.MobAttacks.saveMob(name, tokens.map(t => t.actor), ids, ids.length)
    }, { name: MOB, ids: mob })
    // a combat in turn order: Archmage, then the two Skeletons
    combatId = await gm.evaluate(async ({ mob, other }) => {
      const combat = await CONFIG.Combat.documentClass.create({ scene: canvas.scene.id, active: true })
      await combat.createEmbeddedDocuments('Combatant', [other, ...mob].map((tokenId, i) => ({ tokenId, sceneId: canvas.scene.id, initiative: 30 - i })))
      await combat.startCombat()
      return combat.id
    }, { mob, other })
  })

  test.afterAll(async ({ gm }) => {
    await gm.evaluate(id => game.combats.get(id)?.delete(), combatId)
    await deleteTokens(gm, [...mob, other])
    await setModuleSettings(gm, previousSettings)
  })

  test('reaching a saved mob combatant\'s turn selects the whole mob', async ({ gm }) => {
    await selectTokens(gm, [other])
    await gm.evaluate(id => game.combats.get(id).nextTurn(), combatId)
    await gm.waitForFunction(count => canvas.tokens.controlled.length === count, mob.length)
    expect(await gm.evaluate(() => canvas.tokens.controlled.map(t => t.id).sort())).toEqual(mob)
  })
})

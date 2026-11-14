// Saved mobs in the Mob Attack dialog
import { ensureModules, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { DIALOG, executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

const MOB = 'MAT e2e mob'

const selectedIds = page => page.evaluate(() => canvas.tokens.controlled.map(t => t.id).sort())
const closeDialog = page => page.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())

test.describe.serial('saved mobs', () => {
  let mob, target, previousSettings

  test.beforeAll(async ({ gm }) => {
    await ensureModules(gm, { 'midi-qol': false })
    previousSettings = await setModuleSettings(gm, {
      mobRules: 'individual',
      autoDetectMultiattacks: 0,
      showIndividualDamageRolls: false,
      keepDialogOpen: false,
      enableDiceSoNice: false,
      hiddenMobList: {},
    })
    mob = (await placeTokens(gm, 'Skeleton', 3, { row: 0 })).sort()
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    await gm.evaluate(async ({ name, ids }) => {
      const tokens = ids.map(id => canvas.tokens.get(id))
      await globalThis.MobAttacks.saveMob(name, tokens.map(t => t.actor), ids, ids.length)
    }, { name: MOB, ids: mob })
  })

  test.afterAll(async ({ gm }) => {
    await closeDialog(gm)
    await deleteTokens(gm, [...mob, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
  })

  test.afterEach(async ({ gm }) => closeDialog(gm))

  test('opening the dialog with nothing selected loads your saved mob', async ({ gm }) => {
    await selectTokens(gm, [])
    const dialog = await openMobDialog(gm)
    await expect(dialog.locator('input[name="mobName"]')).toHaveValue(MOB)
    expect(await selectedIds(gm)).toEqual(mob)
  })

  test('deselecting every token with the dialog open leaves nothing selected', async ({ gm }) => {
    await selectTokens(gm, mob)
    const dialog = await openMobDialog(gm)
    await gm.evaluate(() => canvas.tokens.releaseAll())
    await expect(dialog.locator('input[name="mobName"]')).not.toHaveValue(MOB)
    // give a wrongly reselecting render time to happen
    await gm.waitForTimeout(1000)
    expect(await selectedIds(gm)).toEqual([])
  })

  test('a loaded saved mob rolls its attacks', async ({ gm }) => {
    await selectTokens(gm, [])
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await expect(dialog.locator('input[name="mobName"]')).toHaveValue(MOB)
    // load it through the mob list, as a user would
    await gm.evaluate(async (name) => {
      const app = foundry.applications.instances.get('mob-attack-tool-dialog')
      await app._loadMob(app, name)
    }, MOB)
    await gm.locator(DIALOG).locator('input.useWeapon').first().waitFor()
    await useOnlyWeapons(gm.locator(DIALOG), [await weaponId(gm, 'Skeleton', 'Longsword')])

    const since = await lastMessageId(gm)
    await queueDice(gm, [17, 17, 17])
    await executeMobAttack(gm.locator(DIALOG))
    await waitForMessages(gm, since, 2)
    const damage = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))
    expect(damage).toHaveLength(1)
    // three hits with a d8 longsword
    expect(damage[0].rolls[0].formula).toMatch(/^3d8\b/)
  })
})

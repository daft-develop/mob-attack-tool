// Exported mob attack macros, run from the hotbar as a user would
import { ensureModules, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { DIALOG, clickExport, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

const HOTBAR_SLOT = 10

/**
 * Export the dialog's mob attack as a macro with the given name
 * @param {import('@playwright/test').Page} page - a GM page with the Mob Attack dialog open
 * @param {string} name - the macro name to type
 * @returns {Promise<string>} the name the dialog suggested
 */
async function exportMacro(page, name) {
  await clickExport(page.locator(DIALOG))
  const input = page.locator('input[name="macroName"]')
  await input.waitFor()
  const suggested = await input.inputValue()
  await input.fill(name)
  await page.locator('dialog, .application').filter({ has: input }).locator('button[data-action="ok"]').click()
  await page.waitForFunction(name => game.macros.getName(name), name)
  return suggested
}

/**
 * Put a macro on the hotbar and click it
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string} name - the macro's name
 */
async function runFromHotbar(page, name) {
  await page.evaluate(async ({ name, slot }) => {
    await game.user.assignHotbarMacro(game.macros.getName(name), slot)
  }, { name, slot: HOTBAR_SLOT })
  await page.locator(`#hotbar [data-slot="${HOTBAR_SLOT}"]`).click()
}

test.describe.serial('exported macros', () => {
  let attackers, target, previousSettings
  const macroNames = []

  test.beforeAll(async ({ gm }) => {
    await ensureModules(gm, { 'midi-qol': false })
    previousSettings = await setModuleSettings(gm, {
      mobRules: 'individual',
      autoDetectMultiattacks: 0,
      showIndividualDamageRolls: false,
      keepDialogOpen: true,
      enableDiceSoNice: false,
      hiddenMobList: {},
    })
    attackers = await placeTokens(gm, 'Skeleton', 2, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    await gm.evaluate(() => {
      globalThis.matWarnings = []
      const warn = ui.notifications.warn.bind(ui.notifications)
      ui.notifications.warn = (message, options) => {
        globalThis.matWarnings.push(String(message))
        return warn(message, options)
      }
    })
  })

  test.afterAll(async ({ gm }) => {
    await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
    await gm.evaluate(async (names) => {
      const ids = names.map(n => game.macros.getName(n)?.id).filter(Boolean)
      if (ids.length) await Macro.deleteDocuments(ids)
    }, macroNames)
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
  })

  test.afterEach(async ({ gm }) => {
    await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
    await clearDice(gm)
  })

  test('exporting with no weapon checked warns instead of failing', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [])
    await clickExport(dialog)
    await gm.waitForFunction(() => globalThis.matWarnings.length > 0)
    expect(await gm.evaluate(() => globalThis.matWarnings.at(-1))).toContain('weapon')
  })

  test('a macro whose name has quotes and markup exports and rolls from the hotbar', async ({ gm }) => {
    const name = 'Skeletons "Rusty" <b>bold</b>'
    macroNames.push(name)
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])
    await exportMacro(gm, name)

    const since = await lastMessageId(gm)
    await queueDice(gm, [16, 16])
    await runFromHotbar(gm, name)
    await waitForMessages(gm, since, 2)
    const damage = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))
    expect(damage).toHaveLength(1)
    expect(damage[0].rolls[0].formula).toMatch(/^2d8\b/)
  })

  test('a macro rolls a weapon renamed on an unlinked token', async ({ gm }) => {
    const name = 'MAT e2e renamed weapon'
    macroNames.push(name)
    await gm.evaluate(async (id) => {
      await canvas.tokens.get(id).actor.items.getName('Longsword').update({ name: 'Rusty Longsword' })
    }, attackers[0])
    await selectTokens(gm, [attackers[0]])
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    const renamedId = await gm.evaluate(id => canvas.tokens.get(id).actor.items.getName('Rusty Longsword').id, attackers[0])
    await useOnlyWeapons(dialog, [renamedId])
    await exportMacro(gm, name)

    const since = await lastMessageId(gm)
    await queueDice(gm, [16])
    await runFromHotbar(gm, name)
    await waitForMessages(gm, since, 2)
    const damage = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))
    expect(damage).toHaveLength(1)
    expect(damage[0].flavor).toContain('Rusty Longsword')
  })

  test('a macro exported from a loaded saved mob uses that mob’s token count', async ({ gm }) => {
    const name = 'MAT e2e loaded mob'
    macroNames.push(name)
    // a one-token mob first in the list, then the two-token mob to export
    await gm.evaluate(async (ids) => {
      const actors = ids.map(id => canvas.tokens.get(id).actor)
      await globalThis.MobAttacks.saveMob('Small mob', actors.slice(0, 1), ids.slice(0, 1), 1)
      await globalThis.MobAttacks.saveMob('Big mob', actors, ids, 2)
    }, attackers)
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await gm.evaluate(async () => {
      const app = foundry.applications.instances.get('mob-attack-tool-dialog')
      await app._loadMob(app, 'Big mob')
    })
    await expect(dialog.locator('input[name="mobName"]')).toHaveValue('Big mob')
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])
    await exportMacro(gm, name)

    const command = await gm.evaluate(name => game.macros.getName(name).command, name)
    expect(command).toContain('numSelected: 2,')
    await setModuleSettings(gm, { hiddenMobList: {} })
  })
})

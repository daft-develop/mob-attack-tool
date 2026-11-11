// Helpers for driving the Mob Attack dialog in end-to-end tests

export const DIALOG = '#mob-attack-tool-dialog'

/**
 * Open the Mob Attack dialog for the selected tokens and wait for it
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @returns {Promise<import('@playwright/test').Locator>} the dialog
 */
export async function openMobDialog(page) {
  await page.evaluate(() => globalThis.MobAttacks.createDialog())
  const dialog = page.locator(DIALOG)
  await dialog.locator('button[name="executeMobAttack"]').waitFor()
  return dialog
}

/**
 * Close the Mob Attack dialog if it is open
 * @param {import('@playwright/test').Page} page - a Foundry page
 */
export async function closeMobDialog(page) {
  await page.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
  await page.locator(DIALOG).waitFor({ state: 'detached' })
}

/**
 * The id of a weapon on a world actor
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string} actorName - the world actor's name
 * @param {string} weaponName - the item's name
 * @returns {Promise<string>} the item id
 */
export function weaponId(page, actorName, weaponName) {
  return page.evaluate(({ actorName, weaponName }) => game.actors.getName(actorName).items.getName(weaponName).id, { actorName, weaponName })
}

/**
 * Check exactly the given weapons in the dialog (by item id), unchecking the rest
 * @param {import('@playwright/test').Locator} dialog - from openMobDialog
 * @param {string[]} ids - item ids; add ' (Versatile)' for a versatile entry
 */
export async function useOnlyWeapons(dialog, ids) {
  const wanted = new Set(ids.map(id => `use${id.replace(' ', '-')}`))
  for (const box of await dialog.locator('input.useWeapon').all()) {
    const name = await box.getAttribute('name')
    await box.setChecked(wanted.has(name))
  }
}

/**
 * Run the mob attack from the dialog
 * @param {import('@playwright/test').Locator} dialog - from openMobDialog
 */
export async function executeMobAttack(dialog) {
  await dialog.locator('button[name="executeMobAttack"]').click()
}

/**
 * Click the dialog's macro export button, expanding the options section it is in first
 * @param {import('@playwright/test').Locator} dialog - from openMobDialog
 */
export async function clickExport(dialog) {
  const button = dialog.locator('button[name="exportMobAttack"]')
  if (!(await button.isVisible())) await dialog.locator('a.mat-collapsible').click()
  await button.click()
}

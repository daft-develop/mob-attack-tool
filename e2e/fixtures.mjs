// Playwright fixtures for driving Foundry through its own API (page.evaluate)
// rather than through canvas clicks.
import { test as base, expect } from '@playwright/test'
import { settings } from './config.mjs'

const waitForReady = page => page.waitForFunction(() => globalThis.game?.ready && globalThis.canvas?.ready, null, { timeout: 90_000 })

/**
 * Log in to the running world and wait until Foundry is ready
 * @param {import('@playwright/test').Page} page - a fresh page
 * @param {string} userName - the user to join as
 * @param {string} password - the user's password
 */
export async function joinWorld(page, userName, password) {
  await page.goto('/join')
  // Foundry 13's join form has no accessible labels, so match on structure
  const form = page.locator('form', { has: page.locator('input[type="password"]') }).first()
  await form.locator('select', { has: page.locator('option', { hasText: userName }) }).selectOption({ label: userName })
  await form.locator('input[type="password"]').fill(password)
  await form.getByRole('button', { name: /Join Game Session/ }).click()
  await page.waitForURL('**/game')
  await waitForReady(page)
}

/**
 * Turn modules on or off in the test world (a throwaway copy), reloading
 * the page when anything changed. Modules that aren't installed are skipped.
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {Record<string, boolean>} modules - module id → whether it should be active
 * @returns {Promise<Record<string, boolean>>} which of the modules are active afterwards
 */
export async function ensureModules(page, modules) {
  const changed = await page.evaluate(async (wanted) => {
    const config = { ...game.settings.get('core', 'moduleConfiguration') }
    let changed = false
    for (const [id, active] of Object.entries(wanted)) {
      if (!game.modules.has(id) || Boolean(game.modules.get(id).active) === active) continue
      config[id] = active
      changed = true
    }
    if (changed) await game.settings.set('core', 'moduleConfiguration', config)
    return changed
  }, modules)
  if (changed) {
    await page.reload()
    await waitForReady(page)
  }
  return page.evaluate(ids => Object.fromEntries(ids.map(id => [id, Boolean(game.modules.get(id)?.active)])), Object.keys(modules))
}

export const test = base.extend({
  // One logged-in GM page for every test in the worker: joining takes a while.
  // Quench is turned on so the module's Quench batches can run.
  gm: [async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => console.log(`[browser error] ${error.message}`))
    await joinWorld(page, settings.gmUser, settings.gmPassword)
    await ensureModules(page, { quench: true })
    await use(page)
    await context.close()
  }, { scope: 'worker' }],

  // A logged-in player page in its own browser context, alongside the GM's.
  // Depends on gm, so module changes the GM makes happen before it joins.
  // eslint-disable-next-line no-unused-vars -- gm is only a dependency, see above
  player: [async ({ browser, gm }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => console.log(`[player browser error] ${error.message}`))
    await joinWorld(page, settings.playerUser, settings.playerPassword)
    await use(page)
    await context.close()
  }, { scope: 'worker' }],
})

export { expect }

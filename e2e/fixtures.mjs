// Playwright fixtures for driving Foundry through its own API (page.evaluate)
// rather than through canvas clicks.
import { test as base, expect } from '@playwright/test'
import { settings } from './config.mjs'
import { clearDice } from './dice.mjs'

// Browser errors from the GM and player pages during the current test
const pageErrors = []

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
 * Turning a module on also turns on the modules it requires, as Foundry's
 * module manager does (e.g. Automated Animations needs Sequencer).
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {Record<string, boolean>} modules - module id → whether it should be active
 * @returns {Promise<Record<string, boolean>>} which of the modules are active afterwards
 */
export async function ensureModules(page, modules) {
  const changed = await page.evaluate(async (wanted) => {
    const config = { ...game.settings.get('core', 'moduleConfiguration') }
    let changed = false
    const visited = new Set()
    const setActive = (id, active) => {
      const module = game.modules.get(id)
      if (!module || visited.has(id)) return
      visited.add(id)
      if (Boolean(module.active) !== active && config[id] !== active) {
        config[id] = active
        changed = true
      }
      if (!active) return
      for (const required of module.relationships?.requires ?? []) {
        if ((required.type ?? 'module') === 'module') setActive(required.id, true)
      }
    }
    for (const [id, active] of Object.entries(wanted)) setActive(id, active)
    if (changed) await game.settings.set('core', 'moduleConfiguration', config)
    return changed
  }, modules)
  if (changed) {
    await page.reload()
    await waitForReady(page)
  }
  return page.evaluate(ids => Object.fromEntries(ids.map(id => [id, Boolean(game.modules.get(id)?.active)])), Object.keys(modules))
}

/**
 * Why a module is not active: the modules it requires that aren't installed,
 * so a skip can say e.g. "missing: dae" instead of only "not installed"
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {string} id - the module id
 * @returns {Promise<string>} the reason, for a skip message
 */
export async function inactiveReason(page, id) {
  const reasons = await page.evaluate((moduleId) => {
    const relationships = game.modules.get(moduleId)?.relationships ?? {}
    const reasons = []
    const missing = (relationships.requires ?? [])
      .filter(r => (r.type ?? 'module') === 'module' && !game.modules.get(r.id))
      .map(r => r.id)
    if (missing.length) reasons.push(`missing: ${missing.join(', ')}`)
    // the module's declared range for the installed game system
    const { minimum, maximum } = (relationships.systems ?? []).find(r => r.id === game.system.id)?.compatibility ?? {}
    const version = game.system.version
    if (minimum && foundry.utils.isNewerVersion(minimum, version)) reasons.push(`${game.system.id} ${version} is older than ${minimum}`)
    if (maximum && foundry.utils.isNewerVersion(version, maximum)) reasons.push(`${game.system.id} ${version} is newer than ${maximum}`)
    return reasons
  }, id)
  return reasons.length ? reasons.join('; ') : 'not installed or not compatible with this target'
}

export const test = base.extend({
  // One logged-in GM page for every test in the worker: joining takes a while.
  // Quench is turned on so the module's Quench batches can run.
  gm: [async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      console.log(`[browser error] ${error.message}`)
      pageErrors.push(`GM: ${error.message}`)
    })
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
    page.on('pageerror', (error) => {
      console.log(`[player browser error] ${error.message}`)
      pageErrors.push(`Player: ${error.message}`)
    })
    await joinWorld(page, settings.playerUser, settings.playerPassword)
    await use(page)
    await context.close()
  }, { scope: 'worker' }],

  // Runs around every test: fails it if either page threw (a mob attack runs
  // without the dialog waiting for it, so its errors would otherwise only be
  // logged), and drops dice faces it queued but didn't roll
  afterEachTest: [async ({ gm }, use) => {
    pageErrors.length = 0
    await use()
    await clearDice(gm)
    expect(pageErrors, 'browser errors during the test').toEqual([])
  }, { auto: true }],
})

export { expect }

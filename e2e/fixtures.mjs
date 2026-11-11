// Playwright fixtures for driving Foundry through its own API (page.evaluate)
// rather than through canvas clicks.
import { test as base, expect } from '@playwright/test'
import { settings } from './config.mjs'

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
  await page.waitForFunction(() => globalThis.game?.ready && globalThis.canvas?.ready, null, { timeout: 90_000 })
}

export const test = base.extend({
  // One logged-in GM page for every test in the worker: joining takes a while
  gm: [async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('pageerror', error => console.log(`[browser error] ${error.message}`))
    await joinWorld(page, settings.gmUser, settings.gmPassword)
    await use(page)
    await context.close()
  }, { scope: 'worker' }],
})

export { expect }

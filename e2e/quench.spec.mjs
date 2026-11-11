// Runs the module's Quench test batches (scripts/quench.js) inside Foundry.
// Quench must be installed and active in the test world. The batches are
// registered from here, so mobAttack.js doesn't need initQuenchTests().
import { test, expect } from './fixtures.mjs'

test('the Quench test batches pass', async ({ gm }) => {
  const quenchActive = await gm.evaluate(() => Boolean(game.modules.get('quench')?.active))
  test.skip(!quenchActive, 'Quench is not active in the test world')

  const report = await gm.evaluate(async () => {
    const { registerQuenchBatches } = await import('/modules/mob-attack-tool/scripts/quench.js')
    registerQuenchBatches(globalThis.quench)
    // Quench writes its results into its window, so it has to be open
    await globalThis.quench.app.render(true)
    const reported = new Promise(resolve => Hooks.once('quenchReports', reports => resolve(reports.json)))
    await globalThis.quench.runBatches(['mob-attack-tool.**'], { json: true })
    return JSON.parse(await reported)
  })

  console.log(`[e2e] Quench: ${report.stats.passes} passed, ${report.stats.failures} failed, ${report.stats.pending} pending`)
  const failures = report.failures.map(f => `${f.fullTitle}\n    ${f.err?.message ?? ''}`)
  expect(failures, failures.join('\n')).toEqual([])
  expect(report.stats.passes).toBeGreaterThan(0)
})

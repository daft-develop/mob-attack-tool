// Run the end-to-end tests once per target listed in .env (FOUNDRY_TARGETS),
// one after another, then print a summary. Extra arguments go to Playwright,
// e.g. `npm run test:e2e:all -- e2e/quench.spec.mjs` or `-g "damage card"`.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { repoRoot, targetNames } from '../e2e/config.mjs'

// Playwright's CLI, run with node directly: through a shell, arguments
// containing spaces would be split
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli')

// Counts from Playwright's JSON report; flaky tests count as passed
function countsFrom(jsonPath) {
  if (!existsSync(jsonPath)) return null
  const { stats } = JSON.parse(readFileSync(jsonPath, 'utf8'))
  return { passed: stats.expected + stats.flaky, failed: stats.unexpected, skipped: stats.skipped }
}

const results = []
for (const target of targetNames()) {
  console.log(`\n=== ${target} ===`)
  const jsonPath = join(repoRoot, 'test-results', target, 'results.json')
  // the JSON report is added after the arguments, so it is always written
  const run = spawnSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2), '--reporter=list,json'], {
    stdio: 'inherit',
    env: { ...process.env, FOUNDRY_TARGET: target, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
  })
  results.push({ target, passed: run.status === 0, counts: countsFrom(jsonPath) })
}

console.log('\n=== Summary ===')
for (const { target, passed, counts } of results) {
  const tally = counts
    ? `${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped`
    : 'no results (the run did not finish)'
  console.log(`${passed ? 'passed' : 'FAILED'}  ${target}: ${tally}`)
}
process.exit(results.every(r => r.passed) ? 0 : 1)

// Run the end-to-end tests once per target listed in .env (FOUNDRY_TARGETS),
// one after another, then print a summary. Extra arguments go to Playwright,
// e.g. `npm run test:e2e:all -- e2e/quench.spec.mjs` or `-g "damage card"`.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { targetNames } from '../e2e/config.mjs'

// Playwright's CLI, run with node directly: through a shell, arguments
// containing spaces would be split
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli')

const results = []
for (const target of targetNames()) {
  console.log(`\n=== ${target} ===`)
  const run = spawnSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, FOUNDRY_TARGET: target },
  })
  results.push({ target, passed: run.status === 0 })
}

console.log('\n=== Summary ===')
for (const { target, passed } of results) console.log(`${passed ? 'passed' : 'FAILED'}  ${target}`)
process.exit(results.every(r => r.passed) ? 0 : 1)

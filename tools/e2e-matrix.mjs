// Run the end-to-end tests once per target listed in .env (FOUNDRY_TARGETS),
// one after another, then print a summary. Extra arguments go to Playwright,
// e.g. `npm run test:e2e:all -- e2e/quench.spec.mjs`.
import { spawnSync } from 'node:child_process'
import { targetNames } from '../e2e/config.mjs'

const results = []
for (const target of targetNames()) {
  console.log(`\n=== ${target} ===`)
  const run = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FOUNDRY_TARGET: target },
  })
  results.push({ target, passed: run.status === 0 })
}

console.log('\n=== Summary ===')
for (const { target, passed } of results) console.log(`${passed ? 'passed' : 'FAILED'}  ${target}`)
process.exit(results.every(r => r.passed) ? 0 : 1)

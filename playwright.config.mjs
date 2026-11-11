// End-to-end tests against a real Foundry server. Settings come from .env
// (see .env.example); FOUNDRY_TARGET picks the Foundry/dnd5e combination.
import { defineConfig } from '@playwright/test'
import { getTarget, settings } from './e2e/config.mjs'

const target = getTarget()

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  // one Foundry world shared by every test: run them one at a time
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: `test-results/${target.name}`,
  use: {
    baseURL: `http://localhost:${settings.port}`,
    channel: settings.browserChannel,
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `node e2e/start-foundry.mjs ${target.name}`,
    url: `http://localhost:${settings.port}/api/status`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  metadata: { target: target.name },
})

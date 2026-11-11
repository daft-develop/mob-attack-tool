// Reads the end-to-end test settings from .env (see .env.example).
// Nothing machine-specific is hardcoded: each Foundry/dnd5e combination
// to test is a "target" with its own install and data folder.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

export const repoRoot = resolve(import.meta.dirname, '..')

const envFile = join(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const env = name => process.env[name]?.trim() || undefined

function requireEnv(name) {
  const value = env(name)
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`)
  return value
}

/**
 * @typedef {object} Target
 * @property {string} name - the target name, e.g. v14_dnd5e6
 * @property {string} code - the Foundry install folder (contains main.js)
 * @property {string} data - the Foundry data folder (contains Config/ and Data/)
 * @property {string[]} disabledModules - module ids left out of the test data folder
 */

/**
 * The target names listed in FOUNDRY_TARGETS, in order
 * @returns {string[]} the names
 */
export function targetNames() {
  return requireEnv('FOUNDRY_TARGETS').split(',').map(name => name.trim()).filter(Boolean)
}

/**
 * The settings of one target
 * @param {string} [name] - a name from FOUNDRY_TARGETS; FOUNDRY_TARGET or the first target by default
 * @returns {Target} the target
 */
export function getTarget(name = env('FOUNDRY_TARGET') ?? targetNames()[0]) {
  if (!targetNames().includes(name)) throw new Error(`Target "${name}" is not listed in FOUNDRY_TARGETS`)
  return {
    name,
    code: requireEnv(`FOUNDRY_${name}_CODE`),
    data: requireEnv(`FOUNDRY_${name}_DATA`),
    disabledModules: (env(`FOUNDRY_${name}_DISABLE_MODULES`) ?? '').split(',').map(id => id.trim()).filter(Boolean),
  }
}

export const settings = {
  world: env('FOUNDRY_WORLD') ?? 'testing',
  gmUser: env('FOUNDRY_GM_USER') ?? 'Gamemaster',
  gmPassword: env('FOUNDRY_GM_PASSWORD') ?? '',
  playerUser: env('FOUNDRY_PLAYER_USER') ?? 'Player',
  playerPassword: env('FOUNDRY_PLAYER_PASSWORD') ?? '',
  port: Number(env('FOUNDRY_PORT') ?? 30199),
  browserChannel: env('FOUNDRY_BROWSER_CHANNEL') ?? 'msedge',
  // throwaway data folders are built here, one per target
  workDir: env('FOUNDRY_WORK_DIR') ?? join(tmpdir(), 'mat-e2e'),
}

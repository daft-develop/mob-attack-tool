// Starts Foundry for one test target on a throwaway data folder, so tests
// never write to the real worlds. Playwright runs this as its webServer.
//
// The throwaway folder (FOUNDRY_WORK_DIR/<target>) holds:
//   Config/        license.json copied from the target's data folder
//   Data/modules/  each module mirrored (files and packs copied, folders
//                  linked), except disabled ones;
//                  mob-attack-tool points at this repository
//   Data/worlds/   a fresh copy of the test world, made on every start
//   Data/systems/  each system mirrored like the modules
//   Data/<other>   other folders (assets, ...) with their subfolders linked
//
// Usage: node e2e/start-foundry.mjs [target]
import { spawn } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getTarget, repoRoot, settings } from './config.mjs'

const MODULE_ID = 'mob-attack-tool'

/**
 * Remove a folder, unlinking junctions inside it first so their targets are never touched
 * @param {string} dir - the folder to remove
 */
function removeSafely(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) unlinkSync(path)
    else if (stat.isDirectory()) removeSafely(path)
  }
  rmSync(dir, { recursive: true, force: true })
}

function link(target, path) {
  symlinkSync(target, path, 'junction')
}

/**
 * The top-level folders of a package that hold its compendium packs: packs/,
 * and every folder its manifest's packs[].path points into (some modules keep
 * packs elsewhere, e.g. compendiums/ or assets/)
 * @param {string} manifestPath - the package's module.json or system.json
 * @returns {Set<string>} the folder names
 */
export function packFolders(manifestPath) {
  const folders = new Set(['packs'])
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  }
  catch {
    return folders
  }
  for (const pack of manifest.packs ?? []) {
    const folder = String(pack.path ?? '').replace(/^\.?[/\\]/, '').split(/[/\\]/)[0]
    if (folder && folder !== '..') folders.add(folder)
  }
  return folders
}

/**
 * Mirror a system or module folder: its files and pack folders are copied,
 * its other folders linked. Foundry writes to compendium packs (LevelDB) when
 * it opens them, so linking packs would write to the real install, and clash
 * with a Foundry instance running on it.
 * @param {string} source - the real package folder
 * @param {string} destination - the folder to create
 * @param {string} manifestPath - the package's module.json or system.json
 */
function mirrorPackage(source, destination, manifestPath) {
  const copied = packFolders(manifestPath)
  mkdirSync(destination)
  for (const entry of readdirSync(source)) {
    const path = join(source, entry)
    if (copied.has(entry) || !statSync(path).isDirectory()) cpSync(path, join(destination, entry), { recursive: true })
    else link(path, join(destination, entry))
  }
}

/**
 * Mirror a top-level asset folder (e.g. Data/assets): its subfolders are
 * linked and its small files copied, so the README.txt Foundry writes on
 * start lands in the copy. A folder that can't be read (e.g. a link to a
 * missing drive) is linked as it is.
 * @param {string} source - the real folder
 * @param {string} destination - the folder to create
 */
function mirrorAssetFolder(source, destination) {
  let entries
  try {
    entries = readdirSync(source)
  }
  catch {
    link(source, destination)
    return
  }
  mkdirSync(destination)
  for (const entry of entries) {
    const path = join(source, entry)
    const stat = statSync(path, { throwIfNoEntry: false })
    if (!stat) continue
    if (stat.isDirectory()) link(path, join(destination, entry))
    else if (stat.size < 1024 * 1024) copyFileSync(path, join(destination, entry))
  }
}

/**
 * Build the throwaway data folder for a target
 * @param {import('./config.mjs').Target} target - the target
 * @returns {string} the data folder
 */
export function buildDataFolder(target) {
  const realData = join(target.data, 'Data')
  const realWorld = join(realData, 'worlds', settings.world)
  if (!existsSync(join(target.code, 'main.js'))) throw new Error(`No main.js in ${target.code} (FOUNDRY_${target.name}_CODE)`)
  if (!existsSync(realWorld)) throw new Error(`No "${settings.world}" world in ${realData}`)

  const work = join(settings.workDir, target.name)
  removeSafely(work)
  mkdirSync(join(work, 'Config'), { recursive: true })
  mkdirSync(join(work, 'Data', 'modules'), { recursive: true })
  mkdirSync(join(work, 'Data', 'worlds'), { recursive: true })

  copyFileSync(join(target.data, 'Config', 'license.json'), join(work, 'Config', 'license.json'))
  writeFileSync(join(work, 'Config', 'options.json'), JSON.stringify({
    port: settings.port,
    upnp: false,
    world: null,
    hotReload: false,
    telemetry: false,
    updateChannel: 'stable',
  }, null, 2))

  for (const entry of readdirSync(realData)) {
    if (['modules', 'systems', 'worlds'].includes(entry)) continue
    const path = join(realData, entry)
    if (statSync(path).isDirectory()) mirrorAssetFolder(path, join(work, 'Data', entry))
  }
  mkdirSync(join(work, 'Data', 'systems'))
  for (const systemId of readdirSync(join(realData, 'systems'))) {
    if (!existsSync(join(realData, 'systems', systemId, 'system.json'))) continue
    mirrorPackage(join(realData, 'systems', systemId), join(work, 'Data', 'systems', systemId), join(realData, 'systems', systemId, 'system.json'))
  }
  for (const moduleId of readdirSync(join(realData, 'modules'))) {
    if (moduleId === MODULE_ID || target.disabledModules.includes(moduleId)) continue
    if (!existsSync(join(realData, 'modules', moduleId, 'module.json'))) continue
    mirrorPackage(join(realData, 'modules', moduleId), join(work, 'Data', 'modules', moduleId), join(realData, 'modules', moduleId, 'module.json'))
  }
  link(repoRoot, join(work, 'Data', 'modules', MODULE_ID))
  cpSync(realWorld, join(work, 'Data', 'worlds', settings.world), { recursive: true })
  return work
}

if (import.meta.main) {
  const target = getTarget(process.argv[2])
  const dataPath = buildDataFolder(target)
  console.log(`[e2e] ${target.name}: starting Foundry from ${target.code} on port ${settings.port} with ${dataPath}`)
  const foundry = spawn(process.execPath, [
    join(target.code, 'main.js'),
    `--dataPath=${dataPath}`,
    `--port=${settings.port}`,
    `--world=${settings.world}`,
    '--noupnp',
    '--noupdate',
    '--noipdiscovery',
  ], { stdio: 'inherit' })
  const stop = () => foundry.kill()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  foundry.on('exit', code => process.exit(code ?? 0))
}

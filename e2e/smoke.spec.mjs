import { test, expect } from './fixtures.mjs'

test('the world loads with Mob Attack Tool active', async ({ gm }) => {
  const info = await gm.evaluate(() => ({
    foundry: game.version,
    dnd5e: game.system.version,
    isGM: game.user.isGM,
    mobAttackTool: game.modules.get('mob-attack-tool')?.active,
    api: typeof globalThis.MobAttacks?.quickRoll,
  }))
  console.log(`[e2e] Foundry ${info.foundry}, dnd5e ${info.dnd5e}`)
  expect(info.isGM).toBe(true)
  expect(info.mobAttackTool).toBe(true)
  expect(info.api).toBe('function')
})

test('the removed MobAttacks.createSavedMobsFromCTGgroups() warns instead of failing', async ({ gm }) => {
  const result = await gm.evaluate(async () => {
    const warnings = []
    const warn = ui.notifications.warn.bind(ui.notifications)
    ui.notifications.warn = (message, options) => {
      warnings.push(String(message))
      return warn(message, options)
    }
    try {
      const mobList = await globalThis.MobAttacks.createSavedMobsFromCTGgroups([])
      return { warnings, mobListType: typeof mobList }
    }
    finally {
      ui.notifications.warn = warn
    }
  })
  expect(result.mobListType).toBe('object')
  expect(result.warnings).toHaveLength(1)
  expect(result.warnings[0]).toContain('has been removed')
})

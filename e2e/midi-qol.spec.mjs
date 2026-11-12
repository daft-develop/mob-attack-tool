// midi-qol: damage goes through DamageOnlyWorkflows and the weapon's On Use
// macro runs once per hit. midi-qol is only tested where it is compatible
// (left out of other targets with DISABLE_MODULES).
import { ensureModules, inactiveReason, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

const ON_USE = 'MAT e2e On Use'

test.describe.serial('midi-qol', () => {
  let attackers, target, longswordIds, previousSettings

  test.beforeAll(async ({ gm }) => {
    const active = await ensureModules(gm, { 'midi-qol': true, 'lib-wrapper': true, 'socketlib': true })
    if (!active['midi-qol']) {
      const message = `midi-qol is not active (${await inactiveReason(gm, 'midi-qol')})`
      // the list reporter shows a skipped test without its reason, so log it
      console.log(message)
      test.skip(true, message)
    }
    previousSettings = await setModuleSettings(gm, {
      mobRules: 'individual',
      autoDetectMultiattacks: 0,
      showIndividualDamageRolls: false,
      keepDialogOpen: false,
      enableDiceSoNice: false,
      enableMidi: true,
      enableMidiOnUseMacro: true,
    })
    attackers = await placeTokens(gm, 'Skeleton', 3, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    // an On Use macro that records each call, on every attacker's own Longsword
    longswordIds = await gm.evaluate(async ({ name, ids }) => {
      globalThis.matOnUseCalls = []
      await CONFIG.Macro.documentClass.create({ name, type: 'script', command: 'globalThis.matOnUseCalls.push({ tokenId: args[0].tokenId, advantage: args[0].advantage ?? false, hits: args[0].hitTargets.length })' })
      const result = []
      for (const id of ids) {
        const item = canvas.tokens.get(id).actor.items.getName('Longsword')
        await item.setFlag('midi-qol', 'onUseMacroName', name)
        result.push(item.id)
      }
      return result
    }, { name: ON_USE, ids: attackers })
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await gm.evaluate(name => game.macros.getName(name)?.delete(), ON_USE)
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
    await ensureModules(gm, { 'midi-qol': false })
  })

  test('hits go through midi-qol and run the On Use macro once per hit', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [longswordIds[0]])

    const since = await lastMessageId(gm)
    // two hits and a natural 1
    await queueDice(gm, [15, 15, 1])
    await executeMobAttack(dialog)
    await gm.waitForFunction(() => globalThis.matOnUseCalls.length >= 2, null, { timeout: 30_000 })
    await waitForMessages(gm, since, 2)

    const calls = await gm.evaluate(() => globalThis.matOnUseCalls)
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(attackers).toContain(call.tokenId)
      expect(call.hits).toBe(1)
      expect(call.advantage).toBe(false)
    }
    const midiCards = (await messagesAfter(gm, since)).filter(m => m.content.includes('midi-qol'))
    expect(midiCards.length).toBeGreaterThan(0)
  })
})

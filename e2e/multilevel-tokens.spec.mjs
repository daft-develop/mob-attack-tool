// Multilevel Tokens: a targeted clone stands for its source token. The test
// draws its own Multilevel Tokens regions, so the module makes a real clone.
import { ensureModules, test, expect, inactiveReason } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { createClone, deleteTokens, lastMessageId, messagesAfter, placeTokens, removeClone, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

test.describe.serial('Multilevel Tokens clones', () => {
  let attackers, pair, previousSettings

  test.beforeAll(async ({ gm }) => {
    const active = await ensureModules(gm, { 'multilevel-tokens': true, 'midi-qol': false })
    if (!active['multilevel-tokens']) {
      const message = `Multilevel Tokens is not active (${await inactiveReason(gm, 'multilevel-tokens')})`
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
    })
    attackers = await placeTokens(gm, 'Skeleton', 2, { row: 0 })
    pair = await createClone(gm, 'Archmage')
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await deleteTokens(gm, attackers)
    await removeClone(gm, pair)
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
  })

  test('the dialog counts a clone and its source as one target', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [pair.source, pair.clone])
    await openMobDialog(gm)
    const numTargets = await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog').mat.targets.length)
    expect(numTargets).toBe(1)
    await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
  })

  test('the damage card for an attack on a clone lists its source token', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [pair.clone])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])

    const since = await lastMessageId(gm)
    await queueDice(gm, [19, 19])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)

    const damage = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))
    expect(damage).toHaveLength(1)
    expect(damage[0].targets).toHaveLength(1)
    const [sourceUuids, cloneUuids] = await gm.evaluate(ids => ids.map(id => [canvas.tokens.get(id).document.uuid, canvas.tokens.get(id).actor.uuid]), [pair.source, pair.clone])
    expect(sourceUuids).toContain(damage[0].targets[0].uuid)
    expect(cloneUuids).not.toContain(damage[0].targets[0].uuid)
  })
})

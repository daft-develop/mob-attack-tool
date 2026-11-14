// A player's mob attack, with the GM connected too
import { settings } from './config.mjs'
import { ensureModules, test, expect, inactiveReason } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

const recordBlindRolls = page => page.evaluate(() => {
  globalThis.matBlindByMessage = {}
  Hooks.on('diceSoNiceRollStart', (messageId, context) => {
    globalThis.matBlindByMessage[messageId] = Boolean(context.blind)
  })
})

test.describe.serial('a player\'s mob attack', () => {
  let attackers, target, previousSettings, previousOwnership

  test.beforeAll(async ({ gm }) => {
    const active = await ensureModules(gm, { 'dice-so-nice': true, 'midi-qol': false })
    if (!active['dice-so-nice']) {
      const message = `Dice So Nice is not active (${await inactiveReason(gm, 'dice-so-nice')})`
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
      playerAccess: true,
    })
    attackers = await placeTokens(gm, 'Skeleton', 2, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    // the player owns the attackers' actor
    previousOwnership = await gm.evaluate(async (playerName) => {
      const actor = game.actors.getName('Skeleton')
      const player = game.users.getName(playerName)
      const previous = foundry.utils.deepClone(actor.ownership)
      await actor.update({ [`ownership.${player.id}`]: foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER })
      return previous
    }, settings.playerUser)
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await gm.evaluate(ownership => game.actors.getName('Skeleton').update({ ownership }, { diff: false, recursive: false }), previousOwnership)
    await deleteTokens(gm, [...attackers, target])
    await setModuleSettings(gm, previousSettings)
  })

  test('with Dice So Nice off in this module, its damage dice are hidden for the player and the GM', async ({ gm, player }) => {
    await recordBlindRolls(gm)
    await recordBlindRolls(player)
    const longsword = await player.evaluate(id => canvas.tokens.get(id).actor.items.getName('Longsword').id, attackers[0])
    await selectTokens(player, attackers)
    await targetTokens(player, [target])
    const dialog = await openMobDialog(player)
    await useOnlyWeapons(dialog, [longsword])

    const since = await lastMessageId(gm)
    await queueDice(player, [18, 18])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)
    const [damage] = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))
    expect(damage).toBeTruthy()

    for (const page of [player, gm]) {
      await page.waitForFunction(id => id in globalThis.matBlindByMessage, damage.id, { timeout: 15_000 })
      expect(await page.evaluate(id => globalThis.matBlindByMessage[id], damage.id)).toBe(true)
    }
    await clearDice(player)
  })
})

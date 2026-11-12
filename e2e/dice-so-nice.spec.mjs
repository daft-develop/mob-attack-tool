// Dice So Nice: with the module's Dice So Nice setting off, a mob attack's
// damage rolls are blind (not animated); other rolls are left alone
import { ensureModules, test, expect, inactiveReason } from './fixtures.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

test.describe.serial('Dice So Nice', () => {
  let attackers, target, previousSettings

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
    })
    attackers = await placeTokens(gm, 'Skeleton', 2, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    // record whether each message's roll ended up blind, after every other listener
    await gm.evaluate(() => {
      globalThis.matBlindByMessage = {}
      Hooks.on('diceSoNiceRollStart', (messageId, context) => {
        globalThis.matBlindByMessage[messageId] = Boolean(context.blind)
      })
    })
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
  })

  test('a mob attack\'s damage roll is blind, a later ordinary roll is not', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])

    const since = await lastMessageId(gm)
    await queueDice(gm, [18, 18])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)
    const [damage] = (await messagesAfter(gm, since)).filter(m => m.flavor.includes('Damage Roll'))

    const plainId = await gm.evaluate(async () => (await (await new Roll('1d6').evaluate()).toMessage()).id)
    await gm.waitForFunction(ids => ids.every(id => id in globalThis.matBlindByMessage), [damage.id, plainId], { timeout: 15_000 })
    const blind = await gm.evaluate(() => globalThis.matBlindByMessage)
    expect(blind[damage.id]).toBe(true)
    expect(blind[plainId]).toBe(false)
  })

  test('with damage rolls shown, each of dnd5e’s damage cards is blind too', async ({ gm }) => {
    // shown damage rolls go through dnd5e's rollDamage, which must keep the flag
    await setModuleSettings(gm, { showIndividualDamageRolls: true })
    await gm.evaluate(() => game.user.setFlag('mob-attack-tool', 'showIndividualDamageRolls', true))
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])

    const since = await lastMessageId(gm)
    await queueDice(gm, [18, 18])
    await executeMobAttack(dialog)
    // the results message, then one damage card per hit
    await waitForMessages(gm, since, 3)
    const damageIds = (await messagesAfter(gm, since)).filter(m => m.rolls.length).map(m => m.id)
    expect(damageIds).toHaveLength(2)

    await gm.waitForFunction(ids => ids.every(id => id in globalThis.matBlindByMessage), damageIds, { timeout: 15_000 })
    const blind = await gm.evaluate(() => globalThis.matBlindByMessage)
    for (const id of damageIds) expect(blind[id]).toBe(true)

    await gm.evaluate(() => game.user.unsetFlag('mob-attack-tool', 'showIndividualDamageRolls'))
    await setModuleSettings(gm, { showIndividualDamageRolls: false })
  })
})

// Core mob attack flows through the dialog, with scripted dice and without midi-qol
import { ensureModules, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { closeMobDialog, executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

const ATTACKER = 'Skeleton'
const WEAPON = 'Longsword'
const TARGET = 'Archmage'

const damageCards = messages => messages.filter(m => m.flavor.includes('Damage Roll'))

test.describe.serial('mob attacks from the dialog', () => {
  let attackers, targets, longsword, previousSettings

  test.beforeAll(async ({ gm }) => {
    // the dnd5e damage path; midi-qol has its own tests
    await ensureModules(gm, { 'midi-qol': false })
    previousSettings = await setModuleSettings(gm, {
      autoDetectMultiattacks: 0,
      showIndividualAttackRolls: false,
      showIndividualDamageRolls: false,
      noResultsMessage: false,
      keepDialogOpen: false,
      enableDiceSoNice: false,
    })
    attackers = await placeTokens(gm, ATTACKER, 3, { row: 0 })
    targets = await placeTokens(gm, TARGET, 2, { row: 2 })
    longsword = await weaponId(gm, ATTACKER, WEAPON)
  })

  test.afterAll(async ({ gm }) => {
    await deleteTokens(gm, [...attackers, ...targets])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
  })

  test.afterEach(async ({ gm }) => {
    await clearDice(gm)
    await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
  })

  test('individual rolls: a natural 20 crits, a natural 1 misses', async ({ gm }) => {
    await setModuleSettings(gm, { mobRules: 'individual' })
    await selectTokens(gm, attackers)
    await targetTokens(gm, [targets[0]])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [longsword])

    const since = await lastMessageId(gm)
    await queueDice(gm, [20, 1, 15])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)

    const [damage] = damageCards(await messagesAfter(gm, since))
    // two hits with one crit: 2d8 for the hits plus 1d8 for the crit
    expect(damage.rolls[0].formula).toMatch(/^3d8\b/)
    expect(damage.flavor).toContain(WEAPON)
  })

  test('mob rules 2024: hits are computed without attack rolls', async ({ gm }) => {
    await setModuleSettings(gm, { mobRules: 'mob2024' })
    await selectTokens(gm, attackers)
    await targetTokens(gm, [targets[0]])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [longsword])

    const since = await lastMessageId(gm)
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)

    const messages = await messagesAfter(gm, since)
    expect(messages[0].content).toContain(WEAPON)
    expect(damageCards(messages)).toHaveLength(1)
  })

  test('each damage card lists only the target its attacks hit', async ({ gm }) => {
    await setModuleSettings(gm, { mobRules: 'individual' })
    await selectTokens(gm, attackers)
    await targetTokens(gm, targets)
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [longsword])

    const since = await lastMessageId(gm)
    // every attack on both targets hits
    await queueDice(gm, [15, 15, 15, 15, 15, 15])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 3)

    const cards = damageCards(await messagesAfter(gm, since))
    expect(cards).toHaveLength(2)
    const targetUuids = await gm.evaluate(ids => ids.map((id) => {
      const token = canvas.tokens.get(id)
      // dnd5e 6.0+ descriptors use the token uuid, earlier ones the (synthetic) actor uuid
      return [token.document.uuid, token.actor.uuid]
    }), targets)
    for (const [i, card] of cards.entries()) {
      expect(card.targets).toHaveLength(1)
      expect(targetUuids[i]).toContain(card.targets[0].uuid)
    }
  })

  test('the dialog closes after the attack', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [targets[0]])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [longsword])
    await executeMobAttack(dialog)
    await expect(dialog).toBeHidden()
    await closeMobDialog(gm)
  })
})

test.describe.serial('versatile weapons', () => {
  let attackers, target, longsword, previousSettings

  test.beforeAll(async ({ gm }) => {
    await ensureModules(gm, { 'midi-qol': false })
    previousSettings = await setModuleSettings(gm, {
      mobRules: 'individual',
      autoDetectMultiattacks: 0,
      noResultsMessage: false,
      keepDialogOpen: false,
      enableDiceSoNice: false,
    })
    attackers = await placeTokens(gm, ATTACKER, 1, { row: 0 })
    ;[target] = await placeTokens(gm, TARGET, 1, { row: 2 })
    longsword = await weaponId(gm, ATTACKER, WEAPON)
  })

  test.afterAll(async ({ gm }) => {
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await gm.evaluate(() => game.user.unsetFlag('mob-attack-tool', 'showIndividualDamageRolls'))
  })

  for (const shown of [false, true]) {
    test(`the versatile entry rolls the two-handed die (damage rolls ${shown ? 'shown' : 'condensed'})`, async ({ gm }) => {
      await setModuleSettings(gm, { showIndividualDamageRolls: shown })
      await gm.evaluate(shown => game.user.setFlag('mob-attack-tool', 'showIndividualDamageRolls', shown), shown)
      await selectTokens(gm, attackers)
      await targetTokens(gm, [target])
      const dialog = await openMobDialog(gm)
      await useOnlyWeapons(dialog, [`${longsword} (Versatile)`])

      const since = await lastMessageId(gm)
      await queueDice(gm, [15])
      await executeMobAttack(dialog)
      await waitForMessages(gm, since, 2)
      const [damage] = damageCards(await messagesAfter(gm, since))
      expect(damage.rolls[0].formula).toMatch(/^1d10\b/)
      await clearDice(gm)
    })
  }
})

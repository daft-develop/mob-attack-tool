// Individual damage cards: every critical hit's damage card is marked critical, and
// a hit that isn't a crit is not. With midi-qol, the label used to read the crit count
// after it had been decremented, so the last crit lost it.
// midi-qol is only tested where it is compatible (left out of other targets with DISABLE_MODULES).
import { ensureModules, inactiveReason, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens } from './scene.mjs'

const ATTACKER = 'Skeleton'
const TARGET = 'Archmage'
const WEAPON = 'Longsword'

/**
 * Place an attacker and a target and turn on individual damage cards
 * @param {import('@playwright/test').Page} gm - the GM page
 * @param {boolean} midi - whether the module sends damage through midi-qol
 * @returns {Promise<object>} what tearDown needs
 */
async function setUp(gm, midi) {
  const previousSettings = await setModuleSettings(gm, {
    mobRules: 'individual',
    autoDetectMultiattacks: 0,
    showIndividualDamageRolls: true,
    keepDialogOpen: false,
    enableDiceSoNice: false,
    enableMidi: midi,
  })
  // the user flag overrides the setting, so set it too
  const previousDamageFlag = await gm.evaluate(async () => {
    const previous = game.user.getFlag('mob-attack-tool', 'showIndividualDamageRolls')
    await game.user.setFlag('mob-attack-tool', 'showIndividualDamageRolls', true)
    return previous
  })
  const [attacker] = await placeTokens(gm, ATTACKER, 1, { row: 0 })
  const [target] = await placeTokens(gm, TARGET, 1, { row: 2 })
  return { attacker, target, previousSettings, previousDamageFlag }
}

/**
 * Undo setUp
 * @param {import('@playwright/test').Page} gm - the GM page
 * @param {object} setup - from setUp
 */
async function tearDown(gm, { attacker, target, previousSettings, previousDamageFlag }) {
  await gm.evaluate(async (previous) => {
    if (previous === undefined) await game.user.unsetFlag('mob-attack-tool', 'showIndividualDamageRolls')
    else await game.user.setFlag('mob-attack-tool', 'showIndividualDamageRolls', previous)
  }, previousDamageFlag)
  await deleteTokens(gm, [attacker, target])
  await targetTokens(gm, [])
  await setModuleSettings(gm, previousSettings)
}

/**
 * Attack the target three times with the attacker's weapon, with scripted attack rolls
 * @param {import('@playwright/test').Page} gm - the GM page
 * @param {object} setup - from setUp
 * @param {number[]} d20s - the three attack rolls' d20 faces; damage dice stay random
 * @returns {Promise<string|null>} the last message id before the attack, for messagesAfter
 */
async function attackThreeTimes(gm, { attacker, target }, d20s) {
  await selectTokens(gm, [attacker])
  await targetTokens(gm, [target])
  const dialog = await openMobDialog(gm)
  const weapon = await weaponId(gm, ATTACKER, WEAPON)
  await useOnlyWeapons(dialog, [weapon])
  // the up arrow re-renders the dialog, so wait for each new count before going on
  // (typing into the input loses the next click to a re-render)
  const numAttacks = dialog.locator(`input[name="numAttacks${weapon}"]`)
  const increase = dialog.locator(`.mat-num-group:has(input[name="numAttacks${weapon}"]) [data-action="increaseNumAttack"]`)
  for (const count of ['2', '3']) {
    await increase.click()
    await expect(numAttacks).toHaveValue(count)
  }

  const since = await lastMessageId(gm)
  await queueDice(gm, d20s, 20)
  await executeMobAttack(dialog)
  return since
}

test.afterEach(async ({ gm }) => {
  await clearDice(gm)
  await gm.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())
})

test.describe.serial('individual damage cards with midi-qol', () => {
  let setup

  test.beforeAll(async ({ gm }) => {
    const active = await ensureModules(gm, { 'midi-qol': true, 'lib-wrapper': true, 'socketlib': true })
    if (!active['midi-qol']) {
      const message = `midi-qol is not active (${await inactiveReason(gm, 'midi-qol')})`
      // the list reporter shows a skipped test without its reason, so log it
      console.log(message)
      test.skip(true, message)
    }
    setup = await setUp(gm, true)
  })

  test.afterAll(async ({ gm }) => {
    if (!setup) return
    await tearDown(gm, setup)
    await ensureModules(gm, { 'midi-qol': false })
  })

  test('each critical hit from one attacker has a critical damage card, and only those', async ({ gm }) => {
    const critLabel = await gm.evaluate(() => game.i18n.localize('MAT.critIncluded'))
    // two natural 20s, then a 19 that hits but isn't a crit
    const since = await attackThreeTimes(gm, setup, [20, 20, 19])

    // midi-qol posts each hit's damage as its own chat card once that workflow resolves,
    // with the flavor we pass as the card's title (the message's own flavor stays empty)
    const titleOf = m => m.content.match(/<span class="title">([^<]*)<\/span>/)?.[1] ?? ''
    const damageTitles = async () => (await messagesAfter(gm, since))
      .filter(m => m.content.includes('midi-chat-card'))
      .map(titleOf)
      .filter(title => title.startsWith(`${WEAPON} - `))
    await expect.poll(async () => (await damageTitles()).length, { timeout: 30_000 }).toBe(3)

    // crit dice go on the first damage rolls, one per crit, whichever attacks crit (TODO 16.2),
    // so the crits are rolled first
    const [first, second, third] = await damageTitles()
    expect(first).toContain(critLabel)
    expect(second).toContain(critLabel)
    expect(third).not.toContain(critLabel)
  })
})

test.describe.serial('individual damage cards without midi-qol', () => {
  let setup

  test.beforeAll(async ({ gm }) => {
    await ensureModules(gm, { 'midi-qol': false })
    setup = await setUp(gm, false)
  })

  test.afterAll(async ({ gm }) => {
    if (setup) await tearDown(gm, setup)
  })

  test('each critical hit has a critical damage card, in attack order', async ({ gm }) => {
    // a crit, a 19 that hits but isn't a crit, then a crit: each hit's damage follows its own attack roll
    const since = await attackThreeTimes(gm, setup, [20, 19, 20])

    // without midi-qol each hit's damage is dnd5e's own damage card
    const damageCards = async () => (await messagesAfter(gm, since))
      .filter(m => m.rolls.length > 0 && m.flavor.startsWith(`${WEAPON} - `))
    await expect.poll(async () => (await damageCards()).length, { timeout: 30_000 }).toBe(3)

    // dnd5e marks a critical damage card with a "critical" class: the card header on
    // dnd5e 4 and 5 ("Critical Hit"), a "Critical" pill on dnd5e 6
    const critMarkers = card => gm.locator(`#chat [data-message-id="${card.id}"] .critical`)
    const [first, second, third] = await damageCards()
    await expect(critMarkers(first)).not.toHaveCount(0)
    await expect(critMarkers(second)).toHaveCount(0)
    await expect(critMarkers(third)).not.toHaveCount(0)
  })
})

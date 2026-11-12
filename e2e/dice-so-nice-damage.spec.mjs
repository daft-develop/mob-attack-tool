// Damage rolls animate once with Dice So Nice, whichever way the damage is
// rolled: with or without midi-qol, and as one combined roll or one per hit.
// Counts the diceSoNiceRollStart hook, which Dice So Nice also fires for rolls
// inside chat messages (midi-qol's cards), not only for showForRoll calls.
import { ensureModules, inactiveReason, test, expect } from './fixtures.mjs'
import { queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons } from './dialog.mjs'
import { deleteTokens, lastMessageId, messagesAfter, placeTokens, selectTokens, setModuleSettings, targetTokens } from './scene.mjs'

const CASES = [
  { midi: false, individual: false, name: 'without midi-qol, one combined damage roll' },
  { midi: false, individual: true, name: 'without midi-qol, one damage roll per hit' },
  { midi: true, individual: false, name: 'with midi-qol, one combined damage roll' },
  { midi: true, individual: true, name: 'with midi-qol, one damage roll per hit' },
]

test.describe.serial('damage rolls with Dice So Nice', () => {
  let attackers, target, longswordIds

  test.beforeAll(async ({ gm }) => {
    attackers = await placeTokens(gm, 'Skeleton', 3, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    longswordIds = await gm.evaluate(ids => ids.map(id => canvas.tokens.get(id).actor.items.getName('Longsword').id), attackers)
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await ensureModules(gm, { 'midi-qol': false })
  })

  for (const { midi, individual, name } of CASES) {
    test(name, async ({ gm }) => {
      const dsn = await ensureModules(gm, { 'dice-so-nice': true })
      test.skip(!dsn['dice-so-nice'], `Dice So Nice is not active (${await inactiveReason(gm, 'dice-so-nice')})`)
      if (midi) {
        const active = await ensureModules(gm, { 'midi-qol': true, 'lib-wrapper': true, 'socketlib': true })
        test.skip(!active['midi-qol'], `midi-qol is not active (${await inactiveReason(gm, 'midi-qol')})`)
      }
      // ensureModules can reload the page, which drops anything set up before it: record the animations after
      await gm.evaluate(() => {
        globalThis.matDsnStarts = []
        if (globalThis.matDsnHook) Hooks.off('diceSoNiceRollStart', globalThis.matDsnHook)
        globalThis.matDsnHook = (messageId, context) => globalThis.matDsnStarts.push({ formula: context.roll?.formula ?? '', messageId })
        Hooks.on('diceSoNiceRollStart', globalThis.matDsnHook)
      })
      const previous = await setModuleSettings(gm, {
        mobRules: 'individual',
        autoDetectMultiattacks: 0,
        showIndividualDamageRolls: individual,
        keepDialogOpen: false,
        enableDiceSoNice: true,
        enableMidi: midi,
        enableMidiOnUseMacro: false,
      })
      try {
        await gm.evaluate(() => {
          globalThis.matDsnStarts.length = 0
        })
        const since = await lastMessageId(gm)
        await selectTokens(gm, attackers)
        await targetTokens(gm, [target])
        const dialog = await openMobDialog(gm)
        await useOnlyWeapons(dialog, [longswordIds[0]])

        // two hits and a natural 1: one damage roll per hit, or one combined roll
        await queueDice(gm, [15, 15, 1], 20)
        await executeMobAttack(dialog)
        // let the attack and any duplicate animations finish before counting
        await gm.waitForTimeout(8000)

        // Attack rolls are d20s; every other roll the hook saw is damage
        const animated = await gm.evaluate(() => globalThis.matDsnStarts.filter(r => !r.formula.includes('d20')))
        // damage messages: the ones carrying a damage roll (midi-qol's card holds no roll, its roll is in another message)
        const messages = (await messagesAfter(gm, since)).filter(m => m.rolls.some(r => !r.formula.includes('d20')))
        expect(messages.length, 'damage cards posted').toBeGreaterThan(0)
        // each damage card is animated once, and nothing is animated without a card
        expect(animated.map(r => r.messageId), 'damage animations, by card').toHaveLength(messages.length)
        expect(new Set(animated.map(r => r.messageId)).size, 'distinct cards animated').toBe(messages.length)
      }
      finally {
        await setModuleSettings(gm, previous)
      }
    })
  }
})

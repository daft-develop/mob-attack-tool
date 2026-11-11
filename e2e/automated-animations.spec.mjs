// Automated Animations: one animation per hit, from the token that hit, at the target.
// playAnimation is replaced with a recorder: tests can't check the visuals.
import { ensureModules, test, expect } from './fixtures.mjs'
import { clearDice, queueDice } from './dice.mjs'
import { executeMobAttack, openMobDialog, useOnlyWeapons, weaponId } from './dialog.mjs'
import { deleteTokens, lastMessageId, placeTokens, selectTokens, setModuleSettings, targetTokens, waitForMessages } from './scene.mjs'

test.describe.serial('Automated Animations', () => {
  let attackers, target, previousSettings

  test.beforeAll(async ({ gm }) => {
    const active = await ensureModules(gm, { 'autoanimations': true, 'midi-qol': false })
    test.skip(!active.autoanimations, 'Automated Animations is not installed')
    previousSettings = await setModuleSettings(gm, {
      mobRules: 'individual',
      autoDetectMultiattacks: 0,
      showIndividualDamageRolls: false,
      keepDialogOpen: false,
      enableDiceSoNice: false,
      enableAutoAnimations: true,
    })
    attackers = await placeTokens(gm, 'Skeleton', 3, { row: 0 })
    ;[target] = await placeTokens(gm, 'Archmage', 1, { row: 2 })
    await gm.evaluate(() => {
      globalThis.matAnimations = []
      globalThis.matPlayAnimation = AutomatedAnimations.playAnimation
      AutomatedAnimations.playAnimation = (token, item, options) => {
        globalThis.matAnimations.push({ token: token?.id, item: item?.name, targets: (options.targets ?? []).map(t => t.id) })
      }
    })
  })

  test.afterAll(async ({ gm }) => {
    if (!attackers) return
    await gm.evaluate(() => {
      AutomatedAnimations.playAnimation = globalThis.matPlayAnimation
    })
    await deleteTokens(gm, [...attackers, target])
    await targetTokens(gm, [])
    await setModuleSettings(gm, previousSettings)
    await clearDice(gm)
  })

  test('each hit plays an animation from an attacking token at the target', async ({ gm }) => {
    await selectTokens(gm, attackers)
    await targetTokens(gm, [target])
    const dialog = await openMobDialog(gm)
    await useOnlyWeapons(dialog, [await weaponId(gm, 'Skeleton', 'Longsword')])

    const since = await lastMessageId(gm)
    // two hits and a miss
    await queueDice(gm, [15, 1, 15])
    await executeMobAttack(dialog)
    await waitForMessages(gm, since, 2)
    await gm.waitForFunction(() => globalThis.matAnimations.length >= 2)

    const animations = await gm.evaluate(() => globalThis.matAnimations)
    expect(animations).toHaveLength(2)
    for (const animation of animations) {
      expect(attackers).toContain(animation.token)
      expect(animation.item).toBe('Longsword')
      expect(animation.targets).toEqual([target])
    }
  })
})

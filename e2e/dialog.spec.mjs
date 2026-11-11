// Mob Attack dialog edge cases (review findings 12.8, 12.15 and 12.16)
import { test, expect } from './fixtures.mjs'
import { DIALOG, openMobDialog } from './dialog.mjs'
import { deleteTokens, placeTokens, selectTokens, setModuleSettings } from './scene.mjs'

const closeDialog = page => page.evaluate(() => foundry.applications.instances.get('mob-attack-tool-dialog')?.close())

test.describe.serial('the Mob Attack dialog', () => {
  let tokens, previousSettings

  test.beforeAll(async ({ gm }) => {
    previousSettings = await setModuleSettings(gm, { autoDetectMultiattacks: 0, hiddenMobList: {} })
    tokens = await placeTokens(gm, 'Skeleton', 2, { row: 0 })
  })

  test.afterAll(async ({ gm }) => {
    await closeDialog(gm)
    await deleteTokens(gm, tokens)
    await setModuleSettings(gm, previousSettings)
  })

  test.afterEach(async ({ gm }) => closeDialog(gm))

  test('Next with only another user\'s saved mobs leaves the dialog on the selection', async ({ gm }) => {
    // a saved mob that belongs to another user
    await gm.evaluate(async (tokenIds) => {
      const otherUser = game.users.find(u => u.id !== game.user.id)
      const actor = canvas.tokens.get(tokenIds[0]).actor
      await game.settings.set('mob-attack-tool', 'hiddenMobList', {
        'Other user mob': { mobName: 'Other user mob', monsters: [{ id: actor.id, amount: 1 }], selectedTokenIds: [tokenIds[0]], numSelected: 1, userId: otherUser.id },
      })
    }, tokens)
    await selectTokens(gm, tokens)
    const dialog = await openMobDialog(gm)
    const nameBefore = await dialog.locator('input[name="mobName"]').inputValue()

    await dialog.locator('a[data-action="nextMob"]').click()
    await gm.waitForTimeout(500)

    await expect(dialog.locator('input[name="mobName"]')).toHaveValue(nameBefore)
    expect(await gm.evaluate(() => game.settings.get('mob-attack-tool', 'hiddenChangedMob'))).toBe(false)
    expect(await gm.evaluate(() => canvas.tokens.controlled.length)).toBe(tokens.length)
    await setModuleSettings(gm, { hiddenMobList: {} })
  })

  test('raising a monster count adds the token\'s own actor', async ({ gm }) => {
    // the token's actor has an item the world actor doesn't
    await gm.evaluate(async (id) => {
      const actor = canvas.tokens.get(id).actor
      await actor.items.getName('Longsword').update({ name: 'Token-only Longsword' })
    }, tokens[0])
    await selectTokens(gm, [tokens[0]])
    const dialog = await openMobDialog(gm)
    const increase = dialog.locator('a[data-action="increaseNumMonster"]').first()
    await increase.click()
    await expect(dialog.locator('input.numMonster').first()).toHaveValue('2')

    const added = await gm.evaluate(() => {
      const actors = foundry.applications.instances.get('mob-attack-tool-dialog').mat.actorList
      const last = actors.at(-1)
      return { isToken: last.isToken, hasRenamed: Boolean(last.items.getName('Token-only Longsword')) }
    })
    expect(added).toEqual({ isToken: true, hasRenamed: true })
    await expect(gm.locator(DIALOG)).toContainText('Token-only Longsword')
  })

  test('deleting the loaded saved mob loads your next saved mob, not another user’s', async ({ gm }) => {
    // another user's mob comes first in the list, then two of yours
    await gm.evaluate(async (tokenIds) => {
      const otherUser = game.users.find(u => u.id !== game.user.id)
      const actor = canvas.tokens.get(tokenIds[0]).actor
      const mob = (mobName, userId) => ({ mobName, monsters: [{ id: actor.id, amount: 1 }], selectedTokenIds: [tokenIds[0]], numSelected: 1, userId })
      await game.settings.set('mob-attack-tool', 'hiddenMobList', {
        'Other user mob': mob('Other user mob', otherUser.id),
        'Mob A': mob('Mob A', game.user.id),
        'Mob B': mob('Mob B', game.user.id),
      })
    }, tokens)
    await selectTokens(gm, [])
    const dialog = await openMobDialog(gm)
    await gm.evaluate(async () => {
      const app = foundry.applications.instances.get('mob-attack-tool-dialog')
      await app._loadMob(app, 'Mob A')
    })
    await expect(dialog.locator('input[name="mobName"]')).toHaveValue('Mob A')

    // delete it through the mob list, as a user would
    await dialog.locator('button[name="selectMob"]').click()
    const mobList = gm.locator('select[name="selectMob"]')
    await mobList.selectOption('Mob A')
    await gm.locator('input[name="deleteSavedMob"]').check()
    await gm.locator('button[data-action="select"]').click()

    await expect(dialog.locator('input[name="mobName"]')).toHaveValue('Mob B')
    expect(await gm.evaluate(() => Object.keys(game.settings.get('mob-attack-tool', 'hiddenMobList')))).toEqual(['Other user mob', 'Mob B'])
    await setModuleSettings(gm, { hiddenMobList: {} })
  })

  test('loading a saved mob fires matMobUpdate', async ({ gm }) => {
    await gm.evaluate(async (tokenIds) => {
      const actor = canvas.tokens.get(tokenIds[0]).actor
      await game.settings.set('mob-attack-tool', 'hiddenMobList', {
        'Mob A': { mobName: 'Mob A', monsters: [{ id: actor.id, amount: 1 }], selectedTokenIds: [tokenIds[0]], numSelected: 1, userId: game.user.id },
      })
      globalThis.matMobUpdates = []
      globalThis.matMobUpdateHook = Hooks.on('matMobUpdate', ({ mobName, type }) => globalThis.matMobUpdates.push({ mobName, type }))
    }, tokens)
    await selectTokens(gm, tokens)
    await openMobDialog(gm)
    await gm.evaluate(async () => {
      const app = foundry.applications.instances.get('mob-attack-tool-dialog')
      await app._loadMob(app, 'Mob A')
      Hooks.off('matMobUpdate', globalThis.matMobUpdateHook)
    })
    expect(await gm.evaluate(() => globalThis.matMobUpdates)).toContainEqual({ mobName: 'Mob A', type: 'load' })
    await setModuleSettings(gm, { hiddenMobList: {} })
  })
})

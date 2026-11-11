import { describe, it, expect, vi, beforeEach } from 'vitest'

// macroObject.js imports the dialog class, which can't load outside Foundry
vi.mock('../../scripts/ui/dialog/mobAttackDialogV2.js', () => ({ createAndRenderDialog: vi.fn() }))
vi.mock('../../scripts/ui/dialog/dialog-context.js', () => ({
  prepareMonsters: vi.fn(async () => [{ a1: { id: 'a1', name: 'Goblin' } }, {}, {}]),
}))

const { macroObject } = await import('../../scripts/macroObject.js')

let settings
let mobDialog

beforeEach(() => {
  settings = {
    'mob-attack-tool.hiddenMobList': {},
    'mob-attack-tool.currentDialogId': 'dialog1',
    'mob-attack-tool.hiddenChangedMob': true,
  }
  game.settings = {
    get: (scope, key) => settings[`${scope}.${key}`],
    set: vi.fn(async (scope, key, value) => { settings[`${scope}.${key}`] = value }),
  }
  game.user = { id: 'user1', isGM: false }
  game.combat = null
  mobDialog = { mat: { localUpdate: false }, render: vi.fn() }
  game.mobAttackTool = { dialogs: new Map([['dialog1', mobDialog]]) }
  globalThis.Hooks = { call: vi.fn() }
})

describe('saveMob', () => {
  it('re-renders the open dialog as a local update, keeping its edits', async () => {
    await macroObject().saveMob('Goblins', [{ id: 'a1' }], ['tok1'], 1)
    expect(settings['mob-attack-tool.hiddenMobList'].Goblins.selectedTokenIds).toEqual(['tok1'])
    expect(mobDialog.mat.localUpdate).toBe(true)
    expect(mobDialog.render).toHaveBeenCalled()
  })
})

describe('deleteSavedMob', () => {
  it('re-renders the open dialog without the deleted mob', async () => {
    settings['mob-attack-tool.hiddenMobList'] = { Goblins: { mobName: 'Goblins', userId: 'user1' } }
    await macroObject().deleteSavedMob('Goblins')
    expect(settings['mob-attack-tool.hiddenMobList']).toEqual({})
    expect(settings['mob-attack-tool.hiddenChangedMob']).toBe(false)
    expect(mobDialog.mat.localUpdate).toBe(false)
    expect(mobDialog.render).toHaveBeenCalled()
  })
})

describe('createSavedMobsFromCTGgroups', () => {
  it('warns that it was removed and leaves the saved mobs unchanged', async () => {
    const mobList = { Goblins: { mobName: 'Goblins' } }
    game.settings = { get: (scope, key) => (key === 'hiddenMobList' ? mobList : undefined), set: vi.fn() }
    game.i18n = { localize: key => key }
    globalThis.ui = { notifications: { warn: vi.fn() } }
    const result = await macroObject().createSavedMobsFromCTGgroups([[{ initiative: 10 }]])
    expect(ui.notifications.warn).toHaveBeenCalledWith('MAT.ctgGroupsRemoved')
    expect(result).toBe(mobList)
    expect(game.settings.set).not.toHaveBeenCalled()
  })
})

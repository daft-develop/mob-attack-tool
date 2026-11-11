import { describe, it, expect, vi, beforeEach } from 'vitest'

// macroObject.js imports the dialog class, which can't load outside Foundry
vi.mock('../../scripts/ui/dialog/mobAttackDialogV2.js', () => ({ createAndRenderDialog: vi.fn() }))
vi.mock('../../scripts/ui/dialog/dialog-context.js', () => ({
  prepareMonsters: vi.fn(async () => [{ a1: { id: 'a1', name: 'Goblin' } }, {}, {}]),
}))

vi.mock('../../scripts/mobRules.js', () => ({ rollMobAttack: vi.fn() }))
vi.mock('../../scripts/individualRolls.js', () => ({ rollMobAttackIndividually: vi.fn() }))
vi.mock('../../scripts/foundry/targets.js', () => ({
  checkTarget: () => true,
  getSelectedTokenIds: () => [{ tokenId: 'tok1' }],
  getTargetData: vi.fn(),
  findLocatedWeapon: vi.fn(),
}))

const { macroObject } = await import('../../scripts/macroObject.js')
const { rollMobAttack } = await import('../../scripts/mobRules.js')
const { findLocatedWeapon, getTargetData } = await import('../../scripts/foundry/targets.js')

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
  game.i18n = { localize: key => key, format: key => key }
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

describe('quickRoll', () => {
  beforeEach(() => {
    settings['mob-attack-tool.mobRules'] = 'mob2024'
    globalThis.ui = { notifications: { warn: vi.fn() } }
    rollMobAttack.mockClear()
  })

  it('rolls a weapon found under another item id with the exported attacks', async () => {
    // Exported from a token whose Scimitar had id w1 (plus its versatile entry);
    // the selected token's same-named Scimitar has id w9
    const scimitar = { id: 'w9', name: 'Scimitar' }
    findLocatedWeapon.mockReturnValue(scimitar)
    getTargetData.mockResolvedValue([{ targetId: 'target1', weapons: [{ weaponId: 'w1' }, { weaponId: 'w1' }] }])

    macroObject().quickRoll({
      weaponLocators: [
        { actorID: 'a1', weaponName: 'Scimitar', weaponID: 'w1' },
        { actorID: 'a1', weaponName: 'Scimitar', weaponID: 'w1 (Versatile)' },
      ],
      attacks: { 'w1': [], 'w1 (Versatile)': [] },
      monsters: {},
    })
    await vi.waitFor(() => expect(rollMobAttack).toHaveBeenCalled())

    const data = rollMobAttack.mock.calls[0][0]
    expect(data.weapons).toEqual({ w1: scimitar })
    expect(data.attacks).toEqual({
      'w1': [{ targetId: 'target1', targetNumAttacks: 2 }],
      'w1 (Versatile)': [{ targetId: 'target1', targetNumAttacks: 2 }],
    })
    // every attack key resolves to a weapon, as the roll functions look it up
    for (const key of Object.keys(data.attacks)) {
      expect(data.weapons[key.replace(' (Versatile)', '')]).toBe(scimitar)
    }
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

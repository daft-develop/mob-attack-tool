import { describe, it, expect, vi } from 'vitest'

// macroObject.js imports the dialog class, which can't load outside Foundry
vi.mock('../../scripts/ui/dialog/mobAttackDialogV2.js', () => ({ createAndRenderDialog: vi.fn() }))
vi.mock('../../scripts/ui/dialog/dialog-context.js', () => ({ prepareMonsters: vi.fn() }))

const { macroObject } = await import('../../scripts/macroObject.js')

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

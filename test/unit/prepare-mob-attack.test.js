import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prepareMobAttack } from '../../scripts/ui/dialog/dialog-context.js'

// With a saved mob loaded, the attack uses the dialog's actors and the
// saved mob's token count (11.1 / f0a9ea6)
let settings

beforeEach(() => {
  settings = {
    'mob-attack-tool.hiddenChangedMob': true,
    'mob-attack-tool.hiddenMobName': 'Goblins',
    'mob-attack-tool.hiddenMobList': { Goblins: { mobName: 'Goblins', numSelected: 2 } },
    'mob-attack-tool.showMultiattackDescription': false,
    'mob-attack-tool.autoDetectMultiattacks': 0,
    'mob-attack-tool.askRollType': false,
  }
  game.settings = { get: (scope, key) => settings[`${scope}.${key}`], set: vi.fn() }
  game.mobAttackTool = undefined
})

describe('prepareMobAttack with a saved mob loaded', () => {
  it('uses the actor list it is given and the saved mob\'s token count', async () => {
    const goblin = { id: 'goblin', name: 'Goblin', img: 'goblin.png', items: { contents: [] } }
    const html = { find: () => [] }
    const data = await prepareMobAttack(html, [], {}, {}, [], 12, 0, {}, [goblin, goblin])
    expect(data.numSelected).toBe(2)
    expect(data.monsters.goblin.amount).toBe(2)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callOnUseMacroForHits, isMidiQolEnabled, runDamageOnlyWorkflow, waitForMidiRollComplete } from '../../scripts/integrations/midi-qol.js'

let settings
let moduleActive

beforeEach(() => {
  moduleActive = true
  settings = { enableMidi: true, enableMidiOnUseMacro: true, dontSendItemCardUuid: false }
  game.modules = { get: id => (id === 'midi-qol' && moduleActive !== undefined ? { active: moduleActive } : undefined) }
  game.settings = { get: (scope, key) => settings[key] }
})

describe('isMidiQolEnabled', () => {
  it('needs the module active and the setting on', () => {
    expect(isMidiQolEnabled()).toBe(true)
    settings.enableMidi = false
    expect(isMidiQolEnabled()).toBe(false)
  })

  it('is false when the module is not installed', () => {
    moduleActive = undefined
    expect(isMidiQolEnabled()).toBe(false)
  })
})

describe('runDamageOnlyWorkflow', () => {
  const weapon = { actor: { name: 'Goblin' } }
  const roll = { total: 9 }

  beforeEach(() => {
    globalThis.MidiQOL = { DamageOnlyWorkflow: vi.fn(function (...args) {
      this.args = args
    }) }
  })

  it('applies the roll to the target with the flavor and item', async () => {
    const target = { id: 'target' }
    const workflow = await runDamageOnlyWorkflow(weapon, roll, 'slashing', target, 'Scimitar - Damage Roll')
    expect(workflow.args).toEqual([weapon.actor, target, 9, 'slashing', [target], roll, { flavor: 'Scimitar - Damage Roll', item: weapon, itemCardUuid: 'new' }])
  })

  it('passes no target when there is none', async () => {
    const workflow = await runDamageOnlyWorkflow(weapon, roll, 'slashing', undefined, 'flavor')
    expect(workflow.args[1]).toBeUndefined()
    expect(workflow.args[4]).toEqual([])
  })
})

describe('waitForMidiRollComplete', () => {
  let onComplete

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.Hooks = {
      once: vi.fn((name, fn) => {
        onComplete = fn
      }),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves soon after midi-qol signals RollComplete', async () => {
    let done = false
    waitForMidiRollComplete(4000).then(() => {
      done = true
    })
    expect(Hooks.once).toHaveBeenCalledWith('midi-qol.RollComplete', expect.any(Function))
    await vi.advanceTimersByTimeAsync(300)
    expect(done).toBe(false)
    onComplete()
    await vi.advanceTimersByTimeAsync(100)
    expect(done).toBe(true)
  })

  it('gives up after the timeout', async () => {
    let done = false
    waitForMidiRollComplete(1000).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(900)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(done).toBe(true)
  })
})

describe('callOnUseMacroForHits', () => {
  let executed
  const actor = { uuid: 'Actor.goblin', flags: {}, getRollData: () => ({ str: 1 }) }
  const weapon = { id: 'w1', name: 'Scimitar', actor, flags: { 'midi-qol': { onUseMacroName: 'Shove' } }, toObject: () => ({ name: 'Scimitar' }) }
  const workflow = { tokenId: 'wf', tokenUuid: 'wf-uuid', damageRollHTML: '<div>', itemCardUuid: 'card', uuid: 'wf.uuid' }
  const hits = overrides => ({
    data: { withAdvantage: true, withDisadvantage: false },
    targetToken: { id: 'target' },
    damageRoll: { total: 12 },
    damageTypes: ['Slashing'],
    isVersatile: false,
    numHitAttacks: 3,
    tokenAttackList: [{ tokenId: 'a', tokenUuid: 'A' }, { tokenId: 'b', tokenUuid: 'B' }],
    attackRoll: { total: 17 },
    attackTotal: 17,
    isCritical: true,
    ...overrides,
  })

  beforeEach(() => {
    vi.useFakeTimers()
    executed = []
    game.macros = { getName: name => (name === 'Shove' ? { execute: data => executed.push({ ...data }) } : undefined) }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const run = async (overrides, weaponData = weapon) => {
    const promise = callOnUseMacroForHits(weaponData, workflow, hits(overrides))
    await vi.runAllTimersAsync()
    await promise
  }

  it('runs the macro once per hit, from the token that made each hit', async () => {
    await run()
    expect(executed.map(d => d.tokenId)).toEqual(['a', 'b', 'b'])
    expect(executed.map(d => d.tokenUuid)).toEqual(['A', 'B', 'B'])
  })

  it('passes the hit details to the macro', async () => {
    await run()
    expect(executed[0]).toMatchObject({
      actorUuid: 'Actor.goblin',
      targets: [{ id: 'target' }],
      hitTargets: [{ id: 'target' }],
      attackTotal: 17,
      isCritical: true,
      damageTotal: 12,
      itemCardUuid: 'card',
      otherDamageList: [{ damage: 12, type: 'Slashing' }],
      advantage: true,
      disadvantage: false,
      tag: 'OnUse',
    })
  })

  it('withholds the item card uuid when the setting asks to', async () => {
    settings.dontSendItemCardUuid = true
    await run()
    expect(executed[0].itemCardUuid).toBeNull()
  })

  it('does nothing when On Use macros are disabled or the weapon has none', async () => {
    settings.enableMidiOnUseMacro = false
    await run()
    settings.enableMidiOnUseMacro = true
    await run({}, { actor, flags: {} })
    expect(executed).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { getMobActors } from '../../scripts/ui/dialog/dialog-context.js'

const goblin = { id: 'goblin' }
const ogre = { id: 'ogre' }
const actors = { goblin, ogre }
const getActor = id => actors[id]

describe('getMobActors', () => {
  it('repeats each actor by its amount, in mob order', () => {
    const mob = { monsters: [{ id: 'goblin', amount: 3 }, { id: 'ogre', amount: 1 }] }
    expect(getMobActors(mob, getActor)).toEqual([goblin, goblin, goblin, ogre])
  })

  it('skips actors that no longer exist', () => {
    const mob = { monsters: [{ id: 'deleted', amount: 2 }, { id: 'ogre', amount: 2 }] }
    expect(getMobActors(mob, getActor)).toEqual([ogre, ogre])
  })

  it('returns no actors for a missing or empty mob', () => {
    expect(getMobActors(undefined, getActor)).toEqual([])
    expect(getMobActors({ monsters: [] }, getActor)).toEqual([])
  })

  it('looks actors up in game.actors by default', () => {
    globalThis.game.actors = { get: id => actors[id] }
    expect(getMobActors({ monsters: [{ id: 'ogre', amount: 1 }] })).toEqual([ogre])
  })
})

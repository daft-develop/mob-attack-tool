import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findLocatedWeapon, getSelectedTokenIds, getSelectedTokens, selectTokens } from '../../scripts/foundry/targets.js'

const makeToken = (id, actorId) => ({
  id,
  document: { uuid: `Scene.s.Token.${id}` },
  actor: { id: actorId },
  control: vi.fn(),
})

describe('selectTokens', () => {
  let tokens

  beforeEach(() => {
    tokens = { t1: makeToken('t1', 'a1'), t2: makeToken('t2', 'a2') }
    globalThis.canvas = { tokens: { releaseAll: vi.fn(), get: id => tokens[id] } }
  })

  it('releases all tokens, then adds each given token to the selection', () => {
    selectTokens(['t1', 't2'])
    expect(canvas.tokens.releaseAll).toHaveBeenCalledOnce()
    expect(tokens.t1.control).toHaveBeenCalledWith({ releaseOthers: false })
    expect(tokens.t2.control).toHaveBeenCalledWith({ releaseOthers: false })
  })

  it('skips tokens that are no longer on the scene', () => {
    expect(() => selectTokens(['deleted', 't2'])).not.toThrow()
    expect(tokens.t2.control).toHaveBeenCalledOnce()
  })
})

describe('getSelectedTokenIds', () => {
  it('describes each controlled token', () => {
    globalThis.canvas = { tokens: { controlled: [makeToken('t1', 'a1'), makeToken('t2', 'a2')] } }
    expect(getSelectedTokenIds()).toEqual([
      { tokenId: 't1', tokenUuid: 'Scene.s.Token.t1', actorId: 'a1' },
      { tokenId: 't2', tokenUuid: 'Scene.s.Token.t2', actorId: 'a2' },
    ])
  })

  it('returns an empty list when nothing is selected', () => {
    globalThis.canvas = { tokens: { controlled: [] } }
    expect(getSelectedTokenIds()).toEqual([])
  })

  it('leaves out a token whose actor was deleted', () => {
    const orphan = { ...makeToken('t2'), actor: null }
    globalThis.canvas = { tokens: { controlled: [makeToken('t1', 'a1'), orphan] } }
    expect(getSelectedTokenIds()).toEqual([{ tokenId: 't1', tokenUuid: 'Scene.s.Token.t1', actorId: 'a1' }])
  })
})

describe('getSelectedTokens', () => {
  it('returns the selected tokens that have an actor', () => {
    const t1 = makeToken('t1', 'a1')
    globalThis.canvas = { tokens: { controlled: [t1, { ...makeToken('t2'), actor: null }] } }
    expect(getSelectedTokens()).toEqual([t1])
  })
})

describe('findLocatedWeapon', () => {
  // items.getName stand-in for an actor's item collection
  const actorWith = (id, ...names) => {
    const items = names.map(name => ({ id: `${id}-${name}`, name }))
    return { id, items: { getName: name => items.find(i => i.name === name) } }
  }
  const worldActors = actors => ({ get: id => actors.find(a => a.id === id) })

  it('finds a weapon renamed on an unlinked token, which the world actor does not have', () => {
    const worldGoblin = actorWith('goblin', 'Club')
    const tokenGoblin = actorWith('goblin', 'Club "Big Stick"')
    const weapon = findLocatedWeapon({ actorID: 'goblin', weaponName: 'Club "Big Stick"' }, [{ actor: tokenGoblin }], worldActors([worldGoblin]))
    expect(weapon).toEqual({ id: 'goblin-Club "Big Stick"', name: 'Club "Big Stick"' })
  })

  it('prefers the selected token’s item over the world actor’s', () => {
    const tokenGoblin = actorWith('goblin', 'Scimitar')
    const weapon = findLocatedWeapon({ actorID: 'goblin', weaponName: 'Scimitar' }, [{ actor: tokenGoblin }], worldActors([actorWith('goblin', 'Scimitar')]))
    expect(weapon).toBe(tokenGoblin.items.getName('Scimitar'))
  })

  it('ignores selected tokens of other actors', () => {
    const weapon = findLocatedWeapon({ actorID: 'goblin', weaponName: 'Club' }, [{ actor: actorWith('ogre', 'Club') }], worldActors([actorWith('goblin', 'Club')]))
    expect(weapon.id).toBe('goblin-Club')
  })

  it('falls back to the world actor when no matching token is selected', () => {
    const weapon = findLocatedWeapon({ actorID: 'goblin', weaponName: 'Club' }, [], worldActors([actorWith('goblin', 'Club')]))
    expect(weapon.id).toBe('goblin-Club')
  })

  it('returns undefined when neither the tokens nor the world actor have it', () => {
    expect(findLocatedWeapon({ actorID: 'goblin', weaponName: 'Club' }, [{ actor: null }], worldActors([]))).toBeUndefined()
  })
})

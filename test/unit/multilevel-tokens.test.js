import { describe, it, expect, beforeEach } from 'vitest'
import { getDamageTargetId, getTargetActor, getTargetToken, withoutTargetedClones } from '../../scripts/integrations/multilevel-tokens.js'

const orc = { name: 'orc actor' }
const dragon = { name: 'dragon actor' }

// A source token, and clones of it on this scene or pointing at another scene.
// Since Foundry 11 clones have a synthetic actor of their own (a copy of the source's)
const cloneActor = { name: 'synthetic clone actor' }
const source = { id: 'source', actor: orc, document: { flags: {} } }
const clone = { id: 'clone', actor: cloneActor, document: { flags: { 'multilevel-tokens': { stoken: 'source' } } } }
const remoteClone = { id: 'remote', actor: cloneActor, document: { flags: { 'multilevel-tokens': { stoken: 'dragonToken', sscene: 'otherScene' } } } }
const dragonTokenDoc = { id: 'dragonToken', actor: dragon }

const setModule = (active) => {
  game.modules = { get: id => (id === 'multilevel-tokens' && active !== undefined ? { active } : undefined) }
}

beforeEach(() => {
  setModule(true)
  game.scenes = { get: id => (id === 'otherScene' ? { tokens: { get: tid => (tid === 'dragonToken' ? dragonTokenDoc : undefined) } } : undefined) }
  globalThis.canvas = { tokens: { get: id => ({ source, clone, remote: remoteClone })[id] } }
})

describe('withoutTargetedClones', () => {
  it('drops a clone when its source token is also targeted', () => {
    expect(withoutTargetedClones([source, clone])).toEqual([source])
  })

  it('keeps a clone whose source is not targeted', () => {
    expect(withoutTargetedClones([clone, remoteClone])).toEqual([clone, remoteClone])
  })

  it('keeps all tokens while the module is inactive or not installed', () => {
    setModule(false)
    expect(withoutTargetedClones([source, clone])).toEqual([source, clone])
    setModule(undefined)
    expect(() => withoutTargetedClones([source, clone])).not.toThrow()
  })
})

describe('getTargetActor', () => {
  it('returns the token’s own actor for a normal token', () => {
    expect(getTargetActor(source)).toBe(orc)
  })

  it('returns the source actor for a clone on this scene', () => {
    expect(getTargetActor(clone)).toBe(orc)
  })

  it('returns the source actor for a clone of a token on another scene', () => {
    expect(getTargetActor(remoteClone)).toBe(dragon)
  })

  it('reads the flags from the token when its document has none', () => {
    const legacyClone = { id: 'legacy', actor: null, flags: { 'multilevel-tokens': { stoken: 'source' } } }
    expect(getTargetActor(legacyClone)).toBe(orc)
  })

  it('uses a clone’s own actor when the module is not installed', () => {
    setModule(undefined)
    expect(getTargetActor(clone)).toBe(cloneActor)
  })

  it('treats a clone without an actor (before Foundry 11) the same way', () => {
    expect(getTargetActor({ ...clone, actor: null })).toBe(orc)
  })

  it('does not treat a token with other multilevel-tokens flags as a clone', () => {
    const notAClone = { id: 'other', actor: dragon, document: { flags: { 'multilevel-tokens': { somethingElse: true } } } }
    expect(getTargetActor(notAClone)).toBe(dragon)
  })
})

describe('getTargetToken', () => {
  it('returns the source token document for a clone of a token on another scene', () => {
    expect(getTargetToken(remoteClone)).toBe(dragonTokenDoc)
  })

  it('returns the source token for a clone on this scene, which takes the damage', () => {
    expect(getTargetToken(clone)).toBe(source)
  })

  it('returns the token itself otherwise', () => {
    expect(getTargetToken(source)).toBe(source)
    expect(getTargetToken(undefined)).toBeUndefined()
  })
})

describe('getDamageTargetId', () => {
  it('lists a clone’s source token on this scene', () => {
    expect(getDamageTargetId('clone')).toBe('source')
  })

  it('keeps a clone of a token on another scene, which this scene’s card can’t list', () => {
    expect(getDamageTargetId('remote')).toBe('remote')
  })

  it('keeps any other token, and no target', () => {
    expect(getDamageTargetId('source')).toBe('source')
    expect(getDamageTargetId(null)).toBeNull()
  })
})

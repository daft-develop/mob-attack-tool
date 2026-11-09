import { describe, it, expect, beforeEach } from 'vitest'
import { getTargetActor, getTargetToken, withoutTargetedClones } from '../../scripts/integrations/multilevel-tokens.js'

const orc = { name: 'orc actor' }
const dragon = { name: 'dragon actor' }

// A source token with an actor, and clones of it (no actor) on this scene or pointing at another scene
const source = { id: 'source', actor: orc, document: { flags: {} } }
const clone = { id: 'clone', actor: null, document: { flags: { 'multilevel-tokens': { stoken: 'source' } } } }
const remoteClone = { id: 'remote', actor: null, document: { flags: { 'multilevel-tokens': { stoken: 'dragonToken', sscene: 'otherScene' } } } }
const dragonTokenDoc = { id: 'dragonToken', actor: dragon }

const setModule = (active) => {
  game.modules = { get: id => (id === 'multilevel-tokens' && active !== undefined ? { active } : undefined) }
}

beforeEach(() => {
  setModule(true)
  game.scenes = { get: id => (id === 'otherScene' ? { tokens: { get: tid => (tid === 'dragonToken' ? dragonTokenDoc : undefined) } } : undefined) }
  globalThis.canvas = { tokens: { get: id => ({ source })[id] } }
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

  it('does not throw for an actorless token when the module is not installed', () => {
    setModule(undefined)
    expect(() => getTargetActor(clone)).not.toThrow()
    expect(getTargetActor(clone)).toBeNull()
  })
})

describe('getTargetToken', () => {
  it('returns the source token document for a clone of a token on another scene', () => {
    expect(getTargetToken(remoteClone)).toBe(dragonTokenDoc)
  })

  it('returns the token itself otherwise', () => {
    expect(getTargetToken(source)).toBe(source)
    expect(getTargetToken(clone)).toBe(clone)
    expect(getTargetToken(undefined)).toBeUndefined()
  })
})

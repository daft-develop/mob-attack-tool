import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSelectedTokenIds, selectTokens } from '../../scripts/foundry/targets.js'

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
})

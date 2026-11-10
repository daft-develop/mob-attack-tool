import { describe, it, expect } from 'vitest'
import { getAttackerForHit } from '../../scripts/core/attackers.js'

const tokens = [{ tokenId: 'a' }, { tokenId: 'b' }]

describe('getAttackerForHit', () => {
  it('returns the token that made each hit', () => {
    expect(getAttackerForHit(tokens, 0)).toBe(tokens[0])
    expect(getAttackerForHit(tokens, 1)).toBe(tokens[1])
  })

  it('uses the last token for hits beyond the list instead of reading past its end', () => {
    expect(getAttackerForHit(tokens, 2)).toBe(tokens[1])
    expect(getAttackerForHit(tokens, 5)).toBe(tokens[1])
  })

  it('returns undefined when no token was recorded', () => {
    expect(getAttackerForHit([], 0)).toBeUndefined()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playAttackAnimations } from '../../scripts/integrations/automated-animations.js'

const weapon = { name: 'Scimitar' }
const tokens = { a: { id: 'a' }, b: { id: 'b' }, target: { id: 'target' } }
let enabled
let moduleActive

beforeEach(() => {
  enabled = true
  moduleActive = true
  game.settings = { get: (scope, key) => (key === 'enableAutoAnimations' ? enabled : undefined) }
  game.modules = { get: id => (id === 'autoanimations' && moduleActive !== undefined ? { active: moduleActive } : undefined) }
  globalThis.canvas = { tokens: { get: id => tokens[id] } }
  globalThis.AutomatedAnimations = { playAnimation: vi.fn() }
})

describe('playAttackAnimations', () => {
  it('plays one animation per hit from the attacking token, at the target', () => {
    playAttackAnimations(weapon, [{ tokenId: 'a' }, { tokenId: 'b' }], 2, 'target')
    expect(AutomatedAnimations.playAnimation.mock.calls).toEqual([
      [tokens.a, weapon, { targets: [tokens.target] }],
      [tokens.b, weapon, { targets: [tokens.target] }],
    ])
  })

  it('does not pass a target when none is selected', () => {
    playAttackAnimations(weapon, [{ tokenId: 'a' }], 1, null)
    expect(AutomatedAnimations.playAnimation).toHaveBeenCalledWith(tokens.a, weapon, {})
  })

  it('plays the extra hits from the last token when fewer tokens were recorded', () => {
    playAttackAnimations(weapon, [{ tokenId: 'a' }], 3, 'target')
    expect(AutomatedAnimations.playAnimation).toHaveBeenCalledTimes(3)
    expect(AutomatedAnimations.playAnimation.mock.calls.every(call => call[0] === tokens.a)).toBe(true)
  })

  it('plays nothing without recorded tokens', () => {
    playAttackAnimations(weapon, [], 2, 'target')
    expect(AutomatedAnimations.playAnimation).not.toHaveBeenCalled()
  })

  it('plays nothing when disabled in settings or the module is not active', () => {
    enabled = false
    playAttackAnimations(weapon, [{ tokenId: 'a' }], 1, 'target')
    enabled = true
    moduleActive = undefined
    playAttackAnimations(weapon, [{ tokenId: 'a' }], 1, 'target')
    expect(AutomatedAnimations.playAnimation).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { isPublicRollMode } from '../../scripts/foundry/chat.js'

const useSettings = (settings) => {
  game.settings = { get: (scope, key) => settings[`${scope}.${key}`] }
}

afterEach(() => {
  game.version = '13.0.0'
})

describe('isPublicRollMode', () => {
  it.each([['publicroll', true], ['roll', true], ['gmroll', false], ['blindroll', false], ['selfroll', false]])(
    'Foundry 13: roll mode %s is public: %s', (mode, expected) => {
      game.version = '13.351'
      useSettings({ 'core.rollMode': mode })
      expect(isPublicRollMode()).toBe(expected)
    })

  it.each([['public', true], ['ic', true], ['gm', false], ['blind', false], ['self', false]])(
    'Foundry 14: message mode %s is public: %s', (mode, expected) => {
      game.version = '14.370'
      // core.rollMode is deprecated and null on Foundry 14
      useSettings({ 'core.rollMode': null, 'core.messageMode': mode })
      expect(isPublicRollMode()).toBe(expected)
    })
})

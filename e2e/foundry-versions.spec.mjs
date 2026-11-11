// Behaviour that differs between Foundry versions, checked against the real API
import { test, expect } from './fixtures.mjs'

test('public rolls are recognised as public (core.messageMode on Foundry 14)', async ({ gm }) => {
  const result = await gm.evaluate(async () => {
    const { isPublicRollMode } = await import('/modules/mob-attack-tool/scripts/foundry/chat.js')
    const v14 = !foundry.utils.isNewerVersion('14', game.version)
    const [key, publicMode, gmMode] = v14 ? ['messageMode', 'public', 'gm'] : ['rollMode', 'publicroll', 'gmroll']
    const previous = game.settings.get('core', key)
    await game.settings.set('core', key, publicMode)
    const whenPublic = isPublicRollMode()
    await game.settings.set('core', key, gmMode)
    const whenGm = isPublicRollMode()
    await game.settings.set('core', key, previous)
    return { whenPublic, whenGm }
  })
  expect(result).toEqual({ whenPublic: true, whenGm: false })
})

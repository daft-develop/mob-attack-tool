import { registerMiscBatch } from './quench/misc.js'
import { registerNpcBatch } from './quench/npc.js'
import { registerPlayerBatch } from './quench/player.js'
import { registerPreflightBatch } from './quench/preflight.js'

export function initQuenchTests() {
  Hooks.on('quenchReady', (quench) => {
    registerPreflightBatch(quench)
    registerPlayerBatch(quench)
    registerNpcBatch(quench)
    registerMiscBatch(quench)
  })
}

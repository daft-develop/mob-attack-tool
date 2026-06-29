import { registerMiscBatch } from './quench/misc.quench.js'
import { registerMultiattackBatch } from './quench/multiattack.quench.js'
import { registerNpcBatch } from './quench/npc.quench.js'
import { registerPlayerBatch } from './quench/player.quench.js'
import { registerPreflightBatch } from './quench/preflight.quench.js'

export function initQuenchTests() {
  Hooks.on('quenchReady', (quench) => {
    registerPreflightBatch(quench)
    registerPlayerBatch(quench)
    registerNpcBatch(quench)
    registerMultiattackBatch(quench)
    registerMiscBatch(quench)
  })
}

// Integration with the Automated Animations module (https://foundryvtt.com/packages/autoanimations)
import { moduleName } from '../constants.js'
import { getAttackerForHit } from '../core/attackers.js'

const MODULE_ID = 'autoanimations'

/**
 * Play the weapon's Automated Animations animation once per hit, from the
 * token that made each hit, when the module is active and enabled in this
 * module's settings
 * @param {Item5e} weaponData - the weapon used
 * @param {{tokenId: string}[]} tokenAttackList - attacking tokens, in hit order
 * @param {number} numHitAttacks - number of hits
 * @param {string|null} targetId - targeted token id, or null without a target
 */
export function playAttackAnimations(weaponData, tokenAttackList, numHitAttacks, targetId) {
  if (!game.settings.get(moduleName, 'enableAutoAnimations') || !game.modules.get(MODULE_ID)?.active) return
  const target = canvas.tokens.get(targetId)
  // don't pass target data if a target hasn't been selected
  const options = target ? { targets: [target] } : {}
  for (let i = 0; i < numHitAttacks; i++) {
    const attacker = getAttackerForHit(tokenAttackList, i)
    if (!attacker) return
    AutomatedAnimations.playAnimation(canvas.tokens.get(attacker.tokenId), weaponData, options)
  }
}

// Mob Attack Tool - utils.js
// Re-exports from split modules for backwards compatibility
// New code should import directly from scripts/core/ and scripts/engine/

// Core pure logic
export { calcD20Needed, calcAttackersNeeded, calcSuccessfulAttacks, getTextFromAttackBonus } from './core/roll-math.js'
export { getScalingFactor, simplifyFormula } from './core/damage.js'
export { getActivityFromItem, getAttackData, getAttackBonus } from './core/attack.js'

// Engine interop (Foundry-side effects)
export { getDamageOptions, callMidiMacro, checkTarget, formatAttackTargets, getTargetData } from './engine/foundry-interop.js'
export { prepareMonsters, prepareMobAttack, endGroupedMobTurn, getDamageFormulaAndType, isTargeted, sendChatMessage } from './engine/mob-logic.js'

// Legacy version check - kept for quench tests
export { foundryEqualOrNewerThan, systemEqualOrNewerThan } from './versions.js'

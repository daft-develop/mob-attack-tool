// Mob Attack Tool - utils.js
// Re-exports from the split modules so existing imports keep working.
// New code should import directly from the module that defines a function.

// No side effects
export { calcD20Needed, calcAttackersNeeded, calcSuccessfulAttacks, getTextFromAttackBonus } from './core/roll-math.js'
export { getScalingFactor, getDamageFormulaAndType } from './core/damage.js'
export { getActivityFromItem, getAttackData, getAttackBonus, isMobAttackItem } from './core/attack.js'

// dnd5e version differences and system APIs
export { getSpellMethod, getCasterLevel, simplifyFormula, formatAttackTargets, getDamageOptions, getDamageMessageData } from './system/dnd5e.js'

// Foundry side effects
export { checkTarget, getTargetData } from './foundry/targets.js'
export { endGroupedMobTurn } from './foundry/combat.js'
export { sendChatMessage } from './foundry/chat.js'

// Third-party module integrations
export { callMidiMacro } from './integrations/midi-qol.js'

// Mob attack dialog data
export { prepareMonsters, prepareMobAttack } from './ui/dialog/dialog-context.js'

// Version checks - kept for quench tests
export { foundryEqualOrNewerThan, systemEqualOrNewerThan } from './versions.js'

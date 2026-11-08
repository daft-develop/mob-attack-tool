import { systemEqualOrNewerThan } from '../versions.js'

/**
 * Get the scaling factor for cantrips based on caster level
 * @param {Item5e} weaponData - A spell item
 * @returns {number} The number of damage dice for the cantrip
 */
export function getScalingFactor(weaponData) {
  let cantripScalingFactor = 1
  if (weaponData.type == 'spell') {
    let casterLevel
    if (systemEqualOrNewerThan('4.3.0') && weaponData.actor.type === 'npc') {
      casterLevel = weaponData.actor.system.attributes.spell.level
    }
    else {
      casterLevel = weaponData.actor.system.details.level || weaponData.actor.system.details.spellLevel
    }

    if (5 <= casterLevel && casterLevel <= 10) {
      cantripScalingFactor = 2
    }
    else if (11 <= casterLevel && casterLevel <= 16) {
      cantripScalingFactor = 3
    }
    else if (17 <= casterLevel) {
      cantripScalingFactor = 4
    }
  }
  return cantripScalingFactor
}

/**
 * Simplify a roll formula using dnd5e system helpers
 * @param {string} formula - The formula to simplify
 * @returns {string} - The simplified formula
 */
export function simplifyFormula(formula) {
  if (systemEqualOrNewerThan('5.0.0')) {
    return dnd5e.dice.simplifyRollFormula(formula, { preserveFlavor: true })
  }
  // pre 5.0, negative modifiers didn't get the same leading/trailing space of positive modifiers
  else {
    let simplified = dnd5e.dice.simplifyRollFormula(formula, { preserveFlavor: true })
    // regex replace in case we missed a case
    return simplified.replaceAll(/(?<! )-(\d)/g, ' - $1')
  }
}

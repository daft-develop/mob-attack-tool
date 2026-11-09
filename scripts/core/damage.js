import { getCasterLevel } from '../system/dnd5e.js'

/**
 * Get the scaling factor for cantrips based on caster level
 * @param {Item5e} weaponData - A spell item
 * @returns {number} The number of damage dice for the cantrip
 */
export function getScalingFactor(weaponData) {
  let cantripScalingFactor = 1
  if (weaponData.type == 'spell') {
    const casterLevel = getCasterLevel(weaponData.actor)

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

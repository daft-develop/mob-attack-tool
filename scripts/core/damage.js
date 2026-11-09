import { getCasterLevel, simplifyFormula } from '../system/dnd5e.js'
import { getAttackData } from './attack.js'

// Same as Foundry's String.prototype.capitalize, without relying on it
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)

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

/**
 * Get damage formulas and types for a weapon/spell
 * @param {Item5e} weaponData - An item in an actor's inventory
 * @param {boolean} isVersatile - true if calculating versatile damage, false otherwise
 * @returns {[string[], string[], string[]]} Array of three sub-arrays: diceFormulas, damageTypes, damageTypeLabels
 */
export function getDamageFormulaAndType(weaponData, isVersatile = false) {
  const attackData = getAttackData(weaponData)
  let cantripScalingFactor = getScalingFactor(weaponData)
  let diceFormulas = []
  let damageTypes = []
  let damageTypeLabels = []
  let lengthIndex = 0
  for (let diceFormulaParts of attackData.damage.parts) {
    damageTypeLabels.push(diceFormulaParts[1])
    damageTypes.push(capitalize(diceFormulaParts[1]))
    if (weaponData.type == 'spell') {
      if (attackData.scaling?.mode == 'cantrip') {
        let rollFormula = new Roll(((isVersatile && lengthIndex === 0) ? attackData.damage.versatile : diceFormulaParts[0]), { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod })
        rollFormula.alter(0, cantripScalingFactor, { multiplyNumeric: false })
        diceFormulas.push(simplifyFormula(rollFormula.formula))
      }
      else {
        diceFormulas.push(simplifyFormula((isVersatile && lengthIndex === 0) ? attackData.damage.versatile : diceFormulaParts[0]).replace('@mod', attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod))
      }
    }
    else {
      // for non-spell damage formulas, the first available formula should add the magicalBonus, if it exists
      let formula = (((isVersatile && lengthIndex === 0) ? attackData.damage.versatile : diceFormulaParts[0]).replace('@mod', attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod))
      if (lengthIndex === 0 && weaponData.system.magicAvailable) {
        formula += '+ ' + weaponData.system.magicalBonus
      }
      diceFormulas.push(simplifyFormula(formula))
    }
    lengthIndex++
  }
  return [diceFormulas, damageTypes, damageTypeLabels]
}

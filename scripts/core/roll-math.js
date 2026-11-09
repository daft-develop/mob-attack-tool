/**
 * Calculate the d20 roll needed to hit a target's AC
 * @param {number} attackBonus - The attacker's total attack bonus
 * @param {number} targetAC - The target's armor class
 * @param {number} rollTypeValue - Advantage/disadvantage modifier (0 for normal)
 * @param {string} mobRulesSetting - 'mob2014' or 'mob2024' rule set
 * @returns {number} The d20 roll needed (clamped 1-20)
 */
export function calcD20Needed(attackBonus, targetAC, rollTypeValue, mobRulesSetting) {
  let d20Needed = targetAC - attackBonus
  if (mobRulesSetting === 'mob2014') {
    d20Needed -= rollTypeValue
  }
  else if (mobRulesSetting === 'mob2024') {
    // Hidden math used in the DMG 2024 mob results table
    if (rollTypeValue > 0) d20Needed = Math.round(Math.pow((d20Needed - 1), 2) / 20 + 1)
    if (rollTypeValue < 0) d20Needed = Math.round(-Math.pow((d20Needed - 21), 2) / 20 + 21)
  }
  return Math.min(20, Math.max(1, d20Needed))
}

/**
 * Calculate how many attackers are needed to guarantee at least one hit
 * Uses the DMG 2014 mob rules table, or a custom table when one is given
 * @param {number} d20Needed - The roll needed for a success
 * @param {Array<string|number>|null} customTable - Flat [min, max, attackers, ...] rows, or null for the DMG table
 * @returns {number} The number of attackers needed
 */
export function calcAttackersNeeded(d20Needed, customTable = null) {
  let attackersNeeded = 0
  if (customTable) {
    let tableArray = {}
    for (let i = 0; i < Math.floor(customTable.length / 3); i++) {
      tableArray[i] = customTable.slice(3 * i, 3 * i + 3)
      if (parseInt(tableArray[i][0]) <= d20Needed && d20Needed <= parseInt(tableArray[i][1])) {
        attackersNeeded = Math.abs(parseInt(tableArray[i][2]))
      }
    }
  }
  else {
    if (1 <= d20Needed && d20Needed <= 5) {
      attackersNeeded = 1
    }
    else if (6 <= d20Needed && d20Needed <= 12) {
      attackersNeeded = 2
    }
    else if (13 <= d20Needed && d20Needed <= 14) {
      attackersNeeded = 3
    }
    else if (15 <= d20Needed && d20Needed <= 16) {
      attackersNeeded = 4
    }
    else if (17 <= d20Needed && d20Needed <= 18) {
      attackersNeeded = 5
    }
    else if (d20Needed == 19) {
      attackersNeeded = 10
    }
    else if (d20Needed >= 20) {
      attackersNeeded = 20
    }
  }
  return attackersNeeded
}

/**
 * Use the DMG 2024 Mob Results table to calculate successful attacks based on the roll needed and the amount of attacks
 * The actual table is replaced by an equivalent mathematical expression that can cover all possible values
 * @param {number} d20Needed - The roll needed for a success
 * @param {number} totalAttacks - The amount of attacks
 * @returns {number} The amount of successful attacks
 */
export function calcSuccessfulAttacks(d20Needed, totalAttacks) {
  return Math.max(0, Math.round((20 - d20Needed + 1) / 20 * totalAttacks))
}

/**
 * Text format the attack bonus to include leading +/-
 * @param {number} finalAttackBonus - number representing attack bonus
 * @returns {string} string version of bonus, leading + or -
 */
export function getTextFromAttackBonus(finalAttackBonus) {
  // convert to string first
  let finalAttackBonusText = finalAttackBonus.toString()
  // add a '+' for positive attack bonuses if it's not already there
  return !/^[+-]/.test(finalAttackBonusText) ? `+${finalAttackBonusText}` : finalAttackBonusText
}

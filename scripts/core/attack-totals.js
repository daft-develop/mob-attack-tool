// Attack and average damage totals shown in the mob attack dialog

/**
 * Total attacks and average damage of the checked weapons across a mob
 * @param {object} monsters - monster data from prepareMonsters, keyed by actor id
 * @returns {{numAttacks: number, averageDamage: number}} the totals
 */
export function sumCheckedAttacks(monsters) {
  let numAttacks = 0
  let averageDamage = 0
  for (const monster of Object.values(monsters)) {
    for (const weapon of Object.values(monster.weapons)) {
      if (weapon.useButtonValue === 'checked') {
        numAttacks += weapon.numAttack * monster.amount
        averageDamage += weapon.numAttack * weapon.averageDamage * monster.amount
      }
    }
  }
  return { numAttacks, averageDamage }
}

/**
 * Total attacks and average damage assigned to one target
 * Each entry in a target's weapons list is a single attack
 * @param {object[]} weapons - the target's weapons list
 * @returns {{numAttacks: number, averageDamage: number}} the totals
 */
export function sumTargetAttacks(weapons) {
  let averageDamage = 0
  for (const weapon of weapons) {
    averageDamage += weapon.averageDamage
  }
  return { numAttacks: weapons.length, averageDamage }
}

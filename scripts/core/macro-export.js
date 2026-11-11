// Builds the macros the mob attack dialog exports. Each exported macro
// replays its mob attack through MobAttacks.quickRoll (macroObject.js).

/**
 * Default name for an exported mob attack macro, e.g. "Scimitar Mob Attack of 4 Goblin(s)"
 * @param {string} weaponName - name of the mob's first selected weapon
 * @param {number} numTokens - number of tokens in the mob
 * @param {string} mobName - token or saved mob name
 * @param {{prefix: string, postfix: string}} words - localized MAT.macroNamePrefix and MAT.macroNamePostfix
 * @returns {string} the macro name
 */
export function buildMacroName(weaponName, numTokens, mobName, { prefix, postfix }) {
  return `${weaponName} ${prefix} ${numTokens} ${mobName}${postfix}`
}

/**
 * Script command for a macro that replays a mob attack through MobAttacks.quickRoll
 * Without an explicit advantage or disadvantage, the macro checks the modifier
 * keys held when it runs: alt for advantage, and meta or ctrl for disadvantage
 * depending on the disadvantageKeyBinding setting
 * @param {object} mobAttackData - mob attack data from prepareMobAttack
 * @param {number} disadvantageKeyBinding - the disadvantageKeyBinding setting (0 = meta key, otherwise ctrl)
 * @returns {string} the macro command
 */
export function buildQuickRollCommand(mobAttackData, disadvantageKeyBinding) {
  let withAdvantage = mobAttackData.withAdvantage
  let withDisadvantage = mobAttackData.withDisadvantage
  if (!withAdvantage && !withDisadvantage) {
    withAdvantage = `event.altKey`
    withDisadvantage = (disadvantageKeyBinding === 0 ? `event.metaKey` : `event.ctrlKey`)
  }
  return `MobAttacks.quickRoll({numSelected: ${mobAttackData.numSelected}, weaponLocators: ${JSON.stringify(mobAttackData.weaponLocators)}, attacks: ${JSON.stringify(mobAttackData.attacks)}, withAdvantage: ${withAdvantage}, withDisadvantage: ${withDisadvantage}, rollTypeValue: ${mobAttackData.rollTypeValue}, rollTypeMessage: "${mobAttackData.rollTypeMessage}", monsters: ${JSON.stringify(mobAttackData.monsters)}})`
}

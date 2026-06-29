/**
 * Returns the scaling multiplier for a spell weapon based on the caster's level.
 *
 * @param {object} weaponData - The weapon or spell data object.
 * @param {string} weaponData.type - The item type; only spells use scaling.
 * @param {object} [weaponData.actor] - The actor that owns the weapon.
 * @returns {number} The scaling factor to apply to the spell damage.
 */
export function getSpellScalingFactor(weaponData) {
  if (weaponData?.type !== 'spell') {
    return 1
  }

  const actor = weaponData.actor
  // General case, actors and old NPCs
  let casterLevel = actor?.system?.details?.level || actor?.system?.details?.spellLevel || 1

  // After 5e 4.3.0, npc caster level moved
  if (actor?.type === 'npc' && actor?.system?.attributes?.spell?.level !== undefined) {
    casterLevel = actor.system.attributes.spell.level
  }

  if (5 <= casterLevel && casterLevel <= 10) {
    return 2
  }
  if (11 <= casterLevel && casterLevel <= 16) {
    return 3
  }
  if (17 <= casterLevel) {
    return 4
  }

  return 1
}

/**
 * Returns the scaling multiplier for Fighter Extra Attack scaling
 *
 * @param {number} level actor class or challenge level
 * @returns {number} multiplier
 */
export function getFighterScalingFactor(level) {
  if (level == 20) {
    return 4
  }
  else if (11 <= level && level < 20) {
    return 3
  }
  else {
    // level < 11 but has Extra Attack
    return 2
  }
}

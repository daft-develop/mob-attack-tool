/**
 * Return the first attack activity from an item
 * This is taken from the dnd5e system code
 * @param {Item5e} actorItem - item containing an attack activity
 * @returns {AttackActivity|undefined} the first activity on an item with the type attack, or undefined if no match
 */
export function getActivityFromItem(actorItem) {
  return actorItem.system.activities?.getByType('attack')[0]
}

/**
 * For a given weapon/spell/item, return the data required to perform an attack
 * Uses the dnd5e 4+ activity model
 *
 * We're using:
 *
 * ability - string of str/dex/etc. or 'none'
 * a bound copy of the rollDamage function pointing back to the item/activity source
 * damage.versatile - bool true if versatile copy of item
 * damage.parts[] - array of damage "parts" like the damage formula and damage type (fire/slashing)
 * scaling.mode - for spells
 * range - for ranged weapon reach/long/value/units
 *
 * @param {Item5e} item a weapon/spell held by an actor
 * @returns {object} the item's attackData
 */
export function getAttackData(item) {
  const attackActivity = getActivityFromItem(item) || {}
  let attackData = { ...attackActivity }
  if (attackActivity.damage) {
    attackData.damage = {
      parts: attackData.damage.parts.map(p => [
        p.formula + (p.base && !/@mod\b/.test(p.formula) ? ' + @mod' : ''),
        p.types.first() ?? '',
      ]),
    }
    if (item.system.properties.has('ver')) {
      const versatile = item.system.damage.versatile.clone(item.system.damage.versatile)
      versatile.denomination ||= item.system.damage.base.steppedDenomination()
      versatile.number ||= item.system.damage.base.number
      versatile.types = item.system.damage.base.types
      attackData.damage.versatile = versatile.formula + (!/@mod\b/.test(versatile.formula) ? ' + @mod' : '')
    }
    else {
      attackData.damage.versatile = ''
    }
    attackData.ability = attackActivity.ability ?? 'none'
    if (item.type === 'spell' && item.system.level === 0 && item.name !== 'Eldritch Blast') {
      attackData.scaling = { mode: 'cantrip' }
    }
    attackData.rollDamage = attackActivity.rollDamage.bind(attackActivity)
  }
  return attackData
}

/**
 * Get the numerical attack bonus for a given weapon that's from an actor embedded collection
 * Required to be on an actor in order to get the correct modifiers
 *
 * @param {Item5e} actorItem - weapon type item from an actor embedded collection
 * @returns {number} a positive or negative integer representing the total attack bonus
 */
export function getAttackBonus(actorItem) {
  // we assume a single activity of type 'attack' exists on the weapon
  const attackData = getActivityFromItem(actorItem)
  // return the labels.modifier if it exists, otherwise modifier is 0
  let modifierString = attackData?.labels?.modifier ?? 0
  // remove spaces between leading - and number to prevent NaN results
  modifierString = modifierString.replaceAll(' ', '')
  return parseInt(modifierString)
}

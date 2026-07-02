// @ts-check

import { flattenMultiExtraDesc } from './utils.js'
import { getFighterScalingFactor, getSpellScalingFactor } from './scaling.js'

/**
 * Parse out preferred weapons for a given actor
 * Upstream, this function is called twice. First to flag number of attacks and pre-select weapons matching mutliattack description
 * A second pass if no multi was found to auto-select the max damage weapon instead
 * Note: A weapon description giving options (or, alternatively, instead, etc.) returns false so the second pass picks the most damaging option
 * A weapon description that's inclusive (two x AND three y) chooses all of them
 * @param {string} weaponName name of weapon currently being evaluated
 * @param {*} actorData actor currently being evaluated
 * @param {*} weapons array of actor's items with attack activity
 * @param {*} options option to select/check weapon with the highest damage
 * @returns {Promise<[number, boolean]>} number of attacks with this weapon, bool if this should be one of the auto-selected weapons
 */
export async function getMultiattackFromActor(weaponName, actorData, weapons, options) {
  /** @type [ number, boolean ] */
  let multiattack
  let weaponData = actorData.items.getName(weaponName)
  let multiItem = actorData.items.contents.find(i => i.name.toLowerCase().startsWith('multiattack'))
  let extraItem = actorData.items.contents.find(i => i.name.toLowerCase().startsWith('extra attack'))

  // Skip test if weapon not found on actor
  if (weaponData == undefined) {
    multiattack = [1, false]
  }
  // Check for eldritch blast first, it takes priority over multi/extra attack
  else if (weaponData.type === 'spell' && weaponName === 'Eldritch Blast') {
    multiattack = [getSpellScalingFactor(weaponData), false]
  }
  else if (multiItem != undefined) {
    // Otherwise, find out details about multiattack
    multiattack = await parseMultiAttack(actorData, weaponData)
  }
  else if (extraItem != undefined) {
    // look for Fighter-specific triggers
    if (extraItem.name.toLowerCase().includes('fighter')
      || extraItem?.system?.description?.value.toLowerCase().includes('number of attacks increases')) {
      let actorLevel = actorData.system.details.level
      multiattack = [getFighterScalingFactor(actorLevel), false]
    }
    else if (extraItem?.system?.description?.value.toLowerCase().includes('can attack three times')) {
      multiattack = [3, false]
    }
    else if (extraItem?.system?.description?.value.toLowerCase().includes('can attack four times')) {
      multiattack = [4, false]
    }
    else {
      multiattack = [2, false]
    }
  }
  else {
    // default behavior
    // If attacker has only one weapon and no multiattack, autoselect it
    multiattack = [1, Object.keys(weapons).length === 1]
  }

  // select this weapon if it deals the most damage and no other weapons or spells are selected
  if (options?.checkMaxDamageWeapon) {
    if (weaponData === options?.maxDamageWeapon) {
      multiattack[1] = true
    }
  }

  return multiattack
}

/**
 * Parse out as many variations of Multi Attack as practical
 * @param {*} actorData actor being parsed
 * @param {*} weaponData active weapon being parsed
 * @returns {Promise<[number, boolean]>} same as above
 */
async function parseMultiAttack(actorData, weaponData) {
  // Name cleanup: case to lowercase for insensitive checks, trim tailing 's' to avoid plural/singular mix
  // between item and description (item is Claw, description has Claws)
  /** @type { string } */
  let weaponName = weaponData.name.toLowerCase().replace(/s$/i, '')

  // Find Multiattack description, lower case to make case insensitive
  /** @type { string } */
  let lowerDesc = (await flattenMultiExtraDesc(actorData)).toLowerCase()

  // Can't parse a blank description
  if (lowerDesc == '') {
    return [1, false]
  }

  /** @type {[ number, boolean ]} */
  let multiattack = [1, false]

  // classify the weapon further
  /** @type { 'unknown' | 'melee' | 'ranged' } */
  let weaponType
  if ([`mwak`, `msak`].includes(weaponData.system.actionType)) {
    weaponType = `melee`
  }
  else if ([`rwak`, `rsak`].includes(weaponData.system.actionType)) {
    weaponType = `ranged`
  }
  else {
    weaponType = `unknown`
  }

  /** @type {{attacks: {count: number, weapon: string}[]} | undefined} */
  let parsed = regexParseDescription(lowerDesc)

  if (parsed == undefined) {
    return [1, false]
  }

  // specific match trims tailing s to de-pluralize name matching weaponName trimming above
  let specificMatch = parsed.attacks.find(a => a.weapon.replace(/s$/i, '') == weaponName)
  let categoryMatch = parsed.attacks.find(a => a.weapon.includes(weaponType))

  // if parser couldn't figure out the weapon type
  // but got a count
  if (parsed.attacks[0].weapon == `anything-goes`) {
    multiattack = [parsed.attacks[0].count, false]
  }
  // Try to find an exact name match in the description
  else if (specificMatch != undefined) {
    multiattack = [specificMatch.count, true]
  }
  // Try to match by category (melee, ranged)
  else if (categoryMatch != undefined) {
    multiattack = [categoryMatch.count, true]
  }

  // if anything in the description suggested multiple options,
  // flag selected as 'false' to trigger a second pass to pick
  // the max damage option
  if ([' or ', ' instead', 'alternatively', ' while '].some(word => lowerDesc.includes(word))) {
    multiattack[1] = false
  }

  return multiattack
}

// Word to number mapping
/** @type {Record<string, number>} */
const WORD_TO_NUM = {
  one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10,
}

/**
 * @param {string} val
 * @returns {number}
 */
function normalizeCount(val) {
  const lower = val.toLowerCase().trim()
  if (WORD_TO_NUM[lower] !== undefined) return WORD_TO_NUM[lower]
  const num = parseInt(lower, 10)
  return isNaN(num) ? 1 : num
}

// Regex patterns (order matters: most specific first)
const PATTERNS = [
  // 1. Multiple attacks joined by "and" or "or"
  // The creature makes two claw attacks and one bite attack
  /makes\s+(?<count1>\d+|[a-z]+)\s+(?<weapon1>[a-z\s]{2,30}?)\s+attacks?\s+(?:and|or)\s+(?<count2>\d+|[a-z]+)\s+(?<weapon2>[a-z\s]{2,30}?)\s+attacks?/i,

  // 2. Standard single attack
  // The creature makes two bite attacks
  /makes\s+(?<count>\d+|[a-z]+)\s+(?<weapon>[a-z\s]{2,30}?)\s+attacks?/i,

  // 3. Conditional "can use... and make"
  /can\s+(?:use\s+.+?\s+)?make\s+(?<count>\d+|[a-z]+)\s+(?<weapon>[a-z\s]{2,30}?)\s+attacks?/i,

  // 4. Breakdown format: "makes N attacks: ..."
  // The creature makes two attacks: one bite attack and one claw attack
  // Details structure can vary, see sub-search further below
  /makes\s+(?<total>\d+|[a-z]+)\s+attacks?\s*:\s*(?<details>.+?)\s*(?:\.|$)/i,

  // 5. Inverted structure
  // The creature makes two attacks with its longsword
  /makes\s+(?<count>\d+|[a-z]+)\s+attacks?\s+(?:with it'?s)\s+(?<weapon>[a-z\s]{2,30})/i,

  // Twice/Once ending structure (last word is once/twice)
  // The creature attacks with its weapon name once/twice
  // The creature uses Fire Breath once
  /(?:uses?|attacks?\s+with)(?:\s+it'?s)?\s+(?<weapon>.+)\s+(?<count>[a-z]+)$/i,

  // Attack Twice/Once structure (attack followed by count)
  // The creature attacks twice with its weapon name
  /attacks?\s+(?<count>[a-z]+)\s+(?:[a-z']+\s)*(?:it'?s\s+)(?<weapon>[a-z\s]{2,30})/i,

  // Super Generic
  // The creature makes three attacks
  /makes\s+(?<count>\d+|[a-z]+)\s+attacks?/i,

  // The creature makes two longsword attacks
  // The creature makes three unarmed strikes
  /makes\s+(?<count>[a-z]+)\s+(?<weapon>.+?)(?:\s+attacks)?$/i,

  // The creature attacks twice
  /attacks\s+(?<count>[a-z]+)$/i,

  // The creature attacks nine times
  /attacks\s+(?<count>[a-z]+)\s+times?$/i,

  // The creature attacks twice with megasword
  /attacks?\s+(?<count>[a-z]+)\s+with\s+(?<weapon>.+)$/i,
]

/**
 * @param {string} line multiattack description string
 * @returns {{ attacks: {count: number, weapon: string}[]} | undefined}
 */
function regexParseDescription(line) {
  line = line.trim().replace(/[.,;]/, '')

  for (const pattern of PATTERNS) {
    const match = pattern.exec(line)
    if (match) {
      const g = match.groups

      if (g?.weapon1) {
        return {
          attacks: [
            { count: normalizeCount(g.count1), weapon: g.weapon1.trim() },
            { count: normalizeCount(g.count2), weapon: g.weapon2.trim() },
          ],
        }
      }
      else if (g?.weapon) {
        return {
          attacks: [{ count: normalizeCount(g.count), weapon: g.weapon.trim() }],
        }
      }
      else if (g?.details) {
        const attacks = []
        // Extract "N with X" from breakdown strings

        // Try 5.1 style first: one with its x and one with its y
        const detailRegex = /(?<count>\d+|[a-z]+)\s+with\s+(?:its\s+)?(?<weapon>[a-z]+(?:\s+[a-z]+)*?)(?=\s+(and|or)\s+|[.!?]?$)/gi
        let detailMatch
        while ((detailMatch = detailRegex.exec(g.details)) !== null) {
          const g = detailMatch.groups
          attacks.push({
            count: normalizeCount(g?.count ?? '1'),
            weapon: g?.weapon.trim() ?? 'anything-goes',
          })
        }

        if (attacks.length == 0) {
          // no match, try again with 5.2 style
          // one x attack and one y attack
          const detailRegex = /\b(?!((and|or)\b))(?<count>\d+|[a-z]+)\s+(?<weapon>[a-z]+(?:\s+[a-z]+)*?)\s+attacks?\b/gi
          let detailMatch
          while ((detailMatch = detailRegex.exec(g.details)) !== null) {
            const g = detailMatch.groups
            attacks.push({
              count: normalizeCount(g?.count ?? '1'),
              weapon: g?.weapon.trim() ?? 'anything-goes',
            })
          }
        }
        return { attacks }
      }
      else if (g?.count) {
        // no specific weapon in description, just a count
        return {
          attacks: [{
            count: normalizeCount(g.count),
            weapon: `anything-goes`,
          }],
        }
      }
    }
  }
  return undefined // Fallback if nothing found
}

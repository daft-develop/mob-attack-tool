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
    multiattack = [0, false]
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
  const dictStrNum = /** @type {Record<string, number>} */ ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 })

  /** @type { string } */
  let weaponName = weaponData.name.toLowerCase()

  // Find Multiattack description, lower case to make case insensitive
  /** @type { string } */
  let desc = (await flattenMultiExtraDesc(actorData)).toLowerCase()

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

  // First split multiattack description before/after the portion
  // referreing to `weaponName`
  let attackIndex = desc.indexOf(`attack`)

  /** @type { 'choose' | 'melee' | 'ranged' | 'specific' | 'unknown' } */
  let attackDescType
  // check first if the weapon is called out directly in the description
  if (desc.indexOf(`${weaponName.toLowerCase()}`) !== -1) {
    attackIndex = desc.indexOf(`${weaponName.toLowerCase()}`)
    attackDescType = `specific`
  }

  // then look for category matches (melee or ranged)
  else if (weaponType == `melee` && desc.indexOf(`melee attack`) != -1) {
    attackIndex = desc.indexOf(`melee attack`)
    attackDescType = `melee`
  }
  else if (weaponType == `ranged` && desc.indexOf(`ranged attack`) != -1) {
    attackIndex = desc.indexOf(`ranged attack`)
    attackDescType = `ranged`
  }
  else {
    // general case: not specifically melee, ranged, or named in the description
    attackDescType = `unknown`
  }

  // Split up description into words for analysis
  let wordsBeforeAttack = desc.slice(0, attackIndex).split(' ').reverse()

  // work backwards from attack to find count
  let numAttacksTotal = 0
  let numAttacksWithThisWeapon = 0
  for (let word of wordsBeforeAttack) {
    if (dictStrNum[word]) {
      if (attackDescType !== `unknown`) {
        numAttacksWithThisWeapon = dictStrNum[word]
      }
      numAttacksTotal = dictStrNum[word]
      break
    }
  }

  // if desc in front of attack doesn't find a match
  // check after
  if (numAttacksTotal == 0) {
    let remainingWords = desc.slice(attackIndex).split(' ')

    let weaponDetected = false
    let twiceAtEnd = false

    // Step backwards through multiattack description
    for (let word of remainingWords) {
      // homogenize words to simplify detection
      word = word.toLowerCase()
      let interpunction = [',', '.', ':']
      for (let ip of interpunction) {
        if (word.endsWith(ip)) word = word.slice(0, word.indexOf(ip))
      }

      // check if description ends with 'twice' (a rare exception)
      if (word === 'twice') {
        twiceAtEnd = true
      }

      // detect weapon
      if (weaponName.toLowerCase().split(' ').includes(word) || `${weaponName.toLowerCase()}s`.split(' ').includes(word)) {
        weaponDetected = true
      }

      // detect possibility of choosing what kind of multiattack to use
      const optionKeywordsSingle = [`or`, `alternatively`, `instead`, `while`]
      if (weaponDetected) {
        if (optionKeywordsSingle.includes(word)) {
          attackDescType = `choose`
          if (twiceAtEnd == true) {
            numAttacksWithThisWeapon = 2
            break
          }
        }
      }

      // match text number to actual value for number of attacks
      if (weaponDetected && dictStrNum[word]) {
        numAttacksWithThisWeapon = dictStrNum[word]
      }
    }
  }

  let typeArray = ['']
  let numWeaponsInventory = actorData.items.filter(w => w.type === 'weapon').length
  if (attackDescType !== `unknown`) {
    if (attackDescType === `melee`) {
      typeArray = [`simpleM`, `martialM`]
    }
    else if (attackDescType === `ranged`) {
      typeArray = [`simpleR`, `martialR`]
    }
    numWeaponsInventory = actorData.items.filter(w => typeArray.includes(w.system.weaponType)).length
  }

  // either return the specific or total number of multiattacks
  if (numAttacksTotal !== 0) {
    if (numAttacksWithThisWeapon !== 0) {
      multiattack = [
        (numWeaponsInventory === numAttacksWithThisWeapon
          && numWeaponsInventory === numAttacksTotal)
          ? 1
          : numAttacksWithThisWeapon,
        true
      ]
    }
    else if (weaponDetected) {
      multiattack = [
        (numWeaponsInventory === numAttacksTotal)
          ? 1
          : numAttacksTotal,
        true
      ]
    }
  }

  // if anything in the description suggested multiple options,
  // flag selected as 'false' to trigger a second pass to pick
  // the max damage option
  if (attackDescType == `choose`) {
    multiattack[1] = false
  }
  return multiattack
}


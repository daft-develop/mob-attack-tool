// Builds the mob attack dialog's template data and reads its form back.
// "Context" as in ApplicationV2's _prepareContext.
import { moduleName } from '../../constants.js'
import { getAttackData, getAttackBonus, isMobAttackItem } from '../../core/attack.js'
import { getDamageFormulaAndType } from '../../core/damage.js'
import { getTextFromAttackBonus } from '../../core/roll-math.js'
import { getMultiattackFromActor } from '../../multiattack.js'

/**
 * Prepare monster data for the mob attack dialog
 * @param {Array<Item5e>} actorList - List of actor objects
 * @param {boolean} keepCheckboxes - Whether to preserve existing checkbox states
 * @param {object} oldMonsters - Previous monster data for checkbox preservation
 * @param {object} weapons - Existing weapons map
 * @param {object} availableAttacks - Existing attack counts
 * @returns {Promise<[object, object, object]>} Tuple of [monsters, weapons, availableAttacks]
 */
export async function prepareMonsters(actorList, keepCheckboxes = false, oldMonsters = {}, weapons = {}, availableAttacks = {}) {
  let monsters = {}

  // safety block to set actorList to an empty iterable
  // if it wasn't passed in correctly
  if (actorList == null || actorList == undefined) {
    actorList = []
  }

  for (let actor of actorList) {
    if (monsters[actor.id]) {
      if (monsters[actor.id].id === actor.id) {
        monsters[actor.id].amount += 1
      }
    }
    else {
      monsters[actor.id] = { id: actor.id, amount: 1, optionVisible: false, img: actor.img, name: actor.name }
    }
  }

  for (let actor of actorList) {
    if (monsters[actor.id]) {
      if (!monsters[actor.id].optionVisible) {
        let monsterData = {
          id: monsters[actor.id].id,
          amount: monsters[actor.id].amount,
          actorId: monsters[actor.id].id,
          actorAmount: `${monsters[actor.id].amount}x`,
          actorImg: monsters[actor.id].img,
          actorNameImg: monsters[actor.id].name.replace(' ', '-'),
          actorName: monsters[actor.id].name,
          weapons: {},
        }
        monsters[actor.id] = { ...monsterData }
        monsters[actor.id].optionVisible = true
        if (game.settings.get(moduleName, 'showMultiattackDescription')) {
          if (actor.items.contents.filter(i => i.name.startsWith('Multiattack')).length > 0) {
            monsters[actor.id]['multiattackDesc'] = $(actor.items.filter(i => i.name.startsWith('Multiattack'))[0].system.description.value)[0].textContent
          }
          else if (actor.items.contents.filter(i => i.name.startsWith('Extra Attack')).length > 0) {
            monsters[actor.id]['multiattackDesc'] = $(actor.items.filter(i => i.name.startsWith('Extra Attack'))[0].system.description.value)[0].textContent
          }
        }
      }
    }

    let actorWeapons = {}
    let items = actor.items.contents
    for (let item of items) {
      if (isMobAttackItem(item)) {
        if (weapons[item.id]?.id === item.id) {
          availableAttacks[item.id] += 1
        }
        else {
          weapons[item.id] = item
          availableAttacks[item.id] = 1
          actorWeapons[item.id] = item
        }
      }
    }
    let numAttacksTotal, preChecked
    let numCheckedWeapons = 0
    let highestDamageFormula = 0, maxDamage, maxDamageWeapon
    let averageDamageRoll
    let averageDamage = {}
    let options = {}
    let autoDetect = game.settings.get(moduleName, 'autoDetectMultiattacks')
    for (let [weaponID, weaponData] of Object.entries(actorWeapons)) {
      if (autoDetect === 2) {
        [numAttacksTotal, preChecked] = getMultiattackFromActor(weaponData.name, weaponData.actor, weapons, options)
        if (preChecked) numCheckedWeapons++
      }
      let damageData = getDamageFormulaAndType(weaponData, false)
      damageData = (typeof damageData[0][0] === 'undefined') ? '0' : damageData[0][0]
      maxDamage = new Roll(damageData).alter(((numAttacksTotal > 1) ? numAttacksTotal : 1), 0, { multiplyNumeric: true })
      maxDamage = await maxDamage.evaluate({ maximize: true })
      maxDamage = maxDamage.total
      damageData = getDamageFormulaAndType(weaponData, false)
      averageDamageRoll = new Roll(damageData[0].join(' + '))
      let averageDamageValue = 0
      for (let dTerm of averageDamageRoll.terms.filter(t => t.number > 0 && t.faces > 0)) {
        averageDamageValue += ((dTerm.faces + 1) / 2) * dTerm.number
      }
      for (let nTerm of averageDamageRoll.terms.filter(t => t.number > 0 && !t.faces)) {
        averageDamageValue += nTerm.number
      }
      averageDamage[weaponID] = Math.ceil(averageDamageValue)
      if (highestDamageFormula < maxDamage) {
        highestDamageFormula = maxDamage
        maxDamageWeapon = weaponData
      }
    }

    if (numCheckedWeapons === 0) {
      options['checkMaxDamageWeapon'] = true
      options['maxDamageWeapon'] = maxDamageWeapon
    }

    for (let [weaponID, weaponData] of Object.entries(actorWeapons)) {
      const attackData = getAttackData(weaponData)
      let checkVersatile = attackData.damage.versatile != ''
      for (let j = 0; j < 1 + ((checkVersatile) ? 1 : 0); j++) {
        let isVersatile = (j < 1) ? false : attackData.damage.versatile != ''
        let damageData = getDamageFormulaAndType(weaponData, isVersatile)
        let weaponDamageText = ``
        for (let i = 0; i < damageData[0].length; i++) {
          ((i > 0) ? weaponDamageText += `<br>${damageData[0][i]} ${damageData[1][i].capitalize()}` : weaponDamageText += `${damageData[0][i]} ${damageData[1][i].capitalize()}`)
        }
        numAttacksTotal = 1, preChecked = false
        autoDetect = game.settings.get(moduleName, 'autoDetectMultiattacks')
        if (autoDetect > 0) [numAttacksTotal, preChecked] = getMultiattackFromActor(weaponData.name, weaponData.actor, weapons, options)
        if (autoDetect === 1 || isVersatile) preChecked = false
        let weaponRangeText
        if (attackData.range.long > 0) {
          weaponRangeText = `${attackData.range.value}/${attackData.range.long} ${attackData.range.units}.`
        }
        else if (attackData.range.value > 0) {
          weaponRangeText = `${attackData.range.value} ${attackData.range.units}.`
        }
        else if (attackData.range.units === 'touch') {
          weaponRangeText = 'Touch'
        }
        else if (attackData.range.units === 'self') {
          weaponRangeText = 'Self'
        }
        else {
          weaponRangeText = '-'
        }

        let labelData = {
          numAttacksName: `numAttacks${(weaponData.id + ((isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``)).replace(' ', '-')}`,
          numAttack: numAttacksTotal,
          weaponActorName: weaponData.actor.name,
          weaponId: weaponData.id,
          weaponImg: weaponData.img,
          weaponNameImg: weaponData.name.replace(' ', '-'),
          weaponName: `${weaponData.name}${((isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``)}`,
          weaponAttackBonusText: getTextFromAttackBonus(getAttackBonus(weaponData)),
          weaponRange: weaponRangeText,
          weaponDamageText: weaponDamageText,
          useButtonName: `use${(weaponData.id + ((isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``)).replace(' ', '-')}`,
          useButtonValue: (keepCheckboxes) ? oldMonsters[actor.id]['weapons'][weaponID].useButtonValue : (preChecked) ? `checked` : ``,
          averageDamage: averageDamage[weaponID],
        }
        if (j === 0) {
          monsters[actor.id]['weapons'][weaponID] = { ...labelData }
        }
        else if (j === 1) {
          monsters[actor.id]['weapons'][weaponID + ` (${game.i18n.localize('Versatile')})`] = { ...labelData }
        }
      }
    }
  }
  return [monsters, weapons, availableAttacks]
}

/**
 * Prepare mob attack data from the dialog HTML
 * @param {JQuery<HTMLElement>} html - The dialog HTML element
 * @param {Array<string>} selectedTokenIds - Selected token IDs
 * @param {object} weapons - Weapons map
 * @param {object} availableAttacks - Available attack counts
 * @param {Array<object>} targets - Target data
 * @param {number} targetAC - Target AC
 * @param {number} numSelected - Number of selected tokens
 * @param {object} monsters - Monster data
 * @param {Actor5e[]} [actorList] - the dialog's actors, used when a saved mob is loaded
 * @returns {Promise<object>} Mob attack data bundle
 */
export async function prepareMobAttack(html, selectedTokenIds, weapons, availableAttacks, targets, targetAC, numSelected, monsters, actorList = []) {
  let mobList = game.settings.get(moduleName, 'hiddenMobList')
  if (game.settings.get(moduleName, 'hiddenChangedMob')) {
    let mobName = game.settings.get(moduleName, 'hiddenMobName')
    let mobData = mobList[mobName]

    numSelected = mobData?.numSelected ?? 0;
    [monsters, weapons, availableAttacks] = await prepareMonsters(actorList)
  }

  let attacks = {}
  let weaponLocators = []
  let numAttacksMultiplier
  let isVersatile
  for (let [weaponID, weaponData] of Object.entries(weapons)) {
    isVersatile = getAttackData(weaponData).damage.versatile != ''
    weaponID += ((isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``)

    if (html.find(`input[name="use` + weaponData.id.replace(' ', '-') + `"]`)[0].checked) {
      attacks[weaponData.id] = []
      for (let target of targets) {
        if (target.weapons.filter(w => w.weaponId === weaponData.id).length > 0) {
          attacks[weaponData.id].push({ targetId: target.targetId, targetNumAttacks: target.weapons.filter(w => w.weaponId === weaponData.id).length })
        }
      }
      if (targets.length === 0) {
        numAttacksMultiplier = parseInt(html.find(`input[name="numAttacks${weaponData.id.replace(' ', '-')}"]`)[0].value)
        if (Number.isNaN(numAttacksMultiplier)) {
          numAttacksMultiplier = 0
        }
        attacks[weaponData.id].push({ targetId: null, targetNumAttacks: availableAttacks[weaponData.id] * numAttacksMultiplier })
      }
      weaponLocators.push({ actorID: weaponData.actor.id, weaponName: weaponData.name, weaponID: weaponData.id })
    }
    if (html.find(`input[name="use` + weaponID.replace(' ', '-') + `"]`)[0].checked) {
      attacks[weaponID] = []
      for (let target of targets) {
        if (target.weapons.filter(w => w.weaponId === weaponData.id).length > 0) {
          attacks[weaponID].push({ targetId: target.targetId, targetNumAttacks: target.weapons.filter(w => w.weaponId === weaponData.id).length })
        }
      }
      if (targets.length === 0) {
        numAttacksMultiplier = parseInt(html.find(`input[name="numAttacks${weaponID.replace(' ', '-')}"]`)[0].value)
        if (Number.isNaN(numAttacksMultiplier)) {
          numAttacksMultiplier = 0
        }
        attacks[weaponID].push({ targetId: null, targetNumAttacks: availableAttacks[weaponData.id] * numAttacksMultiplier })
      }
      weaponLocators.push({ actorID: weaponData.actor.id, weaponName: weaponData.name, weaponID: weaponID })
    }
  }
  let withAdvantage = false
  let withDisadvantage = false
  let rollTypeValue = 0
  let rollTypeMessage = ``
  if (game.settings.get(moduleName, 'askRollType')) {
    let rtValue = Math.floor(game.settings.get(moduleName, 'rollTypeValue'))
    if (html.find('[name=rollType]')[0].value === 'advantage') {
      rollTypeValue = rtValue
      withAdvantage = true
      rollTypeMessage = ` + ${rtValue} [adv]`
    }
    else if (html.find('[name=rollType]')[0].value === 'disadvantage') {
      rollTypeValue = -1 * rtValue
      withDisadvantage = true
      rollTypeMessage = ` - ${rtValue} [disadv]`
    }
  }

  // Bundle data together
  let mobAttackData = {
    targets,
    targetAC,
    numSelected,
    selectedTokenIds,
    weapons,
    attacks,
    withAdvantage,
    withDisadvantage,
    rollTypeValue,
    rollTypeMessage,
    monsters,
    weaponLocators,
  }

  return mobAttackData
}

/**
 * Expand a saved mob into its list of actors, one entry per monster
 * Actors that no longer exist are skipped, so a saved mob containing a
 * deleted actor doesn't break prepareMonsters
 * @param {object} mobData - a saved mob from the hiddenMobList setting
 * @param {function(string): (Actor5e|undefined)} [getActor] - actor lookup by id
 * @returns {Actor5e[]} the mob's actors
 */
export function getMobActors(mobData, getActor = id => game.actors.get(id)) {
  const actors = []
  for (const monster of mobData?.monsters ?? []) {
    const actor = getActor(monster.id)
    if (!actor) continue
    for (let i = 0; i < monster.amount; i++) {
      actors.push(actor)
    }
  }
  return actors
}

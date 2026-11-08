import { moduleName } from '../mobAttack.js'
import { foundryEqualOrNewerThan } from '../versions.js'
import { getAttackData } from '../core/attack.js'
import { getScalingFactor, simplifyFormula } from '../core/damage.js'
import { getAttackBonus } from '../core/attack.js'
import { getMultiattackFromActor } from '../multiattack.js'

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
      const isAttack = item.system.activities?.some(a => a.type === 'attack' && a.damage?.parts?.length) && (item.type !== 'spell' || item.system.level === 0 || item.system.preparation.mode === 'atwill')

      if (isAttack) {
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
 * @returns {Promise<object>} Mob attack data bundle
 */
export async function prepareMobAttack(html, selectedTokenIds, weapons, availableAttacks, targets, targetAC, numSelected, monsters) {
  let mobList = game.settings.get('mob-attack-tool', 'hiddenMobList')
  if (game.settings.get('mob-attack-tool', 'hiddenChangedMob')) {
    let mobName = game.settings.get(moduleName, 'hiddenMobName')
    let mobData = mobList[mobName]

    let dialogId = game.settings.get(moduleName, 'currentDialogId')
    let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
    let actorList = mobDialog.actorList

    monsters
    weapons
    availableAttacks
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
 * End a grouped mob turn in combat
 * @param {object} data - Mob attack data containing selectedTokenIds
 */
export async function endGroupedMobTurn(data) {
  if (game.combat != null) {
    const mobList = game.settings.get('mob-attack-tool', 'hiddenMobList')
    const combatants = game.combat.turns
    let mobCreatures = {}
    let otherCreatures = []
    for (let combatant of combatants) {
      let savedMob
      for (let mobName of Object.keys(mobList)) {
        if (mobList[mobName].selectedTokenIds.includes(combatant.tokenId)) {
          savedMob = mobList[mobName]
          break
        }
      }
      if (savedMob) {
        if (Object.keys(mobList).includes(savedMob.mobName)) {
          if (!mobCreatures[savedMob.mobName]?.length) {
            mobCreatures[savedMob.mobName] = [combatant._id]
          }
          else {
            mobCreatures[savedMob.mobName].push(combatant._id)
          }
        }
      }
      else {
        otherCreatures.push(combatant)
      }
    }

    let skipComplete = false
    for (let mobName of Object.keys(mobList)) {
      if (mobCreatures[mobName]?.includes(game.combat.combatant._id) && canvas.tokens.controlled.filter(t => t.id)?.includes(game.combat.combatant._id)) {
        let turnIndex = game.combat.turns.indexOf(game.combat.combatant)
        let lastMobTurn = turnIndex
        let currentRound = game.combat.round
        for (let i = turnIndex + 1; i < game.combat.turns.length; i++) {
          if (mobCreatures[mobName].includes(game.combat.turns[i]._id)) {
            lastMobTurn++
          }
          else {
            break
          }
        }
        if (lastMobTurn === game.combat.turns.length - 1) {
          await game.combat.nextRound()
          skipComplete = true
        }
        else if (Object.keys(mobList).length > 0) {
          await game.combat.update({ round: currentRound, turn: lastMobTurn + 1 })
          skipComplete = true
        }
        break
      }
    }
    if (!skipComplete) {
      // skip turn of selected tokens (not a saved mob per se),
      // but only if they include the current combatant.
      if (canvas.tokens.controlled.filter(t => t.id === game.combat.combatant.tokenId).length > 0) {
        let turnIndex = game.combat.turns.indexOf(game.combat.combatant)
        let lastMobTurn = turnIndex
        let currentRound = game.combat.round
        for (let i = turnIndex + 1; i < game.combat.turns.length; i++) {
          if (data.selectedTokenIds.filter(t => t.tokenId === game.combat.turns[i].tokenId).length > 0) {
            lastMobTurn++
          }
          else {
            break
          }
        }
        if (lastMobTurn === game.combat.turns.length - 1) {
          await game.combat.nextRound()
        }
        else {
          await game.combat.update({ round: currentRound, turn: lastMobTurn + 1 })
        }
      }
    }
  }
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
    damageTypes.push(diceFormulaParts[1].capitalize())
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

/**
 * Format the attack bonus with leading +/- for display
 * @param {number} finalAttackBonus - Attack bonus number
 * @returns {string} Formatted bonus string
 */
export function getTextFromAttackBonus(finalAttackBonus) {
  let finalAttackBonusText = finalAttackBonus.toString()
  return !/^[+-]/.test(finalAttackBonusText) ? `+${finalAttackBonusText}` : finalAttackBonusText
}

/**
 * Check if a token is targeted by the current user
 * @param {Token} token - The token to check
 * @returns {boolean|undefined} True if targeted, undefined otherwise
 */
export function isTargeted(token) {
  if (token.isTargeted) {
    let targetUsers = token.targeted.entries().next().value
    for (let i = 0; i < targetUsers.length; i++) {
      if (targetUsers[i].id === game.user.id) {
        return true
      }
    }
  }
}

/**
 * Send a chat message with mob attack results
 * @param {string} text - The message content
 */
export async function sendChatMessage(text) {
  let whisperIDs = game.users.contents.filter(u => u.isGM).map(u => u.id)

  let chatData = {
    user: game.user.id,
    speaker: { alias: game.i18n.localize('MAT.mobAttackResults') },
    content: text,
    whisper: (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) ? [] : whisperIDs,
  }

  if (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) {
    if (foundryEqualOrNewerThan('14.0.0')) {
      chatData = ChatMessage.applyMode(chatData, game.settings.get('core', 'rollMode'))
    }
    else {
      chatData = ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'))
    }
  }
  await ChatMessage.create(chatData, {})
}

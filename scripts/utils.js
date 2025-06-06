import { systemEqualOrNewerThan } from './versions.js'
import { moduleName } from './mobAttack.js'
import { getMultiattackFromActor } from './multiattack.js'

/**
 * For a given weapon/spell/item, return the data required to perform an attack
 * This was part of "WeaponData" in v3 and migrated to "AttackActivity" on the
 * item's activity in v4
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
 * @returns the item's attackData
 */
export function getAttackData(item) {
  let attackData
  if (systemEqualOrNewerThan('4.0.0')) {
    const attackActivity = getActivityFromItem(item) || {}
    attackData = { ...attackActivity }
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
      if (item.type === 'spell' && item.system.level === 0) {
        attackData.scaling = { mode: 'cantrip' }
      }
      attackData.rollDamage = attackActivity.rollDamage.bind(attackActivity)
    }
  }
  else {
    attackData = item.system
    // v3 requires a rollDamage() call to calculate some of the additional fields we use
    attackData.rollDamage = item.rollDamage.bind(item)
    // sub out "default" Ability Modifier
    if (attackData?.ability == undefined || attackData.ability == '') {
      attackData.ability = attackData.abilityMod
    }
  }
  return attackData
}

export function getDamageOptions(allowCritical = true, targetId = null) {
  let formattedTarget = formatAttackTargets().filter(formattedTarget => formattedTarget.uuid == canvas.tokens.get(targetId)?.actor.uuid)
  if (systemEqualOrNewerThan('4.0.0')) {
    return {
      damage: { isCritical: allowCritical },
      dialog: { configure: false },
      message: { 'data.flags.dnd5e.targets': formattedTarget },
    }
  }
  else {
    return {
      damage: { critical: allowCritical, options: { fastForward: true, messageData: { 'flags.dnd5e': { targets: formattedTarget } } } },
      dialog: {},
    }
  }
}

// This is based in large part on midi-qol's callMacro method
export async function callMidiMacro(item, midiMacroData) {
  const macroName = foundry.utils.getProperty(item, 'flags.midi-qol.onUseMacroName')
  if (!macroName) {
    console.log(`No On Use Macro found at ${item.name}.`)
    return
  }
  const macroData = {
    ...midiMacroData,
    itemUuid: item?.uuid,
    item: item?.toObject(false),
    saves: [],
    superSavers: [],
    failedSaves: [],
    id: item.id,
  }
  try {
    if (macroName.startsWith('ItemMacro')) {
      var itemMacro
      if (macroName === 'ItemMacro') {
        itemMacro = foundry.utils.getProperty(item.flags, 'itemacro.macro')
        macroData.sourceItemUuid = item?.uuid
      }
      else {
        const parts = macroName.split('.')
        const itemName = parts.slice(1).join('.')
        item = macroData.actor.items.find(i => i.name === itemName && foundry.utils.getProperty(i.flags, 'itemacro.macro'))
        if (item) {
          itemMacro = foundry.utils.getProperty(item.flags, 'itemacro.macro')
          macroData.sourceItemUuid = item?.uuid
        }
        else return {}
      }
      const speaker = { alias: macroData.actor.name }
      const actor = macroData.actor
      const token = canvas.tokens.get(macroData.tokenId)
      const character = game.user.character
      const args = [macroData]

      if (!itemMacro?.command) {
        console.log(`Mob Attack Tool - Could not find item macro ${macroName}`)
        return {}
      }
      return (new Function(`"use strict";
        return (async function ({speaker, actor, token, character, item, args}={}) {
          ${itemMacro.command}
          });`))().call(this, { speaker, actor, token, character, item, args })
    }
    else {
      const macroCommand = game.macros.getName(macroName)
      if (macroCommand) {
        return macroCommand.execute(macroData) || {}
      }
    }
  }
  catch (err) {
    ui.notifications.error(`There was an error while executing an "On Use" macro. See the console (F12) for details.`)
    console.error(err)
  }
  return {}
}

export function checkTarget() {
  let targetToken = canvas.tokens.placeables.find(t => t.isTargeted)
  if (!targetToken && game.settings.get(moduleName, 'mobRules') === 0) {
    ui.notifications.warn(game.i18n.localize('MAT.targetValidACWarning'))
    return false
  }
  return true
}

export function formatAttackTargets() {
  if (systemEqualOrNewerThan('4.0.0')) {
    return dnd5e.utils.getTargetDescriptors()
  }
  else {
    return dnd5e.documents.Item5e._formatAttackTargets()
  }
}

export async function getTargetData(monsters) {
  let targetTokens = canvas.tokens.placeables.filter(t => t.isTargeted)
  for (let i = 0; i < targetTokens.length; i++) {
    if (targetTokens[i].actor === null && game.modules.get('multilevel-tokens').active) {
      let mltFlags = targetTokens[i].flags['multilevel-tokens']
      if (targetTokens.filter(t => t.id === mltFlags.stoken).length > 0) {
        targetTokens.splice(i, 1)
        i--
      }
    }
  }
  let weaponsOnTarget = {}
  for (let [, monsterData] of Object.entries(foundry.utils.duplicate(monsters))) {
    Object.assign(weaponsOnTarget, monsterData.weapons)
    for (let i = 0; i < monsterData.amount - 1; i++) {
      for (let weaponID of Object.keys(monsterData.weapons)) {
        if (weaponsOnTarget[weaponID]) {
          weaponsOnTarget[weaponID + String(i)] = monsterData.weapons[weaponID]
        }
      }
    }
  }

  let weaponsOnTargetArray = []
  for (let [weaponID, weaponData] of Object.entries(weaponsOnTarget)) {
    if (weaponData.useButtonValue !== `checked`) {
      delete weaponsOnTarget[weaponID]
    }
    else {
      for (let j = 0; j < weaponData.numAttack; j++) {
        let singleWeaponData = foundry.utils.duplicate(weaponData)
        singleWeaponData.numAttack = 1
        weaponsOnTargetArray.push(singleWeaponData)
      }
    }
  }

  let targets = []
  let targetCount = 0
  let arrayStart = 0
  let targetAC = 10
  let arrayLength = Math.floor(weaponsOnTargetArray.length / targetTokens.length)
  let armorClassMod = game.settings.get(moduleName, 'savedArmorClassMod')
  if (arrayLength === 0) arrayLength = 1
  for (let targetToken of targetTokens) {
    if (targetToken.actor === null && game.modules.get('multilevel-tokens').active) {
      let mltFlags = targetToken.flags['multilevel-tokens']
      if (mltFlags?.sscene) {
        targetAC = game.scenes.get(mltFlags.sscene).tokens.get(mltFlags.stoken).actor.system.attributes.ac.value
      }
      else {
        targetAC = canvas.tokens.get(mltFlags.stoken).actor.system.attributes.ac.value
      }
    }
    else {
      targetAC = targetToken?.actor.system.attributes.ac.value
    }
    let targetImg = targetToken?.document.texture.src ?? 'icons/svg/mystery-man.svg'
    if (VideoHelper.hasVideoExtension(targetImg)) {
      targetImg = await game.video.createThumbnail(targetImg, { width: 100, height: 100 })
    }
    targets.push({
      targetId: targetToken?.id,
      targetImg: targetImg,
      targetImgName: targetToken?.name ?? 'Unknown target',
      isGM: game.user.isGM,
      weapons: weaponsOnTargetArray.slice(arrayStart, arrayLength * (1 + targetCount)),
      noWeaponMsg: '',
      targetIndex: targetCount,
      targetAC: targetAC + armorClassMod,
      targetACtext: ((game.user.isGM) ? ` ${game.i18n.localize('MAT.dialogTargetArmorClassMessage')}` : ``),
    })

    let targetTotalNumAttacks = targets[targets.length - 1].weapons.length
    let targetTotalAverageDamage = 0
    for (let weapon of targets[targets.length - 1].weapons) {
      targetTotalAverageDamage += weapon.averageDamage
    }
    targets[targets.length - 1]['targetTotalNumAttacks'] = targetTotalNumAttacks
    targets[targets.length - 1]['targetTotalAverageDamage'] = targetTotalAverageDamage

    if (targetCount === targetTokens.length - 1) {
      for (let i = 0; i < (weaponsOnTargetArray.length - arrayLength * (1 + targetCount)); i++) {
        targets[i].weapons.push(weaponsOnTargetArray[weaponsOnTargetArray.length - 1 - i])
        targets[i].targetTotalNumAttacks += 1
        targets[i].targetTotalAverageDamage += weaponsOnTargetArray[weaponsOnTargetArray.length - 1 - i].averageDamage
      }
    }
    arrayStart = arrayLength * (1 + targetCount)
    targetCount++
  }

  for (let target of targets) {
    if (target.weapons.length === 0) {
      target.noWeaponMsg = 'None'
    }
  }
  return targets
}

export async function prepareMonsters(actorList, keepCheckboxes = false, oldMonsters = {}, weapons = {}, availableAttacks = {}) {
  let monsters = {}
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
      let isAttack = false
      if (systemEqualOrNewerThan('4.0.0')) {
        isAttack = item.system.activities?.some(a => a.type === 'attack' && a.damage?.parts?.length) && (item.type !== 'spell' || item.system.level === 0 || item.system.preparation.mode === 'atwill')
      }
      else {
        isAttack = item.type == 'weapon' || (item.type == 'spell' && (item.system.level === 0 || item.system.preparation.mode === 'atwill') && item.system.damage.parts.length > 0 && item.system.save.ability === '')
      }
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
        let weaponRangeText = ``
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

export async function prepareMobAttack(html, selectedTokenIds, weapons, availableAttacks, targets, targetAC, numSelected, monsters) {
  let mobList = game.settings.get(moduleName, 'hiddenMobList')
  if (game.settings.get('mob-attack-tool', 'hiddenChangedMob')) {
    let mobName = game.settings.get(moduleName, 'hiddenMobName')
    let mobData = mobList[mobName]

    let dialogId = game.settings.get(moduleName, 'currentDialogId')
    let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
    let actorList = mobDialog.actorList

    monsters = {}
    weapons = {}
    availableAttacks = {}
    numSelected = mobData.numSelected;
    [monsters, weapons, availableAttacks] = await prepareMonsters(actorList)
  }

  let attacks = {}
  let weaponLocators = []
  let numAttacksMultiplier = 1
  let isVersatile = false
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

export async function loadMob(event, selectedMob) {
  let dialogId = game.settings.get(moduleName, 'currentDialogId')
  let mobDialog = game.mobAttackTool.dialogs.get(dialogId)

  let mobList = game.settings.get(moduleName, 'hiddenMobList')

  await game.settings.set(moduleName, 'hiddenChangedMob', true)
  await game.settings.set(moduleName, 'hiddenMobName', selectedMob)

  let mobData = mobList[selectedMob]
  if (mobData === undefined || mobData === null) return
  let weapons = {}
  let actorList = []
  for (let monster of mobData.monsters) {
    for (let i = 0; i < monster.amount; i++) {
      actorList.push(game.actors.get(monster.id))
    }
  }
  [, weapons] = await prepareMonsters(actorList)

  mobList[selectedMob]['weapons'] = weapons
  mobDialog.actorList = actorList
  await game.settings.set(moduleName, 'hiddenMobList', mobList)
  Hooks.call('mobUpdate', { mobList, mobName: selectedMob, type: 'load' })
  if (game.combat) await game.combat.update()

  for (let i = 0; i < Object.keys(mobList).length; i++) {
    if (Object.keys(mobList)[i] === selectedMob) {
      mobDialog.mobListIndex = i
      break
    }
  }
  mobDialog.render(true)
}

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
 * Given a weapon and optional isVersatile setting, return the damage formulas and types
 * as an array of arrays
 * @param {Item5e} weaponData - An item in an actor's inventory
 * @param {boolean} isVersatile - true if calculating versatile damage, false otherwise
 * @returns an array of three sub-arrays, one entry per damage "part"
 *  {string} diceFormulas - string formula for damage roll including modifiers etc.
 *  {string} damageTypes - string of damage type (fire, slashing, etc.) but capitalized
 *  {string} damageTypeLabes - string of damage type, no formatting applied
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
        diceFormulas.push(rollFormula.formula)
      }
      else {
        diceFormulas.push(((isVersatile && lengthIndex === 0) ? attackData.damage.versatile : diceFormulaParts[0]).replace('@mod', attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod))
      }
    }
    else {
      diceFormulas.push(((isVersatile && lengthIndex === 0) ? attackData.damage.versatile : diceFormulaParts[0]).replace('@mod', attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod))
    }
    lengthIndex++
  }
  return [diceFormulas, damageTypes, damageTypeLabels]
}

export function calcD20Needed(attackBonus, targetAC, rollTypeValue) {
  let d20Needed = targetAC - (attackBonus + rollTypeValue)
  if (d20Needed < 1) {
    return 1
  }
  else if (d20Needed > 20) {
    return 20
  }
  else {
    return d20Needed
  }
}

export function calcAttackersNeeded(d20Needed) {
  let attackersNeeded = 0
  if (game.settings.get(moduleName, 'hiddenTableCheckBox')) {
    let customTable = game.settings.get(moduleName, 'tempSetting')
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

export async function sendChatMessage(text) {
  let whisperIDs = game.users.contents.filter(u => u.isGM).map(u => u.id)

  let chatData = {
    user: game.user.id,
    speaker: { alias: game.i18n.localize('MAT.mobAttackResults') },
    content: text,
    whisper: (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) ? [] : whisperIDs,
  }
  if (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) chatData = ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'))
  await ChatMessage.create(chatData, {})
}

/**
 * Get the numerical attack bonus for a given weapon that's from an actor embedded collection
 * Required to be on an actor in order to get the correct modifiers
 *
 * @param {Item5e} actorItem - weapon type item from an actor embedded collection
 * @returns a positive or negative integer represention the total attack bonus
 */
export function getAttackBonus(actorItem) {
  let attackData // common structure where labels.modifier is kept on both version
  if (systemEqualOrNewerThan('4.0.0')) {
    // we assume a single activity of type 'attack' exists on the weapon
    attackData = getActivityFromItem(actorItem)
  }
  else {
    actorItem.getAttackToHit()
    // the system getAttackToHit updates the labels.modifier integer
    // as a side effect, so we'll use it
    attackData = actorItem
  }
  // return the labels.modifier if it exists, otherwise modifier is 0
  return parseInt(attackData?.labels?.modifier ?? 0)
}

/**
 * Return the first attack activity from an item
 * This is taken from the dnd5e system code
 * @param {Item5e} actorItem - item containting an attack activity
 * @returns the first activity on an item with the type attack, or null if no match
 */
function getActivityFromItem(actorItem) {
  return actorItem.system.activities?.getByType('attack')[0]
}

export function getScalingFactor(weaponData) {
  let cantripScalingFactor = 1
  if (weaponData.type == 'spell') {
    // The `details.spellLevel` property on NPCs have moved to `attributes.spell.level`.
    // Deprecated since Version DnD5e 4.3
    // Backwards-compatible support will be removed in Version DnD5e 5.0
    let casterLevel = weaponData.actor.system.details.level || weaponData.actor.system.details.spellLevel
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
 * Text formatting the attack bonus to include leading +/-
 * @param {Number} finalAttackBonus number representing attack bonus
 * @returns string version of bonus, leading + or -
 */
export function getTextFromAttackBonus(finalAttackBonus) {
  // convert to string first
  let finalAttackBonusText = finalAttackBonus.toString()
  // add a '+' for positive attack bonuses if it's not already there
  return !/^[+-]/.test(finalAttackBonusText) ? `+${finalAttackBonusText}` : finalAttackBonusText
}

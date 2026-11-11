import { moduleName, templatePath } from './constants.js'
import { getDamageTargetId, getTargetToken } from './integrations/multilevel-tokens.js'
import { showDiceSoNiceRoll, withDiceSoNiceSuspended, withHiddenDiceFlag } from './integrations/dice-so-nice.js'
import { playAttackAnimations } from './integrations/automated-animations.js'
import { callOnUseMacroForHits, isMidiQolEnabled, runDamageOnlyWorkflow } from './integrations/midi-qol.js'
import { endGroupedMobTurn, getDamageFormulaAndType, calcD20Needed, calcAttackersNeeded, calcSuccessfulAttacks, sendChatMessage, getAttackBonus, getAttackData, getDamageOptions, getDamageMessageData, getTextFromAttackBonus } from './utils.js'

export function rollMobAttack(data, mobRulesSetting) {
  // midi-qol's damage cards can't be flagged to hide their dice
  return withDiceSoNiceSuspended(() => rollMobAttackSuspended(data, mobRulesSetting), { suspend: isMidiQolEnabled() })
}

async function rollMobAttackSuspended(data, mobRulesSetting) {
  const customTable = game.settings.get(moduleName, 'hiddenTableCheckBox')
    ? game.settings.get(moduleName, 'tempSetting')
    : null

  // Cycle through selected weapons
  let attackData = []
  let messageData = { messages: {} }
  let isVersatile
  for (let [key, value] of Object.entries(data.attacks)) {
    for (let j = 0; j < value.length; j++) {
      isVersatile = false
      if (key.endsWith(`(${game.i18n.localize('Versatile')})`.replace(' ', '-'))) {
        isVersatile = true
        key = key.slice(0, key.indexOf(` (${game.i18n.localize('Versatile')})`))
      }

      let targetAC = data.targets.filter(t => t.targetId === value[j].targetId)[0]?.targetAC
      const weaponData = data.weapons[key]
      const actorName = weaponData.actor.name
      const finalAttackBonus = getAttackBonus(weaponData)
      if (!data.withDisadvantage && data.event?.altKey) {
        data.withAdvantage = true
        data.rollTypeValue = Math.floor(game.settings.get(moduleName, 'rollTypeValue'))
        data.rollTypeMessage = ` + ${data.rollTypeValue} [adv]`
      }
      else if (!data.withAdvantage && (game.settings.get(moduleName, 'disadvantageKeyBinding') === 0 ? data.event?.metaKey : data.event?.ctrlKey)) {
        data.withDisadvantage = true
        data.rollTypeValue = -1 * Math.floor(game.settings.get(moduleName, 'rollTypeValue'))
        data.rollTypeMessage = ` - ${data.rollTypeValue} [adv]`
      }
      const d20Needed = calcD20Needed(finalAttackBonus, targetAC, data.rollTypeValue, mobRulesSetting)
      let attackersNeeded, numHitAttacks
      if (mobRulesSetting === 'mob2014') attackersNeeded = calcAttackersNeeded(d20Needed, customTable)

      // Check whether how many attackers can use this weapon
      let availableAttacks = value[j]?.targetNumAttacks
      if (mobRulesSetting === 'mob2024') {
        numHitAttacks = calcSuccessfulAttacks(d20Needed, availableAttacks)
      }

      if (numHitAttacks > 0 || availableAttacks / attackersNeeded >= 1) {
        if (mobRulesSetting === 'mob2014') {
          numHitAttacks = Math.floor(availableAttacks / attackersNeeded)
        }
        const pluralOrNot = ` ${game.i18n.localize((numHitAttacks === 1) ? 'MAT.oneAttackSingular' : 'MAT.multipleAttackPlural')}!`
        const sOrNot = ((numHitAttacks > 1) ? 's' : '')
        const targetACtext = game.user.isGM ? `${game.i18n.localize('MAT.targetAC')} ${targetAC}` : ``

        let actorAmount = data.numSelected
        if (data.monsters?.[weaponData.actor.id]?.['amount']) {
          actorAmount = data.monsters[weaponData.actor.id]['amount']
        }

        let tokenAttackList = []
        let attackToken
        let availableTokens = data.selectedTokenIds.filter(t => !tokenAttackList.includes(t))
        for (let i = 0; i < numHitAttacks; i++) {
          attackToken = availableTokens[Math.floor(Math.random() * availableTokens.length)]
          if (attackToken) tokenAttackList.push(attackToken)
        }

        // Mob attack results message
        let msgData = {
          actorAmount: actorAmount,
          targetACtext: targetACtext,
          d20Needed: d20Needed,
          finalAttackBonus: getTextFromAttackBonus(finalAttackBonus),
          rollTypeMessage: data.rollTypeMessage,
          weaponName: `${weaponData.name}${(isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``}`,
          availableAttacks: availableAttacks,
          attackersNeeded: attackersNeeded,
          numSelected: data.numSelected,
          numHitAttacks: numHitAttacks,
          pluralOrNot: pluralOrNot,
          sOrNot: sOrNot,
          displayTarget: data.targets.length !== 0,
          targetImg: data.targets.filter(t => t.targetId === value[j].targetId)[0]?.targetImg,
          targetId: value[j]?.targetId,
        }

        if (!messageData.messages[actorName]) {
          messageData.messages[actorName] = [msgData]
        }
        else {
          messageData.messages[actorName].push(msgData)
        }

        if (!messageData['totalHitAttacks']) {
          messageData['totalHitAttacks'] = numHitAttacks
        }
        else {
          messageData['totalHitAttacks'] += numHitAttacks
        }

        attackData.push({
          data: data,
          weaponData: weaponData,
          numHitAttacks: numHitAttacks,
          isVersatile: isVersatile,
          tokenAttackList,
          targetId: value[j]?.targetId ?? undefined,
        })

        await new Promise(resolve => setTimeout(resolve, 250))
      }
      else {
        ui.notifications.warn(game.i18n.format('MAT.lowAttackBonusOrSmallMob', { weaponName: weaponData.name }))
      }
    }
  }
  if (attackData.length === 0) {
    return
  }
  else {
    let totalPluralOrNot = ` ${game.i18n.localize((messageData.totalHitAttacks === 1) ? 'MAT.numTotalHitsSingular' : 'MAT.numTotalHitsPlural')}`
    messageData['totalPluralOrNot'] = totalPluralOrNot

    const messageText = await foundry.applications.handlebars.renderTemplate(templatePath('messages/mat-msg-mob-rules.hbs'), messageData)

    if (!game.settings.get(moduleName, 'noResultsMessage')) {
      await sendChatMessage(messageText)
    }

    for (let attack of attackData) {
      await processMobRulesDamageRolls(attack.data, attack.weaponData, attack.numHitAttacks, attack.isVersatile, attack.tokenAttackList, attack.targetId)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (data.endMobTurn) {
      await endGroupedMobTurn(data)
    }
  }
}

export async function processMobRulesDamageRolls(data, weaponData, numHitAttacks, isVersatile, tokenAttackList, targetId) {
  // Check for midi-qol
  const midi_QOL_Active = isMidiQolEnabled()

  let showDamageRolls = game.user.getFlag(moduleName, 'showIndividualDamageRolls') ?? game.settings.get(moduleName, 'showIndividualDamageRolls')

  const attackData = getAttackData(weaponData)

  if (midi_QOL_Active) {
    await new Promise(resolve => setTimeout(resolve, 100))

    let [diceFormulas, damageTypes, damageTypeLabels] = getDamageFormulaAndType(weaponData, isVersatile)
    let diceFormula = diceFormulas.join(' + ')
    let damageType = damageTypes.join(', ')
    let damageRoll = new CONFIG.Dice.DamageRoll(diceFormula, { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod }, { type: damageTypeLabels[0] })
    await damageRoll.alter(numHitAttacks, 0, { multiplyNumeric: true }).roll()

    showDiceSoNiceRoll(damageRoll)

    let targetToken = getTargetToken(canvas.tokens.get(targetId))

    let workflow = await runDamageOnlyWorkflow(weaponData, damageRoll, damageTypeLabels[0], targetToken, `${weaponData.name} - ${game.i18n.localize('Damage Roll')} (${damageType})`)

    await callOnUseMacroForHits(weaponData, workflow, {
      data, targetToken, damageRoll, damageTypes, isVersatile, numHitAttacks, tokenAttackList,
      attackRoll: workflow?.attackRoll,
      attackTotal: workflow.attackTotal,
      isCritical: false,
    })

    // midi-qol not active
  }
  else {
    if (showDamageRolls) {
      await new Promise(resolve => setTimeout(resolve, 100))
      for (let i = 0; i < numHitAttacks; i++) {
        const damageOptions = getDamageOptions(false, getDamageTargetId(targetId), isVersatile)
        await attackData.rollDamage(damageOptions.damage, damageOptions.dialog, { ...damageOptions.message, data: withHiddenDiceFlag(damageOptions.message.data) })
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    else {
      // Condense the damage rolls.
      let [diceFormulas, damageTypes, damageTypeLabels] = getDamageFormulaAndType(weaponData, isVersatile)
      let diceFormula = diceFormulas.join(' + ')
      let damageType = damageTypes.join(', ')
      let damageRoll = new CONFIG.Dice.DamageRoll(diceFormula, { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod }, { type: damageTypeLabels[0] })
      await damageRoll.alter(numHitAttacks, 0, { multiplyNumeric: true })
      damageRoll = await damageRoll.evaluate()
      await damageRoll.toMessage(
        {
          flavor: `${weaponData.name} - ${game.i18n.localize('Damage Roll')} (${damageType})`,
          ...withHiddenDiceFlag(getDamageMessageData(getDamageTargetId(targetId))),
        },
      )
    }
  }
  playAttackAnimations(weaponData, tokenAttackList, numHitAttacks, targetId)
}

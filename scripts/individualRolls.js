import { moduleName } from './mobAttack.js'
import { endGroupedMobTurn, getDamageFormulaAndType, sendChatMessage, getAttackBonus, callMidiMacro, getAttackData, getDamageOptions, formatAttackTargets } from './utils.js'

export async function rollMobAttackIndividually(data) {
  // Temporarily disable DSN 3d dice from rolling, per settings
  if (!game.settings.get(moduleName, 'enableDiceSoNice') && game.user.isGM) {
    await game.settings.set(moduleName, 'hiddenDSNactiveFlag', false)
  }

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
      const weaponData = data.weapons[key]
      const actorName = weaponData.actor.name
      const finalAttackBonus = getAttackBonus(weaponData)

      let attackFormula = ''

      if (data.withAdvantage || (!data.withDisadvantage && data.event?.altKey)) {
        data.withAdvantage = true
        attackFormula = `2d20kh + ${finalAttackBonus}`
      }
      else if (data.withDisadvantage || (!data.withAdvantage && (game.settings.get(moduleName, 'disadvantageKeyBinding') === 0 ? data.event?.metaKey : data.event?.ctrlKey))) {
        data.withDisadvantage = true
        attackFormula = `2d20kl + ${finalAttackBonus}`
      }
      else {
        attackFormula = `1d20 + ${finalAttackBonus}`
      }

      // Check how many attackers have this weapon
      let numHitAttacks = 0
      let numCrits = 0
      let numCritFails = 0
      let availableAttacks = value[j]?.targetNumAttacks

      let targetAC = data.targets.filter(t => t.targetId === value[j].targetId)[0]?.targetAC

      // Evaluate how many individually rolled attacks hit
      let attackRoll, attackRollEvaluated = [], successfulAttackRolls = []
      let atkRollData = []

      // Determine crit threshold
      let critThreshold = 20
      if (weaponData.type === 'weapon' && weaponData.actor.getFlag('dnd5e', 'weaponCriticalThreshold') > 0) {
        critThreshold = weaponData.actor.getFlag('dnd5e', 'weaponCriticalThreshold')
      }
      else if (weaponData.type === 'spell' && weaponData.actor.getFlag('dnd5e', 'spellCriticalThreshold') > 0) {
        critThreshold = weaponData.actor.getFlag('dnd5e', 'spellCriticalThreshold')
      }

      let tokenAttackList = []
      let discardedRollTotal
      let discarded = false
      for (let i = 0; i < availableAttacks; i++) {
        attackRoll = new Roll(attackFormula)
        attackRollEvaluated[i] = await attackRoll.evaluate()
        if (attackRollEvaluated[i].dice[0].results.length > 1) {
          discardedRollTotal = attackRollEvaluated[i].dice[0].results.filter(r => r.discarded)[0].result + finalAttackBonus
          discarded = true
        }

        // Check settings for rolling 3d dice from Dice So Nice
        if (game.user.getFlag(moduleName, 'showIndividualAttackRolls') ?? game.settings.get(moduleName, 'showIndividualAttackRolls')) {
          if (game.modules.get('dice-so-nice')?.active && game.settings.get(moduleName, 'enableDiceSoNice')) {
            if (!game.settings.get(moduleName, 'hideDSNAttackRoll') || !game.user.isGM) {
              // don't await on the attack roll animation, otherwise it won't combine and it takess a while
              game.dice3d.showForRoll(attackRoll, game.user, game.settings.get('core', 'rollMode') === 'publicroll' || game.settings.get('core', 'rollMode') === 'roll')
            }
          }
        }

        // Determine crits and natural 1s
        // Also, make a list of tokens that successfully attacked for (animation) macro purposes
        let attackToken
        let availableTokens = data.selectedTokenIds.filter(t => (!tokenAttackList.includes(t) || (canvas.tokens.get(t.tokenId).actor.id === weaponData.actor.id && tokenAttackList.filter(atkToken => atkToken.tokenId === t.tokenId).length < Math.floor(availableAttacks / data.numSelected))))
        if (attackRollEvaluated[i].total - finalAttackBonus >= critThreshold) {
          numCrits++
          numHitAttacks += 1
          successfulAttackRolls.push(attackRollEvaluated[i])
          atkRollData.push({ roll: attackRollEvaluated[i].total, color: 'max', finalAttackBonus, discarded, discardedRollTotal })
          attackToken = availableTokens[Math.floor(Math.random() * availableTokens.length)]
        }
        else if (attackRollEvaluated[i].total - finalAttackBonus === 1) {
          numCritFails++
          if (game.user.getFlag(moduleName, 'showAllAttackRolls') ?? game.settings.get(moduleName, 'showAllAttackRolls')) {
            atkRollData.push({ roll: attackRollEvaluated[i].total, color: 'min', finalAttackBonus, discarded, discardedRollTotal })
          }
        }
        else if (attackRollEvaluated[i].total >= ((targetAC) ? targetAC : 0) && attackRollEvaluated[i].total - finalAttackBonus > 1) {
          numHitAttacks += 1
          successfulAttackRolls.push(attackRollEvaluated[i])
          atkRollData.push({ roll: attackRollEvaluated[i].total, color: '', finalAttackBonus, discarded, discardedRollTotal })
          attackToken = availableTokens[Math.floor(Math.random() * availableTokens.length)]
        }
        else if (game.user.getFlag(moduleName, 'showAllAttackRolls') ?? game.settings.get(moduleName, 'showAllAttackRolls')) {
          atkRollData.push({ roll: attackRollEvaluated[i].total, color: 'discarded', finalAttackBonus, discarded, discardedRollTotal })
        }
        if (attackToken) tokenAttackList.push(attackToken)
      }

      const hitTarget = numHitAttacks > 0
      let crits, hitOrMiss
      if (hitTarget) {
        crits = numCrits
        hitOrMiss = game.i18n.localize((crits === 1) ? 'MAT.attackHitSingular' : 'MAT.attackHitPlural')
      }
      else {
        crits = numCritFails
        hitOrMiss = game.i18n.localize((crits === 1) ? 'MAT.attackMissSingular' : 'MAT.attackMissPlural')
      }
      const critMsg = (crits > 0) ? `, ${crits}${hitOrMiss}${game.i18n.localize('MAT.critHitDescription')}` : ``
      const pluralOrNot = ((numHitAttacks === 1) ? ` ${game.i18n.localize((availableAttacks > 1) ? 'MAT.oneAttackPlural' : 'MAT.oneAttackSingular')}` : ` ${game.i18n.localize((availableAttacks > 1) ? 'MAT.multipleAttackPlural' : 'MAT.multipleAttackSingular')}`)

      let actorAmount = data.numSelected
      if (data.monsters?.[weaponData.actor.id]?.['amount']) {
        actorAmount = data.monsters[weaponData.actor.id]['amount']
      }

      if (availableAttacks === undefined) break

      // Mob attack results message
      let msgData = {
        actorAmount: actorAmount,
        weaponName: `${weaponData.name}${(isVersatile) ? ` (${game.i18n.localize('Versatile')})` : ``}`,
        availableAttacks: availableAttacks,
        numHitAttacks: numHitAttacks,
        pluralOrNot: pluralOrNot,
        critMsg: critMsg,
        endOfMsg: `!`,
        withAdvantage: data.withAdvantage,
        withDisadvantage: data.withDisadvantage,
        atkRollData: atkRollData,
        showIndividualAttackRolls: (atkRollData.length === 0) ? false : game.user.getFlag(moduleName, 'showIndividualAttackRolls') ?? game.settings.get(moduleName, 'showIndividualAttackRolls'),
        displayTarget: data.targets.length !== 0,
        targetImg: data.targets.filter(t => t.targetId === value[j].targetId)[0]?.targetImg,
        targetId: value[j]?.targetId,
      }

      // Store message data for later
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
        data,
        weaponData,
        finalAttackBonus,
        availableAttacks,
        successfulAttackRolls,
        numHitAttacks,
        numCrits,
        isVersatile,
        tokenAttackList,
        targetId: value[j]?.targetId ?? undefined,
      })

      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  if (attackData.length === 0) return

  let totalPluralOrNot = ` ${game.i18n.localize((messageData.totalHitAttacks === 1) ? 'MAT.numTotalHitsSingular' : 'MAT.numTotalHitsPlural')}`
  messageData['totalPluralOrNot'] = totalPluralOrNot

  // Send message
  let messageText = await renderTemplate('modules/mob-attack-tool/templates/mat-msg-individual-rolls.html', messageData)
  if (!game.settings.get(moduleName, 'noResultsMessage')) {
    await sendChatMessage(messageText)
  }

  // Process damage rolls
  for (let attack of attackData) {
    await processIndividualDamageRolls(attack, attack.weaponData, attack.finalAttackBonus, attack.availableAttacks, attack.successfulAttackRolls, attack.numHitAttacks, attack.numCrits, attack.isVersatile, attack.tokenAttackList, attack.targetId)
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  if (data.endMobTurn) {
    await endGroupedMobTurn(data)
  }
}

export async function processIndividualDamageRolls(data, weaponData, finalAttackBonus, availableAttacks, successfulAttackRolls, numHitAttacks, numCrits, isVersatile, tokenAttackList, targetId) {
  // Check for midi-qol
  let midi_QOL_Active = false
  if (game.modules.get('midi-qol')?.active && game.settings.get(moduleName, 'enableMidi')) midi_QOL_Active = true

  // Determine crit threshold
  let critThreshold = 20
  if (weaponData.type === 'weapon' && weaponData.actor.getFlag('dnd5e', 'weaponCriticalThreshold') > 0) {
    critThreshold = weaponData.actor.getFlag('dnd5e', 'weaponCriticalThreshold')
  }
  else if (weaponData.type === 'spell' && weaponData.actor.getFlag('dnd5e', 'spellCriticalThreshold') > 0) {
    critThreshold = weaponData.actor.getFlag('dnd5e', 'spellCriticalThreshold')
  }

  // Process attack and damage rolls
  // let showAttackRolls = game.user.getFlag(moduleName, 'showIndividualAttackRolls') ?? game.settings.get(moduleName, 'showIndividualAttackRolls')
  let showDamageRolls = game.user.getFlag(moduleName, 'showIndividualDamageRolls') ?? game.settings.get(moduleName, 'showIndividualDamageRolls')

  // Determine target token
  let targetToken = canvas.tokens.get(targetId)
  if (targetToken?.actor === null && game.modules.get('multilevel-tokens').active) {
    let mltFlags = targetToken.flags['multilevel-tokens']
    if (mltFlags?.sscene) {
      targetToken = game.scenes.get(mltFlags.sscene).tokens.get(mltFlags.stoken)
    }
  }

  const FoundryDie = foundry.dice?.terms?.Die || Die
  const attackData = getAttackData(weaponData)

  if (numHitAttacks != 0) {
    // midi active
    if (midi_QOL_Active) {
      if (showDamageRolls) {
        for (let i = 0; i < numHitAttacks; i++) {
          let [diceFormulas, damageTypes, damageTypeLabels] = getDamageFormulaAndType(weaponData, isVersatile)

          let diceFormula = diceFormulas.join(' + ')
          let damageType = damageTypes.join(', ')
          let damageRoll = new CONFIG.Dice.DamageRoll(diceFormula, { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod })

          if (numCrits > 0) {
            // Add critical damage dice on each successful attack, up to the number of crits
            let critDice = [], critDie
            let damageRollDiceTerms = damageRoll.terms.filter(t => t.number > 0 && t.faces > 0)
            for (let term of damageRollDiceTerms) {
              critDie = new FoundryDie({ number: term.number, faces: term.faces })
              critDice.push(critDie)
            }
            for (let i = 0; i < critDice.length; i++) {
              if (damageRollDiceTerms[i].faces === critDice[i].faces) {
                damageRollDiceTerms[i].number += critDice[i].number
              }
              damageRoll._formula = damageRoll.formula
            }
            numCrits--
          }
          damageRoll = await damageRoll.evaluate()

          // Roll Dice so Nice dice
          if (game.modules.get('dice-so-nice')?.active && game.settings.get(moduleName, 'enableDiceSoNice')) {
            await game.dice3d.showForRoll(damageRoll, game.user, game.settings.get('core', 'rollMode') === 'publicroll' || game.settings.get('core', 'rollMode') === 'roll')
          }

          await new MidiQOL.DamageOnlyWorkflow(
            weaponData.actor,
            // (targetToken) ? targetToken : undefined,
            targetToken ?? undefined,
            damageRoll.total,
            damageTypeLabels[0],
            // (targetToken) ? [targetToken] : [],
            targetToken ? [targetToken] : [],
            damageRoll,
            {
              flavor: `${weaponData.name} - ${game.i18n.localize('Damage Roll')} (${damageType})${(numCrits > 0) ? ` (${game.i18n.localize('MAT.critIncluded')})` : ``}`,
              item: weaponData,
              itemCardId: `new`,
            },
          )
          // after issuing the workflow, wait until it signals complete, or 4 seconds has passed, whichever is first
          let waiting = 4000
          Hooks.once('midi-qol.RollComplete', () => {
            waiting = 0
          })
          while (waiting > 0) {
            await new Promise(resolve => setTimeout(resolve, 100))
            waiting -= 100
          }
        }
      }
      else {
        await new Promise(resolve => setTimeout(resolve, 300))
        let [diceFormulas, damageTypes, damageTypeLabels] = getDamageFormulaAndType(weaponData, isVersatile)

        let diceFormula = diceFormulas.join(' + ')
        let damageType = damageTypes.join(', ')
        let damageRoll = new CONFIG.Dice.DamageRoll(diceFormula, { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod })

        // Add critical damage dice
        let critDice = [], critDie
        let damageRollDiceTerms = damageRoll.terms.filter(t => t.number > 0 && t.faces > 0)
        for (let term of damageRollDiceTerms) {
          critDie = new FoundryDie({ number: term.number, faces: term.faces })
          critDice.push(critDie)
        }
        await damageRoll.alter(numHitAttacks, 0, { multiplyNumeric: true })
        if (numCrits > 0) {
          for (let i = 0; i < critDice.length; i++) {
            await critDice[i].alter(numCrits, 0, { multiplyNumeric: false })
            if (damageRollDiceTerms[i].faces === critDice[i].faces) {
              damageRollDiceTerms[i].number += critDice[i].number
            }
            damageRoll._formula = damageRoll.formula
          }
        }
        damageRoll = await damageRoll.evaluate()

        // Roll Dice so Nice dice
        if (game.modules.get('dice-so-nice')?.active && game.settings.get(moduleName, 'enableDiceSoNice')) {
          await game.dice3d.showForRoll(damageRoll, game.user, game.settings.get('core', 'rollMode') === 'publicroll' || game.settings.get('core', 'rollMode') === 'roll')
        }

        let workflow = await new MidiQOL.DamageOnlyWorkflow(
          weaponData.actor,
          // (targetToken) ? targetToken : undefined,
          targetToken ?? undefined,
          damageRoll.total,
          damageTypeLabels[0],
          // (targetToken) ? [targetToken] : [],
          targetToken ? [targetToken] : [],
          damageRoll,
          {
            flavor: `${weaponData.name} - ${game.i18n.localize('Damage Roll')} (${damageType})${(numCrits > 0) ? ` (${game.i18n.localize('MAT.critIncluded')})` : ``}`,
            item: weaponData,
            itemCardId: `new`,
          },
        )

        // prepare data for Midi's On Use Macro feature
        if (game.settings.get(moduleName, 'enableMidiOnUseMacro') && foundry.utils.getProperty(weaponData, 'flags.midi-qol.onUseMacroName')) {
          await new Promise(resolve => setTimeout(resolve, 300))
          const macroData = {
            actor: weaponData.actor,
            actorUuid: weaponData.actor.uuid,
            tokenId: workflow.tokenId,
            tokenUuid: workflow.tokenUuid,
            targets: targetToken ? [targetToken] : [],
            hitTargets: targetToken ? [targetToken] : [],
            damageRoll: damageRoll,
            damageRollHTML: workflow.damageRollHTML,
            attackRoll: successfulAttackRolls[0],
            attackTotal: successfulAttackRolls[0].total,
            itemCardId: (game.settings.get(moduleName, 'dontSendItemCardId')) ? null : workflow.itemCardId,
            isCritical: (numCrits > 0),
            isFumble: false,
            spellLevel: 0,
            powerLevel: 0,
            damageTotal: damageRoll.total,
            damageDetail: workflow.damageDetail,
            damageList: workflow.damageList,
            otherDamageTotal: 0,
            otherDamageDetail: workflow.otherDamageDetail,
            otherDamageList: [{ damage: damageRoll.total, type: damageTypes[0] }],
            rollOptions: { advantage: data.withAdvantage, disadvantage: data.withDisadvantage, versatile: isVersatile, fastForward: true },
            advantage: data.withAdvantage,
            disadvantage: data.withDisadvantage,
            event: null,
            uuid: workflow.uuid,
            rollData: weaponData.actor.getRollData(),
            tag: 'OnUse',
            concentrationData: foundry.utils.getProperty(weaponData.actor.flags, 'midi-qol.concentration-data'),
            templateId: workflow.templateId,
            templateUuid: workflow.templateUuid,
          }

          let j = 0
          for (let i = 0; i < numHitAttacks; i++) {
            if (j < tokenAttackList.length) {
              j = i
            }
            else {
              j = tokenAttackList.length - 1
            }
            macroData.tokenId = tokenAttackList[j].tokenId
            macroData.tokenUuid = tokenAttackList[j].tokenUuid
            await callMidiMacro(weaponData, macroData)
          }
        }
      }
      // Midi-QOL not active
    }
    else {
      if (showDamageRolls) {
        for (let i = 0; i < numHitAttacks; i++) {
          await new Promise(resolve => setTimeout(resolve, 300))
          let damageOptions = {}
          if (successfulAttackRolls[i].total - finalAttackBonus >= critThreshold && numCrits > 0) {
            damageOptions = getDamageOptions(true, targetId)
            numCrits--
          }
          else {
            damageOptions = getDamageOptions(false, targetId)
          }
          await attackData.rollDamage(damageOptions.damage, damageOptions.dialog, damageOptions.message)
        }
      }
      else {
        // Condense the damage rolls.
        let [diceFormulas, damageTypes] = getDamageFormulaAndType(weaponData, isVersatile)
        let diceFormula = diceFormulas.join(' + ')
        let damageType = damageTypes.join(', ')
        let damageRoll = new CONFIG.Dice.DamageRoll(diceFormula, { mod: attackData.ability == 'none' ? 0 : weaponData.actor.system.abilities[attackData.ability].mod })

        // Add critical damage dice
        let critDice = [], critDie
        let damageRollDiceTerms = damageRoll.terms.filter(t => t.number > 0 && t.faces > 0)
        for (let term of damageRollDiceTerms) {
          critDie = new FoundryDie({ number: term.number, faces: term.faces })
          critDice.push(critDie)
        }
        await damageRoll.alter(numHitAttacks, 0, { multiplyNumeric: true })
        if (numCrits > 0) {
          for (let i = 0; i < critDice.length; i++) {
            await critDice[i].alter(numCrits, 0, { multiplyNumeric: false })
            if (damageRollDiceTerms[i].faces === critDice[i].faces) {
              damageRollDiceTerms[i].number += critDice[i].number
            }
            damageRoll._formula = damageRoll.formula
          }
        }
        if (damageRoll._formula === '') {
          ui.notifications.error(game.i18n.format('MAT.invalidDamageFormula', { weaponDataName: weaponData.name }))
        }
        else {
          damageRoll = await damageRoll.evaluate()
          await damageRoll.toMessage(
            {
              flavor: `${weaponData.name} - ${game.i18n.localize('Damage Roll')} (${damageType})${(numCrits > 0) ? ` (${game.i18n.localize('MAT.critIncluded')})` : ``}`,
              flags: {
                dnd5e: {
                  messageType: 'roll',
                  roll: { type: 'damage' },
                  targets: formatAttackTargets().filter(formattedTarget => formattedTarget.uuid == canvas.tokens.get(targetId).actor.uuid),
                },
              },
            },
          )
        }
      }
    }
    // trigger AutoAnimations
    if (game.settings.get(moduleName, 'enableAutoAnimations')) {
      let j = 0
      if (game.modules.get('autoanimations')?.active) {
        for (let i = 0; i < numHitAttacks; i++) {
          if (j < tokenAttackList.length) {
            j = i
          }
          else {
            j = tokenAttackList.length - 1
          }
          if (tokenAttackList.length > 0) {
            const target = canvas.tokens.get(targetId)
            let options = {}
            if (typeof target !== 'undefined') {
              // don't try to pass target data if a target hasn't been selected
              options = { targets: [target] }
            }
            AutomatedAnimations.playAnimation(canvas.tokens.get(tokenAttackList[j].tokenId), weaponData, options)
          }
        }
      }
    }
  }

  // Allow DSN 3d dice to be rolled again
  if (game.user.isGM) await game.settings.set(moduleName, 'hiddenDSNactiveFlag', true)
}

// Integration with the midi-qol module (https://foundryvtt.com/packages/midi-qol)
import { moduleName } from '../constants.js'
import { getAttackerForHit } from '../core/attackers.js'

const { getProperty } = foundry.utils

const MODULE_ID = 'midi-qol'

/**
 * Whether midi-qol is active and enabled in this module's settings
 * @returns {boolean} true if damage should go through midi-qol workflows
 */
export function isMidiQolEnabled() {
  return Boolean(game.modules.get(MODULE_ID)?.active && game.settings.get(moduleName, 'enableMidi'))
}

/**
 * Apply an evaluated damage roll through a midi-qol DamageOnlyWorkflow
 * @param {Item5e} weaponData - the weapon used
 * @param {Roll} damageRoll - the evaluated damage roll
 * @param {string} damageType - the damage type label
 * @param {Token|TokenDocument|undefined} targetToken - the target, if any
 * @param {string} flavor - chat card flavor text
 * @returns {Promise<object>} the midi-qol workflow
 */
export async function runDamageOnlyWorkflow(weaponData, damageRoll, damageType, targetToken, flavor) {
  return new MidiQOL.DamageOnlyWorkflow(
    weaponData.actor,
    targetToken ?? undefined,
    damageRoll.total,
    damageType,
    targetToken ? [targetToken] : [],
    damageRoll,
    {
      flavor,
      item: weaponData,
      itemCardUuid: `new`,
    },
  )
}

/**
 * Wait until midi-qol signals that the last workflow's roll is complete,
 * or the timeout passes, whichever is first
 * @param {number} [timeout] - milliseconds to wait at most
 */
export async function waitForMidiRollComplete(timeout = 4000) {
  let waiting = timeout
  Hooks.once('midi-qol.RollComplete', () => {
    waiting = 0
  })
  while (waiting > 0) {
    await new Promise(resolve => setTimeout(resolve, 100))
    waiting -= 100
  }
}

/**
 * Run the weapon's midi-qol On Use macro once per hit, from the token that
 * made each hit, when On Use macros are enabled and the weapon has one
 * @param {Item5e} weaponData - the weapon used
 * @param {object} workflow - the DamageOnlyWorkflow from runDamageOnlyWorkflow
 * @param {object} hit - details of the hits
 * @param {object} hit.data - the mob attack data (for advantage/disadvantage)
 * @param {Token|TokenDocument|undefined} hit.targetToken - the target, if any
 * @param {Roll} hit.damageRoll - the evaluated damage roll
 * @param {string[]} hit.damageTypes - damage types of the roll
 * @param {boolean} hit.isVersatile - whether the versatile damage was used
 * @param {number} hit.numHitAttacks - number of hits
 * @param {{tokenId: string, tokenUuid: string}[]} hit.tokenAttackList - attacking tokens, in hit order
 * @param {Roll|undefined} hit.attackRoll - an attack roll to pass to the macro
 * @param {number|undefined} hit.attackTotal - that attack roll's total
 * @param {boolean} hit.isCritical - whether the damage includes critical hits
 */
export async function callOnUseMacroForHits(weaponData, workflow, { data, targetToken, damageRoll, damageTypes, isVersatile, numHitAttacks, tokenAttackList, attackRoll, attackTotal, isCritical }) {
  if (!game.settings.get(moduleName, 'enableMidiOnUseMacro') || !getProperty(weaponData, 'flags.midi-qol.onUseMacroName')) return
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
    attackRoll,
    attackTotal,
    itemCardUuid: (game.settings.get(moduleName, 'dontSendItemCardUuid')) ? null : workflow.itemCardUuid,
    isCritical,
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
    concentrationData: getProperty(weaponData.actor.flags, 'midi-qol.concentration-data'),
    templateId: workflow.templateId,
    templateUuid: workflow.templateUuid,
  }

  for (let i = 0; i < numHitAttacks; i++) {
    const attacker = getAttackerForHit(tokenAttackList, i)
    macroData.tokenId = attacker?.tokenId
    macroData.tokenUuid = attacker?.tokenUuid
    await callMidiMacro(weaponData, macroData)
  }
}

// This is based in large part on midi-qol's callMacro method
export async function callMidiMacro(item, midiMacroData) {
  const macroName = getProperty(item, 'flags.midi-qol.onUseMacroName')
  if (!macroName) {
    console.log(`No On Use Macro found at ${item.name}.`)
    return {}
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
        itemMacro = getProperty(item.flags, 'itemacro.macro')
        macroData.sourceItemUuid = item?.uuid
      }
      else {
        const parts = macroName.split('.')
        const itemName = parts.slice(1).join('.')
        item = macroData.actor.items.find(i => i.name === itemName && getProperty(i.flags, 'itemacro.macro'))
        if (item) {
          itemMacro = getProperty(item.flags, 'itemacro.macro')
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
      // await inside the try, so a rejecting macro is reported by the catch below
      return await (new Function(`"use strict";
        return (async function ({speaker, actor, token, character, item, args}={}) {
          ${itemMacro.command}
          });`))().call(this, { speaker, actor, token, character, item, args })
    }
    else {
      const macroCommand = game.macros.getName(macroName)
      if (macroCommand) {
        // As midi-qol does, pass the data as args[0]; its keys stay available
        // as variables too, as they were before
        return (await macroCommand.execute({ ...macroData, args: [macroData] })) || {}
      }
    }
  }
  catch (err) {
    ui.notifications.error(`There was an error while executing an "On Use" macro. See the console (F12) for details.`)
    console.error(err)
  }
  return {}
}

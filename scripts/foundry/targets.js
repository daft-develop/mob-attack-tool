import { moduleName } from '../constants.js'
import { sumTargetAttacks } from '../core/attack-totals.js'

const { duplicate } = foundry.utils

export function checkTarget() {
  let targetToken = canvas.tokens.placeables.find(t => t.isTargeted)
  if (!targetToken && game.settings.get(moduleName, 'mobRules') !== 'individual') {
    ui.notifications.warn(game.i18n.localize('MAT.targetValidACWarning'))
    return false
  }
  return true
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
  for (let [, monsterData] of Object.entries(duplicate(monsters))) {
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
        let singleWeaponData = duplicate(weaponData)
        singleWeaponData.numAttack = 1
        weaponsOnTargetArray.push(singleWeaponData)
      }
    }
  }

  let targets = []
  let targetCount = 0
  let arrayStart = 0
  let targetAC
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
    if (foundry.helpers.media.VideoHelper.hasVideoExtension(targetImg)) {
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

    const targetTotals = sumTargetAttacks(targets[targets.length - 1].weapons)
    targets[targets.length - 1]['targetTotalNumAttacks'] = targetTotals.numAttacks
    targets[targets.length - 1]['targetTotalAverageDamage'] = targetTotals.averageDamage

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

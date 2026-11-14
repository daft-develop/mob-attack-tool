import { rollMobAttackIndividually } from './individualRolls.js'
import { moduleName } from './constants.js'
import { createAndRenderDialog as renderV2 } from './ui/dialog/mobAttackDialogV2.js'
import { rollMobAttack } from './mobRules.js'
import { checkTarget, findLocatedWeapon, getSelectedTokenIds, getTargetData } from './foundry/targets.js'
import { prepareMonsters } from './ui/dialog/dialog-context.js'

export function macroObject() {
  function quickRoll(data) {
    // Collect necessary data for mob attack
    if (!checkTarget()) return
    data['selectedTokenIds'] = getSelectedTokenIds();

    (async () => {
      let targets = await getTargetData(data.monsters)
      data['targets'] = targets

      let weapons = {}
      let attacks = {}
      const missingWeapons = []
      data.weaponLocators.forEach((locator) => {
        const weapon = findLocatedWeapon(locator)
        if (!weapon) {
          // e.g. renamed or deleted since the macro was exported
          missingWeapons.push(locator.weaponName)
          delete data.attacks[locator.weaponID]
          return
        }
        // Key the weapon by its id when the macro was exported, which the
        // attack keys and the targets' weapon ids still use. The weapon found
        // now can have another id, e.g. a same-named item on another token.
        const exportedId = locator.weaponID.replace(` (${game.i18n.localize('Versatile')})`, '')
        weapons[exportedId] = weapon
        attacks[locator.weaponID] = []
        for (let target of targets) {
          attacks[locator.weaponID].push({ targetId: target.targetId, targetNumAttacks: target.weapons.filter(w => w.weaponId === exportedId).length })
        }
      })

      if (missingWeapons.length) {
        ui.notifications.warn(game.i18n.format('MAT.macroWeaponNotFound', { weaponNames: missingWeapons.join(', ') }))
      }
      if (Object.keys(weapons).length === 0) return

      data['weapons'] = weapons
      if (targets.length) data['attacks'] = attacks

      const mobRulesSetting = game.settings.get(moduleName, 'mobRules')
      if (game.settings.get(moduleName, 'mobRules') === 'individual') {
        rollMobAttackIndividually(data)
      }
      else {
        rollMobAttack(data, mobRulesSetting)
      }
    })()
  }

  async function createDialog() {
    await renderV2()
  }

  /*
    This asynchronous function saves a mob.

    input:
    - mobName [String]          The name of the mob
    - actorList [Array]         An array of the each actor linked to tokens that are part the mob to be saved. If multiple tokens are linked to the same actor, duplicate that actor in the array to match.
    - selectedTokenIds [Array]    An array of the ids of the tokens of the mob.
    - numSelected [Integer]      The integer number or amount of tokens that make up the mob.

    output:
    - mobList [Object (Promise)]    The complete data object of all saved mobs, including the one that was just saved to it.

     */
  async function saveMob(mobName, actorList, selectedTokenIds, numSelected, type = '') {
    let mobList = game.settings.get(moduleName, 'hiddenMobList')
    let monsters;
    [monsters, ,] = await prepareMonsters(actorList)
    let monsterArray = []
    for (let [, monsterData] of Object.entries(monsters)) {
      monsterArray.push(monsterData)
    }
    mobList[mobName] = { mobName: mobName, monsters: monsterArray, selectedTokenIds: selectedTokenIds, numSelected: numSelected, userId: game.user.id, type: type }
    await game.settings.set(moduleName, 'hiddenMobList', mobList)

    Hooks.call('matMobUpdate', { mobList, mobName, type: 'save' })
    if (game.combat) await game.combat.update()

    const dialogId = game.settings.get(moduleName, 'currentDialogId')
    let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
    if (mobDialog) {
      // keep the dialog's checkbox and attack count edits
      mobDialog.mat.localUpdate = true
      mobDialog.render()
    }

    return mobList
  }

  /*
    This asynchronous function deletes a saved mob.

    input:
    - mobName [String]        The name of the mob

    output:
    - mobList [Object (Promise)]  The complete data object of all saved mobs, now without the just deleted mob.

     */
  async function deleteSavedMob(mobName) {
    let mobList = game.settings.get(moduleName, 'hiddenMobList')
    for (let nameOfMob of Object.keys(mobList)) {
      if ((mobList[nameOfMob].userId === game.user.id || game.user.isGM) && mobList[nameOfMob].mobName === mobName) {
        delete mobList[nameOfMob]
        break
      }
    }
    await game.settings.set(moduleName, 'hiddenMobList', mobList)
    Hooks.call('matMobUpdate', { mobList, mobName, type: 'delete' })
    const dialogId = game.settings.get(moduleName, 'currentDialogId')
    let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
    if (mobDialog) {
      // not a local update: the deleted mob's monsters must not be kept
      await game.settings.set(moduleName, 'hiddenChangedMob', false)
      mobDialog.render()
    }
    if (game.combat) await game.combat.update()
    return mobList
  }

  /*
    Removed with Combat Tracker Groups support. Kept so macros that still
    call it get a warning instead of a "not a function" error.

    output:
    - mobList [Object (Promise)]  The saved mobs, unchanged.

     */
  async function createSavedMobsFromCTGgroups() {
    ui.notifications.warn(game.i18n.localize('MAT.ctgGroupsRemoved'))
    return game.settings.get(moduleName, 'hiddenMobList')
  }

  return {
    quickRoll: quickRoll,
    createDialog: createDialog,
    saveMob: saveMob,
    deleteSavedMob: deleteSavedMob,
    createSavedMobsFromCTGgroups: createSavedMobsFromCTGgroups,
  }
}

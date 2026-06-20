import { rollMobAttackIndividually } from './individualRolls.js'
import { moduleName } from './mobAttack.js'
import { createAndRenderDialog } from './ui/mobAttackDialog.js'
import { createAndRenderDialog as renderV2 } from './ui/mobAttackDialogV2.js'
import { rollMobAttack } from './mobRules.js'
import { checkTarget, getTargetData, prepareMonsters } from './utils.js'
import { foundryEqualOrNewerThan } from './versions.js'

export function macroObject() {
  function quickRoll(data) {
    // Collect necessary data for mob attack
    if (!checkTarget()) return
    let selectedTokenIds = []
    for (let token of canvas.tokens.controlled) {
      selectedTokenIds.push({ tokenId: token.id, tokenUuid: token.document.uuid, actorId: token.actor.id })
    }
    data['selectedTokenIds'] = selectedTokenIds;

    (async () => {
      let targets = await getTargetData(data.monsters)
      data['targets'] = targets

      let weapons = {}
      let attacker, weapon
      let attacks = {}
      data.weaponLocators.forEach((locator) => {
        attacker = game.actors.get(locator['actorID'])
        weapon = attacker.items.getName(locator['weaponName'])
        weapons[weapon.id] = weapon
        attacks[locator.weaponID] = []
        for (let target of targets) {
          attacks[locator.weaponID].push({ targetId: target.targetId, targetNumAttacks: target.weapons.filter(w => w.weaponId === weapon.id).length })
        }
      })

      data['weapons'] = weapons
      if (targets.length) data['attacks'] = attacks

      if (game.settings.get(moduleName, 'mobRules') === 0) {
        return rollMobAttack(data)
      }
      else {
        return rollMobAttackIndividually(data)
      }
    })()
  }

  async function createDialog() {
    if (foundryEqualOrNewerThan('13.0.0')) {
      await renderV2()
    }
    else {
      await createAndRenderDialog()
    }
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
      mobDialog.localUpdate = true
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
    await game.settings.set('mob-attack-tool', 'hiddenMobList', mobList)
    Hooks.call('matMobUpdate', { mobList, mobName, type: 'delete' })
    const dialogId = game.settings.get(moduleName, 'currentDialogId')
    let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
    if (mobDialog) {
      mobDialog.localUpdate = true
      await game.settings.set(moduleName, 'hiddenChangedMob', false)
      mobDialog.render()
    }
    if (game.combat) await game.combat.update()
    return mobList
  }

  async function createSavedMobsFromCTGgroups(groups, mobNames = []) {
    let mobList = game.settings.get(moduleName, 'hiddenMobList')

    // delete existing CTG groups first
    for (let ctgMobName of Object.keys(mobList)) {
      if (mobList[ctgMobName]?.type === 'ctg') {
        await deleteSavedMob(ctgMobName)
      }
    }
    let dupNameNum = 2
    if (!groups.length || !groups[0].length) return

    for (let i = 0; i < groups.length; i++) {
      let numSelected = groups[i].length
      let actorList = [], selectedTokenIds = []
      if (!mobNames[i]) {
        mobNames[i] = `${game.settings.get(moduleName, 'defaultMobPrefix')} ${groups[i][0]?.name}${game.settings.get(moduleName, 'defaultMobSuffix')}`
        if (i > 0) {
          if (mobNames[i - 1] === mobNames[i]) {
            mobNames[i] += ` ${dupNameNum.toString()}`
          }
          else if (mobNames[i - 1].endsWith(dupNameNum.toString())) {
            dupNameNum++
            mobNames[i] += ` ${dupNameNum.toString()}`
          }
        }
      }
      for (let combatant of groups[i]) {
        actorList.push(combatant?.actor)
        selectedTokenIds.push(combatant?.tokenId)
      }
      mobList = await saveMob(mobNames[i], actorList, selectedTokenIds, numSelected, 'ctg')
    }
    return mobList
  }

  return {
    quickRoll: quickRoll,
    createDialog: createDialog,
    saveMob: saveMob,
    deleteSavedMob: deleteSavedMob,
    createSavedMobsFromCTGgroups: createSavedMobsFromCTGgroups,
  }
}

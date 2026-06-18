import { initSettings } from './settings.js'
import { createAndRenderDialog } from './mobAttackDialog.js'
import { macroObject } from './macroObject.js'
import { foundryEqualOrNewerThan } from './versions.js'
// import { initQuenchTests } from './quench.js'

export const moduleName = 'mob-attack-tool'

Hooks.once('init', async () => {
  console.log('Mob Attack Tool | Adding Mob Attack Tool.')

  if (foundryEqualOrNewerThan('13.0.0')) {
    await foundry.applications.handlebars.loadTemplates({
      'mat.setting': 'modules/mob-attack-tool/templates/settings/mat-settings-partial.hbs',
    })
  }
  else {
    loadTemplates({
      'mat.setting': 'modules/mob-attack-tool/templates/settings/mat-settings-partial.hbs',
    })
  }

  initSettings()
  addMobAttackToolButton()
  // initQuenchTests() }

  const dialogs = new Map()
  game.mobAttackTool = {
    dialogs,
  }
})

Hooks.on('ready', async () => {
  // register global MobAttacks macro object
  // for running mat via user macros
  window.MobAttacks = macroObject()

  // check if CTG's groups have changed
  Hooks.on('ctgGroupUpdate', async (args) => {
    let groups
    if (Array.isArray(args)) {
      groups = args
    }
    else {
      groups = args.groups
    }
    if (!game.settings.get(moduleName, 'autoSaveCTGgroups')) return
    if (groups[0]) {
      if (groups[0].filter(c => c.initiative).length > 0) {
        await macroObject().createSavedMobsFromCTGgroups(groups)
        const dialogId = game.settings.get(moduleName, 'currentDialogId')
        let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
        if (mobDialog) mobDialog.render()
      }
    }
  })

  Hooks.on('deleteCombat', async () => {
    if (!game.settings.get(moduleName, 'autoSaveCTGgroups')) return
    if (game.modules.get('ctg')?.active) {
      let mobList = game.settings.get(moduleName, 'hiddenMobList')

      // delete existing CTG groups
      for (let ctgMobName of Object.keys(mobList)) {
        if (mobList[ctgMobName]?.type === 'ctg') {
          await macroObject().deleteSavedMob(ctgMobName)
        }
      }
    }
  })
})

// update dialog windows if new tokens are selected
Hooks.on('controlToken', async () => {
  let dialogId = game.settings.get(moduleName, 'currentDialogId')
  let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
  if (mobDialog) {
    if (mobDialog.rendered && !mobDialog.currentlySelectingTokens) {
      await game.settings.set(moduleName, 'hiddenChangedMob', false)
      let mobList = game.settings.get(moduleName, 'hiddenMobList')
      if (canvas.tokens.controlled.length !== 0 || Object.keys(mobList).length !== 0) {
        mobDialog.render()
      }
    }
  }
})

// update dialog if targeted token changes
Hooks.on('targetToken', async () => {
  let dialogId = game.settings.get(moduleName, 'currentDialogId')
  let mobDialog = game.mobAttackTool.dialogs.get(dialogId)
  if (mobDialog) {
    if (mobDialog.rendered) {
      // await game.settings.set(moduleName, "hiddenChangedMob", false);
      let mobList = game.settings.get(moduleName, 'hiddenMobList')
      if (canvas.tokens.controlled.length !== 0 || Object.keys(mobList).length !== 0) {
        mobDialog.render()
      }
    }
  }
})

// select mob tokens if next combatant is part of a saved mob
Hooks.on('updateCombat', async (combat, changed) => {
  if (!('turn' in changed)) return
  if (!game.settings.get(moduleName, 'autoSelectMobCombatants')) return
  let thisCombat = game.combats.get(combat.id)
  if (thisCombat.combatants.length === 0) return
  if (!game.user.isGM && game.combat.combatant.players.filter(p => p.id === game.user.id).length === 0) return

  const mobList = game.settings.get('mob-attack-tool', 'hiddenMobList')
  const nextTurn = combat.turns[changed.turn]
  const nextTokenId = nextTurn.tokenId
  let nextMobName = ''
  for (let mobName of Object.keys(mobList)) {
    if (mobList[mobName].selectedTokenIds.includes(nextTokenId) && mobList[mobName].userId === game.user.id) {
      nextMobName = mobName
      break
    }
  }
  if (nextMobName === '') return

  const dialogId = game.settings.get(moduleName, 'currentDialogId')
  let mobDialog = game.mobAttackTool.dialogs.get(dialogId)

  // wait a moment to let CUB's Pan / Select feature do its thing
  if (game.modules.get('combat-utility-belt')?.active) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  if (mobDialog) mobDialog.currentlySelectingTokens = true
  canvas.tokens.releaseAll()
  for (let tokenId of mobList[nextMobName].selectedTokenIds) {
    if (canvas.tokens.placeables.filter(t => t.id === tokenId).length > 0) {
      canvas.tokens.get(tokenId).control({ releaseOthers: false })
    }
  }
  if (mobDialog) {
    mobDialog.numSelected = canvas.tokens.controlled.length
    mobDialog.currentlySelectingTokens = false
    mobDialog.render()
  }
})

//  Hide DSN 3d dice
Hooks.on('diceSoNiceRollStart', (messageId, context) => {
  if (game.settings.get(moduleName, 'hiddenDSNactiveFlag')) return

  // Hide this roll
  context.blind = true
})

function addMobAttackToolButton() {
  Hooks.on('getSceneControlButtons', (controls) => {
    const playerAccess = game.settings.get(moduleName, 'playerAccess')
    if (foundryEqualOrNewerThan('13.0')) {
      const tokenBar = controls['tokens']
      tokenBar.tools[game.i18n.localize('MAT.name')] = {
        name: game.i18n.localize('MAT.name'),
        title: game.i18n.localize('MAT.mobAttack'),
        icon: 'fas fa-dice',
        visible: (playerAccess ? true : game.user.isGM),
        onChange: () => createAndRenderDialog(),
        button: true,
      }
    }
    else {
      const bar = controls.find(c => c.name === 'token')
      bar.tools.push({
        name: game.i18n.localize('MAT.name'),
        title: game.i18n.localize('MAT.mobAttack'),
        icon: 'fas fa-dice',
        visible: (playerAccess ? true : game.user.isGM),
        onClick: async () => createAndRenderDialog(),
        button: true,
      })
    }
  })
}

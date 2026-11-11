import { moduleName, templatePath } from '../../constants.js'
import { checkTarget, getSelectedTokenIds, getSelectedTokens, getTargetData, selectTokens } from '../../foundry/targets.js'
import { sumCheckedAttacks, sumTargetAttacks } from '../../core/attack-totals.js'
import { buildMacroName, buildQuickRollCommand } from '../../core/macro-export.js'
import { getTargetActor, withoutTargetedClones } from '../../integrations/multilevel-tokens.js'
import { escapeHTML, findMonsterActor, findWeaponEntries, getMobActors, getUserMobNames, prepareMonsters, prepareMobAttack, stepMobName } from './dialog-context.js'
import { rollMobAttack } from '../../mobRules.js'
import { rollMobAttackIndividually } from '../../individualRolls.js'

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

export async function createAndRenderDialog() {
  // First time opening the dialog, so no changes yet
  await game.settings.set(moduleName, 'hiddenChangedMob', false)

  // create dialog
  const mobDialog = new MobAttackDialogV2()
  mobDialog.render(true)
  let appId = parseInt(mobDialog.options.uniqueId)
  game.mobAttackTool.dialogs.set(appId, mobDialog)
  await game.settings.set(moduleName, 'currentDialogId', appId)
}

class MobAttackDialogV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  #dragDrop

  constructor(...args) {
    super(...args)

    this.#dragDrop = this.#createDragDropHandlers()

    this.mat = {}
    this.mat.actorList = []
    this.mat.numTargets = 0
    this.mat.mobListIndex = 0

    this.mat.armorClassMod = (game.user.getFlag(moduleName, 'persistACmod') ?? game.settings.get(moduleName, 'persistACmod')) ? game.settings.get(moduleName, 'savedArmorClassMod') : 0

    this.mat.collapsibleName = game.i18n.localize('Show options')
    this.mat.collapsibleCSS = 'mat-collapsible-content-closed'
    this.mat.collapsiblePlusMinus = 'plus'

    this.mat.rollTypeSelection = { advantage: '', normal: 'selected', disadvantage: '' }

    this.mat.numTotalAttacks = 0
    this.mat.totalAverageDamage = 0
    this.mat.localUpdate = false
    this.mat.targetUpdate = false

    this.mat.targets = []

    // keep this var at root level (outside .mat)
    // to maintain compatibility with dialog v1 and Hooks.on calls referencing it
    this.currentlySelectingTokens = false
  }

  static DEFAULT_OPTIONS = {
    id: `${moduleName}-dialog`,
    classes: ['mat-dialog-content2', 'standard-form'],
    tag: 'form',
    window: {
      title: 'MAT.name',
      icon: 'fas fa-dice',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: {
      width: 570,
      height: 'auto',
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: false,
    },
    actions: {
      previousMob: MobAttackDialogV2._previousMob,
      nextMob: MobAttackDialogV2._nextMob,
      saveMob: MobAttackDialogV2._saveMob,
      selectMob: MobAttackDialogV2._selectMob,
      increaseNumAttack: MobAttackDialogV2._increaseNumAttack,
      decreaseNumAttack: MobAttackDialogV2._decreaseNumAttack,
      increaseNumMonster: MobAttackDialogV2._increaseNumMonster,
      decreaseNumMonster: MobAttackDialogV2._decreaseNumMonster,
      displayWeapon: MobAttackDialogV2._displayWeapon,
      displayMonster: MobAttackDialogV2._displayMonster,
      increaseACmod: MobAttackDialogV2._increaseACmod,
      decreaseACmod: MobAttackDialogV2._decreaseACmod,
      toggleCollapse: MobAttackDialogV2._toggleCollapse,
      exportMacro: MobAttackDialogV2._exportMacro,
      executeMobAttack: MobAttackDialogV2._executeMobAttack,
    },
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: '.mat-attacks-on-target-box' }],
  }

  static TABS = {
    primary: {
      tabs: [
        {
          id: 'weapons',
          icon: 'fas fa-fist-raised',
          label: 'Weapon Options',
        },
        {
          id: 'targets',
          icon: 'fas fa-crosshairs',
          label: 'Targets',
        },
      ],
      initial: 'weapons',
    },
  }

  static PARTS = {
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs',
    },
    mobSelect: {
      template: templatePath('dialog/mat-dialog-mob-select.hbs'),
    },
    weapons: {
      template: templatePath('dialog/mat-dialog-weapons.hbs'),
      scrollable: ['scrollable'],
    },
    targets: {
      template: templatePath('dialog/mat-dialog-targets.hbs'),
      scrollable: ['scrollable'],
    },
    footer: {
      template: templatePath('dialog/mat-dialog-footer.hbs'),
    },
  }

  async _prepareContext(context) {
    // Show weapon options per selected token type
    let mobList = game.settings.get(moduleName, 'hiddenMobList')

    this.mat.targetTokens = withoutTargetedClones(canvas.tokens.placeables.filter(t => t.isTargeted))
    this.mat.targetToken = canvas.tokens.placeables.find(t => t.isTargeted)
    this.mat.numTargets = 0
    if (this.mat.targetToken) {
      this.mat.targetAC = getTargetActor(this.mat.targetToken)?.system.attributes.ac.value
      this.mat.numTargets = this.mat.targetTokens.length
    }

    this.mat.numSelected = getSelectedTokens().length
    this.mat.pluralTokensOrNot = ((this.mat.numSelected === 1) ? `` : `s`)

    // determine relevant actor list and mob name
    let _actorList = []
    let _mobName
    if (game.settings.get(moduleName, 'hiddenChangedMob')) {
      _mobName = Object.keys(mobList)[this.mat.mobListIndex]
      _actorList = getMobActors(mobList[_mobName])
      // Select mob tokens
      if (!this.mat.localUpdate) {
        this.currentlySelectingTokens = true
        selectTokens(mobList[Object.keys(mobList)[this.mat.mobListIndex]].selectedTokenIds)
        this.mat.numSelected = getSelectedTokens().length
        this.currentlySelectingTokens = false
      }
    }
    else {
      // set correct index for saved mobs
      for (let i = 0; i < Object.keys(mobList).length; i++) {
        if (mobList[Object.keys(mobList)[i]].userId === game.user.id) {
          this.mat.mobListIndex = i
          break
        }
      }

      // generate default mob name
      if ((this.mat.numSelected > 0 || Object.keys(mobList).length === 0)) {
        if ((this.mat.numSelected === 0)) {
          _mobName = `No monsters selected`
        }
        else {
          _mobName = `${game.settings.get(moduleName, 'defaultMobPrefix')} ${getSelectedTokens()[0]?.name}${game.settings.get(moduleName, 'defaultMobSuffix')}`
        }
      }
      else {
        _mobName = `${Object.keys(mobList)[this.mat.mobListIndex]}`
      }
      await game.settings.set(moduleName, 'hiddenMobName', _mobName)

      // determine actor list
      if (this.mat.numSelected > 0 || Object.keys(mobList).length === 0) {
        for (let token of getSelectedTokens()) {
          _actorList.push(token.actor)
        }
      }
      else {
        _actorList = getMobActors(mobList[Object.keys(mobList)[this.mat.mobListIndex]])
        // Select mob tokens
        this.currentlySelectingTokens = true
        selectTokens(mobList[Object.keys(mobList)[this.mat.mobListIndex]].selectedTokenIds)
        this.mat.numSelected = getSelectedTokens().length
        this.currentlySelectingTokens = false
      }
    }

    let _monsters
    let _weapons
    let _availableAttacks
    [_monsters, _weapons, _availableAttacks] = await prepareMonsters(_actorList)

    // determine if newly determined monsters (+ weapons) should be used, or the already stored (and posssibly modified) data
    if (!this.mat.localUpdate) {
      this.mat.actorList = _actorList
      this.mat.monsters = _monsters
      this.mat.weapons = { ..._weapons }
      this.mat.availableAttacks = _availableAttacks
    }

    // calculate total number of attacks and average damage
    const mobTotals = sumCheckedAttacks(this.mat.monsters)
    this.mat.numTotalAttacks = mobTotals.numAttacks
    this.mat.totalAverageDamage = mobTotals.averageDamage

    // create (and/or update) target data
    let _targets = await getTargetData(this.mat.monsters)

    if (!this.mat.targetUpdate) {
      this.mat.targets = _targets
    }
    else {
      this.mat.targetUpdate = false
      for (const target of this.mat.targets) {
        const targetTotals = sumTargetAttacks(target.weapons)
        target.targetTotalNumAttacks = targetTotals.numAttacks
        target.targetTotalAverageDamage = targetTotals.averageDamage
      }
    }

    if (this.mat.localUpdate) this.mat.localUpdate = false

    let noTargetACtext = ((!this.mat.targetToken) ? ` ${game.i18n.localize('MAT.noTargetAllAttacksHitText')}` : ``)

    let matContext = {
      mobName: _mobName,
      numSelected: this.mat.numSelected,
      numTargets: this.mat.numTargets,
      multipleTargets: this.mat.numTargets > 1,
      pluralTokensOrNot: ((this.mat.numSelected === 1) ? `` : `s`),
      targets: this.mat.targets,
      noTargetACtext: noTargetACtext,
      armorClassMod: (game.user.getFlag(moduleName, 'persistACmod') ?? game.settings.get(moduleName, 'persistACmod')) ? game.settings.get(moduleName, 'savedArmorClassMod') : this.mat.armorClassMod,
      monsters: this.mat.monsters,
      selectRollType: game.settings.get(moduleName, 'askRollType'),
      hiddenCollapsibleName: this.mat.collapsibleName,
      hiddenCollapsibleCSS: this.mat.collapsibleCSS,
      collapsiblePlusMinus: this.mat.collapsiblePlusMinus,
      numTotalAttacks: this.mat.numTotalAttacks,
      totalAverageDamage: this.mat.totalAverageDamage,
      rollTypeSelection: this.mat.rollTypeSelection,
    }
    matContext.isGM = game.user.isGM

    let _weaponArray = []
    for (let [, weaponData] of Object.entries(_weapons)) {
      _weaponArray.push(weaponData)
    }
    let _monsterArray = []
    for (let [, monsterData] of Object.entries(_monsters)) {
      _monsterArray.push(monsterData)
    }
    this.mat.monsterArray = _monsterArray
    this.mat.weaponArray = _weaponArray

    context.mat = matContext

    context.tabs = this._prepareTabs('primary')
    // modify Targets label prior to window render
    context.tabs['targets'].label = game.i18n.localize('Targets') + ' (' + this.mat.numTargets + ')'

    return context
  }

  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'targets':
      case 'weapons':
        context.tab = context.tabs[partId]
        break
      default:
    }
    return context
  }

  async _loadMob(currentDialog, selectedMob) {
    let _mobList = game.settings.get(moduleName, 'hiddenMobList')

    // check the mob exists before switching the dialog to it
    let _mobData = _mobList[selectedMob]
    if (_mobData === undefined || _mobData === null) return

    await game.settings.set(moduleName, 'hiddenChangedMob', true)
    await game.settings.set(moduleName, 'hiddenMobName', selectedMob)

    let _actorList = getMobActors(_mobData)
    const [, _weapons] = await prepareMonsters(_actorList)

    _mobList[selectedMob]['weapons'] = _weapons
    currentDialog.mat.actorList = _actorList
    await game.settings.set(moduleName, 'hiddenMobList', _mobList)
    Hooks.call('matMobUpdate', { mobList: _mobList, mobName: selectedMob, type: 'load' })
    // Deprecated: the old name of this hook, kept for existing listeners
    Hooks.call('mobUpdate', { mobList: _mobList, mobName: selectedMob, type: 'load' })
    if (game.combat) await game.combat.update()

    for (let i = 0; i < Object.keys(_mobList).length; i++) {
      if (Object.keys(_mobList)[i] === selectedMob) {
        currentDialog.mat.mobListIndex = i
        break
      }
    }
    currentDialog.render(true)
  }

  static async _previousMob() {
    await this.#stepMob(-1)
  }

  static async _nextMob() {
    await this.#stepMob(1)
  }

  /**
   * Load the user's previous or next saved mob, wrapping around at either end
   * @param {number} direction - -1 for the previous mob, 1 for the next
   */
  async #stepMob(direction) {
    const mobList = game.settings.get(moduleName, 'hiddenMobList')
    const currentMobName = $(this.element).find(`input[name="mobName"]`)[0].value
    const userMobNames = getUserMobNames(mobList, game.user.id)
    // mobListIndex counts every user's mobs; step from its place among this user's
    const fallbackIndex = userMobNames.indexOf(Object.keys(mobList)[this.mat.mobListIndex])
    const mobName = stepMobName(userMobNames, currentMobName, fallbackIndex, direction)
    // the user has no saved mobs
    if (mobName === undefined) return
    await this._loadMob(this, mobName)
  }

  static async _selectMob() {
    const html = $(this.element)
    let _initialMobName = html.find(`input[name="mobName"]`)[0].value

    let _mobList = game.settings.get(moduleName, 'hiddenMobList')
    let _noSelectMob = true
    for (let mobName of Object.keys(_mobList)) {
      _mobList[mobName]['visible'] = (_mobList[mobName].userId === game.user.id)
      _mobList[mobName]['selected'] = (_mobList[mobName].mobName === _initialMobName)
      if (_mobList[mobName]['selected'] && _noSelectMob) {
        _noSelectMob = false
      }
    }

    const _dialogMobList = await foundry.applications.handlebars.renderTemplate(templatePath('dialog/mat-dialog-mob-list-v2.hbs'), { mobList: _mobList, isGM: game.user.isGM, noSelectMob: _noSelectMob })

    new foundry.applications.api.DialogV2({
      window: { title: 'MAT.selectMob' },
      content: _dialogMobList,
      buttons: [{
        action: 'select',
        label: 'Select',
        callback: async (event, button, dialog) => {
          const dialogHtml = $(dialog.element)
          let _mobSelected = dialogHtml.find(`[name="selectMob"]`)[0].value

          if (dialogHtml.find(`input[name="deleteSavedMob"]`)[0].checked && _mobSelected !== '') {
            for (let mobName of Object.keys(_mobList)) {
              if (_mobList[mobName].userId === game.user.id && _mobList[mobName].mobName === _mobSelected) {
                delete _mobList[mobName]
                break
              }
            }
            await game.settings.set(moduleName, 'hiddenMobList', _mobList)
            Hooks.call('matMobUpdate', { mobList: _mobList, mobName: _mobSelected, type: 'delete' })
            ui.notifications.info(game.i18n.format('MAT.deleteMobNotify', { mobName: _mobSelected }))
            // load the user's next saved mob, not another user's
            _mobSelected = getUserMobNames(_mobList, game.user.id)[0] ?? ''
            await game.settings.set(moduleName, 'hiddenMobName', _mobSelected)
          }
          else if (dialogHtml.find(`input[name="resetUserMobs"]`)[0].checked) {
            for (let mobName of Object.keys(_mobList)) {
              if (_mobList[mobName].userId === game.user.id) {
                delete _mobList[mobName]
              }
            }
            await game.settings.set(moduleName, 'hiddenMobList', _mobList)
            Hooks.call('matMobUpdate', { mobList: _mobList, mobName: _mobSelected, type: 'reset' })
            ui.notifications.info(game.i18n.localize('MAT.resetAllMobsNotify'))
            _mobSelected = _initialMobName
            await game.settings.set(moduleName, 'hiddenMobName', _mobSelected)
          }
          else if (dialogHtml.find(`input[name="resetAllMobs"]`)[0]?.checked) {
            await game.settings.set(moduleName, 'hiddenMobList', {})
            Hooks.call('matMobUpdate', { mobList: _mobList, mobName: _mobSelected, type: 'resetAll' })
            ui.notifications.info(game.i18n.localize('MAT.resetMobsNotify'))
            _mobSelected = _initialMobName
            await game.settings.set(moduleName, 'hiddenMobName', _mobSelected)
          }
          if (game.combat) await game.combat.update()
          ui.combat?.render(true)

          if (_mobSelected === _initialMobName
            || _mobSelected === ''
            || Object.keys(game.settings.get(moduleName, 'hiddenMobList')).length == 0) {
            return
          }
          else {
            // update main dialog (this)
            $(this.element).find(`input[name="mobName"]`)[0].value = _mobSelected
            await this._loadMob(this, _mobSelected)
          }
        },
      }],
    }).render(true)
  }

  static async _saveMobList(mobList, mobName, monsterArray, selectedTokenIds, numSelected) {
    mobList[mobName] = { mobName: mobName, monsters: monsterArray, selectedTokenIds: selectedTokenIds, numSelected: numSelected, userId: game.user.id }
    await game.settings.set(moduleName, 'hiddenMobList', mobList)
    Hooks.call('matMobUpdate', { mobList, mobName, type: 'save' })
    if (game.combat) await game.combat.update()
    ui.notifications.info(game.i18n.format('MAT.savedMobNotify', { mobName: mobName }))
  }

  static async _saveMob() {
    let _mobList = game.settings.get(moduleName, 'hiddenMobList')
    const html = $(this.element)
    let _mobName = html.find(`input[name="mobName"]`)[0].value
    let _selectedTokenIds = []
    for (let token of getSelectedTokens()) {
      _selectedTokenIds.push(token.id)
    }
    if (!Object.keys(_mobList).includes(_mobName)) {
      await MobAttackDialogV2._saveMobList(_mobList, _mobName, this.mat.monsterArray, _selectedTokenIds, getSelectedTokens().length)
    }
    else {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        content: `<p>${game.i18n.format('MAT.overwriteMobDialog', { mobName: escapeHTML(_mobName) })}</p>`,
        rejectClose: false,
        modal: true,
      })
      if (proceed) {
        await MobAttackDialogV2._saveMobList(_mobList, _mobName, this.mat.monsterArray, _selectedTokenIds, getSelectedTokens().length)
      }
    }
    ui.combat?.render(true)
  }

  /**
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - the capturing HTML element which defined a [data-action]
   */
  static async _increaseNumMonster(event, target) {
    let monsterId = target.parentElement.previousElementSibling.getAttribute('name')
    for (let monsterKey of Object.keys(this.mat.monsters)) {
      if (monsterKey === monsterId) {
        const actor = findMonsterActor(this.mat.actorList, monsterKey)
        if (!actor) break
        this.mat.actorList.push(actor)
        let [monsters, weapons, availableAttacks] = await prepareMonsters(this.mat.actorList, true, this.mat.monsters)
        this.mat.monsters = monsters
        this.mat.weapons = weapons
        this.mat.availableAttacks = availableAttacks
        break
      }
    }
    this.mat.localUpdate = true
    this.render()
  }

  static async _decreaseNumMonster(event, target) {
    let _numMonster = parseInt(target.parentElement.previousElementSibling.value)
    if (Number.isNaN(_numMonster) || _numMonster == null || _numMonster == undefined) {
      _numMonster = 1
    }
    let _updatedNumMonster = _numMonster - 1
    let _monsterId = target.parentElement.previousElementSibling.getAttribute('name')
    if (Object.keys(this.mat.monsters).includes(_monsterId)) {
      // deselect one monster token
      let _monsterTokens = getSelectedTokens().filter(t => t.actor.id === _monsterId)
      if (_monsterTokens.length > _updatedNumMonster) {
        this.currentlySelectingTokens = true
        _monsterTokens[0]?.release()
        this.currentlySelectingTokens = false
      }

      // remove monster from mob list
      let _removalIndex = 0
      for (let i = 0; i < this.mat.actorList.length; i++) {
        if (this.mat.actorList[i].id === _monsterId) {
          _removalIndex = i
          break
        }
      }
      this.mat.actorList.splice(_removalIndex, 1)

      let [monsters, weapons, availableAttacks] = await prepareMonsters(this.mat.actorList, true, this.mat.monsters)
      this.mat.monsters = monsters
      this.mat.weapons = weapons
      this.mat.availableAttacks = availableAttacks
    }
    // }
    this.mat.localUpdate = (this.mat.actorList.length > 0)
    this.render()
  }

  static async _increaseNumAttack(event, target) {
    this.#changeNumAttack(target, 1)
  }

  static async _decreaseNumAttack(event, target) {
    this.#changeNumAttack(target, -1)
  }

  /**
   * Change the number of attacks of the weapon whose input sits next to the clicked arrow
   * Decreasing never goes below 1
   * @param {HTMLElement} target - the clicked increase or decrease control
   * @param {number} delta - 1 to increase, -1 to decrease
   */
  #changeNumAttack(target, delta) {
    const input = target.parentElement.previousElementSibling
    let numAttack = parseInt(input.value)
    if (Number.isNaN(numAttack)) {
      numAttack = 1
    }
    const updatedNumAttack = (delta < 0) ? Math.max(1, numAttack + delta) : numAttack + delta
    for (const weapon of findWeaponEntries(this.mat.monsters, input.getAttribute('name').slice(10))) {
      weapon.numAttack = updatedNumAttack
    }
    this.mat.localUpdate = true
    this.render()
  }

  static async _displayWeapon(event, target) {
    const weapon = this.mat.weaponArray.find(w => w.id === target.dataset?.itemId)
    weapon?.sheet.render(true)
  }

  static async _displayMonster(event, target) {
    const monster = this.mat.monsterArray.find(m => m.id === target.dataset?.itemId)
    game.actors.get(monster?.id)?.sheet.render(true)
  }

  static async _toggleCollapse() {
    if (this.mat.collapsibleName === game.i18n.localize('Show options')) {
      this.mat.collapsibleName = game.i18n.localize('Hide options')
      this.mat.collapsiblePlusMinus = 'minus'
      this.mat.collapsibleCSS = 'mat-collapsible-content-open'
    }
    else {
      this.mat.collapsibleName = game.i18n.localize('Show options')
      this.mat.collapsiblePlusMinus = 'plus'
      this.mat.collapsibleCSS = 'mat-collapsible-content-closed'
    }
    let rollTypeOptions = { advantage: '', normal: '', disadvantage: '' }
    rollTypeOptions[$(this.element).find('[name=rollType]')[0]?.value ?? 'normal'] = 'selected'
    this.mat.rollTypeSelection = rollTypeOptions
    this.mat.localUpdate = true
    this.render()
  }

  static async _increaseACmod() {
    await this.#changeACmod(1)
  }

  static async _decreaseACmod() {
    await this.#changeACmod(-1)
  }

  /**
   * Change the target AC modifier and save it for later dialogs
   * @param {number} delta - 1 to increase, -1 to decrease
   */
  async #changeACmod(delta) {
    const input = $(this.element).find(`input[name="armorClassMod"]`)[0]
    let acMod = parseInt(input.value)
    if (Number.isNaN(acMod)) {
      acMod = 0
    }
    const newMod = acMod + delta
    this.mat.armorClassMod = newMod
    await game.settings.set(moduleName, 'savedArmorClassMod', newMod)
    input.value = `${newMod}`
    this.mat.localUpdate = true
    this.render()
  }

  static async _exportMacro() {
    if (getSelectedTokens().length === 0) {
      ui.notifications.warn(game.i18n.localize('MAT.selectTokenWarning'))
      return
    }

    // prepare data
    const selectedTokenIds = getSelectedTokenIds()
    let mobAttackData = await prepareMobAttack($(this.element), selectedTokenIds, this.mat.weapons, this.mat.availableAttacks, this.mat.targets, this.mat.targetAC + game.settings.get(moduleName, 'savedArmorClassMod'), this.mat.numSelected, this.mat.monsters, this.mat.actorList)

    // Create macro
    let key = Object.keys(mobAttackData.attacks)[0]
    if (key === undefined) {
      ui.notifications.warn(game.i18n.localize('MAT.selectWeaponWarning'))
      return
    }
    if (key.endsWith(`(${game.i18n.localize('Versatile')})`)) key = key.slice(0, key.indexOf(` (${game.i18n.localize('Versatile')})`))
    const macroNameWords = { prefix: game.i18n.localize('MAT.macroNamePrefix'), postfix: game.i18n.localize('MAT.macroNamePostfix') }
    // tokens are selected here: the check above returned otherwise
    const macroName = buildMacroName(mobAttackData.weapons[key].name, getSelectedTokens().length, getSelectedTokens()[0].name, macroNameWords)

    const input = await foundry.applications.api.DialogV2.input({
      window: { title: game.i18n.localize('Macro Name') },
      content: `
      <div class="form-group">
      <label>${game.i18n.localize('Macro Name')}: </label>
      <input type="text" name="macroName" value="${escapeHTML(macroName)}">
      <p class="hint">${game.i18n.localize('MAT.macroNameNote')}</p>
      </div>
      `,
      ok: {
        label: game.i18n.localize('Select'),
        icon: 'fa fa-check',
      },
    })

    // user cancelled dialog
    if (input == null) return

    const userMacroName = input?.macroName

    // check for existing macro with same name
    if (game.macros.filter(m => m.name === userMacroName).length > 0) {
      const overwrite = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('Overwrite Macro') },
        content: `<p>${game.i18n.format('MAT.macroOverwriteDialog', { userMacroName: escapeHTML(userMacroName) })}</p>`,
      })

      if (!overwrite) return
    }

    // prepareMobAttack already took numSelected from the loaded saved mob
    let macroData = {
      type: 'script',
      name: userMacroName,
      command: buildQuickRollCommand(mobAttackData, game.settings.get(moduleName, 'disadvantageKeyBinding')),
      img: mobAttackData.weapons[key].img,
    }

    if (game.macros.filter(m => m.name === userMacroName).length > 0) {
      let existingMacro = game.macros.getName(userMacroName)
      await existingMacro.update(macroData)
    }
    else {
      Macro.create(macroData)
    }
    ui.notifications.info(`Macro ${userMacroName} ${game.i18n.localize('MAT.macroNotification')}`)
  }

  static async _executeMobAttack(event) {
    let mobList = game.settings.get(moduleName, 'hiddenMobList')
    if (getSelectedTokens().length == 0 && Object.keys(mobList).length == 0) {
      ui.notifications.warn(game.i18n.localize('MAT.selectTokenWarning'))
      return
    }
    if (checkTarget()) {
      const selectedTokenIds = getSelectedTokenIds()
      let mobAttackData = await prepareMobAttack($(this.element), selectedTokenIds, this.mat.weapons, this.mat.availableAttacks, this.mat.targets, this.mat.targetAC + game.settings.get(moduleName, 'savedArmorClassMod'), this.mat.numSelected, this.mat.monsters, this.mat.actorList)
      mobAttackData.event = event
      const mobRulesSetting = game.settings.get(moduleName, 'mobRules')
      if (game.settings.get(moduleName, 'mobRules') === 'individual') {
        rollMobAttackIndividually(mobAttackData)
      }
      else {
        rollMobAttack(mobAttackData, mobRulesSetting)
      }
      if (!game.settings.get(moduleName, 'keepDialogOpen')) {
        this.close()
      }
    }
  }

  // non-click onEventListener registration (https://foundryvtt.wiki/en/development/api/applicationv2)
  _onRender(...args) {
    super._onRender(...args)

    this.#dragDrop.forEach(d => d.bind(this.element))

    const numAttackInput = this.element.querySelectorAll('.numAttack')
    for (const input of numAttackInput) {
      input.addEventListener('change', (e) => {
        e.preventDefault()
        e.stopImmediatePropagation()

        let weaponId = e.currentTarget.getAttribute('name').slice(10)
        let updatedNumAttack = this.element.querySelector(`input[name="numAttacks${weaponId}"]`)?.value
        for (const weapon of findWeaponEntries(this.mat.monsters, weaponId)) {
          weapon.numAttack = updatedNumAttack
        }
        this.mat.localUpdate = true
        this.render()
      })
    }

    const numMonsterInput = this.element.querySelectorAll('.numMonster')
    for (const input of numMonsterInput) {
      input.addEventListener('change', async (e) => {
        e.preventDefault()
        e.stopImmediatePropagation()

        let _monsterId = e.currentTarget.getAttribute('name')
        let _updatedNumMonster = parseInt(this.element.querySelector(`input[name="${_monsterId}"]`)?.value)
        if (Number.isNaN(_updatedNumMonster) || _updatedNumMonster == null || _updatedNumMonster == undefined) {
          return
        }
        if (Object.keys(this.mat.monsters).includes(_monsterId)) {
          // check if this is add, remove, or no change
          // for both canvas tokens and (the potentially larger) actor list
          let _monsterTokens = getSelectedTokens().filter(t => t.actor.id === _monsterId)
          let _monsterActors = this.mat.actorList.filter(t => t.id == _monsterId)
          let _deltaTokens = _updatedNumMonster - _monsterTokens.length
          let _deltaActors = _updatedNumMonster - _monsterActors.length

          // no change
          if (_deltaActors == 0 || _updatedNumMonster < 1)
            return

          // actor (and maybe token) removal
          if (_deltaActors < 0) {
            // flip positive for easier reading
            let _removalActorCount = -1 * _deltaActors
            let _removalTokenCount = -1 * _deltaTokens

            // release the equivalent number of tokens
            let _released = 0
            while (_removalActorCount > 0) {
              if (_removalTokenCount > 0) {
                this.currentlySelectingTokens = true
                _monsterTokens[_released]?.release()
                _released++
                _removalTokenCount--
                this.currentlySelectingTokens = false
              }
              // remove monster(s) from mob list
              let _removalIndex = 0
              for (let ri = 0; ri < this.mat.actorList.length; ri++) {
                if (this.mat.actorList[ri].id === _monsterId) {
                  _removalIndex = ri
                  break
                }
              }
              this.mat.actorList.splice(_removalIndex, 1)
              _removalActorCount--
            }
          }
          else {
            // adding more monsters (_delta > 0)
            // actor only (no token adds)
            const actor = findMonsterActor(this.mat.actorList, _monsterId)
            for (let i = 0; actor && i < _deltaActors; i++) {
              this.mat.actorList.push(actor)
            }
          }

          // update list on remove or addition
          let [monsters, weapons, availableAttacks] = await prepareMonsters(this.mat.actorList, true, this.mat.monsters)
          this.mat.monsters = monsters
          this.mat.weapons = weapons
          this.mat.availableAttacks = availableAttacks
        }

        this.mat.localUpdate = true
        this.render()
      })
    }

    const weaponChange = this.element.querySelectorAll('.useWeapon')
    for (const input of weaponChange) {
      input.addEventListener('change', (e) => {
        e.preventDefault()
        e.stopImmediatePropagation()

        let weaponId = e.currentTarget.getAttribute('name').slice(3)
        for (const weapon of findWeaponEntries(this.mat.monsters, weaponId)) {
          weapon.useButtonValue = (weapon.useButtonValue === `checked`) ? `` : `checked`
        }
        this.mat.localUpdate = true
        this.render()
      })
    }

    const acModChange = this.element.querySelectorAll('.acModInput')
    for (const input of acModChange) {
      input.addEventListener('change', async (e) => {
        e.preventDefault()
        e.stopImmediatePropagation()

        let acMod = parseInt(e.currentTarget.value)
        if (Number.isNaN(acMod) || acMod == null || acMod == undefined) {
          e.currentTarget.value = 0
          return
        }
        this.mat.armorClassMod = acMod
        await game.settings.set(moduleName, 'savedArmorClassMod', acMod)

        this.mat.localUpdate = true
        this.render()
      })
    }
  }

  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      }
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      }
      return new foundry.applications.ux.DragDrop(d)
    })
  }

  _canDragStart() {
    return true
  }

  _canDragDrop() {
    return true
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    if ('link' in event.target.dataset) return

    const el = event.currentTarget

    const targetImg = el.firstElementChild.src
    const targetId = el.parentNode.parentNode.parentNode.firstElementChild.firstElementChild.dataset.itemId
    const targetIndex = el.parentNode.parentNode.parentNode.firstElementChild.firstElementChild.dataset.targetIndex
    const weaponId = el.firstElementChild.dataset.itemId

    const dragData = {
      type: 'Weapon on Target',
      targets: this.mat.targets,
      targetId: targetId,
      weaponId: weaponId,
      targetIndex: targetIndex,
      img: targetImg,
    }

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData))
  }

  async _onDragOver() { }

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event)

    // a failed parse result will return an empty object
    if (Object.keys(data).length === 0) return

    // Copy attack over from source to target
    const el = event.currentTarget
    const currentTargetId = el.parentNode.parentNode.firstElementChild.firstElementChild.dataset.itemId
    const currentTargetIndex = el.parentNode.parentNode.firstElementChild.firstElementChild.dataset.targetIndex
    if (!currentTargetId) return

    this.mat.targets.filter(t => (t.targetId === currentTargetId && t.targetIndex === parseInt(currentTargetIndex)))[0].weapons.push(data.targets.filter(t => t.targetId === data.targetId)[0].weapons.filter(w => w.weaponId === data.weaponId)[0])

    // After copying, delete attack from source
    let targetWeapons = this.mat.targets.filter(t => (t.targetId === data.targetId && t.targetIndex === parseInt(data.targetIndex)))[0].weapons
    let weaponIndex = targetWeapons.indexOf(targetWeapons.filter(w => w.weaponId === data.weaponId)[0])
    this.mat.targets.filter(t => (t.targetId === data.targetId && t.targetIndex === parseInt(data.targetIndex)))[0].weapons.splice(weaponIndex, 1)

    this.mat.targetUpdate = true
    this.mat.localUpdate = true
    this.render()
  }
}

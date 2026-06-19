import { moduleName } from '../mobAttack.js'
import { buildSettingsData, saveFormData, matSettings } from '../settings.js'

const { expandObject } = foundry.utils
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

// ---------------------------------------------------------------------------
// AppV2 implementation (Foundry v13+)
// ---------------------------------------------------------------------------
export class RollSettingsMenuV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'mob-attack-tool-roll-settings',
    classes: ['standard-form'],
    tag: 'form',
    window: {
      title: 'Mob Attack Tool Settings',
      icon: 'fas fa-cogs',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: {
      width: 530,
      height: 'auto',
    },
    form: {
      handler: RollSettingsMenuV2._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    actions: {
      addRow: RollSettingsMenuV2._onAddRow,
      removeRow: RollSettingsMenuV2._onRemoveRow,
      resetTable: RollSettingsMenuV2._onResetTable,
    },
  }

  static TABS = {
    primary: {
      tabs: [
        {
          id: 'roll',
          icon: 'fas fa-dice-d20',
          label: 'SETTINGS.MAT.rollSettings',
        },
        {
          id: 'multiattack',
          icon: 'fas fa-fist-raised',
          label: 'SETTINGS.MAT.multiattackSettings',
        },
        {
          id: 'targets',
          icon: 'fas fa-crosshairs',
          label: 'SETTINGS.MAT.targetSettings',
        },
        {
          id: 'module',
          icon: 'fas fa-cogs',
          label: 'SETTINGS.MAT.moduleSpecificSettings',
        },
        {
          id: 'mobTable',
          icon: 'fas fa-bars',
          label: 'SETTINGS.MAT.mobTableSettings',
        },
      ],
      initial: 'roll',
    },
  }

  static PARTS = {
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs',
    },
    roll: {
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu-roll.hbs',
      scrollable: ['scrollable'],
    },
    multiattack: {
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu-multiattack.hbs',
      scrollable: ['scrollable'],
    },
    targets: {
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu-target.hbs',
      scrollable: ['scrollable'],
    },
    module: {
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu-module.hbs',
      scrollable: ['scrollable'],
    },
    mobTable: {
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu-mobtable.hbs',
      scrollable: ['scrollable'],
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  }

  async _prepareContext() {
    const context = buildSettingsData()
    let tabsPrep = this._prepareTabs('primary')
    // drop GM tabs for non-GM players
    if (!context.isGM) {
      delete tabsPrep.module
      delete tabsPrep.mobTable
    }
    context.tabs = tabsPrep
    context.buttons = [
      { type: 'submit', icon: 'fa-solid fa-save', label: 'SETTINGS.Save' },
    ]
    return context
  }

  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'roll':
      case 'multiattack':
      case 'targets':
      case 'module':
      case 'mobTable':
        context.tab = context.tabs[partId]
        break
      default:
    }
    return context
  }

  static async _onSubmit(event, form, formData) {
    await saveFormData(expandObject(formData.object))
  }

  /** Read current input values from the live DOM rather than saved settings,
       *  so unsaved edits in other tabs are preserved when adding/removing rows. */
  static _readTableFromDOM(element) {
    return Array.from(element.querySelectorAll('input[name="tempSetting"]'))
      .map(input => parseInt(input.value))
  }

  static async _onAddRow() {
    let customTable = RollSettingsMenuV2._readTableFromDOM(this.element)
    if (customTable[customTable.length - 2] >= 20) {
      customTable[customTable.length - 2] = parseInt(customTable[customTable.length - 2]) - 1
    }
    customTable = customTable.concat([
      parseInt(customTable[customTable.length - 2]) + 1,
      parseInt(customTable[customTable.length - 2]) + 1,
      parseInt(customTable[customTable.length - 1]),
    ])
    await game.settings.set(moduleName, 'tempSetting', customTable)
    this.render()
  }

  static async _onRemoveRow() {
    let customTable = RollSettingsMenuV2._readTableFromDOM(this.element)
    if (customTable.length >= 6) {
      customTable = customTable.slice(0, customTable.length - 3)
      await game.settings.set(moduleName, 'tempSetting', customTable)
    }
    this.render()
  }

  static async _onResetTable() {
    await game.settings.set(moduleName, 'tempSetting', matSettings.tempSetting.default)
    this.render()
  }
}

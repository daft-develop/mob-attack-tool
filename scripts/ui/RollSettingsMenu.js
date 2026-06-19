import { moduleName } from '../mobAttack.js'
import { buildSettingsData, saveFormData, matSettings } from '../settings.js'

const { mergeObject } = foundry.utils

// ---------------------------------------------------------------------------
// Legacy FormApplication implementation (Foundry v12 and below)
// ---------------------------------------------------------------------------
export class RollSettingsMenu extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'mob-attack-tool-roll-settings',
      title: 'Mob Attack Tool Settings',
      template: 'modules/mob-attack-tool/templates/settings/mat-roll-settings-menu.hbs',
      width: '530',
      height: 'auto',
      closeOnSubmit: true,
      tabs: [{ navSelector: '.tabs', contentSelector: 'form', initial: 'roll' }],
    })
  }

  getData() {
    return buildSettingsData()
  }

  async _updateObject(event, formData) {
    await saveFormData(formData)
  }

  activateListeners(html) {
    super.activateListeners(html)

    html.on('click', '.MATaddRow', async () => {
      let tableData = []
      const tableDataHtml = html.find('input[name="tempSetting"]')
      for (let input of tableDataHtml) {
        tableData.push(parseInt(input.value))
      }
      let customTable = tableData
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
    })

    html.on('click', '.MATremoveRow', async () => {
      let tableData = []
      const tableDataHtml = html.find('input[name="tempSetting"]')
      for (let input of tableDataHtml) {
        tableData.push(parseInt(input.value))
      }
      let customTable = tableData
      if (customTable.length >= 6) {
        customTable = customTable.slice(0, customTable.length - 3)
        await game.settings.set(moduleName, 'tempSetting', customTable)
      }
      this.render()
    })

    html.on('click', '.MATresetTable', async () => {
      await game.settings.set(moduleName, 'tempSetting', matSettings.tempSetting.default)
      this.render()
    })
  }
}

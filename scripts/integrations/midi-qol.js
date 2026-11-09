// Integration with the midi-qol module (https://foundryvtt.com/packages/midi-qol)
const { getProperty } = foundry.utils

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
      return (new Function(`"use strict";
        return (async function ({speaker, actor, token, character, item, args}={}) {
          ${itemMacro.command}
          });`))().call(this, { speaker, actor, token, character, item, args })
    }
    else {
      const macroCommand = game.macros.getName(macroName)
      if (macroCommand) {
        return macroCommand.execute(macroData) || {}
      }
    }
  }
  catch (err) {
    ui.notifications.error(`There was an error while executing an "On Use" macro. See the console (F12) for details.`)
    console.error(err)
  }
  return {}
}

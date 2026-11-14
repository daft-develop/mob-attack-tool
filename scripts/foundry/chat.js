import { moduleName } from '../constants.js'
import { foundryEqualOrNewerThan } from '../versions.js'

/**
 * Send a chat message with mob attack results
 * @param {string} text - The message content
 */
export async function sendChatMessage(text) {
  let whisperIDs = game.users.contents.filter(u => u.isGM).map(u => u.id)

  let chatData = {
    user: game.user.id,
    speaker: { alias: game.i18n.localize('MAT.mobAttackResults') },
    content: text,
    whisper: (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) ? [] : whisperIDs,
  }

  if (game.settings.get(moduleName, 'showMobAttackResultsToPlayers')) {
    if (foundryEqualOrNewerThan('14.0.0')) {
      // the user's message mode (core.messageMode); core.rollMode is deprecated and null
      chatData = ChatMessage.applyMode(chatData)
    }
    else {
      chatData = ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'))
    }
  }
  await ChatMessage.create(chatData, {})
}

/**
 * Whether the user's current roll (Foundry 13) or message (Foundry 14+) mode
 * shows rolls to everyone
 * Foundry 14 replaced the core.rollMode setting, which is now null, with
 * core.messageMode; its public modes are public and ic (in character)
 * @returns {boolean} true for public rolls
 */
export function isPublicRollMode() {
  if (foundryEqualOrNewerThan('14.0.0')) {
    return ['public', 'ic'].includes(game.settings.get('core', 'messageMode'))
  }
  const rollMode = game.settings.get('core', 'rollMode')
  return rollMode === 'publicroll' || rollMode === 'roll'
}

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
      chatData = ChatMessage.applyMode(chatData, game.settings.get('core', 'rollMode'))
    }
    else {
      chatData = ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'))
    }
  }
  await ChatMessage.create(chatData, {})
}

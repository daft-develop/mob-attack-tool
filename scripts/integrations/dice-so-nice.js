// Integration with the Dice So Nice module (https://foundryvtt.com/packages/dice-so-nice)
import { moduleName } from '../constants.js'

const MODULE_ID = 'dice-so-nice'

/**
 * Whether Dice So Nice is active and enabled in this module's settings
 * @returns {boolean} true if 3D dice should be shown
 */
export function isDiceSoNiceEnabled() {
  return Boolean(game.modules.get(MODULE_ID)?.active && game.settings.get(moduleName, 'enableDiceSoNice'))
}

// Whether rolls are public, so their 3D dice are synchronized to the other users
export { isPublicRollMode } from '../foundry/chat.js'

/**
 * Show a roll's 3D dice when Dice So Nice is enabled
 * @param {Roll} roll - an evaluated roll
 * @param {object} [options]
 * @param {boolean} [options.synchronize] - show the dice to the other users too
 * @returns {Promise|undefined} resolves when the animation finishes, undefined when disabled
 */
export function showDiceSoNiceRoll(roll, { synchronize = false } = {}) {
  if (!isDiceSoNiceEnabled()) return undefined
  return game.dice3d.showForRoll(roll, game.user, synchronize)
}

/**
 * At the start of a mob attack: when this module's Dice So Nice setting is
 * off, blind Dice So Nice for the attack's chat messages until
 * restoreDiceSoNice(). Only the GM can change the world setting this uses.
 */
export async function suspendDiceSoNice() {
  if (!game.settings.get(moduleName, 'enableDiceSoNice') && game.user.isGM) {
    await game.settings.set(moduleName, 'hiddenDSNactiveFlag', false)
  }
}

/**
 * At the end of a mob attack: let Dice So Nice show rolls again
 */
export async function restoreDiceSoNice() {
  if (game.user.isGM) await game.settings.set(moduleName, 'hiddenDSNactiveFlag', true)
}

/**
 * At startup: no mob attack is running, so clear a suspension left by an
 * interrupted attack (or by 0.19.0's attacks that hit nothing), which would
 * otherwise hide every 3D roll in the world. Only the GM can change it.
 */
export async function clearStaleDiceSoNiceSuspension() {
  if (game.user.isGM && !game.settings.get(moduleName, 'hiddenDSNactiveFlag')) {
    await game.settings.set(moduleName, 'hiddenDSNactiveFlag', true)
  }
}

/**
 * Run a mob attack with Dice So Nice suspended, restoring it once the attack
 * finishes, returns early or throws
 * Suspending hides every roll in the world while the attack runs, so it is
 * only for chat messages this module can't flag with withHiddenDiceFlag
 * (midi-qol's damage cards)
 * @param {() => Promise<*>} callback - the mob attack
 * @param {object} [options]
 * @param {boolean} [options.suspend] - whether to suspend Dice So Nice at all
 * @returns {Promise<*>} what the callback returns
 */
export async function withDiceSoNiceSuspended(callback, { suspend = true } = {}) {
  if (!suspend) return callback()
  await suspendDiceSoNice()
  try {
    return await callback()
  }
  finally {
    await restoreDiceSoNice()
  }
}

/**
 * Chat message data with the flag that hides its 3D dice, when this module's
 * Dice So Nice setting is off. Marking the messages themselves works for
 * players too (only the GM can suspend Dice So Nice) and doesn't depend on
 * when each client sees the hiddenDSNactiveFlag setting change.
 * @param {object} messageData - chat message data, e.g. from getDamageMessageData
 * @returns {object} a copy with flags['mob-attack-tool'].hideDice set, or the data unchanged
 */
export function withHiddenDiceFlag(messageData) {
  if (game.settings.get(moduleName, 'enableDiceSoNice')) return messageData
  return { ...messageData, flags: { ...messageData.flags, [moduleName]: { ...messageData.flags?.[moduleName], hideDice: true } } }
}

/**
 * Register the hook that hides 3D dice for a mob attack's rolls: messages
 * flagged by withHiddenDiceFlag, and any roll while a mob attack has Dice So
 * Nice suspended (for messages this module can't flag, like midi-qol's).
 * Dice So Nice doesn't animate a roll whose context is blind, on every client
 * that runs this hook.
 */
export function registerDiceSoNiceHooks() {
  Hooks.on('diceSoNiceRollStart', (messageId, context) => {
    const flagged = game.messages.get(messageId)?.getFlag(moduleName, 'hideDice')
    if (flagged || !game.settings.get(moduleName, 'hiddenDSNactiveFlag')) context.blind = true
  })
}

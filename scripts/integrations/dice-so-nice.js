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

/**
 * Whether the current roll mode shows rolls to everyone, so their 3D dice
 * are synchronized to the other users
 * @returns {boolean} true for public rolls
 */
export function isPublicRollMode() {
  const rollMode = game.settings.get('core', 'rollMode')
  return rollMode === 'publicroll' || rollMode === 'roll'
}

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
 * Run a mob attack with Dice So Nice suspended, restoring it once the attack
 * finishes, returns early or throws
 * @param {() => Promise<*>} callback - the mob attack
 * @returns {Promise<*>} what the callback returns
 */
export async function withDiceSoNiceSuspended(callback) {
  await suspendDiceSoNice()
  try {
    return await callback()
  }
  finally {
    await restoreDiceSoNice()
  }
}

/**
 * Register the hook that blinds Dice So Nice rolls while a mob attack has them suspended
 */
export function registerDiceSoNiceHooks() {
  Hooks.on('diceSoNiceRollStart', (messageId, context) => {
    if (game.settings.get(moduleName, 'hiddenDSNactiveFlag')) return

    // Hide this roll
    context.blind = true
  })
}

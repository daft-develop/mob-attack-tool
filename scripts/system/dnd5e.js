// Everything that depends on the dnd5e version, or calls dnd5e's own APIs.
// Version checks live here only, so core/ and the rest of the module never
// see a dnd5e version number. When a dnd5e release changes one of these,
// this is the file to patch; when the minimum version rises, delete the
// branches that no longer apply.
import { systemEqualOrNewerThan } from '../versions.js'

/**
 * Return the spellcasting method of a spell, e.g. 'atwill' or 'innate'
 * dnd5e 5.1 replaced system.preparation.mode with system.method and removed
 * the deprecated preparation getter in 6.0
 * @param {Item5e} spell - a spell item
 * @returns {string|undefined} the spellcasting method
 */
export function getSpellMethod(spell) {
  if (systemEqualOrNewerThan('5.1.0')) {
    return spell.system.method
  }
  return spell.system.preparation?.mode
}

/**
 * Return the level that cantrip damage scales with
 * NPCs store it in attributes.spell.level (dnd5e 4.3+); other actors use
 * their character level, falling back to details.spellLevel
 * @param {Actor5e} actor - the actor casting the spell
 * @returns {number|undefined} the caster level
 */
export function getCasterLevel(actor) {
  if (actor.type === 'npc') {
    return actor.system.attributes.spell.level
  }
  return actor.system.details.level || actor.system.details.spellLevel
}

/**
 * Simplify a roll formula using dnd5e's dice helpers
 * Before dnd5e 5.0, negative modifiers didn't get the same leading/trailing
 * space as positive modifiers, so add it
 * @param {string} formula - The formula to simplify
 * @returns {string} The simplified formula
 */
export function simplifyFormula(formula) {
  const simplified = dnd5e.dice.simplifyRollFormula(formula, { preserveFlavor: true })
  if (systemEqualOrNewerThan('5.0.0')) {
    return simplified
  }
  return simplified.replaceAll(/(?<! )-(\d)/g, ' - $1')
}

/**
 * Return dnd5e's target descriptors for the current user's targets, in the
 * shape dnd5e stores on chat messages
 * dnd5e 6.0 moved this from dnd5e.utils to the chat message TargetsField
 * @returns {object[]} target descriptors
 */
export function formatAttackTargets() {
  if (systemEqualOrNewerThan('6.0.0')) {
    return dnd5e.dataModels.chatMessage.fields.TargetsField.getDescriptors()
  }
  return dnd5e.utils.getTargetDescriptors()
}

/**
 * Target descriptors for a single token, so a damage card only lists the
 * target its attacks were assigned to rather than every current target
 * dnd5e 6.0 descriptors are { actor, token, name, img, ac }, keyed by token,
 * and built by dnd5e for any tokens. Before 6.0 they are { name, img, uuid, ac }
 * with the actor's uuid; dnd5e only builds those for the user's targets, so
 * they are built here the same way, for tokens that aren't targeted (such as
 * a Multilevel Tokens clone's source)
 * @param {string|null} targetId - token ID, or null for no target
 * @returns {object[]} the matching descriptor, or an empty array
 */
function getTargetDescriptors(targetId) {
  const token = canvas.tokens.get(targetId)
  if (!token) return []
  if (systemEqualOrNewerThan('6.0.0')) {
    return dnd5e.dataModels.chatMessage.fields.TargetsField.getDescriptors([token])
  }
  const actor = token.actor
  if (!actor?.uuid) return []
  // as dnd5e's getTargetDescriptors: total cover hides the AC
  const ac = actor.statuses?.has('coverTotal') ? null : actor.system.attributes?.ac?.value
  return [{ name: token.name, img: actor.img, uuid: actor.uuid, ac: ac ?? null }]
}

/**
 * Build the config for dnd5e's activity rollDamage(config, dialog, message)
 * dnd5e 6.0 moved a damage message's targets from flags.dnd5e.targets to
 * system.targets, and ignores the old flag
 * @param {boolean} allowCritical - Whether to allow critical hits
 * @param {string|null} targetId - Optional token ID to set as target
 * @param {boolean} [isVersatile] - roll a versatile weapon's two-handed damage
 * @returns {object} damage, dialog and message options for rollDamage
 */
export function getDamageOptions(allowCritical = true, targetId = null, isVersatile = false) {
  const targets = getTargetDescriptors(targetId)
  const message = systemEqualOrNewerThan('6.0.0')
    ? { data: { system: { targets } } }
    : { data: { flags: { dnd5e: { targets } } } }
  return {
    // dnd5e 4+ uses the versatile damage for the two-handed attack mode
    damage: isVersatile ? { isCritical: allowCritical, attackMode: 'twoHanded' } : { isCritical: allowCritical },
    dialog: { configure: false },
    message,
  }
}

/**
 * Chat message data that makes a roll's toMessage() card a dnd5e damage card
 * for one target
 * dnd5e 6.0 replaced the flags.dnd5e roll flags with a "damage" message type
 * and system.targets, and does not migrate the old flags
 * @param {string|null} targetId - token ID, or null for no target
 * @returns {object} message data to merge into toMessage()
 */
export function getDamageMessageData(targetId) {
  const targets = getTargetDescriptors(targetId)
  if (systemEqualOrNewerThan('6.0.0')) {
    return { type: 'damage', system: { targets } }
  }
  return { flags: { dnd5e: { messageType: 'roll', roll: { type: 'damage' }, targets } } }
}

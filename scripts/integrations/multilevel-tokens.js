// Integration with the Multilevel Tokens module (https://foundryvtt.com/packages/multilevel-tokens)
// Multilevel Tokens can clone a token onto other levels or scenes. A clone's
// multilevel-tokens flags point at the source token (stoken), and at the
// source scene (sscene) when that is another scene. Source tokens carry no
// multilevel-tokens flags. Since Foundry 11 a clone also has a synthetic
// actor (a copy of the source's), so it can't be told apart by its actor.

const MODULE_ID = 'multilevel-tokens'

/**
 * The Multilevel Tokens flags of a clone token, or undefined for any other token
 * Only tokens whose flags name a source token are clones, and only while the
 * module is active
 * @param {Token} token - a canvas token
 * @returns {{stoken: string, sscene?: string}|undefined} the clone's flags
 */
function getCloneFlags(token) {
  if (!token || !game.modules.get(MODULE_ID)?.active) return undefined
  const flags = token.document?.flags?.[MODULE_ID] ?? token.flags?.[MODULE_ID]
  return flags?.stoken ? flags : undefined
}

/**
 * Drop clones whose source token is also in the list, so a clone and its
 * source aren't counted as two targets
 * @param {Token[]} tokens - targeted canvas tokens
 * @returns {Token[]} the tokens without those clones
 */
export function withoutTargetedClones(tokens) {
  return tokens.filter((token) => {
    const flags = getCloneFlags(token)
    return !(flags && tokens.some(other => other.id === flags.stoken))
  })
}

/**
 * The actor a targeted token stands for: a clone's source actor, otherwise the token's own actor
 * @param {Token} token - a targeted canvas token
 * @returns {Actor5e|undefined} the actor whose stats (such as AC) apply
 */
export function getTargetActor(token) {
  const flags = getCloneFlags(token)
  if (!flags) return token?.actor
  return getSourceToken(flags)?.actor
}

/**
 * The token that takes a targeted token's damage: a clone's source token
 * (Multilevel Tokens doesn't sync damage from a clone back to its source),
 * otherwise the token itself
 * @param {Token} token - a targeted canvas token
 * @returns {Token|TokenDocument|undefined} the source Token on this scene, its TokenDocument on another scene, or the token
 */
export function getTargetToken(token) {
  const flags = getCloneFlags(token)
  if (!flags) return token
  return getSourceToken(flags)
}

/**
 * A clone's source token
 * @param {{stoken: string, sscene?: string}} flags - the clone's flags
 * @returns {Token|TokenDocument|undefined} the canvas Token on this scene, or the TokenDocument on another scene
 */
function getSourceToken(flags) {
  if (flags.sscene) return game.scenes.get(flags.sscene)?.tokens.get(flags.stoken)
  return canvas.tokens.get(flags.stoken)
}

/**
 * The id of the token a damage card should list for a target: a clone's
 * source token when it is on this scene, otherwise the target itself
 * (a token on another scene can't be listed on this scene's card)
 * @param {string|null} targetId - the targeted token's id
 * @returns {string|null} the token id for the damage card
 */
export function getDamageTargetId(targetId) {
  const target = getTargetToken(canvas.tokens.get(targetId))
  // a canvas Token has a document; a TokenDocument from another scene doesn't
  return target?.document ? target.id : targetId
}

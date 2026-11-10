// Integration with the Multilevel Tokens module (https://foundryvtt.com/packages/multilevel-tokens)
// Multilevel Tokens can clone a token onto other levels or scenes. A clone has
// no actor of its own; its multilevel-tokens flags point at the source token
// (stoken), and at the source scene (sscene) when that is another scene.

const MODULE_ID = 'multilevel-tokens'

/**
 * The Multilevel Tokens flags of a clone token, or undefined for any other token
 * Only tokens without an actor (actor === null) are treated as clones, and
 * only while the module is active
 * @param {Token} token - a canvas token
 * @returns {{stoken: string, sscene?: string}|undefined} the clone's flags
 */
function getCloneFlags(token) {
  if (token?.actor !== null || !game.modules.get(MODULE_ID)?.active) return undefined
  return token.document?.flags?.[MODULE_ID] ?? token.flags?.[MODULE_ID]
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
  if (flags.sscene) {
    return game.scenes.get(flags.sscene)?.tokens.get(flags.stoken)?.actor
  }
  return canvas.tokens.get(flags.stoken)?.actor
}

/**
 * The token to hand to other modules (such as midi-qol) as the target: a
 * clone's source token when it is on another scene, otherwise the token itself
 * @param {Token} token - a targeted canvas token
 * @returns {Token|TokenDocument|undefined} the target token
 */
export function getTargetToken(token) {
  const flags = getCloneFlags(token)
  if (flags?.sscene) {
    return game.scenes.get(flags.sscene)?.tokens.get(flags.stoken)
  }
  return token
}

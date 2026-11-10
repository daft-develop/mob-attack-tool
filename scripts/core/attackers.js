/**
 * The attacking token that made a given hit
 * tokenAttackList has one entry per hit that had a token available, so it
 * can be shorter than the number of hits; the remaining hits use the last
 * token in the list
 * @param {{tokenId: string, tokenUuid: string}[]} tokenAttackList - attacking tokens, in hit order
 * @param {number} hitIndex - zero-based index of the hit
 * @returns {{tokenId: string, tokenUuid: string}|undefined} the attacker, or undefined when the list is empty
 */
export function getAttackerForHit(tokenAttackList, hitIndex) {
  if (tokenAttackList.length === 0) return undefined
  return tokenAttackList[Math.min(hitIndex, tokenAttackList.length - 1)]
}

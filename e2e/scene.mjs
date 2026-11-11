// Scene helpers for end-to-end tests. Tests place their own tokens instead
// of relying on what each test world happens to contain, and remove them
// afterwards: every test shares one world per run.

/**
 * Place unlinked tokens of a world actor on the current scene, in a row
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {string} actorName - the world actor's name
 * @param {number} count - how many tokens
 * @param {object} [options]
 * @param {number} [options.row] - grid row to place them in (0 = top)
 * @param {object} [options.data] - extra token data, e.g. { name: 'Goblin A' }
 * @returns {Promise<string[]>} the new tokens' ids
 */
export async function placeTokens(page, actorName, count, { row = 0, data = {} } = {}) {
  return page.evaluate(async ({ actorName, count, row, data }) => {
    const actor = game.actors.getName(actorName)
    if (!actor) throw new Error(`No actor named ${actorName} in the test world`)
    const grid = canvas.scene.grid.size
    const tokens = []
    for (let i = 0; i < count; i++) {
      const token = await actor.getTokenDocument({ x: grid * (2 + i), y: grid * (2 + row * 2), actorLink: false, ...data })
      tokens.push(token.toObject())
    }
    const created = await canvas.scene.createEmbeddedDocuments('Token', tokens)
    const ids = created.map(t => t.id)
    // wait until the placeables are drawn, so they can be selected and targeted
    for (let tries = 0; tries < 50 && !ids.every(id => canvas.tokens.get(id)); tries++) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return ids
  }, { actorName, count, row, data })
}

/**
 * Delete tokens from the current scene
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {string[]} ids - the tokens' ids
 */
export async function deleteTokens(page, ids) {
  await page.evaluate(async (ids) => {
    const existing = ids.filter(id => canvas.scene.tokens.has(id))
    if (existing.length) await canvas.scene.deleteEmbeddedDocuments('Token', existing)
  }, ids)
}

/**
 * Select exactly the given tokens
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string[]} ids - the tokens' ids
 */
export async function selectTokens(page, ids) {
  await page.evaluate((ids) => {
    canvas.tokens.releaseAll()
    for (const id of ids) canvas.tokens.get(id).control({ releaseOthers: false })
  }, ids)
}

/**
 * Target exactly the given tokens
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string[]} ids - the tokens' ids, or none to clear the targets
 */
export async function targetTokens(page, ids) {
  await page.evaluate(ids => canvas.tokens.setTargets(ids, { mode: 'replace' }), ids)
}

/**
 * Change Mob Attack Tool settings, returning the previous values
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {Record<string, *>} values - setting key → value
 * @returns {Promise<Record<string, *>>} the previous values, to restore with setModuleSettings
 */
export function setModuleSettings(page, values) {
  return page.evaluate(async (values) => {
    const previous = {}
    for (const [key, value] of Object.entries(values)) {
      previous[key] = game.settings.get('mob-attack-tool', key)
      await game.settings.set('mob-attack-tool', key, value)
    }
    return previous
  }, values)
}

/**
 * The id of the newest chat message, to read only the messages after it later
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @returns {Promise<string|null>} the id, or null when the log is empty
 */
export function lastMessageId(page) {
  return page.evaluate(() => game.messages.contents.at(-1)?.id ?? null)
}

/**
 * The chat messages created after a given one
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string|null} afterId - from lastMessageId
 * @returns {Promise<object[]>} plain data for each message: id, flavor, content, rolls' totals and formulas, damage card targets
 */
export function messagesAfter(page, afterId) {
  return page.evaluate((afterId) => {
    const messages = game.messages.contents
    const start = afterId ? messages.findIndex(m => m.id === afterId) + 1 : 0
    return messages.slice(start).map(m => ({
      id: m.id,
      type: m.type,
      flavor: m.flavor ?? '',
      content: m.content ?? '',
      rolls: m.rolls.map(r => ({ total: r.total, formula: r.formula })),
      // dnd5e 6.0+ keeps a damage card's targets in system.targets ({ token, actor, name }),
      // earlier versions in flags.dnd5e.targets ({ uuid, name })
      targets: (m.system?.targets ?? m.flags?.dnd5e?.targets ?? []).map(t => ({ name: t.name, uuid: t.token ?? t.uuid })),
    }))
  }, afterId)
}

/**
 * Wait until the chat log has at least a number of messages after a given one
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {string|null} afterId - from lastMessageId
 * @param {number} count - how many messages to wait for
 */
export async function waitForMessages(page, afterId, count) {
  await page.waitForFunction(({ afterId, count }) => {
    const messages = game.messages.contents
    const start = afterId ? messages.findIndex(m => m.id === afterId) + 1 : 0
    return messages.length - start >= count
  }, { afterId, count }, { timeout: 30_000 })
}

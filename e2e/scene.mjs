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

/**
 * Set up a Multilevel Tokens clone: draw a source and a target region (Multilevel
 * Tokens regions are drawings with its flags), place a token of a world actor in
 * the source region, and wait for the module to clone it into the target region.
 * The module must be active. Remove everything with removeClone.
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {string} actorName - the world actor's name
 * @returns {Promise<{source: string, clone: string, drawings: string[]}>} the token and drawing ids
 */
export async function createClone(page, actorName) {
  return page.evaluate(async (actorName) => {
    const grid = canvas.scene.grid.size
    const { sceneX, sceneY } = canvas.dimensions
    const region = { disabled: false, local: false, playersOnly: false, in: false, out: false, cloneId: 'mat-e2e', macroEnter: false, macroLeave: false, macroMove: false, level: false }
    const rect = (col, source) => ({
      x: sceneX + grid * col,
      y: sceneY + grid * 12,
      shape: { type: 'r', width: grid * 4, height: grid * 3 },
      text: `[MAT e2e] ${source ? 'source' : 'target'}`,
      flags: { 'multilevel-tokens': { ...region, source, target: !source } },
    })
    const drawings = await canvas.scene.createEmbeddedDocuments('Drawing', [rect(2, true), rect(10, false)])

    const actor = game.actors.getName(actorName)
    const token = await actor.getTokenDocument({ x: sceneX + grid * 3, y: sceneY + grid * 13, actorLink: false })
    const [source] = await canvas.scene.createEmbeddedDocuments('Token', [token.toObject()])
    let clone
    for (let tries = 0; tries < 50 && !clone; tries++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      clone = canvas.tokens.placeables.find(t => t.document.flags['multilevel-tokens']?.stoken === source.id)
    }
    if (!clone) throw new Error('Multilevel Tokens did not clone the token')
    return { source: source.id, clone: clone.id, drawings: drawings.map(d => d.id) }
  }, actorName)
}

/**
 * Remove a clone set up by createClone: its source token (Multilevel Tokens removes the clone) and the regions
 * @param {import('@playwright/test').Page} page - a GM page
 * @param {{source: string, clone: string, drawings: string[]}} setup - from createClone
 */
export async function removeClone(page, setup) {
  await page.evaluate(async ({ source, clone, drawings }) => {
    const tokens = [source, clone].filter(id => canvas.scene.tokens.has(id))
    if (tokens.length) await canvas.scene.deleteEmbeddedDocuments('Token', tokens)
    await canvas.scene.deleteEmbeddedDocuments('Drawing', drawings.filter(id => canvas.scene.drawings.has(id)))
  }, setup)
}

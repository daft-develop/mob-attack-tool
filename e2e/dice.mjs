// Deterministic dice for end-to-end tests. Foundry turns each random number
// into a face with Die#mapRandomFace (Foundry 13 and 14); this patches it to
// hand out queued faces first, so tests script exact results: crits, fumbles,
// hits against an AC, advantage. Rolls past the queue are random again.

/**
 * Queue die faces for the next dice rolled in the page, in the order Foundry rolls them
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @param {number[]} faces - face values, e.g. [20, 1, 4] for a natural 20, then a 1, then a 4
 * @param {number} [dieFaces] - only give these faces to dice with this many sides, e.g. 20 for
 *   attack rolls, so damage dice rolled in between don't use them; any die by default
 */
export async function queueDice(page, faces, dieFaces) {
  await page.evaluate(({ queued, sides }) => {
    const Die = foundry.dice.terms.Die
    if (!Die.prototype._matQueuedFaces) {
      const mapRandomFace = Die.prototype.mapRandomFace
      Die.prototype._matQueuedFaces = []
      Die.prototype.mapRandomFace = function (randomUniform) {
        const queue = Die.prototype._matQueuedFaces
        const index = queue.findIndex(entry => entry.faces === undefined || entry.faces === this.faces)
        if (index === -1) return mapRandomFace.call(this, randomUniform)
        return queue.splice(index, 1)[0].face
      }
    }
    Die.prototype._matQueuedFaces.push(...queued.map(face => ({ face, faces: sides })))
  }, { queued: faces, sides: dieFaces })
}

/**
 * How many queued faces have not been rolled yet
 * @param {import('@playwright/test').Page} page - a Foundry page
 * @returns {Promise<number>} the number of faces left
 */
export function queuedDiceLeft(page) {
  return page.evaluate(() => foundry.dice.terms.Die.prototype._matQueuedFaces?.length ?? 0)
}

/**
 * Drop any faces left in the queue
 * @param {import('@playwright/test').Page} page - a Foundry page
 */
export async function clearDice(page) {
  await page.evaluate(() => {
    foundry.dice.terms.Die.prototype._matQueuedFaces?.splice(0)
  })
}

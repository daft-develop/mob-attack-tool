import { test, expect } from './fixtures.mjs'
import { clearDice, queueDice, queuedDiceLeft } from './dice.mjs'

test.afterEach(async ({ gm }) => clearDice(gm))

test('queued faces decide the dice, in order', async ({ gm }) => {
  await queueDice(gm, [20, 3, 4, 1])
  const totals = await gm.evaluate(async () => {
    const first = await new Roll('1d20 + 2d6').evaluate()
    const second = await new Roll('1d20').evaluate()
    return [first.total, second.total]
  })
  expect(totals).toEqual([27, 1])
  expect(await queuedDiceLeft(gm)).toBe(0)
})

test('advantage keeps the higher of the queued d20s', async ({ gm }) => {
  await queueDice(gm, [7, 15])
  const total = await gm.evaluate(async () => (await new Roll('2d20kh').evaluate()).total)
  expect(total).toBe(15)
})

test('rolls past the queue are random again', async ({ gm }) => {
  const total = await gm.evaluate(async () => (await new Roll('1d6').evaluate()).total)
  expect(total).toBeGreaterThanOrEqual(1)
  expect(total).toBeLessThanOrEqual(6)
})

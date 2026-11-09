import { describe, it, expect } from 'vitest'
import { escapeHTML, findWeaponEntries, getMobActors } from '../../scripts/ui/dialog/dialog-context.js'

const goblin = { id: 'goblin' }
const ogre = { id: 'ogre' }
const actors = { goblin, ogre }
const getActor = id => actors[id]

describe('getMobActors', () => {
  it('repeats each actor by its amount, in mob order', () => {
    const mob = { monsters: [{ id: 'goblin', amount: 3 }, { id: 'ogre', amount: 1 }] }
    expect(getMobActors(mob, getActor)).toEqual([goblin, goblin, goblin, ogre])
  })

  it('skips actors that no longer exist', () => {
    const mob = { monsters: [{ id: 'deleted', amount: 2 }, { id: 'ogre', amount: 2 }] }
    expect(getMobActors(mob, getActor)).toEqual([ogre, ogre])
  })

  it('returns no actors for a missing or empty mob', () => {
    expect(getMobActors(undefined, getActor)).toEqual([])
    expect(getMobActors({ monsters: [] }, getActor)).toEqual([])
  })

  it('looks actors up in game.actors by default', () => {
    globalThis.game.actors = { get: id => actors[id] }
    expect(getMobActors({ monsters: [{ id: 'ogre', amount: 1 }] })).toEqual([ogre])
  })
})

describe('escapeHTML', () => {
  it('escapes the characters that break HTML text and attribute values', () => {
    expect(escapeHTML('<b>"Tom" & \'Jerry\'</b>')).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;')
  })

  it('keeps a quoted macro name intact inside value="..."', () => {
    const name = 'Club "Big Stick" Mob Attack of 3 Ogres'
    const input = document.createElement('div')
    input.innerHTML = `<input name="macroName" value="${escapeHTML(name)}">`
    expect(input.firstElementChild.value).toBe(name)
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHTML('Scimitar Mob Attack of 4 Goblins')).toBe('Scimitar Mob Attack of 4 Goblins')
  })
})

describe('findWeaponEntries', () => {
  const monsters = () => ({
    goblin: { weapons: { 'abc123': { numAttack: 1 }, 'abc123 (Versatile)': { numAttack: 1 } } },
    hobgoblin: { weapons: { abc123: { numAttack: 2 }, xyz789: { numAttack: 1 } } },
  })

  it('finds a weapon by its form field id', () => {
    const data = monsters()
    expect(findWeaponEntries(data, 'xyz789')).toEqual([data.hobgoblin.weapons.xyz789])
  })

  it('matches the versatile entry by its dashed form field id', () => {
    const data = monsters()
    expect(findWeaponEntries(data, 'abc123-(Versatile)')).toEqual([data.goblin.weapons['abc123 (Versatile)']])
  })

  it('returns the first match in every monster that has the item id', () => {
    const data = monsters()
    expect(findWeaponEntries(data, 'abc123')).toEqual([data.goblin.weapons.abc123, data.hobgoblin.weapons.abc123])
  })

  it('returns the entries themselves, so updates apply to the dialog data', () => {
    const data = monsters()
    for (const weapon of findWeaponEntries(data, 'abc123')) weapon.numAttack = 5
    expect(data.goblin.weapons.abc123.numAttack).toBe(5)
    expect(data.hobgoblin.weapons.abc123.numAttack).toBe(5)
  })

  it('returns nothing for an unknown id', () => {
    expect(findWeaponEntries(monsters(), 'nope')).toEqual([])
  })
})

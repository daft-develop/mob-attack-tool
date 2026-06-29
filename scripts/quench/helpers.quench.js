import { getAttackBonus, getDamageFormulaAndType } from '../utils.js'
import { systemEqualOrNewerThan } from '../versions.js'

export function getTokenByName(name) {
  return canvas.tokens.placeables?.find(t => t.name == name)
}

export function expectItemCount(expect, items, itemName, count = 1, message = `missing ${itemName}`) {
  expect(items.filter(i => i.name == itemName), message).to.have.lengthOf(count)
}

export function expectAbilityScores(expect, actor, values) {
  const [str, dex, con, int, wis, cha] = values
  expect(actor.system.abilities.str.value).to.equal(str)
  expect(actor.system.abilities.dex.value).to.equal(dex)
  expect(actor.system.abilities.con.value).to.equal(con)
  expect(actor.system.abilities.int.value).to.equal(int)
  expect(actor.system.abilities.wis.value).to.equal(wis)
  expect(actor.system.abilities.cha.value).to.equal(cha)
}

export function expectBattleaxeDetails(expect, items, itemName) {
  const battleaxe = items.find(i => i.name == itemName)
  if (systemEqualOrNewerThan('4.0.0')) {
    expect(battleaxe.system._source.activities.dnd5eactivity000.activation.type, 'Battleaxe +3 ability of NULL').to.equal('action')
    expect(battleaxe.system._source.activities.dnd5eactivity000.attack.ability, 'Battleaxe +3 ability of NULL').to.equal('')
  }
  else {
    expect(battleaxe.system._source, 'Battleaxe +3 ability of NULL').to.have.property('actionType')
    expect(battleaxe.system._source.ability, 'Battleaxe +3 ability of NULL').to.not.be.ok // check for falsy value
  }
}

export function expectAttackBonus(expect, items, itemName, expected) {
  const weapon = items.find(i => i.name == itemName)
  expect(getAttackBonus(weapon)).to.equal(expected)
}

export function expectDamageRoll(expect, items, itemName, versatile, expectedDamage, expectedType, expectedLabel) {
  const weapon = items.find(i => i.name == itemName)
  const [damage, type, label] = getDamageFormulaAndType(weapon, versatile)
  expect(damage[0]).to.equal(expectedDamage)
  expect(type[0]).to.equal(expectedType)
  expect(label[0]).to.equal(expectedLabel)
}

export function registerAttackBonusTests(context, suiteName, items, cases) {
  const { describe, it, expect } = context

  describe(suiteName, function () {
    cases.forEach(([testTitle, itemName, expected]) => {
      it(`should handle ${testTitle}`, function () {
        expectAttackBonus(expect, items, itemName, expected)
      })
    })
  })
}

export function registerDamageRollTests(context, suiteName, items, cases) {
  const { describe, it, expect } = context

  describe(suiteName, function () {
    cases.forEach(([testTitle, itemName, versatile, expectedDamage, expectedType, expectedLabel]) => {
      it(`should handle ${testTitle}`, function () {
        expectDamageRoll(expect, items, itemName, versatile, expectedDamage, expectedType, expectedLabel)
      })
    })
  })
}

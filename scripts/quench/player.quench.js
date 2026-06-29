import { registerAttackBonusTests, registerDamageRollTests, getTokenByName, expectDamageRoll } from './helpers.quench.js'

export function registerPlayerBatch(quench) {
  quench.registerBatch(
    'mat.player',
    (context) => {
      const { describe, it, expect } = context

      const testToken = getTokenByName('Randal')
      const testActor = testToken?.actor
      const testItems = testActor?.items

      const playerAttackCases = [
        ['default prof (str for melee)', 'Longsword', 7],
        ['default prof (dex for ranged)', 'Longbow', 5],
        ['default spell prof (int)', 'Fire Bolt', 2],
        ['manually set weapon prof', 'Handaxe (CHA)', 3],
        ['manually set spell prof', 'Fire Bolt (CON)', 5],
        ['not prof', 'Handaxe (No Prof)', 4],
        ['"none" prof', 'Handaxe (None)', 3],
        ['to hit bonus', 'Handaxe (Bonus ToHit)', 17],
        ['a flat to hit bonus', 'Handaxe (Flat)', 5],
        ['magic bonus in details', 'Battleaxe +3', 10],
        ['magical enhancement bonuses', 'Handaxe, +1', 8],
        ['magical enhancement flat attack modified', 'Handaxe, +5', 5],
      ]
      registerAttackBonusTests(context, 'Player Attack Bonus', testItems, playerAttackCases)

      const playerDamageCases = [
        ['default melee @mod', 'Longsword', false, '1d8 + 4', 'Slashing', 'slashing'],
        ['versatile melee @mod', 'Longsword', true, '1d10 + 4', 'Slashing', 'slashing'],
        ['default ranged @mod', 'Longbow', false, '1d8 + 2', 'Piercing', 'piercing'],
        ['cantrip spell casting with scaling', 'Fire Bolt', false, '2d10', 'Fire', 'fire'],
        ['manually set weapon ability (CHA)', 'Handaxe (CHA)', false, '1d6', 'Slashing', 'slashing'],
        ['magic bonus in details', 'Battleaxe +3', false, '1d8 + 7', 'Slashing', 'slashing'],
        ['magic bonus in details, versatile', 'Battleaxe +3', true, '1d10 + 7', 'Slashing', 'slashing'],
        ['magical enhancement bonuses', 'Handaxe, +1', false, '1d6 + 5', 'Slashing', 'slashing'],
        ['magical enhancement flat attack modified', 'Handaxe, +5', false, '1d6 + 4', 'Slashing', 'slashing'],
        ['damage without a damage type', 'Handaxe, No Damage Type', false, '1d6 + 4', '', ''],
      ]
      registerDamageRollTests(context, 'Player Damage Roll', testItems, playerDamageCases)

      describe('Player Eldritch Blast Damage Roll', () => {
        it('should handle Eldritch Blast scaling', function () {
          const eldritchBlast = getTokenByName('Sefris').actor.items.find(i => i.name == 'Eldritch Blast')
          expectDamageRoll(expect, [eldritchBlast], 'Eldritch Blast', false, '1d10', 'Force', 'force')
        })
      })
    },
    { displayName: 'MAT: Player Character Checks' },
  )
}

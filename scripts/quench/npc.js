import { registerAttackBonusTests, registerDamageRollTests, getTokenByName, expectDamageRoll } from './helpers.js'

export function registerNpcBatch(quench) {
  quench.registerBatch(
    'mat.npc',
    (context) => {
      const { describe, it, expect } = context

      const testToken = getTokenByName('Skeleton')
      const testActor = testToken?.actor
      const testItems = testActor?.items

      const npcAttackCases = [
        ['default prof (str for melee)', 'Longsword', 2],
        ['default prof (dex for ranged)', 'Longbow', 4],
        ['default spell prof (int)', 'Fire Bolt', 0],
        ['manually set weapon prof', 'Handaxe (CHA)', -1],
        ['manually set spell prof', 'Fire Bolt (CON)', 4],
        ['not prof', 'Handaxe (No Prof)', 0],
        ['"none" prof', 'Handaxe (None)', 2],
        ['to hit bonus', 'Handaxe (Bonus ToHit)', 12],
        ['a flat to hit bonus', 'Handaxe (Flat)', 5],
        ['magic bonus in details', 'Battleaxe +3', 5],
        ['magical enhancement bonuses', 'Handaxe, +1', 3],
        ['magical enhancement flat attack modified', 'Handaxe, +5', 5],
      ]
      registerAttackBonusTests(context, 'NPC Attack Bonus', testItems, npcAttackCases)

      const npcDamageCases = [
        ['default melee @mod', 'Longsword', false, '1d8', 'Slashing', 'slashing'],
        ['versatile melee @mod', 'Longsword', true, '1d10', 'Slashing', 'slashing'],
        ['default ranged @mod', 'Longbow', false, '1d8 + 2', 'Piercing', 'piercing'],
        ['manually set weapon ability (CHA)', 'Handaxe (CHA)', false, '1d6 - 3', 'Slashing', 'slashing'],
        ['magic bonus in details', 'Battleaxe +3', false, '1d8 + 3', 'Slashing', 'slashing'],
        ['magic bonus in details, versatile', 'Battleaxe +3', true, '1d10 + 3', 'Slashing', 'slashing'],
        ['magical enhancement bonuses', 'Handaxe, +1', false, '1d6 + 1', 'Slashing', 'slashing'],
        ['magical enhancement flat attack modified', 'Handaxe, +5', false, '1d6', 'Slashing', 'slashing'],
        ['damage without a damage type', 'Handaxe, No Damage Type', false, '1d6', '', ''],
      ]
      registerDamageRollTests(context, 'NPC Damage Roll', testItems, npcDamageCases)

      describe('NPC Cantrip Scaling', () => {
        it('should handle cantrip spell casting with scaling', function () {
          const weapon = testItems.find(i => i.name == 'Fire Bolt')
          expectDamageRoll(expect, [weapon], 'Fire Bolt', false, '1d10', 'Fire', 'fire')

          const fireBoltScaling = getTokenByName('Archmage').actor.items.find(i => i.name == 'Fire Bolt')
          expectDamageRoll(expect, [fireBoltScaling], 'Fire Bolt', false, '4d10', 'Fire', 'fire')
        })
      })
    },
    { displayName: 'MAT: NPC Checks' },
  )
}

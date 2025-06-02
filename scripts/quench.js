import { getAttackBonus, getDamageFormulaAndType } from './utils.js'
import { systemEqualOrNewerThan, foundryEqualOrNewerThan } from './versions.js'

export function initQuenchTests() {
  Hooks.on('quenchReady', (quench) => {
    quench.registerBatch(
      'mat.preflight',
      (context) => {
        const { describe, it, expect } = context

        describe('Scene setup', function () {
          const activeScene = canvas.scene
          it('should have the correct scene', function () {
            expect(activeScene.name).to.equal('Scene')
            expect(activeScene.active).to.equal(true)
          })
          // the rest of these settings and trying to decrease load time
          // since we're constantly refreshing while testing
          it('should have global lighting enabled', function () {
            if (systemEqualOrNewerThan('4.0.0')) {
              expect(activeScene.environment.globalLight.enabled).to.equal(true)
            }
            else {
              expect(activeScene.globalLight).to.equal(true)
            }
          })
          it('should have token vision disabled', function () {
            expect(activeScene.tokenVision).to.equal(false)
          })
          it('should have fog exploration disabled', function () {
            if (systemEqualOrNewerThan('4.0.0')) {
              expect(activeScene.fog.exploration).to.equal(false)
            }
            else {
              expect(activeScene.fogExploration).to.equal(false)
            }
          })
          it('should have no background set', function () {
            expect(activeScene.background.src).to.be.a('null')
          })
        })

        describe('Randal setup', function () {
          const randalToken = canvas.tokens.placeables?.find(t => t.name == 'Randal')
          const randalActor = randalToken?.actor
          const randalItems = randalActor?.items
          it('should have one and only one Randal on the Canvas', function () {
            // one and only one Randal to make .find selection repeatable
            expect(canvas.tokens.placeables.filter(t => t.name == 'Randal')).to.have.lengthOf(1)
          })
          it('should have Randal at level 5', function () {
            expect(randalActor.system.details.level).to.equal(5)
          })
          it('should have Extra Attack', function () {
            expect(randalActor.items.filter(i => i.name == 'Extra Attack')).to.have.lengthOf(1)
          })
          it('should have Abilities set to 18/14/15/9/13/11', function () {
            // level 4 ASI into STR
            expect(randalActor.system.abilities.str.value).to.equal(18)
            expect(randalActor.system.abilities.dex.value).to.equal(14)
            expect(randalActor.system.abilities.con.value).to.equal(15)
            expect(randalActor.system.abilities.int.value).to.equal(9)
            expect(randalActor.system.abilities.wis.value).to.equal(13)
            expect(randalActor.system.abilities.cha.value).to.equal(11)
          })
          it('should have all test equipment', function () {
            expect(randalItems.filter(i => i.name == 'Longsword'), 'missing Longsword').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Longbow'), 'missing Longbow').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe (CHA)'), 'missing Handaxe (CHA)').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe (No Prof)'), 'missing Handaxe (No Prof) Not Proficient').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe (None)'), 'missing Handaxe (None) attribute set to none').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe (Bonus ToHit)'), 'missing Handaxe (Bonus ToHit) with +10 bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe (Flat)'), 'missing Handaxe (Flat) with flat +5 bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe, No Damage Type'), 'missing Handaxe, No Damage Type').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe, +1'), 'missing Handaxe, +1 with magical enchantment bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe, +5'), 'missing Handaxe, +5 with magical flat bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Battleaxe +3'), 'missing SRD Battleaxe +3 with details bonus').to.have.lengthOf(1)
            if (systemEqualOrNewerThan('4.0.0')) {
              expect(randalItems.find(i => i.name == 'Battleaxe +3').system._source.activities.dnd5eactivity000.activation.type, 'Battleaxe +3 ability of NULL').to.equal('action')
              expect(randalItems.find(i => i.name == 'Battleaxe +3').system._source.activities.dnd5eactivity000.attack.ability, 'Battleaxe +3 ability of NULL').to.equal('')
            }
            else {
              expect(randalItems.find(i => i.name == 'Battleaxe +3').system._source, 'Battleaxe +3 ability of NULL').to.have.property('actionType')
              expect(randalItems.find(i => i.name == 'Battleaxe +3').system._source.ability, 'Battleaxe +3 ability of NULL').to.not.be.ok // check for falsy value
            }
            expect(randalItems.filter(i => i.name == 'Fire Bolt', 'missing default Fire Bolt')).to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Fire Bolt (CON)'), 'missing Fire Bolt (CON)').to.have.lengthOf(1)
          })
        })

        describe('Skeleton setup', function () {
          const skeletonToken = canvas.tokens.placeables?.find(t => t.name == 'Skeleton')
          const skeletonActor = skeletonToken?.actor
          const skeletonItems = skeletonActor?.items
          it('should have one and only one Skeleton on the Canvas', function () {
            // one and only one Randal to make .find selection repeatable
            expect(canvas.tokens.placeables.filter(t => t.name == 'Skeleton')).to.have.lengthOf(1)
          })
          it('should have Skeleton CR of 1/4', function () {
            expect(skeletonActor.system.details.cr).to.equal(0.25)
          })
          it('should have Abilities set to 18/14/15/9/13/11', function () {
            // level 4 ASI into STR
            expect(skeletonActor.system.abilities.str.value).to.equal(10)
            expect(skeletonActor.system.abilities.dex.value).to.equal(14)
            expect(skeletonActor.system.abilities.con.value).to.equal(15)
            expect(skeletonActor.system.abilities.int.value).to.equal(6)
            expect(skeletonActor.system.abilities.wis.value).to.equal(8)
            expect(skeletonActor.system.abilities.cha.value).to.equal(5)
          })
          it('should have all test equipment', function () {
            expect(skeletonItems.filter(i => i.name == 'Longsword'), 'missing Longsword').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Longbow'), 'missing Longbow').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe (CHA)'), 'missing Handaxe (CHA)').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe (No Prof)'), 'missing Handaxe (No Prof) Not Proficient').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe (None)'), 'missing Handaxe (None) attribute set to none').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe (Bonus ToHit)'), 'missing Handaxe (Bonus ToHit) with +10 bonus').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe (Flat)'), 'missing Handaxe (Flat) with flat +5 bonus').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe, No Damage Type'), 'missing Handaxe, No Damage Type').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe, +1'), 'missing Handaxe, +1 with magical enchantment bonus').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Handaxe, +5'), 'missing Handaxe, +5 with magical flat bonus').to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Battleaxe +3'), 'missing SRD Battleaxe +3 with details bonus').to.have.lengthOf(1)
            if (systemEqualOrNewerThan('4.0.0')) {
              expect(skeletonItems.find(i => i.name == 'Battleaxe +3').system._source.activities.dnd5eactivity000.activation.type, 'Battleaxe +3 ability of NULL').to.equal('action')
              expect(skeletonItems.find(i => i.name == 'Battleaxe +3').system._source.activities.dnd5eactivity000.attack.ability, 'Battleaxe +3 ability of NULL').to.equal('')
            }
            else {
              expect(skeletonItems.find(i => i.name == 'Battleaxe +3').system._source, 'Battleaxe +3 ability of NULL').to.have.property('actionType')
              expect(skeletonItems.find(i => i.name == 'Battleaxe +3').system._source.ability, 'Battleaxe +3 ability of NULL').to.be.null
            }
            expect(skeletonItems.filter(i => i.name == 'Fire Bolt', 'missing default Fire Bolt')).to.have.lengthOf(1)
            expect(skeletonItems.filter(i => i.name == 'Fire Bolt (CON)'), 'missing Fire Bolt (CON)').to.have.lengthOf(1)
          })
        })
      },
      { displayName: 'MAT: Preflight Checks' },
    )

    quench.registerBatch(
      'mat.player',
      (context) => {
        const { describe, it, expect } = context

        const testToken = canvas.tokens.placeables?.find(t => t.name == 'Randal')
        const testActor = testToken?.actor
        const testItems = testActor?.items

        describe('Player Attack Bonus', function () {
          it('should handle default prof (str for melee)', function () {
            const weapon = testItems.find(i => i.name == 'Longsword')
            expect(getAttackBonus(weapon)).to.equal(7)
          })
          it('should handle default prof (dex for ranged)', function () {
            const weapon = testItems.find(i => i.name == 'Longbow')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
          it('should handle default spell prof (int)', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt')
            expect(getAttackBonus(weapon)).to.equal(2)
          })
          it('should handle manually set weapon prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (CHA)')
            expect(getAttackBonus(weapon)).to.equal(3)
          })
          it('should handle manually set spell prof', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt (CON)')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
          it('should handle not prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (No Prof)')
            expect(getAttackBonus(weapon)).to.equal(4)
          })
          it('should handle "none" prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (None)')
            expect(getAttackBonus(weapon)).to.equal(3)
          })
          it('should handle to hit bonus', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (Bonus ToHit)')
            expect(getAttackBonus(weapon)).to.equal(17)
          })
          it('should handle a flat to hit bonus', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (Flat)')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
          it('should handle magic bonus in details', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3')
            expect(getAttackBonus(weapon)).to.equal(10)
          })
          it('should handle magical enhancement bonuses', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +1')
            expect(getAttackBonus(weapon)).to.equal(8)
          })
          it('should handle magical enhancement flat attack modified', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +5')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
        })

        describe('Player Damage Roll', function () {
          let damage, type, label
          it('should handle default melee @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longsword');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 4')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle versatile melee @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longsword');
            [damage, type, label] = getDamageFormulaAndType(weapon, true)
            damage[0].should.equal('1d10 + 4')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle default ranged @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longbow');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 2')
            type[0].should.equal('Piercing')
            label[0].should.equal('piercing')
          })
          it('should handle cantrip spell casting with scaling', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('2d10')
            type[0].should.equal('Fire')
            label[0].should.equal('fire')
          })
          it('should handle manually set weapon ability (CHA)', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (CHA)');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 0')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magic bonus in details', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 7')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magic bonus in details, versatile', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3');
            [damage, type, label] = getDamageFormulaAndType(weapon, true)
            damage[0].should.equal('1d10 + 7')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magical enhancement bonuses', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +1');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 5')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magical enhancement flat attack modified', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +5');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 4')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle damage without a damage type', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, No Damage Type');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 4')
            type[0].should.equal('')
            label[0].should.equal('')
          })
        })
      },
      { displayName: 'MAT: Player Character Checks' },
    )

    quench.registerBatch(
      'mat.npc',
      (context) => {
        const { describe, it, expect } = context

        const testToken = canvas.tokens.placeables?.find(t => t.name == 'Skeleton')
        const testActor = testToken?.actor
        const testItems = testActor?.items

        describe('NPC Attack Bonus', function () {
          it('should handle default prof (str for melee)', function () {
            const weapon = testItems.find(i => i.name == 'Longsword')
            expect(getAttackBonus(weapon)).to.equal(2)
          })
          it('should handle default prof (dex for ranged)', function () {
            const weapon = testItems.find(i => i.name == 'Longbow')
            expect(getAttackBonus(weapon)).to.equal(4)
          })
          it('should handle default spell prof (int)', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt')
            expect(getAttackBonus(weapon)).to.equal(0)
          })
          it('should handle manually set weapon prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (CHA)')
            expect(getAttackBonus(weapon)).to.equal(-1)
          })
          it('should handle manually set spell prof', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt (CON)')
            expect(getAttackBonus(weapon)).to.equal(4)
          })
          it('should handle not prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (No Prof)')
            expect(getAttackBonus(weapon)).to.equal(0)
          })
          it('should handle "none" prof', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (None)')
            expect(getAttackBonus(weapon)).to.equal(2)
          })
          it('should handle to hit bonus', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (Bonus ToHit)')
            expect(getAttackBonus(weapon)).to.equal(12)
          })
          it('should handle a flat to hit bonus', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (Flat)')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
          it('should handle magic bonus in details', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
          it('should handle magical enhancement bonuses', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +1')
            expect(getAttackBonus(weapon)).to.equal(3)
          })
          it('should handle magical enhancement flat attack modified', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +5')
            expect(getAttackBonus(weapon)).to.equal(5)
          })
        })

        describe('NPC Damage Roll', function () {
          let damage, type, label
          it('should handle default melee @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longsword');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 0')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle versatile melee @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longsword');
            [damage, type, label] = getDamageFormulaAndType(weapon, true)
            damage[0].should.equal('1d10 + 0')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle default ranged @mod', function () {
            const weapon = testItems.find(i => i.name == 'Longbow');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 2')
            type[0].should.equal('Piercing')
            label[0].should.equal('piercing')
          })
          it('should handle cantrip spell casting with scaling', function () {
            const weapon = testItems.find(i => i.name == 'Fire Bolt');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d10')
            type[0].should.equal('Fire')
            label[0].should.equal('fire')
          })
          it('should handle manually set weapon ability (CHA)', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe (CHA)');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 - 3')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magic bonus in details', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d8 + 3')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magic bonus in details, versatile', function () {
            const weapon = testItems.find(i => i.name == 'Battleaxe +3');
            [damage, type, label] = getDamageFormulaAndType(weapon, true)
            damage[0].should.equal('1d10 + 3')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magical enhancement bonuses', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +1');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 1')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle magical enhancement flat attack modified', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, +5');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 0')
            type[0].should.equal('Slashing')
            label[0].should.equal('slashing')
          })
          it('should handle damage without a damage type', function () {
            const weapon = testItems.find(i => i.name == 'Handaxe, No Damage Type');
            [damage, type, label] = getDamageFormulaAndType(weapon, false)
            damage[0].should.equal('1d6 + 0')
            type[0].should.equal('')
            label[0].should.equal('')
          })
        })
      },
      { displayName: 'MAT: NPC Checks' },
    )

    quench.registerBatch(
      'mat.misc',
      (context) => {
        const { describe, it, expect } = context

        describe('Version checking', function () {
          it('should return true for identical versions', function () {
            expect(systemEqualOrNewerThan('3.0.0', '3.0.0'), '3.0.0 == 3.0.0').to.equal(true)

            expect(foundryEqualOrNewerThan('11.123', '11.123'), '11.123 == 11.123').to.equal(true)
          })
          it('should return true for newer versions', function () {
            expect(systemEqualOrNewerThan('4.0.0', '4.1.2'), '4.2.1 > 4.0.0').to.equal(true)
            expect(systemEqualOrNewerThan('3', '3.3.1'), '3.3.1 > 3').to.equal(true)

            expect(foundryEqualOrNewerThan('11.0', '11.123'), '11.123 > 11.0').to.equal(true)
          })
          it('should return false for older versions', function () {
            expect(systemEqualOrNewerThan('4', '3.3.1'), '3.3.1 !> 4').to.equal(false)
            expect(systemEqualOrNewerThan('5', '4.0.0'), '4.0.0 !> 5').to.equal(false)

            expect(foundryEqualOrNewerThan('13.0', '12.123'), '12.123 !> 13').to.equal(false)
          })
          it('should return true without overriding system arg', function () {
            expect(systemEqualOrNewerThan('3')).to.equal(true)

            expect(foundryEqualOrNewerThan('11.0')).to.equal(true)
          })
        })
      },
      { displayName: 'MAT: Misc Tests' },
    )
  })
}

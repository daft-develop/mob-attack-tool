import { getAttackBonus, isDndV4OrNewer } from './utils.js'

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
            if (!isDndV4OrNewer()) {
              expect(activeScene.globalLight).to.equal(true)
            }
            else {
              expect(activeScene.environment.globalLight.enabled).to.equal(true)
            }
          })
          it('should have token vision disabled', function () {
            expect(activeScene.tokenVision).to.equal(false)
          })
          it('should have fog exploration disabled', function () {
            if (!isDndV4OrNewer()) {
              expect(activeScene.fogExploration).to.equal(false)
            }
            else {
              expect(activeScene.fog.exploration).to.equal(false)
            }
          })
          it('should have no background set', function () {
            expect(activeScene.background.src).to.be.a('null')
          })
        }),
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
            expect(randalItems.filter(i => i.name == 'Handaxe, +1'), 'missing Handaxe, +1 with magical enchantment bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Handaxe, +5'), 'missing Handaxe, +5 with magical flat bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Battleaxe +3'), 'missing SRD Battleaxe +3 with details bonus').to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Fire Bolt', 'missing default Fire Bolt')).to.have.lengthOf(1)
            expect(randalItems.filter(i => i.name == 'Fire Bolt (CON)'), 'missing Fire Bolt (CON)').to.have.lengthOf(1)
          })
        })
      },
      { displayName: 'MAT: Preflight Checks' },
    )
    quench.registerBatch(
      'mat.player',
      (context) => {
        const { describe, it, expect } = context

        const randalToken = canvas.tokens.placeables?.find(t => t.name == 'Randal')
        const randalActor = randalToken?.actor
        const randalItems = randalActor?.items

        describe('Player Attack Bonus', function () {
          it('should handle default prof (str for melee)', function () {
            const longsword = randalItems.find(i => i.name == 'Longsword')
            expect(getAttackBonus(longsword)).to.equal(7)
          })
          it('should handle default prof (dex for ranged)', function () {
            const longbow = randalItems.find(i => i.name == 'Longbow')
            expect(getAttackBonus(longbow)).to.equal(5)
          })
          it('should handle default spell prof (int)', function () {
            const firebolt = randalItems.find(i => i.name == 'Fire Bolt')
            expect(getAttackBonus(firebolt)).to.equal(2)
          })
          it('should handle manually set weapon prof', function () {
            const handaxe_manual_cha = randalItems.find(i => i.name == 'Handaxe (CHA)')
            expect(getAttackBonus(handaxe_manual_cha)).to.equal(3)
          })
          it('should handle manually set spell prof', function () {
            const firebolt_con = randalItems.find(i => i.name == 'Fire Bolt (CON)')
            expect(getAttackBonus(firebolt_con)).to.equal(5)
          })
          it('should handle not prof', function () {
            const handaxe_no_prof = randalItems.find(i => i.name == 'Handaxe (No Prof)')
            expect(getAttackBonus(handaxe_no_prof)).to.equal(4)
          })
          it('should handle "none" prof', function () {
            const handaxe_attribute_none = randalItems.find(i => i.name == 'Handaxe (None)')
            expect(getAttackBonus(handaxe_attribute_none)).to.equal(3)
          })
          it('should handle to hit bonus', function () {
            const handaxe_bonus_tohit = randalItems.find(i => i.name == 'Handaxe (Bonus ToHit)')
            expect(getAttackBonus(handaxe_bonus_tohit)).to.equal(17)
          })
          it('should handle a flat to hit bonus', function () {
            const handaxe_bonus_tohit = randalItems.find(i => i.name == 'Handaxe (Flat)')
            expect(getAttackBonus(handaxe_bonus_tohit)).to.equal(11)
          })
          it('should handle magic bonus in details', function () {
            const magic_battleaxe = randalItems.find(i => i.name == 'Battleaxe +3')
            expect(getAttackBonus(magic_battleaxe)).to.equal(10)
          })
          it('should handle magical enhancement bonuses', function () {
            const enhanced_handaxe = randalItems.find(i => i.name == 'Handaxe, +1')
            expect(getAttackBonus(enhanced_handaxe)).to.equal(8)
          })
          it('should handle magical enhancement flat attack modified', function () {
            const flat_enhanced_handaxe = randalItems.find(i => i.name == 'Handaxe, +5')
            expect(getAttackBonus(flat_enhanced_handaxe)).to.equal(5)
          })
        })
      },
      { displayName: 'MAT: Player Character Checks' },
    )
  })
}

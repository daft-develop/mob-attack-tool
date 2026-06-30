import { expectAbilityScores, expectBattleaxeDetails, expectItemCount, getTokenByName } from './helpers.js'
import { systemEqualOrNewerThan } from '../versions.js'

export function registerPreflightBatch(quench) {
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
        const randalToken = getTokenByName('Randal')
        const randalActor = randalToken?.actor
        const randalItems = randalActor?.items
        it('should have one and only one Randal on the Canvas', function () {
          expect(canvas.tokens.placeables.filter(t => t.name == 'Randal')).to.have.lengthOf(1)
        })
        it('should have Randal at level 5', function () {
          expect(randalActor.system.details.level).to.equal(5)
        })
        it('should have Extra Attack', function () {
          expect(randalActor.items.filter(i => i.name == 'Extra Attack')).to.have.lengthOf(1)
        })
        it('should have Abilities set to 18/14/15/9/13/11', function () {
          expectAbilityScores(expect, randalActor, [18, 14, 15, 9, 13, 11])
        })
        it('should have all test equipment', function () {
          expectItemCount(expect, randalItems, 'Longsword', 1, 'missing Longsword')
          expectItemCount(expect, randalItems, 'Longbow', 1, 'missing Longbow')
          expectItemCount(expect, randalItems, 'Handaxe (CHA)', 1, 'missing Handaxe (CHA)')
          expectItemCount(expect, randalItems, 'Handaxe (No Prof)', 1, 'missing Handaxe (No Prof) Not Proficient')
          expectItemCount(expect, randalItems, 'Handaxe (None)', 1, 'missing Handaxe (None) attribute set to none')
          expectItemCount(expect, randalItems, 'Handaxe (Bonus ToHit)', 1, 'missing Handaxe (Bonus ToHit) with +10 bonus')
          expectItemCount(expect, randalItems, 'Handaxe (Flat)', 1, 'missing Handaxe (Flat) with flat +5 bonus')
          expectItemCount(expect, randalItems, 'Handaxe, No Damage Type', 1, 'missing Handaxe, No Damage Type')
          expectItemCount(expect, randalItems, 'Handaxe, +1', 1, 'missing Handaxe, +1 with magical enchantment bonus')
          expectItemCount(expect, randalItems, 'Handaxe, +5', 1, 'missing Handaxe, +5 with magical flat bonus')
          expectItemCount(expect, randalItems, 'Battleaxe +3', 1, 'missing SRD Battleaxe +3 with details bonus')
          expectBattleaxeDetails(expect, randalItems, 'Battleaxe +3')
          expectItemCount(expect, randalItems, 'Fire Bolt', 1, 'missing default Fire Bolt')
          expectItemCount(expect, randalItems, 'Fire Bolt (CON)', 1, 'missing Fire Bolt (CON)')
        })
      })

      describe('Sefris setup', function () {
        const sefrisToken = getTokenByName('Sefris')
        const sefrisActor = sefrisToken?.actor
        it('should have one and only one Sefris on the Canvas', function () {
          expect(canvas.tokens.placeables.filter(t => t.name == 'Sefris')).to.have.lengthOf(1)
        })
        it('should have Sefris at level 5', function () {
          expect(sefrisActor.system.details.level).to.equal(5)
        })
        it('should have Eldritch Blast', function () {
          expect(sefrisActor.items.filter(i => i.name == 'Eldritch Blast')).to.have.lengthOf(1)
        })
        it('should have Abilities set to 18/14/15/9/13/11', function () {
          expectAbilityScores(expect, sefrisActor, [12, 14, 15, 10, 8, 20])
        })
      })

      describe('Skeleton setup', function () {
        const skeletonToken = getTokenByName('Skeleton')
        const skeletonActor = skeletonToken?.actor
        const skeletonItems = skeletonActor?.items
        it('should have one and only one Skeleton on the Canvas', function () {
          expect(canvas.tokens.placeables.filter(t => t.name == 'Skeleton')).to.have.lengthOf(1)
        })
        it('should have Skeleton CR of 1/4', function () {
          expect(skeletonActor.system.details.cr).to.equal(0.25)
        })
        it('should have Abilities set to 18/14/15/9/13/11', function () {
          expectAbilityScores(expect, skeletonActor, [10, 14, 15, 6, 8, 5])
        })
        it('should have all test equipment', function () {
          expectItemCount(expect, skeletonItems, 'Longsword', 1, 'missing Longsword')
          expectItemCount(expect, skeletonItems, 'Longbow', 1, 'missing Longbow')
          expectItemCount(expect, skeletonItems, 'Handaxe (CHA)', 1, 'missing Handaxe (CHA)')
          expectItemCount(expect, skeletonItems, 'Handaxe (No Prof)', 1, 'missing Handaxe (No Prof) Not Proficient')
          expectItemCount(expect, skeletonItems, 'Handaxe (None)', 1, 'missing Handaxe (None) attribute set to none')
          expectItemCount(expect, skeletonItems, 'Handaxe (Bonus ToHit)', 1, 'missing Handaxe (Bonus ToHit) with +10 bonus')
          expectItemCount(expect, skeletonItems, 'Handaxe (Flat)', 1, 'missing Handaxe (Flat) with flat +5 bonus')
          expectItemCount(expect, skeletonItems, 'Handaxe, No Damage Type', 1, 'missing Handaxe, No Damage Type')
          expectItemCount(expect, skeletonItems, 'Handaxe, +1', 1, 'missing Handaxe, +1 with magical enchantment bonus')
          expectItemCount(expect, skeletonItems, 'Handaxe, +5', 1, 'missing Handaxe, +5 with magical flat bonus')
          expectItemCount(expect, skeletonItems, 'Battleaxe +3', 1, 'missing SRD Battleaxe +3 with details bonus')
          expectBattleaxeDetails(expect, skeletonItems, 'Battleaxe +3')
          expectItemCount(expect, skeletonItems, 'Fire Bolt', 1, 'missing default Fire Bolt')
          expectItemCount(expect, skeletonItems, 'Fire Bolt (CON)', 1, 'missing Fire Bolt (CON)')
        })
      })

      describe('Archmage setup', function () {
        const archmageToken = getTokenByName('Archmage')
        const archmageActor = archmageToken?.actor
        const archmageItems = archmageActor?.items
        it('should have all test equipment', function () {
          expectItemCount(expect, archmageItems, 'Fire Bolt', 1, 'missing Fire Bolt')
        })
      })
    },
    { displayName: 'MAT: Preflight Checks' },
  )
}

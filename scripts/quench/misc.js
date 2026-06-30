import { simplifyFormula } from '../utils.js'
import { foundryEqualOrNewerThan, systemEqualOrNewerThan } from '../versions.js'

export function registerMiscBatch(quench) {
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

      describe('Formula Simplification', function () {
        it('should simplify formulas correctly', function () {
          expect(simplifyFormula('1d6'), 'no simplification, die').to.equal('1d6')
          expect(simplifyFormula('3'), 'simple simplification, pos const').to.equal('3')
          expect(simplifyFormula('-3'), 'simple simplification, neg const').to.equal(' - 3')
          expect(simplifyFormula('1d6 + 3'), 'simplify + 3').to.equal('1d6 + 3')
          expect(simplifyFormula('1d6+3'), 'simplify + 3').to.equal('1d6 + 3')
          expect(simplifyFormula('1d6 +3'), 'simplify + 3').to.equal('1d6 + 3')
          expect(simplifyFormula('1d6 + 0'), 'simplify + 0').to.equal('1d6')
          expect(simplifyFormula('1d6 + -3'), 'simplify + -3').to.equal('1d6 - 3')
          expect(simplifyFormula('1d6 - -3'), 'simplify - -3').to.equal('1d6 + 3')
          expect(simplifyFormula('1d6 + +3'), 'simplify + +3').to.equal('1d6 + 3')
          expect(simplifyFormula('-3 + 1d6-1d4-3'), 'spacing on leading -').to.equal('1d6 - 1d4 - 6')
          expect(simplifyFormula('1d6 + 4 + 1d4 + -3'), 'simplify + 4 + 1d4 + -3').to.equal('1d6 + 1d4 + 1')
          expect(simplifyFormula('2 + 1d6 + (2 + -3)'), 'simplify with brackets').to.equal('1d6 + 1')
          expect(simplifyFormula('2[ice] + 1d4[fire] + 1d6[ice]'), 'simplify with flavor').to.equal('1d4[fire] + 1d6[ice] + 2[ice]')
        })
      })
    },
    { displayName: 'MAT: Misc Tests' },
  )
}

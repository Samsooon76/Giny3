import { describe, expect, it } from 'vitest'
import { decodePattern, effectPatternParams } from './patternDecoder'

describe('decodePattern', () => {
  it('fills a min–max damage line and drops the optional when only one value', () => {
    expect(decodePattern('#1{{~1~2 à }}#2 dommages Feu', [17, 20])).toBe('17 à 20 dommages Feu')
    expect(decodePattern('#1{{~1~2 à }}#2 dommages Feu', [17])).toBe('17 dommages Feu')
  })

  it('keeps the signed optional body used on characteristic maluses', () => {
    expect(decodePattern('-#1{{~1~2 à -}}#2 Force', [40])).toBe('-40 Force')
    expect(decodePattern('-#1{{~1~2 à -}}#2 Force', [10, 15])).toBe('-10 à -15 Force')
  })

  it('adds the French plural s from {{~ps}}', () => {
    expect(decodePattern('Repousse de #1 case{{~ps}}', [1])).toBe('Repousse de 1 case')
    expect(decodePattern('Repousse de #1 case{{~ps}}', [2])).toBe('Repousse de 2 cases')
  })

  it('strips UITK sprite tags and ignores empty slots', () => {
    expect(
      decodePattern('#1{{~1~2 à }}#2% <sprite name="PV"> PV du lanceur', [10]),
    ).toBe('10% PV du lanceur')
  })
})

describe('effectPatternParams', () => {
  it('uses diceNum..diceSide when both are set, else a single value', () => {
    expect(effectPatternParams({ diceNum: 17, diceSide: 20, value: 0 })).toEqual([17, 20, undefined])
    expect(effectPatternParams({ diceNum: 40, diceSide: 0, value: 0 })).toEqual([40, undefined, undefined])
    expect(effectPatternParams({ diceNum: 0, diceSide: 0, value: 5 })).toEqual([5, undefined, undefined])
  })
})

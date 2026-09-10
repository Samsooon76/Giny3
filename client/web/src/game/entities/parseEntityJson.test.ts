import { describe, expect, it } from 'vitest'
import { parseEntityJson } from './parseEntityJson'
describe('legacy entity JSON', () => {
  it('accepts missing bounds without altering names or valid coordinates', () => {
    expect(parseEntityJson('{"name":"NaN and Infinity","bounds":[NaN,Infinity,-Infinity,12.5]}'))
      .toEqual({ name: 'NaN and Infinity', bounds: [null, null, null, 12.5] })
  })
  it('still rejects corrupt JSON', () => {
    expect(() => parseEntityJson('{"bounds":')).toThrow()
  })
})

import { expect, it } from 'vitest'
import { parseServerCharacters } from './serverCharacters'
it('accepts several real portraits and rejects malformed and duplicate entries', () => {
  const first = { id: 1, name: 'Féca', look: '{1|10}' }, second = { id: 2, name: 'Iop', look: '{1|20}' }
  expect(parseServerCharacters({ servers: [{ id: 50, characters: [first, second, first, { id: 3, look: 4 }, null] }] }).get(50)).toEqual([first, second])
  expect(parseServerCharacters(null).size).toBe(0)
})

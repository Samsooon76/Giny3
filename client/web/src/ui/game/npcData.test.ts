import { expect, it } from 'vitest'
import { npcPrice, npcText } from './npcData'
it('renders dialog parameters literally without executable catalogue markup', () => {
  expect(npcText('Bonjour #1.<br/><b>Choisissez</b> &amp; partez.', ['<img src=x>'])).toBe('Bonjour <img src=x>.\nChoisissez & partez.')
  expect(npcText('#2 #1', ['$&'])).toBe('#2 $&')
})
it('matches purchase/sale rounding and disables invalid or overflowing quantities', () => {
  expect(npcPrice(15, 3)).toBe(45); expect(npcPrice(15, 3, true)).toBe(4)
  expect(npcPrice(1, 1, true)).toBe(1)
  for (const quantity of [0, -1, NaN, 1.5, 2147483647]) expect(npcPrice(10, quantity)).toBeNull()
})

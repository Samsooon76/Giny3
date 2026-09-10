import { expect, it, beforeEach } from 'vitest'
import { creationSpellPairs, creationSpellTiles, creationSpellTile } from './creationSpellTiles'
import { hydrateCatalog, resetCatalog } from './catalog'
import type { CreationSpell } from '../../giny/types'
const spell = (id: number): CreationSpell => ({ id, name: `Sort ${id}`, description: 'Description complète', icon_id: id, icon: `spells/${id}.png`, ap_cost: 3, min_range: 1, range: 4, critical_hit: 15, effects: ['Dommages Terre'] })
beforeEach(() => resetCatalog())
it('joins actual variant partners without mixing classes or dropping unpaired spells', () => {
  hydrateCatalog({ spells: { '2': { id: 2, name: 'Variante', iconId: 2 } }, spellVariants: {
    '10': { id: 10, breedId: 1, spellIds: [1, 2] }, '11': { id: 11, breedId: 2, spellIds: [8, 9] },
  } })
  const pairs = creationSpellPairs([spell(1), spell(3)], 1)
  expect(pairs.map(pair => pair.map(s => s.id))).toEqual([[1, 2], [3]])
  const tiles = creationSpellTiles(pairs)
  expect(tiles[0].repeaters?.gd_spellButtons.map(tile => tile.key)).toEqual(['1', '2'])
  expect(creationSpellPairs([], 3)).toEqual([])
})
it('retains the native tooltip with the spell details and readable description', () => {
  const tile = creationSpellTile(spell(1))
  expect(tile.tooltip?.tree).toBe('SpellTooltip')
  expect(tile.tooltip?.resolve?.('lbl_spellName')?.text).toBe('Sort 1')
  expect(tile.tooltip?.resolve?.('lbl_description')?.style?.whiteSpace).toBe('normal')
  expect(tile.tooltip?.resolve?.('lbl_apValue')?.text).toBe('3')
})

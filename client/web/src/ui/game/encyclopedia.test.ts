import { expect, it } from 'vitest'
import { filterMonsters, ITEM_CATEGORIES, type Monster } from './encyclopedia'

const rows: Monster[] = [
  { id: 1, name: 'Bouftou Nuageux', race: 10, subareas: [445], look: '', grades: [], drops: [] },
  { id: 2, name: 'Boufton Orageux', race: 10, subareas: [445, 446], look: '', grades: [], drops: [] },
  { id: 3, name: 'Tofu', race: 20, subareas: [446], look: '', grades: [], drops: [] },
]
it('combines territory, family and trimmed case-insensitive search without mutating the catalogue', () => {
  expect(filterMonsters(rows, ' BOUF ', 445, 10).map(row => row.id)).toEqual([2, 1])
  expect(filterMonsters(rows, '', 446, 20).map(row => row.id)).toEqual([3])
  expect(filterMonsters(rows, 'tofu', 445, null)).toEqual([])
  expect(rows.map(row => row.id)).toEqual([1, 2, 3])
})
it('maps cosmetics to category 5, not quest items category 3', () => {
  expect(ITEM_CATEGORIES).toEqual([0, 1, 2, 5])
})

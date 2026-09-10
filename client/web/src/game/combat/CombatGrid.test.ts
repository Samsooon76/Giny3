import { expect, it } from 'vitest'
import { CellGrid } from '../cells/CellGrid'
import { combatAdjacency, combatNeighbours, combatPath, reachableCells } from './CombatGrid'
import type { WebMapData } from '../maps/types'
import type { CombatSnapshot } from '../../giny/combatState'
// Grid built in screen coordinates to exercise the actual cell geometry, not a mocked neighbour list.
const positions = [[0,0],[43,21.5],[86,0],[43,-21.5],[86,43]]
const grid = new CellGrid({ id: 1, cells: positions.map(([x,y],cellId) => ({ cellId,x,y:-y,mov:1,los:1,visible:1,nonWalkableDuringFight:0,nonWalkableDuringRp:0 })) } as WebMapData)
const state = { controlled_id: 1, fighters: [{ id: 1, cell: 0, mp: 2, alive: true }] } as CombatSnapshot
it('tactical neighbours share an edge, never just a corner', () => {
  expect(combatNeighbours(grid, 0).sort()).toEqual([1,3])
})
it('respects fight-only obstacles, occupied cells and PM budget', () => {
  expect(combatPath(grid, state, 4)).toEqual([0,1,4])
  grid.cells[1].nonWalkableDuringFight = 1
  expect(combatPath(grid, state, 4)).toEqual([])
  grid.cells[1].nonWalkableDuringFight = 0
  expect(combatPath(grid, { ...state, fighters: [{ ...state.fighters[0], mp: 1 }] }, 4)).toEqual([])
  expect(combatPath(grid, { ...state, fighters: [...state.fighters, { id: 2, cell: 1, alive: true } as CombatSnapshot['fighters'][number]] }, 4)).toEqual([])
})
it('caches one adjacency table per map and exposes the full preview', () => {
  expect(combatAdjacency(grid)).toBe(combatAdjacency(grid))
  expect([...reachableCells(grid, state).entries()].sort()).toEqual([[1,1],[2,2],[3,1],[4,2]])
  // Zero PM reaches nothing; the start cell itself is never listed.
  expect(reachableCells(grid, { ...state, fighters: [{ ...state.fighters[0], mp: 0 }] }).size).toBe(0)
})

import { expect, it } from 'vitest'
import { CellGrid, cellIdToWorld, HALF_CELL_HEIGHT, HALF_CELL_WIDTH } from './CellGrid'
import type { WebMapData } from '../maps/types'

it('picks the visible diamond interior, including points near all four edges', () => {
  const grid = new CellGrid({ id: 1, cells: Array.from({ length: 560 }, (_, cellId) => {
    const point = cellIdToWorld(cellId)
    return { cellId, x: point.x, y: -point.y, mov: 1, los: 1 }
  }) } as WebMapData)
  for (let id = 0; id < 560; id++) {
    const center = grid.cellToWorld(id)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      // The previous 2% padding let a closer neighbouring centre steal these.
      for (const [x, y] of [[.79, .2], [.2, .79], [.49, .5], [0, 0]]) {
        expect(grid.worldToCell({ x: center.x + sx * x * HALF_CELL_WIDTH, y: center.y + sy * y * HALF_CELL_HEIGHT })).toBe(id)
      }
    }
  }
})

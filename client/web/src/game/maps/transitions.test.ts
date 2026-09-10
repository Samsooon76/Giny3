import { describe, expect, it } from 'vitest'
import { resolveMapTransition } from './transitions'
import type { WebMapData } from './types'

function mapWithChange(mapChangeData: number): WebMapData {
  return {
    format: 'test', id: 10, sourceBundle: '', backgroundColorU32: 0,
    columns: 14, rows: 40,
    neighbours: { top: 11, bottom: 12, left: 13, right: 14 },
    cells: [
      { cellId: 0, x: -1, y: 1, mov: 1, los: 1, speed: 0, moveZone: 0, linkedZone: 0, mapChangeData, visible: 1, nonWalkableDuringFight: 0, nonWalkableDuringRp: 0, floor: 0 },
      { cellId: 1, x: 1, y: -1, mov: 1, los: 1, speed: 0, moveZone: 0, linkedZone: 0, mapChangeData: 0, visible: 1, nonWalkableDuringFight: 0, nonWalkableDuringRp: 0, floor: 0 },
    ],
    walkableCells: [0, 1], elements: [], props: [], gfx: {}, missingGfx: [],
  }
}

describe('map transitions', () => {
  it.each([
    [1, 'right', 14],
    [4, 'bottom', 12],
    [16, 'left', 13],
    [64, 'top', 11],
    [224, 'top', 11],
  ] as const)('decodes change mask %i', (mask, direction, mapId) => {
    expect(resolveMapTransition(mapWithChange(mask), 0)).toEqual({ direction, mapId })
  })

  it('uses the final facing for a corner with two exits', () => {
    expect(resolveMapTransition(mapWithChange(64 | 16), 0, 4)).toEqual({ direction: 'left', mapId: 13 })
  })

  it('ignores missing neighbours and ordinary cells', () => {
    const map = mapWithChange(1)
    map.neighbours.right = 0
    expect(resolveMapTransition(map, 0)).toBeNull()
    expect(resolveMapTransition(map, 1)).toBeNull()
  })
})

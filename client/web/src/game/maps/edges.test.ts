import { describe, expect, it } from 'vitest'
import { CellGrid } from '../cells/CellGrid'
import { buildMapEdges, findEdgeHover } from './edges'
import type { MapCell, WebMapData } from './types'

const CHANGE = { right: 1, bottom: 4, left: 16, top: 64 }

/** 14 x 40 map whose four borders are all map-change cells. */
function fullMap(): WebMapData {
  const cells: MapCell[] = []
  for (let id = 0; id < 560; id += 1) {
    const row = Math.floor(id / 14)
    const column = id % 14
    let mapChangeData = 0
    if (column === 0) mapChangeData |= CHANGE.left
    if (column === 13) mapChangeData |= CHANGE.right
    if (row === 0) mapChangeData |= CHANGE.top
    if (row === 39) mapChangeData |= CHANGE.bottom
    cells.push({
      cellId: id,
      x: -580.5 + column * 86 + (row & 1) * 43,
      y: 483.75 - row * 21.5,
      mov: 1, los: 1, speed: 0, moveZone: 0, linkedZone: 0,
      mapChangeData, visible: 1, nonWalkableDuringFight: 0, nonWalkableDuringRp: 0, floor: 0,
    })
  }
  return {
    format: 'test', id: 1, sourceBundle: '', backgroundColorU32: 0, columns: 14, rows: 40,
    neighbours: { top: 11, bottom: 12, left: 13, right: 14 },
    cells, walkableCells: cells.map((cell) => cell.cellId), elements: [], props: [], gfx: {}, missingGfx: [],
  }
}

describe('map edges', () => {
  const map = fullMap()
  const grid = new CellGrid(map)
  const index = buildMapEdges(map, grid)

  it('groups the map-change cells of every border', () => {
    expect(index.edges.map((edge) => edge.direction).sort()).toEqual(['bottom', 'left', 'right', 'top'])
    expect(index.edges.find((edge) => edge.direction === 'right')?.mapId).toBe(14)
    // 40 rows minus the corner cells, which advertise two exits and are
    // resolved to the geometrically closest border.
    expect(index.edges.find((edge) => edge.direction === 'right')?.cells.length).toBeGreaterThanOrEqual(38)
  })

  it('keeps pointing at a border past the edge of the map', () => {
    const far = findEdgeHover(index, grid, { x: index.bounds.maxX + 900, y: 0 })
    expect(far?.edge.direction).toBe('right')
    expect(grid.getCell(far!.cellId)?.mapChangeData).toBe(CHANGE.right)
  })

  it('walks to the border cell closest to the pointer', () => {
    const target = grid.cellToWorld(13 + 14 * 20)
    const hover = findEdgeHover(index, grid, { x: target.x + 400, y: target.y })
    expect(hover?.cellId).toBe(13 + 14 * 20)
  })

  it('reports nothing at the centre of the map', () => {
    expect(findEdgeHover(index, grid, { x: 0, y: 0 })).toBeNull()
  })

  it('prefers the closest border in a corner', () => {
    const corner = grid.cellToWorld(13)
    expect(findEdgeHover(index, grid, { x: corner.x + 600, y: corner.y })?.edge.direction).toBe('right')
    expect(findEdgeHover(index, grid, { x: corner.x, y: corner.y - 600 })?.edge.direction).toBe('top')
  })
})

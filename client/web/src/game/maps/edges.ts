import { HALF_CELL_HEIGHT, HALF_CELL_WIDTH, type CellGrid, type WorldPoint } from '../cells/CellGrid'
import { resolveMapTransition, type MapTransitionDirection } from './transitions'
import type { WebMapData } from './types'

export type MapEdge = {
  direction: MapTransitionDirection
  mapId: number
  /** Walkable map-change cells forming that border, ordered along the edge. */
  cells: number[]
}

export type MapEdgeIndex = {
  edges: MapEdge[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export type EdgeHover = {
  edge: MapEdge
  /** Border cell closest to the pointer: the one the character walks to. */
  cellId: number
}

/**
 * Width of the border strip, in cells. The pointer triggers a border as soon as
 * it enters that strip, and keeps triggering it however far outside the map it
 * goes, so aiming past the edge — over the neighbour map — still works.
 */
const BAND_CELLS = 1.5

/** Group every reachable map-change cell of a map by border. */
export function buildMapEdges(map: WebMapData, grid: CellGrid): MapEdgeIndex {
  const byDirection = new Map<MapTransitionDirection, MapEdge>()
  for (const cell of map.cells) {
    if (cell.mapChangeData === 0 || !grid.isWalkable(cell.cellId)) {
      continue
    }
    const transition = resolveMapTransition(map, cell.cellId)
    if (!transition) {
      continue
    }
    const existing = byDirection.get(transition.direction)
    if (existing) {
      existing.cells.push(cell.cellId)
    } else {
      byDirection.set(transition.direction, {
        direction: transition.direction,
        mapId: transition.mapId,
        cells: [cell.cellId],
      })
    }
  }
  const edges = [...byDirection.values()]
  for (const edge of edges) {
    const horizontal = edge.direction === 'left' || edge.direction === 'right'
    edge.cells.sort((a, b) => {
      const pa = grid.cellToWorld(a)
      const pb = grid.cellToWorld(b)
      return horizontal ? pa.y - pb.y : pa.x - pb.x
    })
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of grid.worldPositions) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { edges, bounds: { minX, minY, maxX, maxY } }
}

/** Border aimed at by the pointer, if any, plus the cell to walk to. */
export function findEdgeHover(index: MapEdgeIndex, grid: CellGrid, world: WorldPoint): EdgeHover | null {
  const { bounds } = index
  const bandX = BAND_CELLS * HALF_CELL_WIDTH * 2
  const bandY = BAND_CELLS * HALF_CELL_HEIGHT * 2
  let best: { edge: MapEdge; overshoot: number } | null = null
  for (const edge of index.edges) {
    let overshoot: number
    switch (edge.direction) {
      case 'left':
        overshoot = (bounds.minX + bandX - world.x) / bandX
        break
      case 'right':
        overshoot = (world.x - (bounds.maxX - bandX)) / bandX
        break
      case 'top':
        overshoot = (bounds.minY + bandY - world.y) / bandY
        break
      default:
        overshoot = (world.y - (bounds.maxY - bandY)) / bandY
        break
    }
    if (overshoot > 0 && (!best || overshoot > best.overshoot)) {
      best = { edge, overshoot }
    }
  }
  if (!best) {
    return null
  }
  return { edge: best.edge, cellId: nearestCell(best.edge, grid, world) }
}

/**
 * Cell of the border facing the pointer. Only the position *along* the border
 * matters: a border zigzags by half a cell, so ranking on the straight-line
 * distance would jump between rows as the pointer moves away from the map.
 */
function nearestCell(edge: MapEdge, grid: CellGrid, world: WorldPoint): number {
  const horizontal = edge.direction === 'left' || edge.direction === 'right'
  let cellId = edge.cells[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of edge.cells) {
    const point = grid.cellToWorld(candidate)
    const along = horizontal
      ? Math.abs(world.y - point.y) / HALF_CELL_HEIGHT
      : Math.abs(world.x - point.x) / HALF_CELL_WIDTH
    if (along < bestDistance) {
      bestDistance = along
      cellId = candidate
    }
  }
  return cellId
}

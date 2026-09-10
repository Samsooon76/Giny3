import type { WebMapData } from './types'

export type MapTransitionDirection = 'top' | 'bottom' | 'left' | 'right'

export type MapTransition = {
  direction: MapTransitionDirection
  mapId: number
}

const CHANGE_MASK: Record<MapTransitionDirection, number> = {
  right: 1,
  bottom: 4,
  left: 16,
  top: 64,
}

const FACING_DIRECTION: Partial<Record<number, MapTransitionDirection>> = {
  0: 'right',
  2: 'bottom',
  4: 'left',
  6: 'top',
}

/** Resolve the official neighbour reached through a map-change cell. */
export function resolveMapTransition(
  map: WebMapData,
  cellId: number,
  facing = -1,
): MapTransition | null {
  const cell = map.cells[cellId]
  if (!cell) return null

  const candidates = (Object.keys(CHANGE_MASK) as MapTransitionDirection[])
    .filter((direction) => (cell.mapChangeData & CHANGE_MASK[direction]) !== 0)
    .filter((direction) => Number.isInteger(map.neighbours[direction]) && map.neighbours[direction] > 0)

  if (candidates.length === 0) return null
  if (candidates.length === 1) {
    const direction = candidates[0]
    return { direction, mapId: map.neighbours[direction] }
  }

  const movementDirection = FACING_DIRECTION[facing]
  if (movementDirection && candidates.includes(movementDirection)) {
    return { direction: movementDirection, mapId: map.neighbours[movementDirection] }
  }

  // Corner cells can advertise two exits. If the final movement was diagonal,
  // choose the geometrically closest edge, as the official client does.
  const xs = map.cells.map((item) => item.x)
  const ys = map.cells.map((item) => item.y)
  const edges: Record<MapTransitionDirection, number> = {
    left: Math.abs(cell.x - Math.min(...xs)),
    right: Math.abs(Math.max(...xs) - cell.x),
    bottom: Math.abs(cell.y - Math.min(...ys)),
    top: Math.abs(Math.max(...ys) - cell.y),
  }
  const direction = candidates.reduce((best, item) => edges[item] < edges[best] ? item : best)
  return { direction, mapId: map.neighbours[direction] }
}

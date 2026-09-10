import { isWalkableCell } from '../maps/adapter'
import type { MapCell, WebMapData } from '../maps/types'

export const MAP_COLUMNS = 14
export const MAP_ROWS = 40
export const CELL_COUNT = 560
export const HALF_CELL_WIDTH = 43
export const HALF_CELL_HEIGHT = 21.5

export type WorldPoint = {
  x: number
  y: number
}

export class CellGrid {
  readonly mapId: number
  readonly cells: MapCell[]
  readonly worldPositions: WorldPoint[]
  readonly walkable: boolean[]

  constructor(map: WebMapData) {
    this.mapId = map.id
    this.cells = map.cells
    this.worldPositions = map.cells.map((cell) => unityToPixi(cell.x, cell.y))
    this.walkable = map.cells.map((cell) => isWalkableCell(cell))
  }

  getCell(cellId: number): MapCell | undefined {
    if (cellId < 0 || cellId >= this.cells.length) {
      return undefined
    }
    return this.cells[cellId]
  }

  isWalkable(cellId: number): boolean {
    return this.walkable[cellId] === true
  }

  cellToWorld(cellId: number): WorldPoint {
    return this.worldPositions[cellId] ?? { x: 0, y: 0 }
  }

  worldToCell(world: WorldPoint): number {
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (let id = 0; id < this.worldPositions.length; id += 1) {
      const center = this.worldPositions[id]
      if (!insideDiamond(world, center)) {
        continue
      }
      const dx = world.x - center.x
      const dy = world.y - center.y
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = id
      }
    }
    return best
  }

  /** Dofus 0..7 from world delta (Pixi Y-down): 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE. */
  directionBetween(fromCell: number, toCell: number): number {
    const from = this.cellToWorld(fromCell)
    const to = this.cellToWorld(toCell)
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (dx === 0 && dy === 0) {
      return -1
    }
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
    return ((sector % 8) + 8) % 8
  }

  /** The cells touching `cellId`. Dofus adjacency is diagonal on screen: the
      four cells at (±43, ±21.5) share an edge, the four at (±86, 0) / (0, ±43)
      share a corner. Off-map offsets simply resolve to nothing. */
  neighbours(cellId: number): number[] {
    const center = this.cellToWorld(cellId)
    const offsets: Array<[number, number]> = [
      [HALF_CELL_WIDTH, HALF_CELL_HEIGHT],
      [HALF_CELL_WIDTH, -HALF_CELL_HEIGHT],
      [-HALF_CELL_WIDTH, HALF_CELL_HEIGHT],
      [-HALF_CELL_WIDTH, -HALF_CELL_HEIGHT],
      [HALF_CELL_WIDTH * 2, 0],
      [-HALF_CELL_WIDTH * 2, 0],
      [0, HALF_CELL_HEIGHT * 2],
      [0, -HALF_CELL_HEIGHT * 2],
    ]
    const result: number[] = []
    for (const [dx, dy] of offsets) {
      const id = this.worldToCell({ x: center.x + dx, y: center.y + dy })
      if (id >= 0 && id !== cellId && !result.includes(id)) {
        result.push(id)
      }
    }
    return result
  }

  firstWalkable(): number {
    const mid = Math.floor(this.cells.length / 2)
    if (this.isWalkable(mid)) {
      return mid
    }
    for (let offset = 1; offset < this.cells.length; offset += 1) {
      const left = mid - offset
      const right = mid + offset
      if (left >= 0 && this.isWalkable(left)) {
        return left
      }
      if (right < this.cells.length && this.isWalkable(right)) {
        return right
      }
    }
    return -1
  }
}

/** Fractional grid row of a world Y, used to depth-sort moving entities. */
export function rowFromWorldY(worldY: number): number {
  return (worldY + 483.75) / HALF_CELL_HEIGHT
}

/**
 * Depth key of the sortable layer: one bucket per isometric row, subdivided by
 * the official inner render order. Entities take the middle of their bucket.
 */
export function sortableZIndex(row: number, innerOrder: number): number {
  return Math.round(row * 1000) + Math.min(Math.max(innerOrder, 0), 999)
}

export function cellIdToWorld(cellId: number): WorldPoint {
  const row = Math.floor(cellId / MAP_COLUMNS)
  const column = cellId % MAP_COLUMNS
  const x = -580.5 + column * 86 + (row & 1) * 43
  const y = 483.75 - row * 21.5
  return unityToPixi(x, y)
}

export function unityToPixi(x: number, y: number): WorldPoint {
  return { x, y: -y }
}

export function insideDiamond(point: WorldPoint, center: WorldPoint): boolean {
  const dx = Math.abs(point.x - center.x) / HALF_CELL_WIDTH
  const dy = Math.abs(point.y - center.y) / HALF_CELL_HEIGHT
  // Only floating-point tolerance: a padded diamond steals points from its neighbours.
  return dx + dy <= 1 + 1e-9
}

export function diamondPoints(center: WorldPoint): WorldPoint[] {
  return [
    { x: center.x, y: center.y - HALF_CELL_HEIGHT },
    { x: center.x + HALF_CELL_WIDTH, y: center.y },
    { x: center.x, y: center.y + HALF_CELL_HEIGHT },
    { x: center.x - HALF_CELL_WIDTH, y: center.y },
  ]
}

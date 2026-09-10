import { spellPreview } from './SpellPreview'
import { HALF_CELL_HEIGHT, HALF_CELL_WIDTH, type CellGrid } from '../cells/CellGrid'
import type { CombatSnapshot } from '../../giny/combatState'
import type { HudSpell } from '../../giny/types'

export function combatNeighbours(grid: CellGrid, cell: number): number[] {
  const p = grid.cellToWorld(cell)
  return grid.neighbours(cell).filter(id => {
    const q = grid.cellToWorld(id)
    return Math.abs(Math.abs(p.x - q.x) - HALF_CELL_WIDTH) < 1 && Math.abs(Math.abs(p.y - q.y) - HALF_CELL_HEIGHT) < 1
  })
}
/** Four-neighbour tactical adjacency, built once per map instead of scanning
    the whole grid on every hover. Shares the official cell geometry. */
const adjacencyCache = new WeakMap<CellGrid, Map<number, number[]>>()
export function combatAdjacency(grid: CellGrid): Map<number, number[]> {
  const cached = adjacencyCache.get(grid)
  if (cached) return cached
  const table = new Map<number, number[]>()
  for (const cell of grid.cells) table.set(cell.cellId, combatNeighbours(grid, cell.cellId))
  adjacencyCache.set(grid, table)
  return table
}
export function tacticalDistance(grid: CellGrid, from: number, to: number): number {
  const a = grid.cellToWorld(from), b = grid.cellToWorld(to)
  const dx = (b.x - a.x) / (HALF_CELL_WIDTH * 2), dy = (b.y - a.y) / (HALF_CELL_HEIGHT * 2)
  return Math.round(Math.abs(dx + dy) + Math.abs(dx - dy))
}
/** All cells reachable with the available MP and their walk cost. Preview only:
    Giny validates obstacles, tackle, states and spell history. Tackle losses
    are deliberately excluded here (unknown without the server); the preview
    never debits anything. */
export function reachableCells(grid: CellGrid, state: CombatSnapshot): Map<number, number> {
  const reached = new Map<number, number>()
  const me = state.fighters.find(f => f.id === state.controlled_id)
  if (!me || me.cell < 0) return reached
  const occupied = new Set(state.fighters.filter(f => f.alive && f.id !== me.id && f.cell >= 0).map(f => f.cell))
  const adjacency = combatAdjacency(grid)
  const queue = [me.cell]
  reached.set(me.cell, 0)
  for (const cell of queue) {
    const cost = reached.get(cell)!
    if (cost >= me.mp) continue
    for (const next of adjacency.get(cell) ?? []) {
      const c = grid.getCell(next)
      if (!c || c.mov !== 1 || c.nonWalkableDuringFight || occupied.has(next) || reached.has(next)) continue
      reached.set(next, cost + 1); queue.push(next)
    }
  }
  reached.delete(me.cell)
  return reached
}
export function combatPath(grid: CellGrid, state: CombatSnapshot, goal: number): number[] {
  const me = state.fighters.find(f => f.id === state.controlled_id)
  if (!me || goal === me.cell) return []
  const occupied = new Set(state.fighters.filter(f => f.alive && f.id !== me.id && f.cell >= 0).map(f => f.cell))
  const adjacency = combatAdjacency(grid)
  const parents = new Map<number, number>([[me.cell, -1]]), queue = [{ cell: me.cell, cost: 0 }]
  for (const node of queue) {
    if (node.cell === goal) { const path = [goal]; while (parents.get(path[0]) !== -1) path.unshift(parents.get(path[0])!); return path }
    if (node.cost >= me.mp) continue
    for (const cell of adjacency.get(node.cell) ?? []) {
      const c = grid.getCell(cell)
      if (!c || c.mov !== 1 || c.nonWalkableDuringFight || occupied.has(cell) || parents.has(cell)) continue
      parents.set(cell, node.cell); queue.push({ cell, cost: node.cost + 1 })
    }
  }
  return []
}
/** Shared Bubble targeting adapter; callers never maintain a second LOS rule. */
export function spellCells(grid: CellGrid, state: CombatSnapshot, spell: HudSpell): number[] {
  return spellPreview(grid, state, spell, -1).allowed
}

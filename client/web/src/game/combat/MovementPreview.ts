import type { CombatFighter, CombatSnapshot } from '../../giny/combatState'
import type { CellGrid } from '../cells/CellGrid'
import { combatAdjacency } from './CombatGrid'

export type MovementPreview = { reachable: number[]; path: number[]; tackledPath: number[]; unreachablePath: number[]; endCell: number; apLost: number; mpLost: number; uncertain: boolean }
// Giny uses Math.Round's ties-to-even, rather than JavaScript's ties-up.
export function roundLoss(value: number): number { const n = Math.floor(value); return value - n === .5 ? n + (n % 2) : Math.round(value) }
export function tackleLoss(grid: CellGrid, state: CombatSnapshot, me: CombatFighter, cell: number) {
  if (me.can_be_tackled === false || me.invisible) return { ap: 0, mp: 0, uncertain: false }
  const adjacent = combatAdjacency(grid).get(cell) ?? []
  const enemies = state.fighters.filter(f => f.alive && f.team !== me.team && f.can_tackle !== false && !f.invisible && adjacent.includes(f.cell))
  if (!enemies.length) return { ap: 0, mp: 0, uncertain: false }
  if (me.tackle_evade == null || enemies.some(f => f.tackle_block == null)) return { ap: 0, mp: 0, uncertain: true }
  const retained = enemies.reduce((value, f) => value * (me.tackle_evade! + 2) / (2 * (f.tackle_block! + 2)), 1)
  const lost = retained > 0 && retained < 1 ? 1 - retained : 0
  return { ap: Math.min(me.ap, Math.max(0, roundLoss(me.ap * lost))), mp: Math.min(me.mp, Math.max(0, roundLoss(me.mp * lost))), uncertain: false }
}

/** Bubble's presentation groups, with Giny's authoritative tackle rules:
 * pay the initial escape, then stop upon entering another tackling contact.
 * This model never changes the snapshot or sends a resource debit. */
export function movementPreview(grid: CellGrid, state: CombatSnapshot, goal = -1): MovementPreview {
  const result: MovementPreview = { reachable: [], path: [], tackledPath: [], unreachablePath: [], endCell: -1, apLost: 0, mpLost: 0, uncertain: false }
  const me = state.fighters.find(f => f.id === state.controlled_id)
  if (!me || !me.alive || me.cell < 0 || me.can_move === false || me.carried) return result
  const occupied = new Set(state.fighters.filter(f => f.alive && f.id !== me.id && f.cell >= 0).map(f => f.cell))
  const adjacency = combatAdjacency(grid)
  const initial = tackleLoss(grid, state, me, me.cell)
  result.apLost = initial.ap; result.mpLost = initial.mp; result.uncertain = initial.uncertain
  const budget = Math.max(0, me.mp - initial.mp)
  const walkable = (id: number) => { const c = grid.getCell(id); return c?.mov === 1 && !c.nonWalkableDuringFight && !occupied.has(id) }
  const costs = new Map([[me.cell, 0]]), queue = [me.cell]
  const parents = new Map([[me.cell, -1]])
  for (const cell of queue) {
    const cost = costs.get(cell)!
    if (cost >= budget) continue
    const contact = tackleLoss(grid, state, me, cell)
    if (cell !== me.cell && (contact.ap > 0 || contact.mp > 0)) continue
    for (const next of adjacency.get(cell) ?? []) {
      if (!walkable(next) || costs.has(next)) continue
      costs.set(next, cost + 1); parents.set(next, cell); queue.push(next)
    }
  }
  result.reachable = queue.slice(1)
  if (goal < 0 || goal === me.cell) return result
  // Find a geometric route even beyond the budget to draw its red tail.
  const routeParents = costs.has(goal) ? parents : new Map([[me.cell, -1]])
  if (!costs.has(goal)) {
    const all = [me.cell]
    for (const cell of all) {
      if (cell === goal) break
      for (const next of adjacency.get(cell) ?? []) if (walkable(next) && !routeParents.has(next)) { routeParents.set(next, cell); all.push(next) }
    }
  }
  if (!routeParents.has(goal)) return result
  const path = [goal]
  while (routeParents.get(path[0]) !== -1) path.unshift(routeParents.get(path[0])!)
  let stopped = false
  result.path = [me.cell]; result.endCell = me.cell
  for (let i = 1; i < path.length; i++) {
    const prior = tackleLoss(grid, state, me, path[i - 1])
    if (i > budget || (i > 1 && (prior.ap > 0 || prior.mp > 0))) stopped = true
    result.uncertain ||= prior.uncertain
    if (stopped) result.unreachablePath.push(path[i])
    else { result.path.push(path[i]); result.endCell = path[i]; if (initial.ap || initial.mp) result.tackledPath.push(path[i]) }
  }
  return result
}

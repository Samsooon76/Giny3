import type { CellGrid } from '../cells/CellGrid'
import type { CombatSnapshot } from '../../giny/combatState'
import type { HudSpell } from '../../giny/types'
import { spellLevel } from '../../ui/game/catalog'
import { lineOfSight, parseZone, pointCell, rangePoints, zoneCells } from './bubbleSpellGeometry'

export function resolvePreviewSpell(spell: HudSpell): HudSpell {
  const level = spellLevel(spell.id, spell.grade)
  return { ap_cost: level?.apCost, min_range: level?.minRange, range: level?.range,
    cast_in_line: level?.castInLine, cast_in_diagonal: level?.castInDiagonal, cast_test_los: level?.castTestLos,
    preview_zones: level?.effects?.map(e => e.rawZone ?? (e.zoneDescr ? `${String.fromCharCode(e.zoneDescr.shape)}${e.zoneDescr.param1},${e.zoneDescr.param2}` : 'P')), ...spell }
}
export function spellPreview(grid: CellGrid, state: CombatSnapshot, raw: HudSpell, target: number) {
  const spell = resolvePreviewSpell(raw), caster = state.fighters.find(f => f.id === state.controlled_id)
  const allowed: number[] = [], blocked: number[] = [], area: number[] = []
  if (!caster || caster.cell < 0) return { allowed, blocked, area, valid: false }
  const occupied = new Set(state.fighters.filter(f => f.alive && f.cell >= 0).map(f => f.cell))
  const losCells = grid.cells.map(c => ({ l: c.los ? 2 : 0 }))
  for (const [x, y] of rangePoints(caster.cell, { range: spell.range ?? 1, minRange: spell.min_range ?? 0, castInLine: spell.cast_in_line, castInDiagonal: spell.cast_in_diagonal })) {
    const id = pointCell(x, y)
    if (id === undefined) continue
    const cell = grid.getCell(id)
    if (!cell || cell.mov !== 1 || cell.nonWalkableDuringFight) continue
    const legal = !(spell.need_free_cell && occupied.has(id)) && !(spell.need_taken_cell && !occupied.has(id)) &&
      (!spell.cast_test_los || lineOfSight(losCells, caster.cell, id, occupied))
    ;(legal ? allowed : blocked).push(id)
  }
  const valid = allowed.includes(target)
  if (valid) for (const rawZone of spell.preview_zones?.length ? spell.preview_zones : ['P']) {
    for (const id of zoneCells(parseZone(rawZone), caster.cell, target)) {
      const c = grid.getCell(id)
      if (c?.mov === 1 && !c.nonWalkableDuringFight && !area.includes(id)) area.push(id)
    }
  }
  return { allowed, blocked, area, valid }
}

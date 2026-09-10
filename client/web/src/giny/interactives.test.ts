import { describe, expect, it } from 'vitest'
import { Writer } from './binary'
import { CellGrid } from '../game/cells/CellGrid'
import { cellIdToWorld } from '../game/cells/CellGrid'
import {
  parseInteractiveElementUpdated,
  parseInteractiveUseEnded,
  parseInteractiveUseError,
  parseInteractiveUsed,
  parseStatedElementUpdated,
} from './parsers'
import type { MapCell, WebMapData } from '../game/maps/types'

describe('interactive messages', () => {
  it('reads InteractiveUsed', () => {
    const payload = new Writer().varUInt(1).varUInt(489338).varUInt(114).varUInt(35).u8(1).finish()
    expect(parseInteractiveUsed(payload)).toEqual({
      kind: 'used', actorId: 1, elementId: 489338, skillId: 114, duration: 35, canMove: true,
    })
  })

  it('reads InteractiveUseEnded', () => {
    const payload = new Writer().varUInt(489701).varUInt(68).finish()
    expect(parseInteractiveUseEnded(payload)).toEqual({ kind: 'ended', elementId: 489701, skillId: 68 })
  })

  it('reads InteractiveUseError', () => {
    const payload = new Writer().varUInt(489324).varUInt(0).finish()
    expect(parseInteractiveUseError(payload)).toEqual({ kind: 'error', elementId: 489324 })
  })

  /** `InteractiveElement`: two ints, then the enabled and disabled skill
      lists, each entry prefixed by its own protocol type id. */
  it('reads InteractiveElementUpdated and treats an empty enabled list as unusable', () => {
    const enabled = new Writer().i32(489701).i32(254)
      .u16(1).u16(2087).varUInt(68).i32(0)
      .u16(0)
      .u8(1).finish()
    expect(parseInteractiveElementUpdated(enabled)).toEqual({
      kind: 'element', elementId: 489701, elementTypeId: 254, enabled: true,
    })

    const disabled = new Writer().i32(489701).i32(254)
      .u16(0)
      .u16(1).u16(2087).varUInt(68).i32(0)
      .u8(1).finish()
    expect(parseInteractiveElementUpdated(disabled)).toMatchObject({ enabled: false })
  })

  it('reads StatedElementUpdated', () => {
    const payload = new Writer().i32(489701).varUInt(342).varUInt(2).u8(1).finish()
    expect(parseStatedElementUpdated(payload)).toEqual({
      kind: 'stated', elementId: 489701, cellId: 342, state: 2,
    })
  })
})

function grid(): CellGrid {
  const cells: MapCell[] = []
  for (let id = 0; id < 560; id += 1) {
    const world = cellIdToWorld(id)
    cells.push({
      cellId: id, x: world.x, y: -world.y, mov: 1, los: 1, speed: 0, moveZone: 0,
      linkedZone: 0, mapChangeData: 0, visible: 1, nonWalkableDuringFight: 0,
      nonWalkableDuringRp: 0, floor: 0,
    })
  }
  return new CellGrid({ id: 1, cells } as unknown as WebMapData)
}

describe('cell adjacency', () => {
  it('finds the eight cells touching a mid-map cell', () => {
    const neighbours = grid().neighbours(300)
    expect(neighbours).toHaveLength(8)
    expect(new Set(neighbours).size).toBe(8)
    expect(neighbours).not.toContain(300)
  })

  it('drops the offsets that fall outside the map', () => {
    // Cell 0 is the top-left corner: half of its ring is off-map.
    expect(grid().neighbours(0).length).toBeLessThan(8)
  })
})

import { describe, expect, it } from 'vitest'
import { slotInterior } from './slot'
import type { VisualTreeNode } from './types'

const empty: VisualTreeNode = { type: 'Slot', children: [{ binding: 'itemTile_container', children: [
  { binding: 'itemTile_icon', children: [{ binding: 'itemTile_icon_Vector', sprite: 'hat' }] },
] }] }

describe('shared item slot constructor', () => {
  it('replaces the empty equipment icon with an item without mutating the cached prototype', () => {
    const occupied = slotInterior(empty, '/items/hat.png', 1)
    expect(occupied[0].children?.[0].binding).toBe('itemTile_asset')
    expect(occupied[0].children?.[0].children?.[0].sprite).toBe('/items/hat.png')
    expect(slotInterior(empty)[0].children?.[0].binding).toBe('itemTile_icon')
    expect(empty.children?.[0].children?.[0].binding).toBe('itemTile_icon')
  })
  it('anchors stack counts to the bottom right and removes them for single items', () => {
    const quantity = slotInterior(empty, '/items/apple.png', 8)[0].children?.[1]
    expect(quantity?.text).toBe('8')
    expect(quantity?.style).toMatchObject({ left: 'auto', top: 'auto', right: 4, bottom: 2 })
    expect(slotInterior(empty, '/items/apple.png', 1)[0].children).toHaveLength(1)
  })
})

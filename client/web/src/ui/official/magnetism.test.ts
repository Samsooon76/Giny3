import { describe, expect, it } from 'vitest'
import {
  MAGNET_THRESHOLD,
  dockedEdges,
  resizeRect,
  snapMove,
  snapResize,
  type MagnetTarget,
} from './magnetism'
import { OFFICIAL_CANVAS } from './surface'

const bounds = OFFICIAL_CANVAS

describe('window magnetism', () => {
  it('lands a window on the canvas edge it was dropped next to', () => {
    const { rect, guides } = snapMove({ x: 5, y: 300, w: 400, h: 244 }, { bounds })
    expect(rect.x).toBe(0)
    expect(guides.some((guide) => guide.axis === 'x' && guide.at === 0)).toBe(true)
  })

  it('snaps the bottom edge to the bottom of the canvas', () => {
    const { rect } = snapMove({ x: 600, y: bounds.height - 250, w: 400, h: 244 }, { bounds })
    expect(rect.y + rect.h).toBe(bounds.height)
  })

  it('joins the facing edge of a window that is magnetic for others', () => {
    const targets: MagnetTarget[] = [{ id: 'ActionBar', rect: { x: 636, y: 990, w: 648, h: 90 } }]
    const { rect, guides } = snapMove({ x: 636 + 648 + 7, y: 990, w: 200, h: 90 }, { bounds, targets })
    expect(rect.x).toBe(targets[0].rect.x + targets[0].rect.w)
    expect(guides.some((guide) => guide.axis === 'x' && guide.at === targets[0].rect.x + targets[0].rect.w)).toBe(true)
  })

  it('keeps the gap an official xMagneticOffset asks for', () => {
    const targets: MagnetTarget[] = [{ id: 'Tracking', rect: { x: 400, y: 100, w: 200, h: 200 } }]
    const { rect } = snapMove({ x: 606, y: 100, w: 120, h: 120 }, { bounds, targets, offset: { x: 8, y: 0 } })
    expect(rect.x).toBe(608)
  })

  it('never lands a window that opts out of magnetism', () => {
    const { rect, guides } = snapMove({ x: 5, y: 300, w: 400, h: 244 }, { bounds, threshold: -1 })
    expect(rect.x).toBe(5)
    expect(guides).toEqual([])
  })

  it('ignores a neighbour that is not magnetic for others', () => {
    const { rect } = snapMove({ x: 700, y: 300, w: 200, h: 100 }, { bounds, targets: [] })
    expect(rect.x).toBe(700)
  })

  it('only moves the dragged edges when resizing', () => {
    const resized = resizeRect({ x: 100, y: 100, w: 300, h: 200 }, ['e', 's'], 40, -30)
    expect(resized).toEqual({ x: 100, y: 100, w: 340, h: 170 })
  })

  it('holds the anchored edge while the west grip snaps to the canvas', () => {
    const start = { x: 9, y: 200, w: 400, h: 300 }
    const { rect } = snapResize(resizeRect(start, ['w'], -4, 0), ['w'], { bounds })
    expect(rect.x).toBe(0)
    expect(rect.x + rect.w).toBe(start.x + start.w)
  })

  it('quantises a resize without letting the anchored edge drift', () => {
    const start = { x: 1000, y: 100, w: 400, h: 300 }
    const { rect } = snapResize(resizeRect(start, ['w'], -37, 0), ['w'], {
      bounds,
      quantize: (width, height) => ({ width: Math.round(width / 36) * 36, height }),
    })
    expect(rect.x + rect.w).toBe(1400)
    expect(rect.w % 36).toBe(0)
  })

  it('leaves room above a window whose title bar sits outside its box', () => {
    const { rect } = snapMove({ x: 400, y: 6, w: 300, h: 200 }, { bounds, insetTop: 45 })
    expect(rect.y).toBe(45)
  })

  it('reports the canvas edges a window has settled against', () => {
    expect(dockedEdges({ x: 0, y: 55, w: 42, h: 276 }, bounds)).toEqual(['w'])
    expect(dockedEdges({ x: bounds.width - 42, y: 0, w: 42, h: 276 }, bounds)).toEqual(['n', 'e'])
  })

  it('never snaps beyond the official threshold', () => {
    const away = MAGNET_THRESHOLD + 1
    const { rect } = snapMove({ x: away, y: 300, w: 400, h: 244 }, { bounds })
    expect(rect.x).toBe(away)
  })
})

import { describe, expect, it } from 'vitest'
import {
  BANNER_MIN_PX,
  bannerQuantizer,
  bannerSeed,
  gridForSize,
  sizeForGrid,
  snapBannerSize,
} from './bannerGeometry'
import { resizeRect, snapResize } from '../official/magnetism'
import { OFFICIAL_CANVAS } from '../official/surface'

describe('bannerMenu grid', () => {
  it('opens as the reference 9×3 grid with room for all 24 menus', () => {
    const seed = bannerSeed()
    expect(seed).toEqual({
      x: 1200,
      y: 183,
      w: 292,
      h: 124,
    })
    expect(gridForSize(seed.w, seed.h)).toEqual({ cols: 9, rows: 3 })
  })

  it('snaps a 4×4 MENUS window the way the official client titles it [4, 4]', () => {
    const size = sizeForGrid(4, 4)
    expect(gridForSize(size.width, size.height)).toEqual({ cols: 4, rows: 4 })
    expect(snapBannerSize(size.width + 10, size.height + 8)).toMatchObject({ cols: 4, rows: 4, ...size })
  })

  it('grows a right-docked strip leftward when the west edge is dragged', () => {
    const strip = sizeForGrid(1, 6)
    const start = { x: OFFICIAL_CANVAS.width - strip.width, y: 55, w: strip.width, h: strip.height }
    const dx = -(sizeForGrid(4, 7).width - start.w)
    const { rect } = snapResize(resizeRect(start, ['w'], dx, 0), ['w'], {
      bounds: OFFICIAL_CANVAS,
      quantize: bannerQuantizer,
      minWidth: BANNER_MIN_PX,
      minHeight: BANNER_MIN_PX,
    })
    expect(gridForSize(rect.w, rect.h)).toEqual({ cols: 4, rows: 6 })
    expect(rect.x + rect.w).toBe(OFFICIAL_CANVAS.width)
  })

  it('keeps the right dock when stretching south', () => {
    const strip = sizeForGrid(1, 6)
    const start = { x: OFFICIAL_CANVAS.width - strip.width, y: 55, w: strip.width, h: strip.height }
    const dy = sizeForGrid(1, 10).height - start.h
    const { rect } = snapResize(resizeRect(start, ['s'], 0, dy), ['s'], {
      bounds: OFFICIAL_CANVAS,
      quantize: bannerQuantizer,
      minWidth: BANNER_MIN_PX,
      minHeight: BANNER_MIN_PX,
    })
    expect(rect.x).toBe(start.x)
    expect(rect.x + rect.w).toBe(OFFICIAL_CANVAS.width)
    expect(gridForSize(rect.w, rect.h)).toEqual({ cols: 1, rows: 10 })
  })
})

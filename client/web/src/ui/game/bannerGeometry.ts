/** Banner grid at the density measured in the official screenshot.
 * The host preset opens a 9×3 menu; manual resizes keep using whole slots. */

import type { Rect, SizeQuantizer } from '../official/magnetism'
import { OFFICIAL_CANVAS } from '../official/surface'
import { HUD_LAYOUT } from './hudLayout'

export const BANNER_SLOT_PX = 32
export const BANNER_PAD_PX = 4
/** USS `.header.widget.horizontal.large { height: 24px }`. */
export const BANNER_HEADER_PX = 24
export const BANNER_MIN_PX = 42
export const BANNER_USS_WIDTH = 42
export const BANNER_USS_HEIGHT = 249
export const BANNER_DEFAULT_TOP = 55

export type BannerGrid = { cols: number; rows: number }

export function sizeForGrid(cols: number, rows: number): { width: number; height: number } {
  const columns = Math.max(1, Math.round(cols))
  const lines = Math.max(1, Math.round(rows))
  return {
    width: Math.max(BANNER_MIN_PX, columns * BANNER_SLOT_PX + BANNER_PAD_PX),
    height: Math.max(BANNER_MIN_PX, lines * BANNER_SLOT_PX + BANNER_PAD_PX + BANNER_HEADER_PX),
  }
}

export function gridForSize(width: number, height: number): BannerGrid {
  const cols = Math.max(1, Math.round((width - BANNER_PAD_PX) / BANNER_SLOT_PX))
  const rows = Math.max(1, Math.round((height - BANNER_PAD_PX - BANNER_HEADER_PX) / BANNER_SLOT_PX))
  return { cols, rows }
}

export function snapBannerSize(width: number, height: number): { width: number; height: number } & BannerGrid {
  const grid = gridForSize(width, height)
  return { ...grid, ...sizeForGrid(grid.cols, grid.rows) }
}

/** The quantiser the window controller applies to every banner gesture. */
export const bannerQuantizer: SizeQuantizer = (width, height) => snapBannerSize(width, height)

/** Same opening rectangle as the window controller, before any saved resize. */
export function bannerSeed(bounds = OFFICIAL_CANVAS): Rect {
  return {
    ...HUD_LAYOUT.BannerMenu,
    x: HUD_LAYOUT.BannerMenu.x * bounds.width / OFFICIAL_CANVAS.width,
    y: HUD_LAYOUT.BannerMenu.y * bounds.height / OFFICIAL_CANVAS.height,
  }
}

import type { Rect } from '../official/magnetism'

/** Host placements measured from the supplied official capture, expressed in
 * the 1920×1080 game surface, excluding the native title bar. The extracted
 * USS contains editor defaults, not this in-game widget arrangement. */
export const HUD_LAYOUT: Record<string, Rect> = {
  Smiley: { x: 0, y: 540, w: 390, h: 278 },
  QuestList: { x: 1, y: 145, w: 225, h: 120 },
  Chat: { x: 0, y: 830, w: 495, h: 250 },
  CharacterInformations: { x: 495, y: 950, w: 145, h: 130 },
  ActionBar: { x: 640, y: 935, w: 635, h: 85 },
  widgetProgressGauge: { x: 640, y: 1020, w: 635, h: 60 },
  CartographyBanner: { x: 1395, y: 860, w: 525, h: 220 },
  BannerMenu: { x: 1200, y: 183, w: 292, h: 124 },
}

export const HUD_LAYOUT_VERSION = 'official-capture-2026-09-07'

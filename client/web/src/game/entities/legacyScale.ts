import type { ParsedLook } from './types'

/** Standard breed scales in the 2.68 server snapshot versus the Dofus 3.6
 * breeds catalogue (game-data/data/breeds.json), keyed by the base skin.
 * Existing characters retain their old Look even after breeds are imported.
 * Only exact legacy defaults are translated: custom sizes, transformed bones,
 * monsters, props and already migrated players retain their requested scale. */
const LEGACY_BREED_SCALES: Record<number, readonly [number, number]> = {
  10: [135, 53], 11: [125, 52], 20: [130, 50], 21: [125, 48],
  30: [120, 43], 31: [95, 43], 40: [140, 55], 41: [155, 52],
  50: [110, 43], 51: [110, 43], 60: [150, 58], 61: [150, 57],
  70: [110, 43], 71: [115, 43], 80: [140, 55], 81: [140, 53],
  90: [140, 53], 91: [135, 52], 100: [150, 58], 101: [145, 55],
  110: [145, 55], 111: [140, 53], 120: [160, 57], 121: [145, 53],
  1405: [160, 58], 1407: [155, 55], 1437: [150, 53], 1438: [145, 52],
  1663: [160, 53], 1664: [160, 52], 3179: [145, 53], 3180: [140, 52],
  3285: [140, 53], 3286: [135, 52], 3498: [155, 58], 3499: [145, 57],
  3221: [155, 55], 3633: [150, 53],
}

export function normalizeLegacyPlayerScale(look: ParsedLook | null): ParsedLook | null {
  if (!look || look.boneId !== 1 || look.scales.length !== 1) return look
  const scales = LEGACY_BREED_SCALES[look.skinIds[0]]
  if (!scales || look.scales[0] !== scales[0]) return look
  // Keep raw as the server identity/cache key; this is a rendering conversion.
  return { ...look, scales: [scales[1]], scale: scales[1] / 100 }
}

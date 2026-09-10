import { describe, expect, it } from 'vitest'
import { previewSize } from './entityFraming'

describe('entity camera framing', () => {
  it('keeps the top of the look inside a portrait for both tall and wide looks', () => {
    for (const [width, height] of [[150, 500], [400, 500]]) {
      const framed = previewSize('portrait', 96, 96, width, height)
      expect(framed.baseline - height * framed.scale).toBeCloseTo(5.76)
      expect(framed.scale).toBeGreaterThan(0)
    }
  })
  it('keeps full-body previews within the host when resized', () => {
    for (const side of [96, 300]) {
      const framed = previewSize('fit', side, side, 200, 500)
      expect(500 * framed.scale).toBeLessThanOrEqual(side)
      expect(framed.baseline).toBeLessThanOrEqual(side)
    }
  })
})

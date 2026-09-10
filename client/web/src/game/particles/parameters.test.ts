import { describe, expect, it } from 'vitest'
import { color, curve, keyCurve, rotate, materialTexturePath } from './parameters'
describe('authored particle parameters', () => {
  it('resolves noise references without taking a particle with the same ID', () => {
    const block = { dissolveTexID: 1, _textures: [
      { id: 1, category: 'particles', field: 'dissolveTexID', path: 'effects/particles/1.png' },
      { id: 1, category: 'noises', field: 'noiseTexID', path: 'effects/noises/1.png' },
    ] }
    expect(materialTexturePath(block, 'dissolveTexID', 'noises')).toBe('effects/noises/1.png')
    expect(materialTexturePath({ ...block, _textures: block._textures.slice(0, 1) }, 'dissolveTexID', 'noises')).toBeUndefined()
    expect(materialTexturePath({ ...block, dissolveTexID: -1 }, 'dissolveTexID', 'noises')).toBeUndefined()
  })
  it('keeps signed constants and interpolates the documented curve modes', () => {
    expect(curve({ mode: 0, constantMax: -86 })).toBe(-86)
    expect(curve({ mode: 3, constantMin: 6, constantMax: 15 }, 0, .5)).toBe(10.5)
    const linear = { keys: [{ time: 0, value: 0, outTangent: 1 }, { time: 1, value: 1, inTangent: 1 }] }
    expect(curve({ mode: 1, constantMax: 10, curveMax: linear }, .25)).toBeCloseTo(2.5)
    expect(keyCurve(linear, -1)).toBe(0); expect(keyCurve(linear, 2)).toBe(1)
    expect(keyCurve({ keys: [{ time: 0, value: 3, outTangent: 'Infinity' }, { time: 1, value: 9 }] }, .5)).toBe(3)
  })
  it('uses ARGB colours and independent lifetime alpha gradients', () => {
    expect(color({ mode: 0, colorMax: { value: 0x80402010 } })).toEqual([64 / 255, 32 / 255, 16 / 255, 128 / 255])
    expect(color({ mode: 1, gradientMax: { alphaKeys: [{ time: 0, alpha: 0 }, { time: 1, alpha: 1 }] } }, .5)).toEqual([1, 1, 1, .5])
  })
  it('projects rotated authored 3D shapes into the map plane', () => {
    const point = rotate(1, 0, 0, { x: 0, y: 0, z: 90 })
    expect(point.x).toBeCloseTo(0); expect(point.y).toBeCloseTo(1)
  })
})

import { describe, expect, it } from 'vitest'
import { adaptMapDocument } from '../maps/adapter'
import { CURRENT_EFFECTS_VERSION } from './types'

describe('effects contract', () => {
  it('treats missing effect fields as neutral', () => {
    const map = adaptMapDocument({
      id: 1,
      cells: Array.from({ length: 560 }, (_, id) => ({ id, mov: 1, visible: 1, non_walkable_during_rp: 0 })),
      elements: [{ gfx_id: 1, layer: 'background' }],
      gfx: { 1: { texture: 'gfx/1.png', width: 8, height: 8 } },
    })
    expect(map.effectsVersion).toBeUndefined()
    expect(map.environment).toBeUndefined()
    expect(map.elements[0].blend).toBe('normal')
  })

  it('marks unknown blends on versioned documents instead of drawing them as normal', () => {
    const map = adaptMapDocument({
      id: 2,
      effects_version: CURRENT_EFFECTS_VERSION,
      cells: [],
      elements: [{ gfx_id: 1, layer: 'sortable', blend: 'burn' }],
    })
    expect(map.elements[0].blend).toBe('unsupported')
  })

  it('keeps pre-version documents mapping unknown blends to normal', () => {
    const map = adaptMapDocument({
      id: 3,
      cells: [],
      elements: [{ gfx_id: 1, layer: 'sortable', blend: 'burn' }],
    })
    expect(map.elements[0].blend).toBe('normal')
  })

  it('preserves qualified texture dependencies and refraction host layer', () => {
    const map = adaptMapDocument({
      id: 54162245,
      effects_version: 1,
      cells: [],
      elements: [],
      refraction: [{
        gfx_id: 57971,
        host_material_layer: 'foreground',
        material_index: 4,
        transform: { m11: 1.2, m32: 20 },
        parameters: { ShaderRefractionParameters: { strength: 8.6, noiseTexID: 1 } },
      }],
      effect_dependencies: [
        { category: 'noises', id: 1, path: 'effects/noises/1.png' },
        { category: 'particles', id: 1, path: 'effects/particles/1.png' },
      ],
    })
    expect(map.refraction?.[0].hostMaterialLayer).toBe('foreground')
    expect(map.refraction?.[0].transform.m11).toBe(1.2)
    expect(map.effectDependencies?.map((item) => item.path)).toEqual([
      'effects/noises/1.png',
      'effects/particles/1.png',
    ])
  })

  it('diagnoses a future effects version', () => {
    const map = adaptMapDocument({
      id: 9,
      effects_version: CURRENT_EFFECTS_VERSION + 3,
      cells: [],
      elements: [],
    })
    expect(map.effectCoverage?.unknownVersion).toBe(CURRENT_EFFECTS_VERSION + 3)
    expect(map.effectCoverage?.complete).toBe(false)
    expect(map.effectCoverage?.issues.some((issue) => issue.family === 'schema')).toBe(true)
  })
})

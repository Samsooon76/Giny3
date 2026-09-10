import { describe, expect, it } from 'vitest'
import { adaptMapDocument } from './adapter'

const cell = (id: number) => ({
  id, x: 0, y: 0, mov: 1, los: 1, visible: 1, non_walkable_during_rp: 0,
})

describe('adaptMapDocument', () => {
  it('reads gfx from either gfx or gfx_catalog', () => {
    const fromGfx = adaptMapDocument({
      id: 1,
      cells: Array.from({ length: 560 }, (_, index) => cell(index)),
      elements: [],
      gfx: { '10': { texture: 'gfx/10.png', width: 8, height: 8 } },
    })
    expect(fromGfx.gfx['10'].texture).toBe('gfx/10.png')

    const fromCatalog = adaptMapDocument({
      id: 2,
      cells: Array.from({ length: 560 }, (_, index) => cell(index)),
      elements: [],
      gfx_catalog: { '11': { texture: 'gfx/11.png', width: 4, height: 4 } },
    })
    expect(fromCatalog.gfx['11'].texture).toBe('gfx/11.png')
  })

  it('keeps extractor-shaped interactive props', () => {
    const adapted = adaptMapDocument({
      id: 154644,
      cells: [cell(0)],
      elements: [],
      props: [
        {
          kind: 'interactive',
          interaction_id: 435481,
          cell_id: 170,
          gfx_id: 19725,
          prop_id: 19725,
          static: true,
          transform: { m11: -1, m12: 0, m21: 0, m22: 1, m31: -439.5, m32: 296.75 },
          color_u32: 4286677377,
          display_behaviour: 0,
          inner_cell_render_order: 1,
        },
        {
          kind: 'animated',
          interaction_id: 491165,
          cell_id: 545,
          gfx_id: 1839,
          static: false,
          transform: { m11: 1, m12: 0, m21: 0, m22: 1, m31: 881.5, m32: -333.25 },
          play_animation: 0,
        },
      ],
    })
    expect(adapted.props).toHaveLength(2)

    const door = adapted.props[0]
    expect(door.interactionId).toBe(435481)
    expect(door.cellId).toBe(170)
    expect(door.propId).toBe(19725)
    expect(door.static).toBe(true)
    expect(door.transform).toEqual({
      m11: -1, m12: 0, m21: 0, m22: 1, m31: -439.5, m32: 296.75,
    })

    const ore = adapted.props[1]
    expect(ore.interactionId).toBe(491165)
    expect(ore.cellId).toBe(545)
    expect(ore.propId).toBe(1839)
    expect(ore.static).toBe(false)
    expect(ore.kind).toBe('animated')
  })

  it('keeps versioned effect fields and reports an unknown future version', () => {
    const adapted = adaptMapDocument({
      id: 154644,
      effects_version: 99,
      environment: { wind: { active: true, parameters: { windPower: 0.5 } } },
      effect_dependencies: [{ category: 'noises', id: 500, path: 'effects/noises/500.png' }],
      cells: [cell(0)],
      elements: [],
    })
    expect(adapted.environment?.wind.active).toBe(true)
    expect(adapted.effectDependencies?.[0].category).toBe('noises')
    expect(adapted.effectCoverage?.unknownVersion).toBe(99)
  })
})

it('does not trust stale prepared coverage to claim unimplemented visual effects', () => {
  const families = ['wave_config', 'noise_config', 'postprocess_config', 'staging_sequences', 'shader_wave', 'pp_bloom',
    'shader_dissolve', 'shader_distortion', 'shader_emissive', 'shader_color_animation', 'shader_texture_offset',
    'shader_outline', 'shader_custom_framerate', 'shader_depth_alpha_clip']
  const map = adaptMapDocument({ id: 1, effects_version: 1, cells: [], elements: [],
    effect_coverage: { families: [...families, 'wind_config'],
      status: Object.fromEntries([...families, 'wind_config'].map(family => [family, 'supported'])),
      issues: [], complete: true },
  })
  expect(map.effectCoverage?.complete).toBe(false)
  expect(map.effectCoverage?.status.wind_config).toBe('supported')
  for (const family of families) {
    expect(map.effectCoverage?.status[family]).toBe(['wave_config', 'shader_wave', 'pp_bloom', 'postprocess_config',
      'staging_sequences', 'shader_dissolve', 'shader_distortion', 'shader_emissive', 'shader_color_animation',
      'shader_texture_offset', 'shader_depth_alpha_clip'].includes(family) ? 'semantics_unknown' : 'render_absent')
    expect(map.effectCoverage?.issues.filter(issue => issue.family === family)).toHaveLength(1)
  }
})


it('upgrades obsolete chromatic renderer coverage without hiding missing source data', () => {
  const adapt = (status: string) => adaptMapDocument({ id: 1, effects_version: 1, cells: [], elements: [],
    effect_coverage: { families: ['pp_chromatic'], status: { pp_chromatic: status },
      issues: [{ family: 'pp_chromatic', status }], complete: false } }).effectCoverage!
  expect(adapt('render_absent').status.pp_chromatic).toBe('supported')
  expect(adapt('render_absent').issues).toEqual([])
  expect(adapt('source_missing').status.pp_chromatic).toBe('source_missing')
  expect(adapt('source_missing').issues).toHaveLength(1)
})

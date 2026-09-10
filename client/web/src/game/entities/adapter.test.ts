import { describe, expect, it } from 'vitest'
import { adaptEntityDocument } from './adapter'

describe('adaptEntityDocument', () => {
  it('keeps v2 look parts and part_ref nodes', () => {
    const entity = adaptEntityDocument({
      format: 'giny.dofus3.entity.v2',
      bone_id: 1,
      scale: 0.53,
      frame_rate: 30,
      parts: {
        'skin/Torse_1': {
          leaves: [
            {
              texture: 'textures/look.webp',
              vertices: [{ x: 1, y: 2, u: 0, v: 1, mul: [1, 1, 1, 1], add: [0, 0, 0, 0] }],
              indices: [0, 1, 2],
            },
          ],
        },
      },
      animations: {
        AnimStatiqueExplo0_1: {
          frames: [
            [
              {
                slot: 12,
                part_ref: 'skin/Torse_1',
                visible: true,
                drawable: true,
                transform: [1, 0, 0, 0, 1, 0],
                color: { multiplicative: [1, 1, 1, 1], additive: [0, 0, 0, 0], alpha: 1 },
              },
            ],
          ],
        },
      },
    })
    expect(entity.parts['skin/Torse_1'].leaves).toHaveLength(1)
    expect(entity.animations.AnimStatiqueExplo0_1.frames[0][0].partRef).toBe('skin/Torse_1')
  })

  it('turns v1 bone chunks and graphic nodes into drawable frames', () => {
    const entity = adaptEntityDocument({
      format: 'giny.dofus3.entity.v1',
      bone_id: 231,
      texture: 'textures/231-0.png',
      parts: {
        '5': {
          name: '5',
          chunks: [
            {
              vertices: [{ x: 0, y: 1, u: 0.2, v: 0.3, mul: [1, 1, 1, 1], add: [0, 0, 0, 0] }],
              indices: [0, 1, 2],
            },
          ],
        },
      },
      animations: {
        AnimStatique_1: {
          frames: [
            [
              { node: 0, tag: 23, drawable: false, transform: [1, 0, 0, 0, 1, 0] },
              {
                node: 6,
                tag: 0x97,
                drawable: true,
                graphic: '5',
                transform: [1, 0, 2, 0, 1, 4],
                color_u32: [0x597f7f7f],
              },
            ],
          ],
        },
      },
    })
    expect(entity.parts['5'].leaves[0].texture).toBe('textures/231-0.png')
    const node = entity.animations.AnimStatique_1.frames[0][0]
    expect(node.partRef).toBe('5')
    expect(node.slot).toBe(6)
    expect(node.transform[2]).toBe(2)
  })

  it('drops animations whose frames have no drawable parts', () => {
    const entity = adaptEntityDocument({
      parts: {},
      animations: {
        AnimStatique_1: {
          frames: [[{ node: 0, drawable: false, transform: [1, 0, 0, 0, 1, 0] }]],
        },
      },
    })
    expect(entity.animations).toEqual({})
  })
})

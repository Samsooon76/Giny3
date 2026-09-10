import { Texture, TextureSource, textureBitGl, type GlProgram } from 'pixi.js'
import { expect, it } from 'vitest'
import {
  ACTOR_RECOLOR_BIT,
  ACTOR_RECOLOR_BITS,
  ActorRecolorShader,
  NEUTRAL_ACTOR_RECOLOR,
  NEUTRAL_RECOLOR,
  createActorRecolorUniforms,
  isNeutralRecolor,
  recolorToUniform,
  setActorRecolorUniform,
} from './ActorRecolor'

it('turns authored percentages into the shader multipliers', () => {
  // +100% saturation doubles it, -50% brightness halves it, and the grey tint
  // is an absolute weight rather than a relative change.
  expect(recolorToUniform({ hueShift: 120, saturationPct: 100, brightnessPct: -50, grayTintPct: 40 }))
    .toEqual([120, 2, 0.5, 0.4])
  expect(recolorToUniform(NEUTRAL_ACTOR_RECOLOR)).toEqual(NEUTRAL_RECOLOR)
})

it('clamps a recolour that would invert the art', () => {
  // -200% saturation must desaturate, never re-saturate through a negative
  // multiplier, and the grey tint stays a 0..1 weight.
  expect(recolorToUniform({ hueShift: 0, saturationPct: -200, brightnessPct: -300, grayTintPct: 250 }))
    .toEqual([0, 0, 0, 1])
})

it('treats an all-zero recolour as no recolour at all', () => {
  expect(isNeutralRecolor(null)).toBe(true)
  expect(isNeutralRecolor(NEUTRAL_ACTOR_RECOLOR)).toBe(true)
  expect(isNeutralRecolor({ ...NEUTRAL_ACTOR_RECOLOR, hueShift: 1 })).toBe(false)
  expect(isNeutralRecolor({ ...NEUTRAL_ACTOR_RECOLOR, grayTintPct: 10 })).toBe(false)
})

it('recolours the texel after it is sampled, before the node tint', () => {
  // textureBitGl is what fills outColor; recolouring before it would be
  // overwritten, and after the template's `finalColor = outColor * vColor` it
  // would fight the animation's own colour track.
  expect(ACTOR_RECOLOR_BITS.indexOf(textureBitGl)).toBeLessThan(
    ACTOR_RECOLOR_BITS.indexOf(ACTOR_RECOLOR_BIT),
  )
  expect(ACTOR_RECOLOR_BIT.fragment.main).toContain('applyActorRecolor(straight')
  expect(ACTOR_RECOLOR_BIT.fragment.header).toContain('vec3 applyActorRecolor(')
})

it('unpremultiplies before the HSV shift', () => {
  // Pixi uploads image textures with premultiplied alpha: shifting the
  // premultiplied texel darkens soft edges into a halo.
  expect(ACTOR_RECOLOR_BIT.fragment.main).toContain('outColor.rgb / outColor.a')
})

it('shares one uniform group across the meshes of an actor', () => {
  const uniforms = createActorRecolorUniforms()
  const first = new Texture({ source: new TextureSource({ width: 1, height: 1 }) })
  const second = new Texture({ source: new TextureSource({ width: 1, height: 1 }) })
  const head = new ActorRecolorShader(first, uniforms, {} as GlProgram)
  const torso = new ActorRecolorShader(second, uniforms, {} as GlProgram)

  expect(head.resources.uTexture).toBe(first.source)
  expect(torso.resources.uTexture).toBe(second.source)
  expect(head.resources.recolorUniforms).toBe(torso.resources.recolorUniforms)
  head.setColorAdd([.1, .2, -.3, 0])
  expect(Array.from(torso.resources.nodeColorUniforms.uniforms.uNodeAdd as Float32Array)).toEqual([0, 0, 0])
  head.setColorAdd([0, 0, 0, 0])
  expect(Array.from(head.resources.nodeColorUniforms.uniforms.uNodeAdd as Float32Array)).toEqual([0, 0, 0])

  setActorRecolorUniform(uniforms, recolorToUniform({ hueShift: 90, saturationPct: 0, brightnessPct: 0, grayTintPct: 0 }))
  expect(Array.from(head.resources.recolorUniforms.uniforms.uRecolor as Float32Array)).toEqual([90, 1, 1, 0])

  // A pooled mesh reused for another leaf assigns mesh.texture, which Pixi
  // forwards to the shader: the sampler has to follow.
  head.texture = second
  expect(head.resources.uTexture).toBe(second.source)

  head.destroy()
  torso.destroy()
  first.destroy(true)
  second.destroy(true)
})

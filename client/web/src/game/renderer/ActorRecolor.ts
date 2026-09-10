import {
  Shader,
  UniformGroup,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl,
  textureBitGl,
  type GlProgram,
  type Texture,
  type TextureShader,
} from 'pixi.js'

/**
 * Per-actor recolouring, the way the official client tints a monster.
 *
 * Dofus 3 does not ship a second texture for a recoloured variant: the live
 * pixel shader shifts the sampled texel in HSV from four values authored on
 * the monster (`HueShift`, `SaturationPct`, `BrightnessPct`, `GrayTintPct`),
 * which is how archimonsters are drawn from the ordinary monster art. Sampled
 * from the Bubble client, whose GLSL is a commented translation of the live
 * DXBC pixel shader — see `client/dofus3/docs/bubble-shaders/02-frag.glsl`
 * (`applyActorRecolor`, `uRecolor`).
 *
 * Swapping textures instead of shifting hue is what makes a recoloured monster
 * come out in its base colours.
 */

/** Below this saturation a texel counts as grey, and `grayTint` may paint it. */
export const ACHROMATIC_SATURATION = 0.12

/** Hue 0°, saturation ×1, brightness ×1, no grey tint: the texel is untouched. */
export const NEUTRAL_RECOLOR: ActorRecolorUniform = [0, 1, 1, 0]

/** Recolour as authored in the data: percentages relative to the base art. */
export type ActorRecolor = {
  /** Hue rotation in degrees. */
  hueShift: number
  /** Saturation change in percent; 0 leaves it alone, +100 doubles it. */
  saturationPct: number
  /** Brightness change in percent; 0 leaves it alone. */
  brightnessPct: number
  /** How strongly the grey texels take the target hue, in percent. */
  grayTintPct: number
}

/** `uRecolor`: hue in degrees, saturation ×, brightness ×, grey tint 0..1. */
export type ActorRecolorUniform = [number, number, number, number]

export const NEUTRAL_ACTOR_RECOLOR: ActorRecolor = {
  hueShift: 0,
  saturationPct: 0,
  brightnessPct: 0,
  grayTintPct: 0,
}

export function isNeutralRecolor(recolor: ActorRecolor | null | undefined): boolean {
  return (
    !recolor ||
    (recolor.hueShift === 0 &&
      recolor.saturationPct === 0 &&
      recolor.brightnessPct === 0 &&
      recolor.grayTintPct === 0)
  )
}

/**
 * Authored percentages to the shader's multipliers.
 *
 * Saturation and brightness are relative (`1 + pct/100`, floored at 0, so -100%
 * is fully desaturated or black), while the grey tint is an absolute 0..1
 * weight. Mirrors the conversion the official client does before it uploads
 * the uniform.
 */
export function recolorToUniform(recolor: ActorRecolor): ActorRecolorUniform {
  return [
    recolor.hueShift,
    Math.max(0, 1 + recolor.saturationPct / 100),
    Math.max(0, 1 + recolor.brightnessPct / 100),
    Math.min(1, Math.max(0, recolor.grayTintPct / 100)),
  ]
}

/**
 * The recolour stage, as a Pixi "high shader" bit.
 *
 * It is appended after `textureBitGl`, which leaves the sampled texel in
 * `outColor`, and before the template's own `finalColor = outColor * vColor`,
 * so the animation's per-node tint and alpha still multiply the result exactly
 * as they do on an untouched mesh.
 *
 * The HSV pair is the usual branchless conversion; `applyActorRecolor` is a
 * transcription of the live shader:
 *
 * - a texel under `ACHROMATIC_SATURATION` is grey, and `grayTint` makes it take
 *   the target hue outright (`absolute`) rather than rotate from its own
 *   meaningless one (`rotated`);
 * - saturation keeps whichever is stronger, the scaled original or the tint;
 * - brightness scales and clamps.
 */
export const ACTOR_RECOLOR_BIT = {
  name: 'actor-recolor-bit',
  fragment: {
    header: /* glsl */ `
            uniform vec4 uRecolor;

            const float ACHROMATIC_SATURATION = ${ACHROMATIC_SATURATION.toFixed(2)};
            const vec4 NEUTRAL_RECOLOR = vec4(0.0, 1.0, 1.0, 0.0);

            vec3 recolorRgbToHsv(vec3 c) {
                vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
                vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
                vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
                float d = q.x - min(q.w, q.y);
                float e = 1.0e-10;
                return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
            }

            vec3 recolorHsvToRgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            vec3 applyActorRecolor(vec3 rgb, vec4 recolor) {
                vec3 hsv = recolorRgbToHsv(rgb);
                float achromatic = (1.0 - smoothstep(0.0, ACHROMATIC_SATURATION, hsv.y))
                    * step(0.0001, recolor.w);
                float rotated = fract(hsv.x + recolor.x / 360.0);
                float absolute = fract(recolor.x / 360.0);
                hsv.x = mix(rotated, absolute, achromatic);
                hsv.y = max(hsv.y * recolor.y, achromatic * recolor.w);
                hsv.z = clamp(hsv.z * recolor.z, 0.0, 1.0);
                return recolorHsvToRgb(hsv);
            }
        `,
    // Pixi uploads image textures with premultiplied alpha, while the HSV
    // transform is only meaningful on straight colour: recolouring the
    // premultiplied texel darkens every soft edge and leaves a halo.
    main: /* glsl */ `
            if (uRecolor != NEUTRAL_RECOLOR && outColor.a > 0.0) {
                vec3 straight = clamp(outColor.rgb / outColor.a, 0.0, 1.0);
                outColor.rgb = applyActorRecolor(straight, uRecolor) * outColor.a;
            }
        `,
  },
}

/**
 * Pixi's own mesh bits, with the recolour spliced between the texture sample
 * and the template's tint. The order is the contract: `textureBitGl` is what
 * fills `outColor`.
 */
export const ACTOR_RECOLOR_BITS = [
  localUniformBitGl,
  textureBitGl,
  ACTOR_RECOLOR_BIT,
  {
    name: 'node-additive-color',
    fragment: {
      header: 'uniform vec3 uNodeAdd;',
      // Pixi carries premultiplied colour. Apply Flash RGB addition in straight
      // space, then premultiply again; transparent texels must remain transparent.
      end: 'if (finalColor.a > 0.0) { finalColor.rgb = clamp(finalColor.rgb / finalColor.a + uNodeAdd, 0.0, 1.0) * finalColor.a; }',
    },
  },
  roundPixelsBitGl,
]

let program: GlProgram | null = null

/**
 * The mesh program with the recolour stage spliced in.
 *
 * Same bits as Pixi's own mesh shader (`GlMeshAdaptor`), so the adaptor's bind
 * groups still line up: 100 for the global uniforms, 101 for the local ones
 * that carry `mesh.tint` and `mesh.alpha`. WebGL only, which is what the
 * renderer asks for at init (`preference: 'webgl'`).
 */
export function actorRecolorProgram(): GlProgram {
  program ??= compileHighShaderGlProgram({ name: 'actor-recolor', bits: ACTOR_RECOLOR_BITS })
  return program
}

export function createActorRecolorUniforms(): UniformGroup {
  return new UniformGroup({
    uRecolor: { value: new Float32Array(NEUTRAL_RECOLOR), type: 'vec4<f32>' },
  })
}

export function setActorRecolorUniform(uniforms: UniformGroup, value: ActorRecolorUniform): void {
  const target = uniforms.uniforms.uRecolor as Float32Array
  target.set(value)
  uniforms.update()
}

/**
 * One shader per mesh: a pooled mesh binds its own leaf texture, while every
 * mesh of the same actor shares the recolour uniform group, so a change costs
 * a single upload.
 *
 * `texture` is the contract `Mesh` expects of a custom shader (`TextureShader`):
 * assigning `mesh.texture` forwards here, which is what rebinds the sampler
 * when a pooled mesh is reused for another leaf.
 */
export class ActorRecolorShader extends Shader implements TextureShader {
  private _texture: Texture

  constructor(
    texture: Texture,
    recolorUniforms: UniformGroup,
    // Compiling the program needs a canvas to probe the fragment precision,
    // so a test without a DOM passes its own stub.
    glProgram: GlProgram = actorRecolorProgram(),
  ) {
    super({
      glProgram,
      resources: {
        uTexture: texture.source,
        uSampler: texture.source.style,
        textureUniforms: {
          uTextureMatrix: { type: 'mat3x3<f32>', value: texture.textureMatrix.mapCoord },
        },
        recolorUniforms,
        nodeColorUniforms: new UniformGroup({ uNodeAdd: { value: new Float32Array(3), type: 'vec3<f32>' } }),
      },
    })
    this._texture = texture
  }

  get texture(): Texture {
    return this._texture
  }

  setColorAdd(color: readonly number[]): void {
    const group = this.resources.nodeColorUniforms
    const target = group.uniforms.uNodeAdd as Float32Array
    target[0] = color[0]; target[1] = color[1]; target[2] = color[2]
    group.update()
  }

  set texture(value: Texture) {
    if (this._texture === value) {
      return
    }
    this._texture = value
    this.resources.uTexture = value.source
    this.resources.uSampler = value.source.style
    this.resources.textureUniforms.uniforms.uTextureMatrix = value.textureMatrix.mapCoord
  }
}

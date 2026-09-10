import { expect, it, vi } from 'vitest'
import { Mesh, Texture, type GlProgram } from 'pixi.js'
import { EntityRenderer } from './EntityRenderer'
import { adaptEntityDocument } from './adapter'
import { ActorRecolorShader } from '../renderer/ActorRecolor'

vi.mock('../assets/textures', () => ({
  acquireTextures: async (urls: string[]) => Object.assign(
    new Map(urls.map(url => [url, Texture.WHITE])), { release() {} },
  ),
  warmTextures: async () => {},
}))
vi.mock('../renderer/ActorRecolor', async importOriginal => {
  const original = await importOriginal<typeof import('../renderer/ActorRecolor')>()
  return {
    ...original,
    ActorRecolorShader: class extends original.ActorRecolorShader {
      constructor(texture: Texture, uniforms: ConstructorParameters<typeof original.ActorRecolorShader>[1]) {
        super(texture, uniforms, {} as GlProgram)
      }
    },
  }
})

// Feu de Joie (bone 3254), AnimStatique_1, slot 7. The prepared document
// has decoded colours but no color_encoding, like the other composed actors.
const fireColor = {
  multiplicative: [25 / 127, 25 / 127, 25 / 127, 1],
  additive: [43 / 127, 99 / 127, 99 / 127, 0],
  alpha: 1,
}
const neutralColor = { multiplicative: [1, 1, 1, 1], additive: [0, 0, 0, 0], alpha: 0.5 }

it.each([undefined, 'legacy', 'signed-rgba-flags-v2'])(
  'renders decoded additive colours with encoding %s and clears them on the next frame', async encoding => {
    const entity = new EntityRenderer()
    try {
      await entity.load(adaptEntityDocument({
        color_encoding: encoding,
        frame_rate: 10,
        parts: { flame: { leaves: [{ texture: 'fire.png', indices: [0, 1, 2], vertices: [
          { x: 0, y: 0, u: 0, v: 0 }, { x: 10, y: 0, u: 1, v: 0 }, { x: 0, y: 10, u: 0, v: 1 },
        ] }] } },
        animations: { AnimStatique_1: { frames: [
          [{ slot: 7, part_ref: 'flame', color: fireColor }, { slot: 8, part_ref: 'flame', color: neutralColor }],
          [{ slot: 7, part_ref: 'flame', color: neutralColor }],
        ] } },
      }))
      const meshes = entity.root.children.map(wrap => wrap.children[0] as Mesh)
      const shader = meshes[0].shader as ActorRecolorShader
      expect(shader).toBeInstanceOf(ActorRecolorShader)
      expect(Array.from(shader.resources.nodeColorUniforms.uniforms.uNodeAdd as Float32Array))
        .toEqual(fireColor.additive.slice(0, 3).map(Math.fround))
      expect(meshes[1].shader).toBeNull()
      expect(meshes[1].alpha).toBe(0.5)

      entity.setRecolor({ hueShift: 20, saturationPct: 0, brightnessPct: 0, grayTintPct: 0 })
      entity.setRecolor(null)
      expect(meshes[0].shader).toBeInstanceOf(ActorRecolorShader)
      expect(meshes[1].shader).toBeNull()

      entity.tick(0.11)
      expect(meshes[0].shader).toBeNull()
      expect(meshes[0].alpha).toBe(0.5)
    } finally { entity.destroy() }
  },
)

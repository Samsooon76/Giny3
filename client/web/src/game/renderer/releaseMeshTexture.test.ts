import { BindGroup, Shader, Texture, TextureSource, type GlProgram, type Renderer } from 'pixi.js'
import { afterEach, expect, it, vi } from 'vitest'
import { releaseMeshTexture } from './releaseMeshTexture'

afterEach(() => vi.restoreAllMocks())

it('releases the actual BindGroup listener before destroying a baked texture', () => {
  const texture = new Texture({ source: new TextureSource({ width: 1, height: 1 }) })
  // No GPU is needed to exercise the real Shader/BindGroup resource setters.
  const shader = new Shader({ glProgram: {} as GlProgram, resources: { uTexture: texture.source, uSampler: texture.source.style } })
  const renderer = { renderPipes: { mesh: { _adaptor: { _shader: shader } } } } as unknown as Renderer
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  releaseMeshTexture(renderer, texture)
  expect(shader.resources.uTexture).toBe(Texture.EMPTY.source)
  texture.destroy(true)
  expect(warning).not.toHaveBeenCalled()
  shader.destroy()
})

it('leaves another live entity texture bound', () => {
  const texture = new Texture({ source: new TextureSource({ width: 1, height: 1 }) })
  const group = new BindGroup({ uTexture: Texture.WHITE.source })
  const resources = { uTexture: group.getResource(0) }
  const renderer = { renderPipes: { mesh: { _adaptor: { _shader: { resources } } } } } as unknown as Renderer
  releaseMeshTexture(renderer, texture)
  expect(resources.uTexture).toBe(Texture.WHITE.source)
  group.destroy()
  texture.destroy(true)
})

it('can dispose an entity after its renderer was destroyed', () => {
  expect(() => releaseMeshTexture(undefined, Texture.EMPTY)).not.toThrow()
  expect(() => releaseMeshTexture({ renderPipes: null } as unknown as Renderer, Texture.EMPTY)).not.toThrow()
})

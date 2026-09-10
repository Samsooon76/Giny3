import { Texture, TextureSource } from 'pixi.js'
import { expect, it } from 'vitest'
import { graphicsSettings } from '../graphicsSettings'
import { acquireBakedTexture, bakedTextureStats, trimBakedTextures } from './bakedTextures'
const texture = (size = 2048) => new Texture({ source: new TextureSource({ width: size, height: size }) })
it('reduces recoloring retention with the profile and updates sampling on live textures', () => {
  const previous = graphicsSettings.snapshot(), source = texture()
  graphicsSettings.set('high')
  const leases = ['one', 'two', 'three'].map(key => acquireBakedTexture(key, source, () => texture())!)
  try {
    expect(bakedTextureStats()).toMatchObject({ bytes: 48 * 1024 * 1024, budget: 64 * 1024 * 1024 })
    expect(leases[0].texture.source.scaleMode).toBe('linear')
    leases[1].release(); leases[2].release()
    graphicsSettings.set('low')
    expect(bakedTextureStats()).toMatchObject({ bytes: 16 * 1024 * 1024, budget: 16 * 1024 * 1024, pinnedBytes: 16 * 1024 * 1024 })
    expect(leases[0].texture.source.scaleMode).toBe('nearest')
    expect(leases[0].texture.destroyed).toBe(false)
    expect(leases[1].texture.destroyed).toBe(true)
  } finally { for (const lease of leases) lease.release(); trimBakedTextures(); source.destroy(true); graphicsSettings.set(previous) }
})
it('never owns a borrowed texture and destroys a refused oversized recoloring', () => {
  const source = texture(), oversized = texture(8192)
  try {
    expect(acquireBakedTexture('borrowed', source, () => source)).toBeNull()
    expect(() => acquireBakedTexture('oversized', source, () => oversized)).toThrow('Budget maximal')
    expect(oversized.destroyed).toBe(true)
    expect(source.destroyed).toBe(false)
    expect(bakedTextureStats().bytes).toBe(0)
  } finally { source.destroy(true); trimBakedTextures() }
})

import { Texture } from 'pixi.js'
import { expect, it, vi } from 'vitest'
import { ResourceLimitError, type Lease } from './ResourcePool'
import { acquireTextures, texturePool } from './textures'
it('releases early and late leases when a texture set exceeds admission capacity', async () => {
  const early = vi.fn(), late = vi.fn()
  let finish!: (lease: Lease<Texture>) => void
  const pending = new Promise<Lease<Texture>>(resolve => { finish = resolve })
  const acquire = vi.spyOn(texturePool, 'acquire').mockImplementation(async key => {
    if (key === 'early') return { value: Texture.WHITE, release: early }
    if (key === 'denied') throw new ResourceLimitError(10, 5)
    return pending
  })
  try {
    const result = acquireTextures(['early', 'denied', 'late'])
    const rejected = expect(result).rejects.toMatchObject({ name: 'ResourceLimitError' })
    await Promise.resolve(); await Promise.resolve()
    expect(early).toHaveBeenCalledOnce()
    finish({ value: Texture.WHITE, release: late })
    await rejected
    expect(late).toHaveBeenCalledOnce()
  } finally { acquire.mockRestore() }
})

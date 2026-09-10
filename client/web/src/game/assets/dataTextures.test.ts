import { afterEach, expect, it, vi } from 'vitest'
import { isWaveDataTexture, loadWaveDataTexture } from './dataTextures'

afterEach(() => vi.unstubAllGlobals())
it('limits raw RGBA decoding to qualified wave lookup textures', () => {
  expect(isWaveDataTexture('/game-data/effects/wave/wavesDynamics/9.png')).toBe(true)
  expect(isWaveDataTexture('/game-data/effects/wave/wavesDissolveDynamics/2.png?v=1')).toBe(true)
  expect(isWaveDataTexture('/game-data/effects/wave/waveMapMasks/9.png')).toBe(false)
  expect(isWaveDataTexture('/game-data/gfx/9.png')).toBe(false)
})
it('preserves four independent channels and closes the bitmap when its texture is destroyed', async () => {
  const bitmap = { width: 4, height: 4, close: vi.fn() }
  const create = vi.fn(async () => bitmap)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() })))
  vi.stubGlobal('createImageBitmap', create)
  const texture = await loadWaveDataTexture('/effects/wave/wavesDynamics/9.png', new AbortController().signal)
  expect(create).toHaveBeenCalledWith(expect.any(Blob), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  expect(texture.source.alphaMode).toBe('no-premultiply-alpha')
  expect(bitmap.close).not.toHaveBeenCalled()
  texture.destroy(true)
  expect(bitmap.close).toHaveBeenCalledOnce()
})
it('closes late decoder results on cancellation', async () => {
  const controller = new AbortController(), close = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob() })))
  vi.stubGlobal('createImageBitmap', vi.fn(async () => { controller.abort(); return { width: 4, height: 4, close } }))
  await expect(loadWaveDataTexture('/effects/wave/wavesDynamics/9.png', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(close).toHaveBeenCalledOnce()
})

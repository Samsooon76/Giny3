import { ImageSource, Texture } from 'pixi.js'
import { throwIfAborted } from './TaskQueue'

/** RGBA LUTs carry four independent wave thresholds, not opacity. */
export function isWaveDataTexture(url: string): boolean {
  return /\/effects\/wave\/waves(?:Dissolve)?Dynamics\/\d+\.png(?:[?#]|$)/.test(url)
}

export async function loadWaveDataTexture(url: string, signal: AbortSignal): Promise<Texture> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Wave data texture ${response.status}: ${url}`)
  const resource = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  try {
    throwIfAborted(signal)
    const texture = new Texture({ source: new ImageSource({ resource, alphaMode: 'no-premultiply-alpha', autoGenerateMipmaps: false }) })
    texture.source.once('destroy', () => resource.close())
    return texture
  } catch (error) { resource.close(); throw error }
}

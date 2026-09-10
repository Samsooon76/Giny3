import { graphicsSettings } from '../graphicsSettings'
import { ResourceLimitError } from '../assets/ResourcePool'
import type { Texture } from 'pixi.js'
type Entry = { texture: Texture; refs: number; bytes: number }
const entries = new Map<string, Entry>()
let bytes = 0
let budget = graphicsSettings.current().bakedTextureMB * 1024 * 1024
const hardLimit = 128 * 1024 * 1024
function trim(allUnused = false) {
  if (!allUnused && bytes <= budget) return
  for (const [key, entry] of entries) {
    if (entry.refs) continue
    entries.delete(key); bytes -= entry.bytes; entry.texture.destroy(true)
    if (!allUnused && bytes <= budget) break
  }
}
export function acquireBakedTexture(key: string, source: Texture, bake: () => Texture) {
  let entry = entries.get(key)
  if (!entry) {
    const texture = bake()
    // A failed canvas conversion may return a borrowed source. Never own or destroy it.
    if (texture === source) return null
    entry = { texture, refs: 0, bytes: texture.source.pixelWidth * texture.source.pixelHeight * 4 }
    if (bytes + entry.bytes > hardLimit) trim(true)
    if (bytes + entry.bytes > hardLimit) { texture.destroy(true); throw new ResourceLimitError(entry.bytes, hardLimit) }
    texture.source.scaleMode = graphicsSettings.current().textureScaleMode
    entries.set(key, entry); bytes += entry.bytes
  }
  const owned = entry
  owned.refs++
  entries.delete(key); entries.set(key, owned)
  trim()
  let released = false
  return { texture: owned.texture, release() {
    if (released) return
    released = true; owned.refs--
    entries.delete(key); entries.set(key, owned); trim()
  } }
}
graphicsSettings.subscribe(() => {
  budget = graphicsSettings.current().bakedTextureMB * 1024 * 1024
  for (const entry of entries.values()) entry.texture.source.scaleMode = graphicsSettings.current().textureScaleMode
  trim()
})
export function trimBakedTextures(): void { trim(true) }
export function bakedTextureStats() {
  return { entries: entries.size, bytes, budget, hardLimitBytes: hardLimit, pinnedBytes: [...entries.values()].reduce((sum, entry) => sum + (entry.refs ? entry.bytes : 0), 0), pinned: [...entries.values()].filter(entry => entry.refs > 0).length }
}

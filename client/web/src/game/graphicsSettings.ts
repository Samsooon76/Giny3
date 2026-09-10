export const GRAPHICS_PROFILES = {
  low: { label: 'Économique', fps: 30, backgroundFps: 10, resolution: 0.75, textureMB: 128, bakedTextureMB: 16, textureScaleMode: 'nearest', particles: 1024, wind: false, postProcess: false, refraction: false, neighbours: false },
  balanced: { label: 'Équilibré', fps: 60, backgroundFps: 15, resolution: 1, textureMB: 256, bakedTextureMB: 32, textureScaleMode: 'nearest', particles: 4096, wind: true, postProcess: true, refraction: true, neighbours: true },
  high: { label: 'Qualité élevée', fps: 60, backgroundFps: 15, resolution: 2, textureMB: 384, bakedTextureMB: 64, textureScaleMode: 'linear', particles: 8192, wind: true, postProcess: true, refraction: true, neighbours: true },
} as const
export type GraphicsProfile = keyof typeof GRAPHICS_PROFILES
const KEY = 'giny.graphics.v1'
let profile: GraphicsProfile = 'balanced'
try {
  const saved = localStorage.getItem(KEY)
  if (saved && Object.hasOwn(GRAPHICS_PROFILES, saved)) profile = saved as GraphicsProfile
} catch { /* Session-only settings when local storage is unavailable. */ }
const listeners = new Set<() => void>()
export const graphicsSettings = {
  snapshot: () => profile,
  current: () => GRAPHICS_PROFILES[profile],
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  set(next: GraphicsProfile) {
    if (!Object.hasOwn(GRAPHICS_PROFILES, next) || next === profile) return
    profile = next
    try { localStorage.setItem(KEY, next) } catch { /* Session-only setting. */ }
    for (const listener of listeners) listener()
  },
}

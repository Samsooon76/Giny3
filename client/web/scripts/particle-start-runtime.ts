import { Container, Texture } from 'pixi.js'
import { adaptMapDocument } from '../src/game/maps/adapter'
import { MapParticles } from '../src/game/particles/MapParticles'
import { ParticleWarmBudget } from '../src/game/particles/ParticleWarmBudget'
import { particleStartSource, validateParticleStart } from '../src/game/particles/ParticleStartState'
import { graphicsSettings, GRAPHICS_PROFILES, type GraphicsProfile } from '../src/game/graphicsSettings'
import { gameDataUrl } from '../src/data/assetUrl'

export async function prepareParticleStarts(raw: unknown) {
  const map = adaptMapDocument(raw), sourceHash = await particleStartSource(map)
  const variants: Record<string, ReturnType<MapParticles['exportStartState']>> = {}
  if (!(map.particles ?? []).some(p => p.particlesMainParameters.prewarm && p.particlesMainParameters.looping)) return { sourceHash, variants }
  // White textures supply Sprite dimensions for simulation; no pixels are exported.
  const textures = new Map<string, Texture>()
  for (const definition of map.particles ?? []) for (const material of [definition.material, definition.trailMaterial]) {
    if (material.texture) textures.set(gameDataUrl(material.texture), Texture.WHITE)
    const gfx = map.gfx[String(material.gfxId)]
    if (gfx) {
      const key = gameDataUrl(gfx.texture)
      textures.set(gfx.frame ? `${key}#${gfx.frame.join(',')}` : key, Texture.WHITE)
    }
  }
  const previous = graphicsSettings.snapshot()
  try {
    for (const profile of Object.keys(GRAPHICS_PROFILES) as GraphicsProfile[]) for (const background of [false, true]) {
      graphicsSettings.set(profile)
      const layers = { background: new Container(), sortable: new Container(), foreground: new Container() }
      const runtime = new MapParticles(map, textures, layers, background, true)
      try {
        const budget = new ParticleWarmBudget(() => 0)
        while (runtime.warming) { budget.reset(256, 1000); runtime.tick(0, budget) }
        const state = runtime.exportStartState(sourceHash)
        if (!validateParticleStart(state, map, sourceHash, state.limit, background)) throw new Error(`Invalid particle start: ${map.id}/${profile}/${background}`)
        variants[`${profile}:${background ? 'neighbour' : 'centre'}`] = state
      } finally { runtime.destroy(); for (const layer of Object.values(layers)) layer.destroy({ children: true }) }
    }
  } finally { graphicsSettings.set(previous) }
  return { sourceHash, variants }
}

import { loadBubble, type NativeEntity } from '../game/bubble/runtime'
import { graphicsSettings } from '../game/graphicsSettings'
import { trackPreviewContext } from '../game/assets/previewMetrics'
import { createTrackedCanvas } from '../game/assets/gpuContexts'
import { previewSize, type PreviewMode } from './entityFraming'

type Hub = { native: NativeEntity; loader?: NativeEntity; canvas: HTMLCanvasElement; ready: Promise<void>; refs: number; releaseGpu: () => void; jobs: Set<() => void>; frame: number }
let shared: Hub | undefined

/** Bubble's original portrait renderer, shared across all visible portraits. */
export async function acquireBubblePreview() {
  if (!shared) {
    const gpu = createTrackedCanvas('previews')
    const hub: Hub = { native: undefined, canvas: gpu.canvas, ready: Promise.resolve(), refs: 0, releaseGpu: gpu.release, jobs: new Set(), frame: 0 }
    shared = hub
    hub.ready = (async () => {
      const runtime = await loadBubble()
      hub.native = new runtime.__BubbleLookRenderer()
      hub.loader = new runtime.__BubbleAssetLoader()
      await hub.loader.manifestLoader.load('/bubble/data')
      hub.loader.manifestLoader.manifest.remote_base_url = ''
      if (!await hub.native.init(hub.canvas, { assetBaseUrl: '/bubble/data', sharedLoader: hub.loader })) throw new Error('Moteur de portraits Bubble indisponible')
      trackPreviewContext(1)
    })().catch(error => { hub.native?.destroy(); hub.loader?.destroy(); gpu.release(); if (shared === hub) shared = undefined; throw error })
  }
  const hub = shared
  hub.refs++
  try { await hub.ready } catch (error) { hub.refs--; throw error }
  let released = false
  const entities = new Set<NativeEntity>(), jobs = new Set<() => void>()
  const draw = (entity: NativeEntity, canvas: HTMLCanvasElement, width: number, height: number, mode: PreviewMode) => {
    if (released) return
    const resolution = Math.min(window.devicePixelRatio || 1, graphicsSettings.current().resolution)
    const w = Math.max(1, Math.round(width * resolution)), h = Math.max(1, Math.round(height * resolution))
    hub.native.resize(w, h)
    // The native renderer normally draws its full entity list. Isolate the
    // selected portrait for this synchronous draw, restoring ownership after it.
    const all = hub.native._entities
    hub.native._entities = [entity]
    try {
      entity.x = 0; entity.y = 0
      hub.native.renderFrame()
      const [left, right, top, bottom] = entity.bbox
      if (!(right > left && bottom > top)) throw new Error('Portrait Bubble sans géométrie')
      const size = previewSize(mode, w, h, right - left, bottom - top)
      const factor = size.scale
      const scale = (manager: NativeEntity) => {
        manager.scaleX *= factor; manager.scaleY *= factor
        for (const sub of manager.subentityRefs.values()) scale(sub)
      }
      entity.look.scaleX *= factor; entity.look.scaleY *= factor
      scale(entity.animManager)
      entity.x = w / 2 - (left + right) / 2 * factor
      entity.y = size.baseline - bottom * factor
      hub.native.renderFrame()
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas de portrait indisponible')
      context.clearRect(0, 0, w, h)
      context.drawImage(hub.canvas, 0, 0)
    } finally { hub.native._entities = all }
  }
  return {
    async create(look: string, facing?: number) {
      const entity = await hub.native.createEntity(look)
      if (released) { hub.native.removeEntity(entity); throw new DOMException('Portrait annulé', 'AbortError') }
      entities.add(entity)
      await hub.native.ensureAnimGroup(entity, 'AnimStatique')
      entity.setDirection(facing ?? 1, 'giny-preview')
      entity.staticAnim()
      return entity
    },
    draw,
    subscribe(job: () => void, onError: (error: unknown) => void) {
      const guarded = () => { try { job() } catch (error) { hub.jobs.delete(guarded); jobs.delete(guarded); onError(error) } }
      jobs.add(guarded); hub.jobs.add(guarded)
      if (!hub.frame) {
        let last = 0
        const tick = (time: number) => {
          hub.frame = 0
          if (!hub.jobs.size) return
          hub.frame = requestAnimationFrame(tick)
          if (document.hidden || time - last < 1000 / graphicsSettings.current().fps) return
          last = time
          for (const next of hub.jobs) next()
        }
        hub.frame = requestAnimationFrame(tick)
      }
    },
    release() {
      if (released) return
      released = true
      for (const job of jobs) hub.jobs.delete(job)
      for (const entity of entities) hub.native.removeEntity(entity)
      if (--hub.refs === 0) {
        if (shared === hub) shared = undefined
        cancelAnimationFrame(hub.frame)
        hub.native.destroy(); hub.loader?.destroy(); hub.releaseGpu(); trackPreviewContext(-1)
      }
    },
  }
}

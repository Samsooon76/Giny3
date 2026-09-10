import { graphicsSettings } from '../graphicsSettings'
import { isWaveDataTexture, loadWaveDataTexture } from './dataTextures'
import { preparationBudget } from './PreparationBudget'
import { Assets, CompressedSource, Texture, type Renderer } from 'pixi.js'
import { ResourcePool, ResourceLimitError, type Lease } from './ResourcePool'
import { abortError, throwIfAborted, TaskQueue, type LoadOptions } from './TaskQueue'

type BC7Result = { width: number; height: number; blocks: Uint8Array }
let worker: Worker | null = null
let sequence = 0
const pending = new Map<number, { resolve: (r: BC7Result) => void; reject: (e: Error) => void; cleanup: () => void }>()
function loadBC7(url: string, signal: AbortSignal): Promise<Texture> {
  if (!worker) {
    worker = new Worker(new URL('./bc7.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      const task = pending.get(data.id)
      if (!task) return
      pending.delete(data.id); task.cleanup()
      if (data.error) task.reject(new Error(data.error)); else task.resolve(data)
    }
    worker.onerror = () => {
      for (const task of pending.values()) { task.cleanup(); task.reject(new Error('Worker BC7 indisponible')) }
      pending.clear(); worker?.terminate(); worker = null
    }
  }
  return new Promise<BC7Result>((resolve, reject) => {
    const id = ++sequence
    const abort = () => { worker?.postMessage({ id, cancel: true }); pending.delete(id); cleanup(); reject(abortError()) }
    const cleanup = () => signal.removeEventListener('abort', abort)
    pending.set(id, { resolve, reject, cleanup }); signal.addEventListener('abort', abort, { once: true })
    worker!.postMessage({ id, url })
    if (signal.aborted) abort()
  }).then(({ width, height, blocks }) => new Texture({ source: new CompressedSource({
    width, height, resource: [blocks], format: 'bc7-rgba-unorm', alphaMode: 'premultiplied-alpha',
    scaleMode: 'nearest', autoGenerateMipmaps: false,
  }) }))
}
export const texturePool = new ResourcePool<Texture>(async (url, signal) => {
  const texture = url.endsWith('.ktx2') ? await loadBC7(url, signal)
    : isWaveDataTexture(url) ? await loadWaveDataTexture(url, signal) : await Assets.load<Texture>(url)
  texture.source.scaleMode = graphicsSettings.current().textureScaleMode; texture.source.autoGenerateMipmaps = false
  return texture
}, async (url, texture) => {
  if (url.endsWith('.ktx2') || isWaveDataTexture(url)) texture.destroy(true)
  else await Assets.unload(url)
}, texture => texture.source.format === 'bc7-rgba-unorm'
  ? Math.ceil(texture.source.pixelWidth / 4) * Math.ceil(texture.source.pixelHeight / 4) * 16
  : texture.source.pixelWidth * texture.source.pixelHeight * 4, 256 * 1024 * 1024, 6, 768 * 1024 * 1024)

graphicsSettings.subscribe(() => texturePool.visitLoaded(texture => { texture.source.scaleMode = graphicsSettings.current().textureScaleMode }))

export type TextureSet = Map<string, Texture> & { release: () => void }
export async function acquireTextures(urls: string[], options: LoadOptions = {}): Promise<TextureSet> {
  const leases: Lease<Texture>[] = []
  const textures = new Map<string, Texture>() as TextureSet
  let released = false
  let budgetFailure: ResourceLimitError | undefined
  textures.release = () => { if (!released) { released = true; for (const lease of leases) lease.release() } }
  await Promise.all([...new Set(urls)].map(async url => {
    try {
      const lease = await texturePool.acquire(url, options)
      if (released) lease.release()
      else { leases.push(lease); textures.set(url, lease.value) }
    } catch (error) {
      if (error instanceof ResourceLimitError) { budgetFailure = error; textures.release(); return }
      if (!options.signal?.aborted) console.warn('[textures]', url, error)
    }
  }))
  if (options.signal?.aborted) { textures.release(); throwIfAborted(options.signal) }
  if (budgetFailure) throw budgetFailure
  return textures
}

/** Serialize GPU preparation while keeping visible work ahead of queued neighbours. */
const uploads = new TaskQueue(1)
export async function warmTextures(textures: Iterable<Texture>, renderer?: Renderer, signal?: AbortSignal, options: LoadOptions = {}): Promise<void> {
  if (!renderer) return
  const context = { ...options, signal }
  const sources = [...new Set([...textures].map(t => t.source))]
  for (const source of sources) {
    await uploads.run(async () => {
      await preparationBudget.checkpoint(context)
      throwIfAborted(signal)
      renderer.texture.initSource(source)
    }, context)
  }
}
export function supportsBC7(renderer?: Renderer): boolean {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('textures') === 'lossless') return false
  const gl = (renderer as { gl?: WebGLRenderingContext } | undefined)?.gl
  return !!gl?.getExtension('EXT_texture_compression_bptc')
}

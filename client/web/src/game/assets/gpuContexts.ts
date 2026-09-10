import { trackGpuImages } from './GpuImages'
import { trackGpuBuffers } from './GpuBuffers'
type Context = { id: number; label: string; kind: string; canvas: HTMLCanvasElement; lost: number; images: ReturnType<typeof trackGpuImages>; tracker: ReturnType<typeof trackGpuBuffers> }
const contexts = new Set<Context>()
let nextId = 0
/** Install before renderer initialization so startup allocations are included. */
export function createTrackedCanvas(label: string) {
  const canvas = document.createElement('canvas'), original = canvas.getContext
  const owned = new Map<RenderingContext, Context>()
  let released = false
  const getContext = function (kind: string, options?: unknown) {
    const gl = Reflect.apply(original, canvas, [kind, options]) as RenderingContext | null
    if (!released && gl && ['webgl', 'experimental-webgl', 'webgl2'].includes(kind) && !owned.has(gl)) {
      const context = { id: ++nextId, label, kind, canvas, lost: 0, images: trackGpuImages(gl as WebGLRenderingContext), tracker: trackGpuBuffers(gl as WebGLRenderingContext) }
      owned.set(gl, context); contexts.add(context)
    }
    return gl
  } as typeof canvas.getContext
  canvas.getContext = getContext
  const lost = () => { for (const context of owned.values()) { context.lost++; context.tracker.reset(); context.images.reset() } }
  canvas.addEventListener('webglcontextlost', lost)
  return { canvas, release() {
    if (released) return
    released = true
    canvas.removeEventListener('webglcontextlost', lost)
    if (canvas.getContext === getContext) canvas.getContext = original
    for (const context of owned.values()) { context.tracker.release(); context.images.release(); contexts.delete(context) }
    owned.clear()
  } }
}
/** Requested payloads per context, not driver VRAM; default framebuffers are excluded. */
export function gpuContextStats() {
  return [...contexts].map(context => ({ id: context.id, label: context.label, kind: context.kind, contextLosses: context.lost,
    canvasPixels: context.canvas.width * context.canvas.height, ...context.tracker.snapshot(), ...context.images.snapshot() }))
}

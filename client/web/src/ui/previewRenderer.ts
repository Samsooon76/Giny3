import { createTrackedCanvas } from '../game/assets/gpuContexts'
import { Application, type Container } from 'pixi.js'
import { graphicsSettings } from '../game/graphicsSettings'
import { trackPreviewContext } from '../game/assets/previewMetrics'

type Hub = { releaseGpu: () => void; app: Application; ready: Promise<void>; refs: number; jobs: Set<(dt: number) => void> }
let shared: Hub | null = null

/** One GPU context for all visible UI portraits; each host keeps its own 2D copy. */
export async function acquirePreviewRenderer() {
  if (!shared) {
    const app = new Application()
    const gpu = createTrackedCanvas('previews')
    const hub: Hub = { releaseGpu: gpu.release, app, ready: Promise.resolve(), refs: 0, jobs: new Set() }
    shared = hub
    hub.ready = app.init({ canvas: gpu.canvas, width: 1, height: 1, backgroundAlpha: 0, antialias: false,
      preference: 'webgl', autoStart: false }).then(() => {
      trackPreviewContext(1)
      app.ticker.remove(app.render, app)
      app.ticker.add(ticker => {
        if (document.hidden) return
        app.ticker.maxFPS = graphicsSettings.current().fps
        for (const job of hub.jobs) job(ticker.deltaMS / 1000)
      })
    }).catch(error => { gpu.release(); if (shared === hub) shared = null; throw error })
  }
  const hub = shared
  hub.refs++
  try { await hub.ready } catch (error) { hub.refs--; throw error }
  let released = false
  const ownedJobs = new Set<(dt: number) => void>()
  return {
    renderer: hub.app.renderer,
    subscribe(job: (dt: number) => void, onError: (error: unknown) => void = console.error) {
      if (released) return
      const guarded = (dt: number) => {
        try { job(dt) } catch (error) {
          hub.jobs.delete(guarded); ownedJobs.delete(guarded)
          if (!hub.jobs.size) hub.app.ticker.stop()
          onError(error)
        }
      }
      ownedJobs.add(guarded); hub.jobs.add(guarded); hub.app.ticker.start()
    },
    draw(root: Container, canvas: HTMLCanvasElement, width: number, height: number) {
      if (released || root.destroyed) return
      const resolution = Math.min(window.devicePixelRatio || 1, graphicsSettings.current().resolution)
      const w = Math.max(1, width), h = Math.max(1, height)
      hub.app.renderer.resize(w, h, resolution)
      hub.app.stage.addChild(root)
      try {
        hub.app.render()
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas de portrait indisponible')
        const pixelWidth = hub.app.canvas.width, pixelHeight = hub.app.canvas.height
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight }
        context.clearRect(0, 0, pixelWidth, pixelHeight)
        context.drawImage(hub.app.canvas as HTMLCanvasElement, 0, 0)
      } finally { root.removeFromParent() }
    },
    release() {
      if (released) return
      released = true
      for (const job of ownedJobs) hub.jobs.delete(job)
      if (!hub.jobs.size) hub.app.ticker.stop()
      if (--hub.refs === 0) {
        if (shared === hub) shared = null
        trackPreviewContext(-1)
        try { hub.app.destroy({ removeView: true, releaseGlobalResources: false }, { children: true, texture: false }) } finally { hub.releaseGpu() }
      }
    },
  }
}

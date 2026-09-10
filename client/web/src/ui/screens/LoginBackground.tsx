import { useEffect, useRef } from 'react'
import { LOGIN_PARALLAX_LAYERS, type ParallaxLayer } from './parallaxLayers'
import '../login-parallax.css'

const WIDTH = 1920, HEIGHT = 1080
const STATIC = new Set(['background', 'background_vignetting', 'fade'])
type Band = { group: string; still: boolean; layers: ParallaxLayer[] }
const bands: Band[] = []
for (const layer of LOGIN_PARALLAX_LAYERS) {
  const group = layer.parentChain.at(-1) ?? 'root', still = STATIC.has(layer.name)
  const last = bands.at(-1)
  if (last?.group === group && last.still === still) last.layers.push(layer)
  else bands.push({ group, still, layers: [layer] })
}
const motion: Record<string, [number, number]> = {
  ParallaxBackground: [8, 5], elements: [14, 9], left_1: [24, 14], right_1: [24, 14],
  left_2: [36, 22], right_2: [36, 22], left_3: [50, 30], smoke: [70, 30],
}

/** One visible canvas instead of a Retina compositor surface per parallax band. */
export function LoginBackground() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return
    let disposed = false, frame = 0, lastDraw = 0, lastTick = 0, time = 0
    let x = 0, y = 0, targetX = 0, targetY = 0
    let prepared: Array<{ band: Band; canvas: HTMLCanvasElement }> = []
    const images: HTMLImageElement[] = []
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight)
      const ratio = Math.min(1, WIDTH / width, HEIGHT / height)
      canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio)
    }
    resize()
    const draw = (now: number) => {
      if (disposed || document.hidden) return
      frame = requestAnimationFrame(draw)
      if (now - lastDraw < 1000 / 30) return
      const dt = lastTick ? Math.min(.1, (now - lastTick) / 1000) : 0
      lastTick = now; lastDraw = now; time += dt
      const ease = 1 - Math.exp(-dt * 8)
      x += (targetX - x) * ease; y += (targetY - y) * ease
      context.fillStyle = '#1a1a2e'; context.fillRect(0, 0, canvas.width, canvas.height)
      const scale = Math.max(canvas.width / WIDTH, canvas.height / HEIGHT)
      const left = (canvas.width - WIDTH * scale) / 2, top = (canvas.height - HEIGHT * scale) / 2
      for (const { band, canvas: image } of prepared) {
        const [dx, dy] = band.still ? [0, 0] : motion[band.group] ?? [0, 0]
        const drift = band.group === 'left_3' ? Math.sin(time * Math.PI / 28) * 12 : 0
        context.globalAlpha = band.group === 'smoke' ? .9 : 1
        context.drawImage(image, left + (x * dx + drift) * scale, top + y * dy * scale, WIDTH * scale, HEIGHT * scale)
      }
      context.globalAlpha = 1
    }
    const pointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1))
      targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1))
    }
    const visibility = () => {
      cancelAnimationFrame(frame); lastTick = 0
      if (!document.hidden && prepared.length) frame = requestAnimationFrame(draw)
    }
    Promise.all(LOGIN_PARALLAX_LAYERS.map(layer => new Promise<{ layer: ParallaxLayer; image: HTMLImageElement } | null>(resolve => {
      const image = new Image(); images.push(image)
      image.onload = () => resolve({ layer, image }); image.onerror = () => resolve(null)
      image.src = `/dofus3/login-background/${layer.file}`
    }))).then(loaded => {
      if (disposed) return
      const assets = new Map(loaded.filter((v): v is NonNullable<typeof v> => !!v).map(v => [v.layer, v.image]))
      // Static band pixels are composed once, not rasterized as large DOM
      // surfaces on every pointer movement. Their resolution is bounded.
      const ratio = Math.min(1, Math.max(canvas.width / WIDTH, canvas.height / HEIGHT))
      prepared = bands.map(band => {
        const buffer = document.createElement('canvas')
        buffer.width = Math.ceil(WIDTH * ratio); buffer.height = Math.ceil(HEIGHT * ratio)
        const ctx = buffer.getContext('2d')!
        ctx.scale(ratio, ratio)
        for (const layer of band.layers) {
          const image = assets.get(layer)
          if (!image) continue
          const stretch = layer.anchorMin.x === 0 && layer.anchorMin.y === 0 && layer.anchorMax.x === 1 && layer.anchorMax.y === 1
          const w = stretch ? WIDTH : layer.size.x || image.naturalWidth
          const h = stretch ? HEIGHT : layer.size.y || image.naturalHeight
          const px = stretch ? 0 : WIDTH / 2 + layer.pos.x - w / 2
          const py = stretch ? 0 : HEIGHT / 2 - layer.pos.y - h / 2
          ctx.globalAlpha = layer.color.a
          ctx.filter = `brightness(${(layer.color.r + layer.color.g + layer.color.b) / 3})`
          if (stretch) {
            const cover = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight)
            ctx.drawImage(image, (WIDTH - image.naturalWidth * cover) / 2, (HEIGHT - image.naturalHeight * cover) / 2, image.naturalWidth * cover, image.naturalHeight * cover)
          } else ctx.drawImage(image, px, py, w, h)
        }
        return { band, canvas: buffer }
      })
      canvas.dataset.ready = 'true'
      for (const image of images) { image.onload = null; image.onerror = null; image.src = '' }
      images.length = 0
      if (!document.hidden) frame = requestAnimationFrame(draw)
    })
    window.addEventListener('pointermove', pointer)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true; cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', pointer); window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      for (const image of images) { image.onload = null; image.onerror = null; image.src = '' }
      for (const image of prepared) { image.canvas.width = 0; image.canvas.height = 0 }
      prepared = []; canvas.width = 0; canvas.height = 0
    }
  }, [])
  return <canvas ref={ref} className="dofus3-login-bg" aria-hidden />
}

import { graphicsSettings } from '../game/graphicsSettings'
import { trackThumbnailBytes } from '../game/assets/previewMetrics'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { acquireBubblePreview } from './bubblePreviewRenderer'
import type { NativeEntity } from '../game/bubble/runtime'

import { type PreviewMode } from './entityFraming'

const thumbnails = new Map<string, string>()
let thumbnailBytes = 0

export function EntityPreview({ look, mode = 'fit', staticImage = false, facing }: { look: string; mode?: PreviewMode; staticImage?: boolean; facing?: number }) {
  const profile = useSyncExternalStore(graphicsSettings.subscribe, graphicsSettings.snapshot, graphicsSettings.snapshot)
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [thumbnail, setThumbnail] = useState<string>()
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)))
    observer.observe(host)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const host = hostRef.current
    if (!host || !look || !visible) return
    const cacheKey = `${look}:${mode}:${host.clientWidth}:${host.clientHeight}:${facing ?? 'default'}:${profile}`
    const cached = staticImage ? thumbnails.get(cacheKey) : undefined
    if (cached) { setThumbnail(cached); return }
    setThumbnail(undefined)
    let cancelled = false
    let disposed = false
    let surface: Awaited<ReturnType<typeof acquireBubblePreview>> | undefined
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block'
    let entity: NativeEntity = null
    let resizeObserver: ResizeObserver | undefined
    const dispose = () => {
      if (disposed) return
      disposed = true
      resizeObserver?.disconnect()
      entity = null
      canvas.remove()
      surface?.release(); surface = undefined
    }
    const render = async () => {
      if (cancelled) return
      surface = await acquireBubblePreview()
      if (cancelled) { surface.release(); surface = undefined; return }
      host.appendChild(canvas)
      entity = await surface.create(look, facing)
      if (cancelled) return
      const frame = () => {
        if (entity) surface?.draw(entity, canvas, host.clientWidth, host.clientHeight, mode)
      }
      frame()
      const observer = new ResizeObserver(frame)
      observer.observe(host)
      resizeObserver = observer
      if (staticImage) {
        surface.draw(entity, canvas, host.clientWidth, host.clientHeight, mode)
        const url = canvas.toDataURL()
        thumbnailBytes -= (thumbnails.get(cacheKey)?.length ?? 0) * 2
        thumbnails.delete(cacheKey); thumbnails.set(cacheKey, url); thumbnailBytes += url.length * 2
        while (thumbnails.size > 128 || thumbnailBytes > 16 * 1024 * 1024) {
          const oldest = thumbnails.keys().next().value!
          thumbnailBytes -= thumbnails.get(oldest)!.length * 2; thumbnails.delete(oldest)
        }
        trackThumbnailBytes(thumbnailBytes)
        setThumbnail(url)
        dispose()
      } else {
        surface.draw(entity, canvas, host.clientWidth, host.clientHeight, mode)
        surface.subscribe(() => {
          if (entity && !document.hidden) frame()
        }, error => { dispose(); console.warn('[EntityPreview] Animation du portrait interrompue', error) })
      }
    }
    void render().catch(error => { dispose(); if (!cancelled) console.warn('[EntityPreview] Impossible de charger le portrait', look, error) })
    return () => {
      cancelled = true
      dispose()
    }
  }, [look, mode, visible, staticImage, facing, profile])
  return <div className={`entity-preview entity-preview--${mode}`} ref={hostRef}>{staticImage && thumbnail ? <img src={thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}</div>
}

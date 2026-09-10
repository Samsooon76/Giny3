import { useEffect } from 'react'

/** Layout-box dump in official canvas pixels.

    `getBoundingClientRect` reads 0 when the compositor is not painting the
    panel (a background tab, a side view). `offsetLeft` / `offsetWidth` stay
    in the unscaled runtime canvas space the official screenshots live
    in, so that is what the comparator consumes.

    The HUD route still has `.official-canvas` (inside `.official-hud`); a
    lone `OfficialTree` only has `.official-tree-host`. Login overlays
    (characterHeader, gameMenu) are sibling canvases and must be walked too.
    In-game `gameMenu` is a HUD chrome layer on the same canvas. */
export type ClientBox = {
  id: string | null
  binding: string | null
  type: string
  classes: string[]
  depth: number
  x: number
  y: number
  w: number
  h: number
  text: string | null
  font: string
  color: string
  background: string
  image: string | null
}

export type ClientBoxesPayload = {
  canvas: { width: number; height: number }
  count: number
  named: number
  depth: number
  boxes: ClientBox[]
}

export function useDumpClientBoxes() {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    return installDumpClientBoxes()
  }, [])
}

/** Drop canvases nested inside another painted canvas. */
export function uniqueSurfaces<T extends { contains(other: T): boolean }>(nodes: T[]): T[] {
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)))
}

export function pickSurfaces(root: ParentNode = document): HTMLElement[] {
  const canvases = uniqueSurfaces(
    [...root.querySelectorAll<HTMLElement>('.official-canvas')].filter(
      (node) => node.offsetWidth > 0 && node.offsetHeight > 0,
    ),
  )
  if (canvases.length) return canvases
  const host = root.querySelector<HTMLElement>('.official-tree-host')
  if (host && host.offsetWidth > 0) return [host]
  return [document.body]
}

/** The paint the comparator attributes: UITK tints with a mask / 9-slice
    mask-border, so `background-image` is `none` even when a sprite is on
    screen. Reading only `background-image` lumped PlayButton layers with
    solid `window_background` fills. */
export type PaintStyle = {
  backgroundImage?: string | null
  maskImage?: string | null
  webkitMaskImage?: string | null
  webkitMaskBoxImageSource?: string | null
  maskBorderSource?: string | null
  borderImageSource?: string | null
}

export function elementPaint(element: HTMLElement): string | null {
  const style = getComputedStyle(element)
  const before = getComputedStyle(element, '::before')
  const beforePaints = before.content !== 'none' && before.content !== ''
  return paintedImage(paintStyle(style)) ?? (beforePaints ? paintedImage(paintStyle(before)) : null)
}

export function paintedImage(style: PaintStyle): string | null {
  for (const value of [
    style.maskImage,
    style.webkitMaskImage,
    style.webkitMaskBoxImageSource,
    style.maskBorderSource,
    style.borderImageSource,
    style.backgroundImage,
  ]) {
    if (typeof value === 'string' && value && value !== 'none') return value.slice(0, 120)
  }
  return null
}

export function paintStyle(style: CSSStyleDeclaration): PaintStyle {
  const extra = style as CSSStyleDeclaration & { webkitMaskBoxImageSource?: string; maskBorderSource?: string }
  const maskVar = style.getPropertyValue('--official-mask-image').trim()
  const borderVar = style.getPropertyValue('--official-mask-border').trim()
  return {
    backgroundImage: style.backgroundImage,
    maskImage: unset(style.maskImage) ?? unset(maskVar),
    webkitMaskImage: style.webkitMaskImage,
    webkitMaskBoxImageSource: unset(extra.webkitMaskBoxImageSource) ?? unset(borderVar),
    maskBorderSource: unset(extra.maskBorderSource) ?? unset(borderVar),
    borderImageSource: style.borderImageSource,
  }
}

function unset(value: string | null | undefined): string | null {
  if (!value || value === 'none') return null
  return value
}

function opaqueColor(value: string): string | null {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return null
  return value
}

export function collectClientBoxes(root: ParentNode = document): ClientBoxesPayload {
  const surfaces = pickSurfaces(root)
  const primary = surfaces[0]
  const canvas = { width: primary.offsetWidth || window.innerWidth, height: primary.offsetHeight || window.innerHeight }
  const boxes: ClientBox[] = []
  const seen = new Set<Element>()
  const walk = (element: Element, surface: HTMLElement, depth: number) => {
    if (seen.has(element)) return
    seen.add(element)
    if (!(element instanceof HTMLElement)) return
    const tag = element.tagName
    if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'LINK') return
    const w = element.offsetWidth
    const h = element.offsetHeight
    if (w > 0 && h > 0) {
      const [x, y] = layoutOffset(element, surface)
      const style = getComputedStyle(element)
      const before = getComputedStyle(element, '::before')
      const beforePaints = before.content !== 'none' && before.content !== ''
      boxes.push({
        id: element.getAttribute('data-official-id') || element.getAttribute('data-uid'),
        binding: element.getAttribute('data-binding'),
        type: element.getAttribute('data-type') || tag.toLowerCase(),
        classes: String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 8),
        depth,
        x, y, w, h,
        text: boxText(element),
        font: `${style.fontFamily.split(',')[0].replace(/"/g, '')} ${style.fontSize}/${style.lineHeight}`,
        color: style.color,
        background: opaqueColor(style.backgroundColor) ?? (beforePaints ? opaqueColor(before.backgroundColor) : null) ?? style.backgroundColor,
        image: paintedImage(paintStyle(style)) ?? (beforePaints ? paintedImage(paintStyle(before)) : null),
      })
    }
    for (const child of element.children) walk(child, surface, depth + 1)
  }
  // CharacterHeader / gameMenu live on their own scaled canvas, sibling of
  // the stage. Walking only the first canvas hid every overlay from rank.
  for (const surface of surfaces) walk(surface, surface, 0)
  const named = boxes.filter((box) => box.binding || box.id).length
  const depth = boxes.reduce((max, box) => Math.max(max, box.depth), 0)
  return { canvas, count: boxes.length, named, depth, boxes }
}

export function dumpClientBoxes(options: { download?: boolean } = {}): ClientBoxesPayload {
  const payload = collectClientBoxes()
  if (options.download !== false) downloadBoxes(payload)
  return payload
}

export function installDumpClientBoxes(): () => void {
  window.__dumpClientBoxes = dumpClientBoxes
  const params = new URLSearchParams(location.search)
  if (params.get('ui-boxes') !== '1') return () => { delete window.__dumpClientBoxes }
  let cancelled = false
  const started = Date.now()
  const tick = () => {
    if (cancelled) return
    if (!document.querySelector('.official-node') && Date.now() - started < 15000) {
      requestAnimationFrame(tick)
      return
    }
    dumpClientBoxes({ download: true })
  }
  requestAnimationFrame(tick)
  return () => {
    cancelled = true
    delete window.__dumpClientBoxes
  }
}

export function layoutOffset(element: HTMLElement, surface: HTMLElement): [number, number] {
  let x = 0
  let y = 0
  let node: HTMLElement | null = element
  while (node && node !== surface) {
    x += node.offsetLeft
    y += node.offsetTop
    const parent = node.offsetParent as HTMLElement | null
    node = parent
  }
  return [x, y]
}

/** Text UITK would paint on this element — direct text nodes only.

    A leaf Label often has a sibling ``<style>`` for cascade states, so
    ``childNodes.length === 1`` is the wrong test. Descendant labels keep
    their own boxes; concatenating them here would double-count copy. */
export function boxText(element: { childNodes: ArrayLike<{ nodeType: number; textContent: string | null }> }): string | null {
  const parts: string[] = []
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType !== 3) continue
    const piece = child.textContent?.trim()
    if (piece) parts.push(piece)
  }
  const raw = parts.join(' ').trim()
  return raw ? raw.slice(0, 40) : null
}

function downloadBoxes(payload: ClientBoxesPayload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'client_boxes.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

declare global {
  interface Window {
    __dumpClientBoxes?: typeof dumpClientBoxes
  }
}

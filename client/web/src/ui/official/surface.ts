/** The official runtime surface every extracted interface is placed in, and
    the single scale factor that maps it onto the browser viewport.

    Both the HUD widgets and the windows the player opens live in this space, so
    a pointer delta means the same thing to each of them: divide by this scale
    and the number is canvas pixels. */

export const OFFICIAL_CANVAS = { width: 1920, height: 1080 }

export function surfaceScale(
  canvas: { width: number; height: number },
  viewport: { width: number; height: number },
): number {
  return Math.min(viewport.width / canvas.width, viewport.height / canvas.height)
}

/** Map a DOM box back into the official canvas, by dividing through the scale
    the surface applied. The canvas element is the origin; letterboxing lives
    around it, not inside it. */
export function canvasRectFromDom(
  element: HTMLElement,
  canvas: { width: number; height: number } = OFFICIAL_CANVAS,
): { x: number; y: number; w: number; h: number } {
  const surface = element.closest('.official-canvas')
  const box = element.getBoundingClientRect()
  if (!(surface instanceof HTMLElement)) return { x: box.left, y: box.top, w: box.width, h: box.height }
  const origin = surface.getBoundingClientRect()
  const authoredWidth = Number(surface.dataset.canvasWidth) || canvas.width
  const scale = origin.width / authoredWidth
  if (!scale) return { x: 0, y: 0, w: box.width, h: box.height }
  return {
    x: (box.left - origin.left) / scale,
    y: (box.top - origin.top) / scale,
    w: box.width / scale,
    h: box.height / scale,
  }
}

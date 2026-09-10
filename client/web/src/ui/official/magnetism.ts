/** Generic window magnetism, the `MagneticDragWindow` behaviour the official
    client applies to every widget rather than to one hand-wired window.

    A dragged edge snaps to a canvas edge, or to the facing/aligned edge of any
    window that declares `is-magnetic-for-others`. `allow-snap-preview` decides
    whether the guides this module returns are painted while the gesture is
    still running. All maths happen in canvas space, never in
    screen pixels: the caller divides pointer deltas by the surface scale. */

export type Edge = 'n' | 's' | 'e' | 'w'
export type Rect = { x: number; y: number; w: number; h: number }
export type Bounds = { width: number; height: number }
export type MagnetTarget = { id: string; rect: Rect }
/** A snapped alignment, drawn as a line across the two rectangles it joins. */
export type Guide = { axis: 'x' | 'y'; at: number; start: number; end: number }
export type SizeQuantizer = (width: number, height: number) => { width: number; height: number }

export const MAGNET_THRESHOLD = 12
export const MIN_WINDOW_PX = 48

export type MagnetOptions = {
  bounds: Bounds
  targets?: MagnetTarget[]
  /** `x/yMagneticOffset`: the gap the official window keeps once snapped. */
  offset?: { x: number; y: number }
  threshold?: number
  /** Space kept at the top of the canvas, where a title bar sits above the
      window box it belongs to. */
  insetTop?: number
  minWidth?: number
  minHeight?: number
  quantize?: SizeQuantizer
}

type Candidate = { at: number; from: number; to: number }

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Which canvas edges the rectangle currently sits against. */
export function dockedEdges(rect: Rect, bounds: Bounds, tolerance = 0.5): Edge[] {
  const edges: Edge[] = []
  if (Math.abs(rect.y) <= tolerance) edges.push('n')
  if (Math.abs(rect.x + rect.w - bounds.width) <= tolerance) edges.push('e')
  if (Math.abs(rect.y + rect.h - bounds.height) <= tolerance) edges.push('s')
  if (Math.abs(rect.x) <= tolerance) edges.push('w')
  return edges
}

/** Candidate lines on one axis: the two canvas edges, then both edges of every
    magnetic neighbour. A neighbour also contributes the span it covers on the
    other axis, which is what the guide is drawn across. */
function candidates(axis: 'x' | 'y', bounds: Bounds, targets: MagnetTarget[], insetTop: number): Candidate[] {
  const extent = axis === 'x' ? bounds.height : bounds.width
  const near = axis === 'x' ? 0 : insetTop
  const list: Candidate[] = [
    { at: near, from: 0, to: extent },
    { at: axis === 'x' ? bounds.width : bounds.height, from: 0, to: extent },
  ]
  for (const target of targets) {
    const near = axis === 'x' ? target.rect.x : target.rect.y
    const far = near + (axis === 'x' ? target.rect.w : target.rect.h)
    const from = axis === 'x' ? target.rect.y : target.rect.x
    const to = from + (axis === 'x' ? target.rect.h : target.rect.w)
    list.push({ at: near, from, to }, { at: far, from, to })
  }
  return list
}

type Snap = { delta: number; guide: Guide }

/** Best snap for a set of probe positions on one axis.

    `probes` are the rectangle edges being dragged, each paired with the gap the
    window keeps on that side once it lands. */
function bestSnap(
  axis: 'x' | 'y',
  probes: Array<{ at: number; gap: number }>,
  lines: Candidate[],
  threshold: number,
  span: { from: number; to: number },
): Snap | undefined {
  let best: Snap | undefined
  for (const probe of probes) {
    for (const line of lines) {
      const target = line.at + probe.gap
      const delta = target - probe.at
      if (Math.abs(delta) > threshold) continue
      if (best && Math.abs(delta) >= Math.abs(best.delta)) continue
      best = {
        delta,
        guide: {
          axis,
          at: line.at,
          start: Math.min(line.from, span.from),
          end: Math.max(line.to, span.to),
        },
      }
    }
  }
  return best
}

export function snapMove(rect: Rect, options: MagnetOptions): { rect: Rect; guides: Guide[] } {
  const { bounds, targets = [], threshold = MAGNET_THRESHOLD, insetTop = 0 } = options
  const gap = options.offset ?? { x: 0, y: 0 }
  const guides: Guide[] = []

  const horizontal = bestSnap('x', [
    { at: rect.x, gap: gap.x },
    { at: rect.x + rect.w, gap: -gap.x },
  ], candidates('x', bounds, targets, insetTop), threshold, { from: rect.y, to: rect.y + rect.h })
  const vertical = bestSnap('y', [
    { at: rect.y, gap: gap.y },
    { at: rect.y + rect.h, gap: -gap.y },
  ], candidates('y', bounds, targets, insetTop), threshold, { from: rect.x, to: rect.x + rect.w })

  const next = { ...rect }
  if (horizontal) { next.x += horizontal.delta; guides.push(horizontal.guide) }
  if (vertical) { next.y += vertical.delta; guides.push(vertical.guide) }
  next.x = clamp(next.x, 0, Math.max(0, bounds.width - next.w))
  next.y = clamp(next.y, insetTop, Math.max(insetTop, bounds.height - next.h))
  return { rect: next, guides }
}

/** Move only the dragged edges, keeping the opposite ones where they are. */
export function resizeRect(rect: Rect, edges: readonly Edge[], dx: number, dy: number): Rect {
  const left = edges.includes('w') ? rect.x + dx : rect.x
  const right = edges.includes('e') ? rect.x + rect.w + dx : rect.x + rect.w
  const top = edges.includes('n') ? rect.y + dy : rect.y
  const bottom = edges.includes('s') ? rect.y + rect.h + dy : rect.y + rect.h
  return { x: left, y: top, w: right - left, h: bottom - top }
}

export function snapResize(rect: Rect, edges: readonly Edge[], options: MagnetOptions): { rect: Rect; guides: Guide[] } {
  const { bounds, targets = [], threshold = MAGNET_THRESHOLD, insetTop = 0 } = options
  const gap = options.offset ?? { x: 0, y: 0 }
  const minWidth = options.minWidth ?? MIN_WINDOW_PX
  const minHeight = options.minHeight ?? MIN_WINDOW_PX
  const guides: Guide[] = []

  let left = rect.x, top = rect.y, right = rect.x + rect.w, bottom = rect.y + rect.h

  const horizontalProbes: Array<{ at: number; gap: number }> = []
  if (edges.includes('w')) horizontalProbes.push({ at: left, gap: gap.x })
  if (edges.includes('e')) horizontalProbes.push({ at: right, gap: -gap.x })
  const horizontal = horizontalProbes.length
    ? bestSnap('x', horizontalProbes, candidates('x', bounds, targets, insetTop), threshold, { from: top, to: bottom })
    : undefined
  if (horizontal) {
    if (edges.includes('w')) left += horizontal.delta
    else right += horizontal.delta
    guides.push(horizontal.guide)
  }

  const verticalProbes: Array<{ at: number; gap: number }> = []
  if (edges.includes('n')) verticalProbes.push({ at: top, gap: gap.y })
  if (edges.includes('s')) verticalProbes.push({ at: bottom, gap: -gap.y })
  const vertical = verticalProbes.length
    ? bestSnap('y', verticalProbes, candidates('y', bounds, targets, insetTop), threshold, { from: left, to: right })
    : undefined
  if (vertical) {
    if (edges.includes('n')) top += vertical.delta
    else bottom += vertical.delta
    guides.push(vertical.guide)
  }

  // The window keeps the edges the gesture did not touch, so a quantised size
  // grows away from the anchored side — a right-docked strip widens leftwards.
  const quantised = options.quantize
    ? options.quantize(right - left, bottom - top)
    : { width: right - left, height: bottom - top }
  const width = Math.max(minWidth, quantised.width)
  const height = Math.max(minHeight, quantised.height)
  const x = edges.includes('w') ? right - width : left
  const y = edges.includes('n') ? bottom - height : top

  return {
    rect: {
      x: clamp(x, 0, Math.max(0, bounds.width - width)),
      y: clamp(y, insetTop, Math.max(insetTop, bounds.height - height)),
      w: width,
      h: height,
    },
    guides,
  }
}

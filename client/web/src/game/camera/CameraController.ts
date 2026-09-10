import { Container } from 'pixi.js'

export type CameraState = {
  x: number
  y: number
  scale: number
}

export type WorldBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Extra world margin kept reachable around the playable area, in pixels. */
const BOUNDS_MARGIN = 90
const MAX_SCALE = 4
const ZOOM_IN = 1.12
const ZOOM_OUT = 0.89
// Measured from the official capture: reserve visual room for the bottom HUD
// by raising the focus, without changing the map's fitted scale.
export const MAP_FOCUS_OFFSET = 70 / 1080

export class CameraController {
  readonly world: Container
  private panning = false
  private lastX = 0
  private lastY = 0
  private minScale = 0.25
  private viewWidth = 1280
  private viewHeight = 720
  private bounds: WorldBounds | null = null
  private defaultState: CameraState = { x: 0, y: 0, scale: 1.15 }

  constructor(world: Container) {
    this.world = world
  }

  /**
   * Frame the map the way the official client does: the whole cell grid stays
   * visible at minimum zoom, the adjacent maps filling whatever screen space is
   * left over. Zooming out further would only reveal black, so it is refused,
   * and panning is clamped to the map itself.
   */
  frame(bounds: WorldBounds, viewWidth: number, viewHeight: number): void {
    this.bounds = bounds
    this.viewWidth = Math.max(1, viewWidth)
    this.viewHeight = Math.max(1, viewHeight)
    const width = Math.max(1, bounds.maxX - bounds.minX + BOUNDS_MARGIN * 2)
    const height = Math.max(1, bounds.maxY - bounds.minY + BOUNDS_MARGIN * 2)
    // "Fit" scale: the whole map is on screen, nothing of it is cut off.
    this.minScale = Math.min(MAX_SCALE, Math.min(this.viewWidth / width, this.viewHeight / height))
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const scale = this.minScale
    this.defaultState = {
      x: this.viewWidth / 2 - centerX * scale,
      y: this.viewHeight * (0.5 - MAP_FOCUS_OFFSET) - centerY * scale,
      scale,
    }
    this.apply(this.defaultState)
  }

  /** False until the map has been framed against a real viewport size. */
  get hasFraming(): boolean {
    return this.bounds !== null
  }

  /** Keep the framing valid when the window is resized. */
  resize(viewWidth: number, viewHeight: number): void {
    if (!this.bounds) {
      this.viewWidth = viewWidth
      this.viewHeight = viewHeight
      return
    }
    const state = this.getState()
    const zoomedIn = state.scale > this.minScale * 1.001
    this.frame(this.bounds, viewWidth, viewHeight)
    if (zoomedIn) {
      this.world.scale.set(Math.max(this.minScale, state.scale))
      this.world.position.set(state.x, state.y)
      this.clampPosition()
    }
  }

  apply(state: CameraState): void {
    this.world.scale.set(state.scale)
    this.world.position.set(state.x, state.y)
    this.clampPosition()
  }

  getState(): CameraState {
    return {
      x: this.world.position.x,
      y: this.world.position.y,
      scale: this.world.scale.x,
    }
  }

  zoomAvailability() { return { canIn: this.world.scale.x < MAX_SCALE, canOut: this.world.scale.x > this.minScale * 1.001 } }

  reset(): void {
    this.apply(this.defaultState)
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const scale = this.world.scale.x || 1
    return {
      x: (screenX - this.world.position.x) / scale,
      y: (screenY - this.world.position.y) / scale,
    }
  }

  zoomAt(screenX: number, screenY: number, direction: number): void {
    const oldScale = this.world.scale.x
    const factor = direction < 0 ? ZOOM_IN : ZOOM_OUT
    const next = clamp(oldScale * factor, this.minScale, MAX_SCALE)
    if (next === oldScale) {
      return
    }
    const world = this.screenToWorld(screenX, screenY)
    this.world.scale.set(next)
    this.world.position.set(screenX - world.x * next, screenY - world.y * next)
    this.clampPosition()
  }

  onPointerDown(event: Pick<PointerEvent, 'button' | 'clientX' | 'clientY'>): void {
    if (event.button === 1 || event.button === 2) {
      this.panning = true
      this.lastX = event.clientX
      this.lastY = event.clientY
    }
  }

  onPointerMove(event: Pick<PointerEvent, 'clientX' | 'clientY'>): boolean {
    if (!this.panning) {
      return false
    }
    this.world.position.x += event.clientX - this.lastX
    this.world.position.y += event.clientY - this.lastY
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.clampPosition()
    return true
  }

  onPointerUp(event: PointerEvent): void {
    if (event.button === 1 || event.button === 2) {
      this.panning = false
    }
  }

  onPointerCancel(): void { this.panning = false }

  get isPanning(): boolean {
    return this.panning
  }

  /** Never let the viewport slide outside the framed area. */
  private clampPosition(): void {
    const bounds = this.bounds
    if (!bounds) {
      return
    }
    const scale = this.world.scale.x || 1
    const left = (bounds.minX - BOUNDS_MARGIN) * scale
    const right = (bounds.maxX + BOUNDS_MARGIN) * scale
    const top = (bounds.minY - BOUNDS_MARGIN) * scale
    const bottom = (bounds.maxY + BOUNDS_MARGIN) * scale
    this.world.position.x = clampAxis(this.world.position.x, left, right, this.viewWidth)
    // Fit, pan and reset must use the same shifted frame.
    const offset = this.viewHeight * MAP_FOCUS_OFFSET
    this.world.position.y = clampAxis(this.world.position.y + offset, top, bottom, this.viewHeight) - offset
  }
}

/**
 * Position offset so that [min, max] (already scaled) covers [0, view].
 * When the content is narrower than the viewport it is centred instead.
 */
function clampAxis(position: number, min: number, max: number, view: number): number {
  const size = max - min
  if (size <= view) {
    return (view - size) / 2 - min
  }
  return clamp(position, view - max, -min)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** CSS client pixels -> Pixi logical screen pixels (not device/backing pixels). */
export function clientToScreen(
  point: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  screen: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: (point.clientX - rect.left) * screen.width / Math.max(rect.width, 1),
    y: (point.clientY - rect.top) * screen.height / Math.max(rect.height, 1),
  }
}

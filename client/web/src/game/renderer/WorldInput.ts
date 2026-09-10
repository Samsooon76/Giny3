import type { CameraController } from '../camera/CameraController'

type CameraInput = Pick<CameraController, 'zoomAt' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'isPanning'>
type WorldInputOptions = {
  camera: CameraInput
  point: (event: { clientX: number; clientY: number }) => { x: number; y: number }
  dirty: () => void
  move: (event: PointerEvent) => void
  click: (event: PointerEvent) => void
  leave: () => void
  context: (event: MouseEvent) => void
  key: (event: KeyboardEvent) => void
}

/** Owns DOM input registration and pointer gesture termination for one canvas. */
export function bindWorldInput(canvas: HTMLCanvasElement, options: WorldInputOptions, keys: EventTarget = window): () => void {
  const { camera } = options
  const wheel = (event: WheelEvent) => {
    options.dirty(); event.preventDefault()
    const point = options.point(event)
    camera.zoomAt(point.x, point.y, event.deltaY)
  }
  const down = (event: PointerEvent) => {
    options.dirty(); canvas.setPointerCapture(event.pointerId)
    const point = options.point(event)
    camera.onPointerDown({ button: event.button, clientX: point.x, clientY: point.y })
  }
  const move = (event: PointerEvent) => {
    options.dirty()
    const point = options.point(event)
    camera.onPointerMove({ clientX: point.x, clientY: point.y })
    options.move(event)
  }
  const up = (event: PointerEvent) => {
    options.dirty()
    const panning = camera.isPanning
    camera.onPointerUp(event)
    if (event.button === 0 && !panning) options.click(event)
  }
  const cancel = () => {
    options.dirty(); camera.onPointerCancel(); options.leave()
  }
  const context = (event: MouseEvent) => { event.preventDefault(); options.context(event) }
  const key = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.closest?.('[contenteditable=true]'))) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    options.key(event)
  }
  const listeners: Array<[string, EventListener]> = [
    ['wheel', wheel as EventListener], ['pointerdown', down as EventListener], ['pointermove', move as EventListener],
    ['pointerup', up as EventListener], ['pointercancel', cancel as EventListener],
    ['pointerleave', options.leave], ['contextmenu', context as EventListener],
  ]
  for (const [name, handler] of listeners) canvas.addEventListener(name, handler, name === 'wheel' ? { passive: false } : undefined)
  keys.addEventListener('keydown', key as EventListener)
  return () => {
    for (const [name, handler] of listeners) canvas.removeEventListener(name, handler)
    keys.removeEventListener('keydown', key as EventListener)
  }
}

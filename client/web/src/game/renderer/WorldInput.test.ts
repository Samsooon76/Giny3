import { expect, it, vi } from 'vitest'
import { bindWorldInput } from './WorldInput'

it('ends cancelled gestures without activating the world and removes every listener on disposal', () => {
  const canvas = Object.assign(new EventTarget(), { setPointerCapture: vi.fn() }) as unknown as HTMLCanvasElement
  const keys = new EventTarget()
  const camera = { zoomAt: vi.fn(), onPointerDown: vi.fn(), onPointerMove: vi.fn(), onPointerUp: vi.fn(), onPointerCancel: vi.fn(), isPanning: false }
  const click = vi.fn(), leave = vi.fn(), key = vi.fn(), dirty = vi.fn()
  const dispose = bindWorldInput(canvas, { camera, point: () => ({ x: 12, y: 24 }), dirty, move: vi.fn(), click, leave, context: vi.fn(), key }, keys)
  const pointer = (name: string) => Object.assign(new Event(name), { pointerId: 1, button: 0, clientX: 50, clientY: 60 })
  canvas.dispatchEvent(pointer('pointerdown'))
  canvas.dispatchEvent(pointer('pointercancel'))
  expect(camera.onPointerCancel).toHaveBeenCalledOnce()
  expect(leave).toHaveBeenCalledOnce()
  expect(click).not.toHaveBeenCalled()
  canvas.dispatchEvent(pointer('pointerup'))
  expect(click).toHaveBeenCalledOnce()
  camera.isPanning = true
  canvas.dispatchEvent(pointer('pointerup'))
  expect(click).toHaveBeenCalledOnce()
  keys.dispatchEvent(Object.assign(new Event('keydown'), { ctrlKey: true }))
  expect(key).not.toHaveBeenCalled()
  keys.dispatchEvent(new Event('keydown'))
  expect(key).toHaveBeenCalledOnce()
  const before = dirty.mock.calls.length
  dispose(); dispose()
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel']) canvas.dispatchEvent(pointer(name))
  keys.dispatchEvent(new Event('keydown'))
  expect(dirty).toHaveBeenCalledTimes(before)
  expect(key).toHaveBeenCalledOnce()
})

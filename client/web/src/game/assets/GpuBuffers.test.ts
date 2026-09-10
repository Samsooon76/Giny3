import { expect, it, vi } from 'vitest'
import { trackGpuBuffers } from './GpuBuffers'
function fixture() {
  let bound: object | null = {}
  const gl = { bufferData: vi.fn(), bufferSubData: vi.fn(), deleteBuffer: vi.fn(), getParameter: vi.fn(() => bound) } as unknown as WebGLRenderingContext
  return { gl, bind: (value: object | null) => { bound = value } }
}
it('counts allocations, resized storage and VAO-specific index bindings without double counting', () => {
  const { gl, bind } = fixture(), original = gl.bufferData, tracker = trackGpuBuffers(gl)
  const vertex = {}, index = {}
  bind(vertex); gl.bufferData(0x8892, 100, 0x88e8)
  gl.bufferData(0x8892, 60, 0x88e8)
  bind(index); gl.bufferData(0x8893, new Uint16Array(20), 0x88e8)
  expect(tracker.snapshot()).toMatchObject({ buffers: 2, bufferBytes: 100, peakBufferBytes: 100, unknownTargets: 0 })
  gl.deleteBuffer(vertex); expect(tracker.snapshot().bufferBytes).toBe(40)
  tracker.release(); expect(gl.bufferData).toBe(original)
  expect(tracker.snapshot().bufferBytes).toBe(0)
})
it('handles WebGL 2 source ranges and resets storage on context loss', () => {
  const { gl } = fixture(), tracker = trackGpuBuffers(gl)
  ;(gl as WebGL2RenderingContext).bufferData(0x8892, new Float32Array(10), 0x88e8, 2, 3)
  expect(tracker.snapshot().bufferBytes).toBe(12)
  ;(gl as WebGL2RenderingContext).bufferData(0x8892, new Float32Array(10), 0x88e8, 2, 0)
  expect(tracker.snapshot().bufferBytes).toBe(32)
  tracker.reset(); expect(tracker.snapshot()).toMatchObject({ buffers: 0, bufferBytes: 0 })
  tracker.release()
})

it('distinguishes uploaded buffer ranges from reserved storage', () => {
  const { gl } = fixture(), tracker = trackGpuBuffers(gl)
  gl.bufferData(0x8892, 64, 0x88e8)
  expect(tracker.snapshot().uploadedBufferBytes).toBe(0)
  gl.bufferSubData(0x8892, 0, new Float32Array(8))
  ;(gl as WebGL2RenderingContext).bufferSubData(0x8892, 0, new Float32Array(8), 1, 2)
  expect(tracker.snapshot()).toMatchObject({ bufferBytes: 64, uploadedBufferBytes: 40 })
  gl.bufferData(0x8892, new Uint16Array(10), 0x88e8)
  expect(tracker.snapshot()).toMatchObject({ bufferBytes: 20, uploadedBufferBytes: 60, uploadCalls: 3 })
  tracker.release()
})

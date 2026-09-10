type GL = WebGLRenderingContext | WebGL2RenderingContext
const bindings: Record<number, number> = {
  0x8892: 0x8894, 0x8893: 0x8895, 0x8f36: 0x8f36, 0x8f37: 0x8f37,
  0x88eb: 0x88ed, 0x88ec: 0x88ef, 0x8c8e: 0x8c8f, 0x8a11: 0x8a28,
}
/** Tracks buffer storage requests, including replacements and deletion.
 * Binding queries occur only at allocation, so VAO-owned index buffers are handled
 * correctly without adding work to draw calls or bufferSubData uploads. */
export function trackGpuBuffers(gl: GL) {
  const buffers = new Map<WebGLBuffer, number>()
  let bytes = 0, peakBytes = 0, allocations = 0, unknownTargets = 0
  let uploadedBufferBytes = 0, uploadCalls = 0
  const originalSubData = gl.bufferSubData
  const originalData = gl.bufferData, originalDelete = gl.deleteBuffer
  const data = function (...args: unknown[]) {
    Reflect.apply(originalData, gl, args)
    const binding = bindings[Number(args[0])]
    if (binding === undefined) { unknownTargets++; return }
    const buffer = gl.getParameter(binding) as WebGLBuffer | null
    if (!buffer) return
    const source = args[1]
    let size: number
    if (typeof source === 'number') size = source
    else if (source && typeof source === 'object' && 'byteLength' in source) {
      const array = source as { byteLength: number; BYTES_PER_ELEMENT?: number }
      const stride = array.BYTES_PER_ELEMENT ?? 1
      const offset = Number(args[3] ?? 0), length = Number(args[4] ?? 0)
      size = length ? length * stride : array.byteLength - offset * stride
    } else return
    if (!Number.isFinite(size) || size < 0) return
    if (typeof source !== 'number') { uploadedBufferBytes += size; uploadCalls++ }
    bytes += size - (buffers.get(buffer) ?? 0)
    buffers.set(buffer, size); allocations++; peakBytes = Math.max(peakBytes, bytes)
  } as typeof gl.bufferData
  const remove = function (buffer: WebGLBuffer | null) {
    originalDelete.call(gl, buffer)
    if (!buffer) return
    bytes -= buffers.get(buffer) ?? 0; buffers.delete(buffer)
  }
  const subData = function (...args: unknown[]) {
    Reflect.apply(originalSubData, gl, args)
    const source = args[2] as { byteLength: number; BYTES_PER_ELEMENT?: number } | null
    if (!source) return
    const stride = source.BYTES_PER_ELEMENT ?? 1, offset = Number(args[3] ?? 0), length = Number(args[4] ?? 0)
    const size = length ? length * stride : source.byteLength - offset * stride
    if (Number.isFinite(size) && size >= 0) { uploadedBufferBytes += size; uploadCalls++ }
  } as typeof gl.bufferSubData
  gl.bufferData = data; gl.deleteBuffer = remove; gl.bufferSubData = subData
  const reset = () => { buffers.clear(); bytes = 0 }
  return {
    snapshot: () => ({ buffers: buffers.size, bufferBytes: bytes, peakBufferBytes: peakBytes, allocations, unknownTargets, uploadedBufferBytes, uploadCalls }),
    reset,
    release() {
      if (gl.bufferSubData === subData) gl.bufferSubData = originalSubData
      if (gl.bufferData === data) gl.bufferData = originalData
      if (gl.deleteBuffer === remove) gl.deleteBuffer = originalDelete
      reset()
    },
  }
}

import { expect, it, vi } from 'vitest'
import { trackGpuImages } from './GpuImages'
function fixture() {
  let bound: object = {}, renderbuffer: object = {}
  const methods = ['texSubImage2D', 'texSubImage3D', 'compressedTexSubImage2D', 'compressedTexSubImage3D', 'texImage2D', 'texImage3D', 'texStorage2D', 'texStorage3D', 'compressedTexImage2D', 'compressedTexImage3D', 'copyTexImage2D', 'generateMipmap', 'deleteTexture', 'renderbufferStorage', 'renderbufferStorageMultisample', 'deleteRenderbuffer']
  const gl = { ...Object.fromEntries(methods.map(name => [name, vi.fn()])), getParameter: vi.fn((binding: number) => binding === 0x8ca7 ? renderbuffer : bound) } as unknown as WebGL2RenderingContext
  return { gl, bind: (value: object) => { bound = value }, renderbuffer: (value: object) => { renderbuffer = value } }
}
it('replaces texture levels and counts independent float textures without coercing pixel data', () => {
  const { gl, bind } = fixture(), tracker = trackGpuImages(gl), first = {}, second = {}
  bind(first)
  const pixels = new Uint8Array(64); pixels.toString = () => { throw new Error('Pixel buffer coerced') }
  gl.texImage2D(0xde1, 0, 0x1908, 4, 4, 0, 0x1908, 0x1401, pixels)
  gl.texImage2D(0xde1, 0, 0x1908, 8, 4, 0, 0x1908, 0x1401, null)
  bind(second); gl.texImage2D(0xde1, 0, 0x8814, 2, 4, 0, 0x1908, 0x1406, null)
  expect(tracker.snapshot()).toMatchObject({ textures: 2, textureBytes: 256, unmeasuredAllocations: 0 })
  gl.deleteTexture(first); expect(tracker.snapshot().textureBytes).toBe(128)
  tracker.release()
})
it('counts compressed blocks, cube faces, array layers and 3D mip levels', () => {
  const { gl, bind } = fixture(), tracker = trackGpuImages(gl)
  gl.compressedTexImage2D(0xde1, 0, 0x8e8c, 7, 5, 0, new Uint8Array(64))
  expect(tracker.snapshot().textureBytes).toBe(64)
  bind({}); gl.texStorage2D(0x8513, 2, 0x8058, 2, 2)
  bind({}); gl.texStorage3D(0x8c1a, 3, 0x8058, 4, 4, 3)
  bind({}); gl.texStorage3D(0x806f, 3, 0x8058, 4, 4, 4)
  expect(tracker.snapshot().textureBytes).toBe(64 + 120 + 252 + 292)
  tracker.release()
})
it('counts generated mips and multisampled attachments and reports unknown formats', () => {
  const { gl, bind, renderbuffer } = fixture(), tracker = trackGpuImages(gl), unknown = {}, attachment = {}
  gl.texImage2D(0xde1, 0, 0x1908, 4, 4, 0, 0x1908, 0x1401, null)
  gl.generateMipmap(0xde1)
  expect(tracker.snapshot().textureBytes).toBe(84)
  renderbuffer(attachment)
  gl.renderbufferStorageMultisample(0x8d41, 4, 0x88f0, 10, 10)
  expect(tracker.snapshot().renderbufferBytes).toBe(1600)
  bind(unknown); gl.texStorage2D(0xde1, 1, 0xdead, 2, 2)
  expect(tracker.snapshot().unmeasuredAllocations).toBe(1)
  gl.deleteTexture(unknown); expect(tracker.snapshot().unmeasuredAllocations).toBe(0)
  gl.deleteRenderbuffer(attachment)
  expect(tracker.snapshot().renderbufferBytes).toBe(0)
  tracker.reset(); expect(tracker.snapshot()).toMatchObject({ textures: 0, textureBytes: 0, renderbufferBytes: 0 })
  tracker.release()
})

it('counts input upload bytes separately from texture storage and subimage updates', () => {
  const { gl, bind } = fixture(), tracker = trackGpuImages(gl)
  gl.texImage2D(0xde1, 0, 0x881a, 2, 2, 0, 0x1908, 0x1406, new Float32Array(16))
  expect(tracker.snapshot()).toMatchObject({ textureBytes: 32, uploadedTextureBytes: 64 })
  gl.texSubImage2D(0xde1, 0, 0, 0, 1, 1, 0x1908, 0x1406, new Float32Array(4))
  gl.texImage2D(0xde1, 0, 0x881a, 2, 2, 0, 0x1908, 0x1406, null)
  expect(tracker.snapshot()).toMatchObject({ textureBytes: 32, uploadedTextureBytes: 80 })
  bind({}); gl.compressedTexImage2D(0xde1, 0, 0x8e8c, 8, 8, 0, new Uint8Array(64))
  gl.compressedTexSubImage2D(0xde1, 0, 0, 0, 4, 4, 0x8e8c, new Uint8Array(16))
  expect(tracker.snapshot()).toMatchObject({ textureBytes: 96, uploadedTextureBytes: 160, unmeasuredUploadCalls: 0 })
  tracker.release()
})

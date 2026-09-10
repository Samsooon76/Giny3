import { gpuImageBytes } from './gpuFormatBytes'
type GL = WebGLRenderingContext | WebGL2RenderingContext
type Level = { width: number; height: number; depth: number; internal: number; format?: number; type?: number; bytes: number | null }
const textureBindings: Record<number, number> = { 0x0de1: 0x8069, 0x8513: 0x8514, 0x806f: 0x806a, 0x8c1a: 0x8c1d }
const bindingTarget = (target: number) => target >= 0x8515 && target <= 0x851a ? 0x8513 : target
export function trackGpuImages(gl: GL) {
  const textures = new Map<WebGLTexture, Map<string, Level>>(), renderbuffers = new Map<WebGLRenderbuffer, number | null>()
  const restore: Array<() => void> = []
  let textureBytes = 0, renderbufferBytes = 0, unknown = 0
  let uploadedTextureBytes = 0, textureUploadCalls = 0, unmeasuredUploadCalls = 0
  const upload = (bytes: number | null) => { textureUploadCalls++; if (bytes === null) unmeasuredUploadCalls++; else uploadedTextureBytes += bytes }
  const api = gl as unknown as Record<string, (...args: unknown[]) => unknown>
  function hook(name: string, record: (args: unknown[]) => void) {
    const original = api[name]
    if (typeof original !== 'function') return
    const wrapped = (...args: unknown[]) => { const result = original.apply(gl, args); record(args); return result }
    api[name] = wrapped
    restore.push(() => { if (api[name] === wrapped) api[name] = original })
  }
  function texture(target: number) {
    const binding = textureBindings[bindingTarget(target)]
    return binding === undefined ? null : gl.getParameter(binding) as WebGLTexture | null
  }
  function set(target: number, level: number, value: Level) {
    const source = texture(target)
    if (!source) return
    let levels = textures.get(source)
    if (!levels) { levels = new Map(); textures.set(source, levels) }
    const key = `${target}:${level}`, previous = levels.get(key)
    textureBytes -= previous?.bytes ?? 0
    if (previous?.bytes === null) unknown--
    levels.set(key, value); textureBytes += value.bytes ?? 0
    if (value.bytes === null) unknown++
  }
  function image(target: number, level: number, internal: number, width: number, height: number, depth: number, format?: number, type?: number, bytes?: number, transferred = false) {
    if (transferred) upload(bytes ?? gpuImageBytes(format ?? internal, width, height, depth, format, type))
    set(target, level, { internal, width, height, depth, format, type, bytes: bytes ?? gpuImageBytes(internal, width, height, depth, format, type) })
  }
  hook('texImage2D', args => {
    const [target, level, internal] = args.slice(0, 3).map(Number)
    if (args.length >= 9) image(target, level, internal, Number(args[3]), Number(args[4]), 1, Number(args[6]), Number(args[7]), undefined, args[8] != null)
    else {
      const source = args[5] as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number } | null
      if (source) image(target, level, internal, source.videoWidth || source.naturalWidth || source.width || 0, source.videoHeight || source.naturalHeight || source.height || 0, 1, Number(args[3]), Number(args[4]), undefined, true)
    }
  })
  hook('copyTexImage2D', args => image(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[5]), Number(args[6]), 1, Number(args[2]), 0x1401))
  hook('texImage3D', args => image(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5]), Number(args[7]), Number(args[8]), undefined, args[9] != null))
  for (const name of ['compressedTexImage2D', 'compressedTexImage3D']) hook(name, args => {
    const d3 = name.endsWith('3D'), at = d3 ? 7 : 6, data = args[at]
    let bytes: number | undefined
    if (typeof data === 'number') bytes = data
    else if (data && typeof data === 'object' && 'byteLength' in data) bytes = Number(args[at + 2]) || Number(data.byteLength) - Number(args[at + 1] ?? 0)
    image(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]), Number(args[4]), d3 ? Number(args[5]) : 1, undefined, undefined, bytes, data != null)
  })
  hook('texSubImage2D', args => {
    const source = args.length >= 9 ? args[8] : args[6]
    if (source == null) return
    if (args.length >= 9) upload(gpuImageBytes(Number(args[6]), Number(args[4]), Number(args[5]), 1, Number(args[6]), Number(args[7])))
    else {
      const image = source as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number }
      upload(gpuImageBytes(Number(args[4]), image.videoWidth || image.naturalWidth || image.width || 0, image.videoHeight || image.naturalHeight || image.height || 0, 1, Number(args[4]), Number(args[5])))
    }
  })
  hook('texSubImage3D', args => { if (args[10] != null) upload(gpuImageBytes(Number(args[8]), Number(args[5]), Number(args[6]), Number(args[7]), Number(args[8]), Number(args[9]))) })
  for (const name of ['compressedTexSubImage2D', 'compressedTexSubImage3D']) hook(name, args => {
    const at = name.endsWith('3D') ? 9 : 7, source = args[at]
    if (typeof source === 'number') upload(source)
    else if (source && typeof source === 'object' && 'byteLength' in source) upload(Number(args[at + 2]) || Number(source.byteLength) - Number(args[at + 1] ?? 0))
  })
  for (const name of ['texStorage2D', 'texStorage3D']) hook(name, args => {
    const [target, levels, internal, width, height] = args.map(Number), depth = name.endsWith('3D') ? Number(args[5]) : 1
    for (let level = 0; level < levels; level++) for (const face of target === 0x8513 ? [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851a] : [target]) {
      image(face, level, internal, Math.max(1, width >> level), Math.max(1, height >> level), target === 0x806f ? Math.max(1, depth >> level) : depth)
    }
  })
  hook('generateMipmap', args => {
    const target = Number(args[0]), source = texture(target), levels = source && textures.get(source)
    if (!levels) return
    for (const [key, base] of [...levels]) {
      if (!key.endsWith(':0')) continue
      const face = Number(key.split(':')[0]), count = Math.floor(Math.log2(Math.max(base.width, base.height, target === 0x806f ? base.depth : 1)))
      for (let level = 1; level <= count; level++) image(face, level, base.internal, Math.max(1, base.width >> level), Math.max(1, base.height >> level), target === 0x806f ? Math.max(1, base.depth >> level) : base.depth, base.format, base.type)
    }
  })
  hook('deleteTexture', args => {
    const source = args[0] as WebGLTexture, levels = textures.get(source)
    if (!levels) return
    for (const level of levels.values()) { textureBytes -= level.bytes ?? 0; if (level.bytes === null) unknown-- }
    textures.delete(source)
  })
  for (const name of ['renderbufferStorage', 'renderbufferStorageMultisample']) hook(name, args => {
    const source = gl.getParameter(0x8ca7) as WebGLRenderbuffer | null
    if (!source) return
    const multi = name.endsWith('Multisample'), offset = multi ? 1 : 0
    const size = gpuImageBytes(Number(args[1 + offset]), Number(args[2 + offset]), Number(args[3 + offset]))
    const previous = renderbuffers.get(source)
    renderbufferBytes -= previous ?? 0; if (previous === null) unknown--
    const bytes = size === null ? null : size * Math.max(1, multi ? Number(args[1]) : 1)
    renderbuffers.set(source, bytes); renderbufferBytes += bytes ?? 0; if (bytes === null) unknown++
  })
  hook('deleteRenderbuffer', args => {
    const source = args[0] as WebGLRenderbuffer, bytes = renderbuffers.get(source)
    renderbufferBytes -= bytes ?? 0; if (bytes === null) unknown--
    renderbuffers.delete(source)
  })
  const reset = () => { textures.clear(); renderbuffers.clear(); textureBytes = 0; renderbufferBytes = 0; unknown = 0 }
  return { reset, snapshot: () => ({ textures: textures.size, textureBytes, renderbuffers: renderbuffers.size, renderbufferBytes, unmeasuredAllocations: unknown, uploadedTextureBytes, textureUploadCalls, unmeasuredUploadCalls }),
    release() { for (const undo of restore) undo(); reset() } }
}

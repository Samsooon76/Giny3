import { parseEntityLook } from './look'
import type {
  Affine6,
  EntityAnimation,
  EntityFrameNode,
  EntityLeaf,
  EntityPart,
  ParsedLook,
  WebEntityData,
} from './types'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function affine(value: unknown): Affine6 {
  const list = asArray(value)
  return [
    num(list[0], 1),
    num(list[1], 0),
    num(list[2], 0),
    num(list[3], 0),
    num(list[4], 1),
    num(list[5], 0),
  ]
}

function vec4(
  value: unknown,
  fallback: [number, number, number, number],
): [number, number, number, number] {
  const list = asArray(value)
  return [
    num(list[0], fallback[0]),
    num(list[1], fallback[1]),
    num(list[2], fallback[2]),
    num(list[3], fallback[3]),
  ]
}

function adaptLook(raw: unknown, fallbackScale: number): ParsedLook {
  const look = asRecord(raw)
  const parsed = typeof look.raw === 'string' ? parseEntityLook(look.raw) : null
  if (parsed) {
    return parsed
  }
  const colors: Record<string, string> = {}
  const colorSource = asRecord(look.colors)
  for (const [key, value] of Object.entries(colorSource)) {
    if (typeof value === 'string') {
      colors[key] = value
    }
  }
  const scales = asArray(look.scales).map((item) => num(item, 100))
  return {
    raw: typeof look.raw === 'string' ? look.raw : '',
    boneId: num(look.bone_id ?? look.boneId, 1),
    skinIds: asArray(look.skin_ids ?? look.skinIds).map((item) => num(item, 0)),
    colors,
    scales,
    scale: num(look.scale, fallbackScale),
  }
}

function packedArgb(value: number): [number, number, number, number] {
  const a = ((value >>> 24) & 0xff) / 128
  const r = ((value >>> 16) & 0xff) / 128
  const g = ((value >>> 8) & 0xff) / 128
  const b = (value & 0xff) / 128
  return [r, g, b, a > 0 ? a : 1]
}

function adaptVertices(raw: unknown): EntityLeaf['vertices'] {
  return asArray(raw).map((item) => {
    const vertex = asRecord(item)
    return {
      x: num(vertex.x),
      y: num(vertex.y),
      u: num(vertex.u),
      v: num(vertex.v),
      mul: vec4(vertex.mul ?? vertex.multiplicative, [1, 1, 1, 1]),
      add: vec4(vertex.add ?? vertex.additive, [0, 0, 0, 0]),
    }
  })
}

function adaptLeaf(raw: unknown, fallbackTexture = ''): EntityLeaf | null {
  const leaf = asRecord(raw)
  const vertices = adaptVertices(leaf.vertices)
  const indices = asArray(leaf.indices).map((item) => num(item, 0))
  if (vertices.length === 0 || indices.length === 0) {
    return null
  }
  const indexed = leaf.indexed_color ?? leaf.indexedColor
  const texture = typeof leaf.texture === 'string' && leaf.texture ? leaf.texture : fallbackTexture
  return {
    texture,
    indexedColor: indexed == null || indexed === '' ? null : num(indexed),
    skinTransform: affine(leaf.skin_transform ?? leaf.skinTransform),
    vertices,
    indices,
  }
}

function adaptPart(raw: unknown, fallbackTexture: string): EntityPart {
  const part = asRecord(raw)
  const fromLeaves = asArray(part.leaves)
    .map((leaf) => adaptLeaf(leaf, fallbackTexture))
    .filter((leaf): leaf is EntityLeaf => leaf !== null)
  if (fromLeaves.length > 0) {
    return { leaves: fromLeaves }
  }
  const fromChunks = asArray(part.chunks)
    .map((chunk) => adaptLeaf(chunk, fallbackTexture))
    .filter((leaf): leaf is EntityLeaf => leaf !== null)
  return { leaves: fromChunks }
}

function adaptNode(raw: unknown): EntityFrameNode | null {
  const node = asRecord(raw)
  const partRef = String(node.part_ref ?? node.partRef ?? node.graphic ?? '')
  if (!partRef || node.visible === false || node.drawable === false) {
    return null
  }
  const color = asRecord(node.color)
  let multiplicative = vec4(color.multiplicative, [1, 1, 1, 1])
  let additive = vec4(color.additive, [0, 0, 0, 0])
  let alpha = num(color.alpha, 1)
  const packed = asArray(node.color_u32 ?? node.colorU32)
  if (!node.color && packed.length > 0) {
    multiplicative = packedArgb(num(packed[0]))
    if (packed.length > 1) {
      additive = packedArgb(num(packed[1]))
    }
    alpha = multiplicative[3]
  }
  const selected = node.visible_leaf_indices ?? node.visibleLeafIndices
  const filters = asArray(node.filters).map((item) => {
    const rec = asRecord(item)
    return {
      kind: num(rec.kind),
      matrix: Array.isArray(rec.matrix) ? rec.matrix.map((value) => num(value)) : undefined,
      payloadHex: typeof rec.payload_hex === 'string' ? rec.payload_hex : typeof rec.payloadHex === 'string' ? rec.payloadHex : undefined,
    }
  })
  const matrix = asArray(node.color_matrix ?? node.colorMatrix).map((value) => num(value))
  return {
    slot: num(node.slot ?? node.node, -1),
    partRef,
    visible: true,
    transform: affine(node.transform),
    color: { multiplicative, additive, alpha },
    visibleLeafIndices: Array.isArray(selected)
      ? selected.map((item) => num(item, 0))
      : null,
    mask: node.mask == null ? undefined : num(node.mask),
    blend: node.blend == null ? undefined : num(node.blend),
    filters: filters.length ? filters : undefined,
    colorMatrix: matrix.length ? matrix : undefined,
  }
}

export function adaptAnimation(name: string, raw: unknown, fallbackRate: number): EntityAnimation {
  const anim = asRecord(raw)
  const frames = asArray(anim.frames).map((frame) =>
    asArray(frame)
      .map((node) => adaptNode(node))
      .filter((node): node is EntityFrameNode => node !== null),
  )
  return {
    name: typeof anim.name === 'string' ? anim.name : name,
    frameCount: num(anim.frame_count ?? anim.frameCount, frames.length),
    frameRate: num(anim.frame_rate ?? anim.frameRate, fallbackRate),
    events: asArray(anim.events).map(asRecord).filter(e => typeof e.text === 'string').map(e => ({ frame: num(e.frame), text: String(e.text) })),
    frames,
  }
}

export function adaptEntityDocument(raw: unknown): WebEntityData {
  const doc = asRecord(raw)
  const frameRate = num(doc.frame_rate ?? doc.frameRate, 25)
  const scale = num(doc.scale, 1)
  const fallbackTexture = typeof doc.texture === 'string' ? doc.texture : ''
  const partsRaw = asRecord(doc.parts)
  const parts: Record<string, EntityPart> = {}
  for (const [ref, value] of Object.entries(partsRaw)) {
    parts[ref] = adaptPart(value, fallbackTexture)
  }
  const animationFiles = Object.fromEntries(Object.entries(asRecord(doc.animation_files)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  const animationsRaw = asRecord(doc.animations)
  const animations: Record<string, EntityAnimation> = {}
  for (const [name, value] of Object.entries(animationsRaw)) {
    const animation = adaptAnimation(name, value, frameRate)
    if (animationFiles[name] || animation.frames.some((frame) => frame.length > 0)) {
      animations[name] = animation
    }
  }
  return {
    format: typeof doc.format === 'string' ? doc.format : '',
    boneId: num(doc.bone_id ?? doc.boneId, 1),
    scale,
    frameRate,
    look: adaptLook(doc.look, scale),
    parts,
    animations,
    animationFiles,
    defaultAnimationName: typeof doc.default_animation_name === 'string' ? doc.default_animation_name : undefined,
    colorEncoding: typeof doc.color_encoding === 'string' ? doc.color_encoding : undefined,
  }
}

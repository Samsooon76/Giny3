export type Affine6 = [number, number, number, number, number, number]

export type EntityVertex = {
  x: number
  y: number
  u: number
  v: number
  mul: [number, number, number, number]
  add: [number, number, number, number]
}

export type EntityLeaf = {
  texture: string
  indexedColor: number | null
  skinTransform: Affine6
  vertices: EntityVertex[]
  indices: number[]
}

export type EntityPart = {
  leaves: EntityLeaf[]
}

export type EntityNodeColor = {
  multiplicative: [number, number, number, number]
  additive: [number, number, number, number]
  alpha: number
}

export type EntityFrameNode = {
  slot: number
  partRef: string
  visible: boolean
  transform: Affine6
  color: EntityNodeColor
  visibleLeafIndices: number[] | null
  mask?: number
  blend?: number
  filters?: Array<{ kind: number; matrix?: number[]; payloadHex?: string }>
  colorMatrix?: number[]
}

export type EntityAnimation = {
  name: string
  frameCount: number
  events?: Array<{ frame: number; text: string }>
  frameRate: number
  frames: EntityFrameNode[][]
}

export type ParsedLook = {
  raw: string
  boneId: number
  skinIds: number[]
  colors: Record<string, string>
  scales: number[]
  scale: number
}

export type WebEntityData = {
  format: string
  boneId: number
  scale: number
  frameRate: number
  look: ParsedLook
  parts: Record<string, EntityPart>
  animations: Record<string, EntityAnimation>
  animationFiles?: Record<string, string>
  defaultAnimationName?: string
  colorEncoding?: string
}

export const DEFAULT_ENTITY_DOCUMENT = 'entities/look_1_10_2012.json'

export type DirectionalPose = {
  name: string
  mirror: boolean
}

/** Conservative retained-data estimate, without allocating a second JSON copy. */
export function estimateEntityBytes(data: WebEntityData): number {
  let bytes = 1024
  for (const part of Object.values(data.parts)) for (const leaf of part.leaves) {
    bytes += 256 + leaf.texture.length * 2 + leaf.vertices.length * 160 + leaf.indices.length * 8
  }
  return bytes + estimateEntityAnimationBytes(data.animations)
}
export function estimateEntityAnimationBytes(animations: WebEntityData['animations']): number {
  let bytes = 0
  for (const animation of Object.values(animations)) for (const frame of animation.frames) bytes += 32 + frame.length * 256
  return bytes
}

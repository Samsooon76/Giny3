/** Versioned map-effect contract. Optional fields are neutral when absent. */

export const CURRENT_EFFECTS_VERSION = 1

export type EffectTextureCategory =
  | 'particles'
  | 'noises'
  | 'masks'
  | 'mapgfx'
  | 'emissive'
  | 'wind'
  | 'wave'
  | string

export type EffectTextureRef = {
  category: EffectTextureCategory
  id: number
  path: string
  field?: string | null
}

export type EffectFamilyStatus =
  | 'supported'
  | 'export_incomplete'
  | 'render_absent'
  | 'source_missing'
  | 'invalid'
  | 'semantics_unknown'

export type Vec2 = { x: number; y: number }
export type Vec3 = { x: number; y: number; z: number }

export type BlendRaw = {
  sourceFactor: number
  destinationFactor: number
  blendOperation: number
}

export type ParameterBlock = Record<string, unknown> & {
  _type?: string
  _textures?: EffectTextureRef[]
}

export type MapMaterial = {
  shader: string
  blend: string
  gfxId: number
  parameters: Record<string, ParameterBlock>
  uniforms?: Record<string, unknown>
  blendRaw?: BlendRaw
  albedo?: EffectTextureRef
  stagingId?: string
  unique?: boolean
}

export type WindEnvironment = {
  active: boolean
  parameters: ParameterBlock | null
}

export type WaveEnvironment = {
  active: boolean
  parameters: ParameterBlock | null
}

export type NoiseEnvironment = {
  active: boolean
  parameters: ParameterBlock | null
}

export type PostProcessEnvironment = {
  active: boolean
  parameters: ParameterBlock[]
}

export type MapEnvironment = {
  wind: WindEnvironment
  wave: WaveEnvironment
  noise: NoiseEnvironment
  postProcess: PostProcessEnvironment
}

export type RefractionInstance = {
  order: number
  gfxId: number
  layer: 'refraction'
  hostMaterialLayer: 'background' | 'sortable' | 'foreground'
  materialIndex: number
  displayBehaviour: number
  colorU32: number
  transform: {
    m11: number
    m12: number
    m21: number
    m22: number
    m31: number
    m32: number
  }
  shader: string
  blend: string
  parameters: Record<string, ParameterBlock>
  uniforms?: Record<string, unknown>
  blendRaw?: BlendRaw
}

export type EffectSequenceEffect = {
  type: string
  visual: boolean
  targets: unknown
  parameters: ParameterBlock
}

export type EffectSequenceShot = {
  id: string
  previousShot: string
  delay: number
  duration: number
  skipIfInstant: boolean
  effects: EffectSequenceEffect[]
}

export type EffectSequence = {
  id: string
  uniqueId: number
  exclusiveGroupId: string
  exclusivityResolveMethod: number
  type: string
  shots: EffectSequenceShot[]
}

export type EffectCoverageIssue = {
  family: string
  status: EffectFamilyStatus
  detail?: string
}

export type EffectCoverage = {
  families: string[]
  status: Record<string, EffectFamilyStatus>
  issues: EffectCoverageIssue[]
  complete: boolean
  unknownVersion?: number
}

export type EffectTickContext = {
  time: number
  dt: number
  camera: { x: number; y: number; scale: number }
  viewport: { width: number; height: number }
  visible: boolean
  worldOffset: { x: number; y: number }
  renderer?: unknown
}

export type EffectSnapshot = {
  waveInstances?: number
  emissiveInstances?: number
  materialInstances?: { color: number; textureOffset: number; alphaClip: number; dissolve?: number; distortion?: number }
  active: number
  ignored: number
  missingTextures: number
  cpuMs: number
  renderTargetBytes: number
  passes: number
  particlesCapped: number
  families: string[]
}

export function emptyEnvironment(): MapEnvironment {
  return {
    wind: { active: false, parameters: null },
    wave: { active: false, parameters: null },
    noise: { active: false, parameters: null },
    postProcess: { active: false, parameters: [] },
  }
}

export function emptyCoverage(): EffectCoverage {
  return { families: [], status: {}, issues: [], complete: true }
}

export function emptySnapshot(): EffectSnapshot {
  return {
    active: 0,
    ignored: 0,
    missingTextures: 0,
    cpuMs: 0,
    renderTargetBytes: 0,
    passes: 0,
    particlesCapped: 0,
    families: [],
  }
}

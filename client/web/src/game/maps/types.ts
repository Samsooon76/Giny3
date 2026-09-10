import type { ParticleDefinition } from '../particles/parameters'
import type {
  EffectCoverage,
  EffectSequence,
  EffectTextureRef,
  MapEnvironment,
  MapMaterial,
  RefractionInstance,
} from '../effects/types'
export type MapLayerName =
  | 'background'
  | 'sortable'
  | 'foreground'
  | 'animated'
  | 'refraction'
  | 'particles'
  | 'unknown'

export type AffineTransform = {
  m11: number
  m12: number
  m21: number
  m22: number
  m31: number
  m32: number
}

export type MapCell = {
  cellId: number
  x: number
  y: number
  mov: number
  los: number
  speed: number
  moveZone: number
  linkedZone: number
  mapChangeData: number
  visible: number
  nonWalkableDuringFight: number
  nonWalkableDuringRp: number
  floor: number
}

export type GfxInfo = {
  id: number
  texture: string
  frame?: [number, number, number, number]
  bc7Texture?: string
  width: number
  height: number
  pivot: [number, number]
  offset: [number, number]
  pixelsPerUnit: number
}

/**
 * How an element's material composites it, resolved by the extractor from the
 * layer's `ShaderBlendingParameters`.
 *
 * `none` means the material scales the source by zero: the element contributes
 * nothing and must not be drawn. Drawing it plainly instead paints an opaque
 * rectangle over the map — that is what washed out the interior maps.
 */
export type MapBlend = 'normal' | 'add' | 'multiply' | 'none' | 'unsupported'

export type MapElement = {
  gfxId: number
  layer: MapLayerName
  order: number
  colorU32: number
  transform: AffineTransform
  materialIndex: number
  displayBehaviour: number
  cellId: number | null
  innerCellRenderOrder: number | null
  /** Shader family of the material: ShaderData, PaintShaderData, ParticlesShaderData. */
  shader: string
  blend: MapBlend
  uniforms?: Record<string, unknown>
  parameters?: Record<string, Record<string, unknown>>
  blendRaw?: { sourceFactor: number; destinationFactor: number; blendOperation: number }
}

/**
 * Interactive or animated map object (door, mine entrance, ore, tree).
 * Unlike elements these reference an Animator2D prop, not a mapgfx sprite,
 * unless `static` says otherwise.
 */
export type MapProp = {
  kind: 'interactive' | 'animated'
  propId: number
  cellId: number
  transform: AffineTransform
  colorU32: number
  innerCellRenderOrder: number
  displayBehaviour: number
  interactionId: number
  ambient?: boolean
  playAnimStatic?: boolean
  minDelay?: number
  maxDelay?: number
  requiresServerUpdate?: boolean
  playAnimation: number
  static: boolean
}

export type WebMapData = {
  format: string
  id: number
  sourceBundle: string
  neighbours: {
    top: number
    bottom: number
    left: number
    right: number
  }
  backgroundColorU32: number
  columns: number
  rows: number
  cells: MapCell[]
  walkableCells: number[]
  elements: MapElement[]
  particles?: ParticleDefinition[]
  props: MapProp[]
  gfx: Record<string, GfxInfo>
  missingGfx: number[]
  effectsVersion?: number
  environment?: MapEnvironment
  materials?: Record<string, MapMaterial[]>
  refraction?: RefractionInstance[]
  effectDependencies?: EffectTextureRef[]
  effectSequences?: EffectSequence[]
  effectCoverage?: EffectCoverage
}

export type UnsupportedStats = {
  /** Elements whose material says not to draw them. */
  notDrawn: number
  animated: number
  refraction: number
  particles: number
  unknownLayer: number
  missingTexture: number
  unsupportedBlend: number
  ignoredEffects: number
}

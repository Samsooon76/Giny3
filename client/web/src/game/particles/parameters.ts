/** Compact, offline-resolved Unity ParticleSystem parameters. */
export type Block = Record<string, unknown>

/** Texture IDs are only unique within their category. */
export function materialTexturePath(block: Block | undefined, field: string, category: string): string | undefined {
  const id = block?.[field]
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || !Array.isArray(block?._textures)) return undefined
  const refs = block._textures.filter((ref): ref is Record<string, unknown> =>
    !!ref && typeof ref === 'object' && ref.category === category && ref.id === id && typeof ref.path === 'string')
  return (refs.find(ref => ref.field === field) ?? refs[0])?.path as string | undefined
}
export type ParticleMaterial = { gfxId: number; texture?: string; shader?: string; parameters: Record<string, Block> }
export type ParticleDefinition = {
  stagingId?: string; isStagingTarget?: boolean | number
  id: string; hostLayer: 'background' | 'sortable' | 'foreground'; cellId: number; renderOrder: number
  transform: { pos: Vec3; rot: Vec3; scale: Vec3 }
  material: ParticleMaterial; trailMaterial: ParticleMaterial
  particlesMainParameters: Block; particlesModulesParameters: Block
  particlesEmissionParameters: Block; particlesShapeParameters: Block
  particlesVelocityOverLifetimeParameters: Block; particlesColorOverLifetimeParameters: Block
  particlesSizeOverLifetimeParameters: Block; particlesRotationOverLifetimeParameters: Block
  particlesNoiseParameters: Block; particleSpritesheetParameters: Block
  particlesTrailsParameters: Block; particlesRendererParameters: Block; particlesSubEmittersParameters: Block
  particlesCollisionParameters?: Block
}
export type Vec3 = { x: number; y: number; z: number }
const EMPTY_BLOCK: Block = Object.freeze({})
export const block = (v: unknown): Block => v && typeof v === 'object' ? v as Block : EMPTY_BLOCK
export const num = (v: unknown, fallback = 0): number => typeof v === 'number' && Number.isFinite(v) ? v : fallback
export const clamp = (v: number): number => Math.max(0, Math.min(1, v))
export const radians = Math.PI / 180
export function rotate(x: number, y: number, z: number, e: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const ax = e.x * radians, ay = e.y * radians, az = e.z * radians
  const y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax)
  const x1 = x * Math.cos(ay) + z1 * Math.sin(ay), z2 = -x * Math.sin(ay) + z1 * Math.cos(ay)
  out.x = x1 * Math.cos(az) - y1 * Math.sin(az); out.y = x1 * Math.sin(az) + y1 * Math.cos(az); out.z = z2
  return out
}
export const vector = (v: unknown, fallback = 0, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 => {
  const b = block(v); out.x = num(b.x, fallback); out.y = num(b.y, fallback); out.z = num(b.z, fallback); return out
}
export function keyCurve(raw: unknown, t: number): number {
  const keys = block(raw).keys as Block[] | undefined
  if (!keys?.length) return 1
  if (t <= num(keys[0].time)) return num(keys[0].value)
  const last = keys[keys.length - 1]
  if (t >= num(last.time)) return num(last.value)
  let i = 1
  while (i < keys.length - 1 && num(keys[i].time) < t) i++
  const a = keys[i - 1], b = keys[i], span = num(b.time) - num(a.time)
  let u = (t - num(a.time)) / span
  if (a.outTangent === 'Infinity' || a.outTangent === '-Infinity' || b.inTangent === 'Infinity' || b.inTangent === '-Infinity') return num(a.value)
  const out = num(a.outTangent), into = num(b.inTangent)
  // Weighted Unity curves use time as the cubic Bezier x coordinate.
  const wa = num(a.weightedMode) & 2 ? num(a.outWeight, 1 / 3) : 1 / 3
  const wb = num(b.weightedMode) & 1 ? num(b.inWeight, 1 / 3) : 1 / 3
  if (wa !== 1 / 3 || wb !== 1 / 3) {
    const target = u; let low = 0, high = 1
    for (let n = 0; n < 12; n++) {
      u = (low + high) / 2
      const x = 3 * (1 - u) ** 2 * u * wa + 3 * (1 - u) * u * u * (1 - wb) + u ** 3
      if (x < target) low = u; else high = u
    }
  }
  const v = 1 - u, av = num(a.value), bv = num(b.value)
  return v ** 3 * av + 3 * v * v * u * (av + out * span * wa)
    + 3 * v * u * u * (bv - into * span * wb) + u ** 3 * bv
}
export function curve(raw: unknown, t = 0, random = .5, fallback = 0): number {
  if (!raw) return fallback
  const c = block(raw), hi = num(c.constantMax, fallback), lo = num(c.constantMin)
  switch (num(c.mode)) {
    case 1: return keyCurve(c.curveMax, t) * hi
    case 2: return (keyCurve(c.curveMin, t) * (1 - random) + keyCurve(c.curveMax, t) * random) * hi
    case 3: return lo + (hi - lo) * random
    default: return hi
  }
}
export type RGBA = [number, number, number, number]
const rgba = (v: unknown, out: RGBA): RGBA => {
  const c = num(block(v).value, 0xffffffff) >>> 0
  out[0] = (c >>> 16 & 255) / 255; out[1] = (c >>> 8 & 255) / 255
  out[2] = (c & 255) / 255; out[3] = (c >>> 24) / 255
  return out
}
function gradient(v: unknown, t: number, result: RGBA): RGBA {
  const g = block(v), colors = g.colorKeys as Block[] | undefined, alphas = g.alphaKeys as Block[] | undefined
  result.fill(1)
  for (let channel = 0; channel < 2; channel++) {
    const keys = channel === 0 ? colors : alphas
    if (!keys?.length) continue
    let i = 0; while (i < keys.length - 1 && num(keys[i + 1].time) < t) i++
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)]
    const mix = clamp((t - num(a.time)) / Math.max(.00001, num(b.time) - num(a.time)))
    if (channel === 1) result[3] = num(a.alpha, 1) * (1 - mix) + num(b.alpha, 1) * mix
    else {
      const ac = num(block(a.color).value, 0xffffffff) >>> 0, bc = num(block(b.color).value, 0xffffffff) >>> 0
      for (let k = 0; k < 3; k++) {
        const shift = 16 - k * 8
        result[k] = (ac >>> shift & 255) / 255 * (1 - mix) + (bc >>> shift & 255) / 255 * mix
      }
    }
  }
  return result
}
export function color(v: unknown, t = 0, random = .5, out: RGBA = [1, 1, 1, 1], scratch?: RGBA): RGBA {
  const c = block(v), mode = num(c.mode)
  if (mode === 1 || mode === 4) return gradient(c.gradientMax, mode === 4 ? random : t, out)
  const hi = mode === 3 ? gradient(c.gradientMax, t, out) : rgba(c.colorMax, out)
  if (mode !== 2 && mode !== 3) return hi
  const lo = mode === 3 ? gradient(c.gradientMin, t, scratch ?? [1, 1, 1, 1]) : rgba(c.colorMin, scratch ?? [1, 1, 1, 1])
  for (let i = 0; i < 4; i++) out[i] = lo[i] * (1 - random) + hi[i] * random
  return out
}

/** Reusable color evaluation storage for a single synchronous emitter. */
export class ParticleColors {
  private value: RGBA = [1, 1, 1, 1]
  private scratch: RGBA = [1, 1, 1, 1]
  sample(value: unknown, time: number, random: number): RGBA { return color(value, time, random, this.value, this.scratch) }
}

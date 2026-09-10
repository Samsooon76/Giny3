import type { ParticleDefinition } from '../particles/parameters'
import {
  CURRENT_EFFECTS_VERSION,
  emptyCoverage,
  emptyEnvironment,
  type EffectCoverage,
  type EffectSequence,
  type EffectTextureRef,
  type MapEnvironment,
  type MapMaterial,
  type ParameterBlock,
  type RefractionInstance,
} from '../effects/types'
import type {
  AffineTransform,
  GfxInfo,
  MapBlend,
  MapCell,
  MapElement,
  MapLayerName,
  MapProp,
  WebMapData,
} from './types'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function pickNumber(source: JsonRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }
  return fallback
}

function pickString(source: JsonRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      return value
    }
  }
  return fallback
}

function pickNullableNumber(source: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function pickPair(source: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(source) && source.length >= 2) {
    return [Number(source[0]) || 0, Number(source[1]) || 0]
  }
  return fallback
}

function normalizeLayer(value: string): MapLayerName {
  switch (value) {
    case 'background':
    case 'sortable':
    case 'foreground':
    case 'animated':
    case 'refraction':
    case 'particles':
      return value
    default:
      return 'unknown'
  }
}

function normalizeBlend(value: string, strict: boolean): MapBlend {
  switch (value) {
    case 'add':
    case 'multiply':
    case 'none':
    case 'unsupported':
      return value
    case 'normal':
      return 'normal'
    default:
      return strict ? 'unsupported' : 'normal'
  }
}

function normalizeTransform(raw: unknown): AffineTransform {
  const tr = asRecord(raw)
  return {
    m11: pickNumber(tr, ['m11', 'a'], 1),
    m12: pickNumber(tr, ['m12', 'b'], 0),
    m21: pickNumber(tr, ['m21', 'c'], 0),
    m22: pickNumber(tr, ['m22', 'd'], 1),
    m31: pickNumber(tr, ['m31', 'tx'], 0),
    m32: pickNumber(tr, ['m32', 'ty'], 0),
  }
}

function normalizeCell(raw: unknown, index: number): MapCell {
  const cell = asRecord(raw)
  return {
    cellId: pickNumber(cell, ['id', 'cellId', 'cell_id'], index),
    x: pickNumber(cell, ['x'], 0),
    y: pickNumber(cell, ['y'], 0),
    mov: pickNumber(cell, ['mov'], 0),
    los: pickNumber(cell, ['los'], 0),
    speed: pickNumber(cell, ['speed'], 0),
    moveZone: pickNumber(cell, ['move_zone', 'moveZone', 'move_zone'], 0),
    linkedZone: pickNumber(cell, ['linked_zone', 'linkedZone'], 0),
    mapChangeData: pickNumber(cell, ['map_change_data', 'mapChangeData'], 0),
    visible: pickNumber(cell, ['visible'], 1),
    nonWalkableDuringFight: pickNumber(cell, [
      'non_walkable_during_fight',
      'nonWalkableDuringFight',
    ], 0),
    nonWalkableDuringRp: pickNumber(cell, [
      'non_walkable_during_rp',
      'nonWalkableDuringRP',
    ], 0),
    floor: pickNumber(cell, ['floor'], 0),
  }
}

function normalizeBlendRaw(raw: unknown): MapElement['blendRaw'] {
  const rec = asRecord(raw)
  if (!Object.keys(rec).length) return undefined
  return {
    sourceFactor: pickNumber(rec, ['source_factor', 'sourceFactor']),
    destinationFactor: pickNumber(rec, ['destination_factor', 'destinationFactor']),
    blendOperation: pickNumber(rec, ['blend_operation', 'blendOperation']),
  }
}

function normalizeElement(raw: unknown, strictBlend: boolean): MapElement {
  const el = asRecord(raw)
  const parameters = el.parameters && typeof el.parameters === 'object'
    ? (el.parameters as Record<string, Record<string, unknown>>)
    : undefined
  return {
    gfxId: pickNumber(el, ['gfx_id', 'gfxId', 'gfx_id'], 0),
    layer: normalizeLayer(pickString(el, ['layer'], 'background')),
    order: pickNumber(el, ['order'], 0),
    colorU32: pickNumber(el, ['color_u32', 'colorU32'], 0xffffffff),
    transform: normalizeTransform(el.transform),
    materialIndex: pickNumber(el, ['material_index', 'materialIndex'], 0),
    displayBehaviour: pickNumber(el, ['display_behaviour', 'displayBehaviour'], 0),
    cellId: pickNullableNumber(el, ['cell_id', 'cellId']),
    innerCellRenderOrder: pickNullableNumber(el, [
      'inner_cell_render_order',
      'innerCellRenderOrder',
    ]),
    shader: pickString(el, ['shader'], 'ShaderData'),
    // A map document predating material resolution has no blend: `normal`
    // keeps it rendering exactly as it did before. Versioned documents mark
    // unknown modes instead of silently drawing them as normal.
    blend: normalizeBlend(pickString(el, ['blend'], 'normal'), strictBlend),
    uniforms: el.uniforms && typeof el.uniforms === 'object' ? (el.uniforms as Record<string, unknown>) : undefined,
    parameters,
    blendRaw: normalizeBlendRaw(el.blend_raw ?? el.blendRaw),
  }
}

function normalizeGfx(id: string, raw: unknown): GfxInfo {
  const gfx = asRecord(raw)
  const numericId = pickNumber(gfx, ['id'], Number(id) || 0)
  return {
    id: numericId,
    texture: pickString(gfx, ['texture'], `gfx/${numericId}.png`),
    frame: Array.isArray(gfx.frame) && gfx.frame.length === 4 ? gfx.frame.map(Number) as [number, number, number, number] : undefined,
    bc7Texture: typeof gfx.bc7_texture === 'string' ? gfx.bc7_texture : undefined,
    width: pickNumber(gfx, ['width'], 0),
    height: pickNumber(gfx, ['height'], 0),
    pivot: pickPair(gfx.pivot, [0.5, 0.5]),
    offset: pickPair(gfx.offset, [0, 0]),
    pixelsPerUnit: pickNumber(gfx, ['pixels_per_unit', 'pixelsPerUnit'], 1),
  }
}

function normalizeProp(raw: unknown): MapProp {
  const prop = asRecord(raw)
  const kind = pickString(prop, ['kind'], 'interactive')
  return {
    kind: kind === 'animated' ? 'animated' : 'interactive',
    propId: pickNumber(prop, ['prop_id', 'propId', 'gfx_id', 'gfxId'], 0),
    cellId: pickNumber(prop, ['cell_id', 'cellId'], 0),
    transform: normalizeTransform(prop.transform),
    colorU32: pickNumber(prop, ['color_u32', 'colorU32'], 0xffffffff),
    innerCellRenderOrder: pickNumber(prop, ['inner_cell_render_order', 'innerCellRenderOrder'], 0),
    displayBehaviour: pickNumber(prop, ['display_behaviour', 'displayBehaviour'], 0),
    interactionId: pickNumber(prop, ['interaction_id', 'interactionId'], 0),
    playAnimation: pickNumber(prop, ['play_animation', 'playAnimation'], 0),
    ambient: prop.ambient === true,
    playAnimStatic: prop.play_anim_static === true,
    minDelay: pickNumber(prop, ['min_delay'], 0),
    maxDelay: pickNumber(prop, ['max_delay'], 0),
    requiresServerUpdate: prop.requires_server_update === true,
    static: prop.static === true,
  }
}

function normalizeTextureRef(raw: unknown): EffectTextureRef | null {
  const rec = asRecord(raw)
  const category = pickString(rec, ['category'])
  const id = pickNumber(rec, ['id'], -1)
  if (!category || id < 0) return null
  const path = pickString(rec, ['path'], '')
  return {
    category,
    id,
    path: path || (category === 'mapgfx' ? `gfx/${id}.png` : `effects/${category}/${id}.png`),
    field: pickString(rec, ['field']) || null,
  }
}

function normalizeParameterBlock(raw: unknown): ParameterBlock {
  return asRecord(raw) as ParameterBlock
}

/** Older exports inferred multiply from the PaintShaderData name alone.
 * A complete parameter table proves whether blending was actually overridden.
 * Native DofusMainShader defaults to One / OneMinusSrcAlpha.
 */
function hasDefaultPaintBlend(raw: unknown): boolean {
  const rec = asRecord(raw)
  return rec.shader === 'PaintShaderData'
    && rec.parameters !== null && typeof rec.parameters === 'object'
    && !Array.isArray(rec.parameters)
    && !('ShaderBlendingParameters' in asRecord(rec.parameters))
    && !rec.blend_raw && !rec.blendRaw
    && (rec.blend === 'multiply' || rec.blend === 'normal' || rec.blend === undefined)
}

function normalizeMaterial(raw: unknown, strictBlend: boolean): MapMaterial {
  const rec = asRecord(raw)
  const parametersRaw = asRecord(rec.parameters)
  const parameters: Record<string, ParameterBlock> = {}
  for (const [key, value] of Object.entries(parametersRaw)) {
    parameters[key] = normalizeParameterBlock(value)
  }
  return {
    shader: pickString(rec, ['shader']),
    blend: hasDefaultPaintBlend(raw) ? 'normal' : normalizeBlend(pickString(rec, ['blend'], 'normal'), strictBlend),
    gfxId: pickNumber(rec, ['gfx_id', 'gfxId']),
    parameters,
    uniforms: rec.uniforms && typeof rec.uniforms === 'object' ? rec.uniforms as Record<string, unknown> : undefined,
    blendRaw: normalizeBlendRaw(rec.blend_raw ?? rec.blendRaw),
    albedo: normalizeTextureRef(rec.albedo) ?? undefined,
    stagingId: pickString(rec, ['staging_id', 'stagingId']) || undefined,
    unique: rec.unique === true,
  }
}

function normalizeEnvironment(raw: unknown): MapEnvironment {
  const rec = asRecord(raw)
  const wind = asRecord(rec.wind)
  const wave = asRecord(rec.wave)
  const noise = asRecord(rec.noise)
  const post = asRecord(rec.post_process ?? rec.postProcess)
  const env = emptyEnvironment()
  env.wind = {
    active: wind.active === true,
    parameters: wind.parameters && typeof wind.parameters === 'object' ? wind.parameters as ParameterBlock : null,
  }
  env.wave = {
    active: wave.active === true,
    parameters: wave.parameters && typeof wave.parameters === 'object' ? wave.parameters as ParameterBlock : null,
  }
  env.noise = {
    active: noise.active === true,
    parameters: noise.parameters && typeof noise.parameters === 'object' ? noise.parameters as ParameterBlock : null,
  }
  env.postProcess = {
    active: post.active === true,
    parameters: Array.isArray(post.parameters) ? post.parameters.map(normalizeParameterBlock) : [],
  }
  return env
}

function normalizeRefraction(raw: unknown, strictBlend: boolean): RefractionInstance {
  const rec = asRecord(raw)
  const host = pickString(rec, ['host_material_layer', 'hostMaterialLayer'], 'foreground')
  const parametersRaw = asRecord(rec.parameters)
  const parameters: Record<string, ParameterBlock> = {}
  for (const [key, value] of Object.entries(parametersRaw)) {
    parameters[key] = normalizeParameterBlock(value)
  }
  return {
    order: pickNumber(rec, ['order']),
    gfxId: pickNumber(rec, ['gfx_id', 'gfxId']),
    layer: 'refraction',
    hostMaterialLayer: host === 'background' || host === 'sortable' ? host : 'foreground',
    materialIndex: pickNumber(rec, ['material_index', 'materialIndex']),
    displayBehaviour: pickNumber(rec, ['display_behaviour', 'displayBehaviour']),
    colorU32: pickNumber(rec, ['color_u32', 'colorU32'], 0x808080),
    transform: normalizeTransform(rec.transform),
    shader: pickString(rec, ['shader']),
    blend: normalizeBlend(pickString(rec, ['blend'], 'normal'), strictBlend),
    parameters,
    uniforms: rec.uniforms && typeof rec.uniforms === 'object' ? rec.uniforms as Record<string, unknown> : undefined,
    blendRaw: normalizeBlendRaw(rec.blend_raw ?? rec.blendRaw),
  }
}

function normalizeSequence(raw: unknown): EffectSequence {
  const rec = asRecord(raw)
  const shots = Array.isArray(rec.shots) ? rec.shots : []
  return {
    id: pickString(rec, ['id']),
    uniqueId: pickNumber(rec, ['unique_id', 'uniqueId']),
    exclusiveGroupId: pickString(rec, ['exclusive_group_id', 'exclusiveGroupId']),
    exclusivityResolveMethod: pickNumber(rec, ['exclusivity_resolve_method', 'exclusivityResolveMethod']),
    type: pickString(rec, ['type'], 'StagingSequence'),
    shots: shots.map((shotRaw) => {
      const shot = asRecord(shotRaw)
      const effects = Array.isArray(shot.effects) ? shot.effects : []
      return {
        id: pickString(shot, ['id']),
        previousShot: pickString(shot, ['previous_shot', 'previousShot']),
        delay: pickNumber(shot, ['delay']),
        duration: pickNumber(shot, ['duration']),
        skipIfInstant: shot.skip_if_instant === true || shot.skipIfInstant === true,
        effects: effects.map((effectRaw) => {
          const effect = asRecord(effectRaw)
          return {
            type: pickString(effect, ['type']),
            visual: effect.visual !== false,
            targets: effect.targets,
            parameters: normalizeParameterBlock(effect.parameters),
          }
        }),
      }
    }),
  }
}

function normalizeCoverage(raw: unknown, effectsVersion: number): EffectCoverage {
  const rec = asRecord(raw)
  const coverage: EffectCoverage = emptyCoverage()
  coverage.families = Array.isArray(rec.families) ? rec.families.map(String) : []
  const statusRaw = asRecord(rec.status)
  for (const [key, value] of Object.entries(statusRaw)) {
    if (typeof value === 'string') coverage.status[key] = value as EffectCoverage['status'][string]
  }
  coverage.issues = Array.isArray(rec.issues)
    ? rec.issues.map((item) => {
        const issue = asRecord(item)
        return {
          family: pickString(issue, ['family']),
          status: pickString(issue, ['status'], 'semantics_unknown') as EffectCoverage['issues'][number]['status'],
          detail: pickString(issue, ['detail']) || undefined,
        }
      })
    : []
  // This family was absent in older prepared releases, but has a renderer now.
  // Source errors and unknown semantics must still be retained.
  for (const family of ['pp_chromatic', 'pp_film_grain']) {
    if (effectsVersion <= CURRENT_EFFECTS_VERSION && coverage.status[family] === 'render_absent') {
      coverage.status[family] = 'supported'
      coverage.issues = coverage.issues.filter(issue => !(issue.family === family && issue.status === 'render_absent'))
    }
  }
  // Prepared documents may predate a correction to the exporter coverage table.
  // A source declaration cannot enable a renderer implementation that is absent.
  const partialDetails: Record<string, string> = {
    wave_config: 'Wave renderer present; native projection and animated fidelity validation remain incomplete',
    shader_wave: 'Wave renderer present; native projection and animated fidelity validation remain incomplete',
    pp_bloom: 'Bloom pyramid and HDR capture implemented; emissive materials and native visual fidelity remain incomplete',
    postprocess_config: 'Post-process consumer implemented; full native material coverage remains incomplete',
    staging_sequences: 'Sequence reader implemented; map event dispatch and full sequence semantics remain incomplete',
    shader_dissolve: 'Particle dissolve implemented; general map material dissolve is not implemented',
    shader_distortion: 'Particle distortion implemented; general map material distortion is not implemented',
    shader_emissive: 'Map emissive material implemented; delayed areas, noise modulation and particle emission remain incomplete',
    shader_color_animation: 'Map color animation implemented; noise/map modulation and particle variants remain incomplete',
    shader_texture_offset: 'Direction offset in local UVs implemented; flowmap, screen/world coordinates and particle variants remain incomplete',
    shader_depth_alpha_clip: 'Map material alpha clipping implemented; particle variants and native visual validation remain incomplete',
  }
  for (const [family, detail] of Object.entries(partialDetails)) {
    if (!coverage.families.includes(family) && !(family in coverage.status)) continue
    if (!coverage.status[family] || ['supported', 'render_absent'].includes(coverage.status[family])) {
      coverage.status[family] = 'semantics_unknown'
    }
    coverage.issues = coverage.issues.filter(issue => !(issue.family === family && issue.status === 'render_absent'))
    if (!coverage.issues.some(issue => issue.family === family && issue.status === 'semantics_unknown')) {
      coverage.issues.push({ family, status: 'semantics_unknown', detail })
    }
  }
  const absent = new Set(['noise_config', 'localized_sounds', 'shader_outline', 'shader_custom_framerate'])
  for (const family of new Set([...coverage.families, ...Object.keys(coverage.status)])) {
    if (!absent.has(family)) continue
    if (!coverage.status[family] || coverage.status[family] === 'supported') coverage.status[family] = 'render_absent'
    if (!coverage.issues.some(issue => issue.family === family && issue.status === 'render_absent')) {
      coverage.issues.push({ family, status: 'render_absent', detail: 'No renderer implementation in this client build' })
    }
  }
  if (effectsVersion > CURRENT_EFFECTS_VERSION) {
    coverage.unknownVersion = effectsVersion
    coverage.complete = false
    coverage.issues.push({
      family: 'schema',
      status: 'semantics_unknown',
      detail: `effectsVersion ${effectsVersion} is newer than client ${CURRENT_EFFECTS_VERSION}`,
    })
  } else {
    coverage.complete = rec.complete === true && coverage.issues.length === 0
  }
  return coverage
}

export function adaptMapDocument(raw: unknown): WebMapData {
  const doc = asRecord(raw)
  const cellsRaw = Array.isArray(doc.cells) ? doc.cells : []
  const elementsRaw = Array.isArray(doc.elements) ? doc.elements : []
  const gfxRaw = { ...asRecord(doc.gfx_catalog), ...asRecord(doc.gfx) }
  const neighbours = asRecord(doc.neighbours ?? doc.neighbors)
  const gfx: Record<string, GfxInfo> = {}
  for (const [key, value] of Object.entries(gfxRaw)) {
    gfx[key] = normalizeGfx(key, value)
  }
  const cells = cellsRaw.map((cell, index) => normalizeCell(cell, index))
  const walkableFromDoc = Array.isArray(doc.walkable_cells)
    ? doc.walkable_cells.map((id) => Number(id))
    : Array.isArray(doc.walkableCells)
      ? doc.walkableCells.map((id) => Number(id))
      : cells
          .filter(
            (cell) =>
              cell.mov === 1 && cell.nonWalkableDuringRp === 0 && cell.visible === 1,
          )
          .map((cell) => cell.cellId)
  const effectsVersion = pickNumber(doc, ['effects_version', 'effectsVersion'], 0)
  const strictBlend = effectsVersion > 0
  const materialsRaw = asRecord(doc.materials)
  const materials: Record<string, MapMaterial[]> = {}
  for (const [layer, table] of Object.entries(materialsRaw)) {
    if (Array.isArray(table)) materials[layer] = table.map((item) => normalizeMaterial(item, strictBlend))
  }

  return {
    format: pickString(doc, ['format'], 'giny.dofus3.map.v1'),
    id: pickNumber(doc, ['id'], 0),
    sourceBundle: pickString(doc, ['source_bundle', 'sourceBundle'], ''),
    neighbours: {
      top: pickNumber(neighbours, ['top'], 0),
      bottom: pickNumber(neighbours, ['bottom'], 0),
      left: pickNumber(neighbours, ['left'], 0),
      right: pickNumber(neighbours, ['right'], 0),
    },
    backgroundColorU32: pickNumber(
      doc,
      ['background_color_u32', 'backgroundColorU32'],
      0xff000000,
    ),
    columns: pickNumber(doc, ['columns'], 14),
    rows: pickNumber(doc, ['rows'], 40),
    cells,
    walkableCells: walkableFromDoc,
    elements: elementsRaw.map((raw) => {
      const element = normalizeElement(raw, strictBlend)
      const table = materialsRaw[element.layer]
      const material = Array.isArray(table) ? table[element.materialIndex] : undefined
      if (element.shader === 'PaintShaderData' && element.blend === 'multiply'
        && !element.blendRaw && !element.parameters?.ShaderBlendingParameters
        && hasDefaultPaintBlend(material)) element.blend = 'normal'
      return element
    }),
    props: (Array.isArray(doc.props) ? doc.props : []).map(normalizeProp),
    particles: Array.isArray(doc.particles) ? doc.particles as ParticleDefinition[] : [],
    gfx,
    missingGfx: Array.isArray(doc.missing_gfx)
      ? doc.missing_gfx.map((id) => Number(id))
      : Array.isArray(doc.missingGfx)
        ? doc.missingGfx.map((id) => Number(id))
        : [],
    effectsVersion: effectsVersion || undefined,
    environment: doc.environment ? normalizeEnvironment(doc.environment) : undefined,
    materials: Object.keys(materials).length ? materials : undefined,
    refraction: Array.isArray(doc.refraction)
      ? doc.refraction.map((item) => normalizeRefraction(item, strictBlend))
      : undefined,
    effectDependencies: (() => {
      const deps = doc.effect_dependencies ?? doc.effectDependencies
      return Array.isArray(deps)
        ? deps.map(normalizeTextureRef).filter((item): item is EffectTextureRef => item !== null)
        : undefined
    })(),
    effectSequences: (() => {
      const sequences = doc.effect_sequences ?? doc.effectSequences
      return Array.isArray(sequences) ? sequences.map(normalizeSequence) : undefined
    })(),
    effectCoverage: doc.effect_coverage || doc.effectCoverage || effectsVersion > CURRENT_EFFECTS_VERSION
      ? normalizeCoverage(doc.effect_coverage ?? doc.effectCoverage, effectsVersion)
      : undefined,
  }
}

export function isWalkableCell(cell: MapCell | undefined): boolean {
  if (!cell) {
    return false
  }
  return cell.mov === 1 && cell.nonWalkableDuringRp === 0 && cell.visible === 1
}

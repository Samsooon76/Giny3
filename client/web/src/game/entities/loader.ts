import { registerDocumentCache } from '../assets/documentBudgets'
import { readLegacyEntityDocument } from './legacyDocument'
import { throwIfAborted, type LoadOptions } from '../assets/TaskQueue'
import { loadCombatAsset, loadCombatBindings } from '../combat/combatAssets'
import { entityPublication, preparedEntity } from './clipLoader'
import { estimateEntityBytes } from './types'
import { ensureData } from '../../data/ensureData'
import { DEFAULT_ENTITY_DOCUMENT, type WebEntityData } from './types'
import { entityDocumentCandidates, parseEntityLook } from './look'
import { normalizeLegacyPlayerScale } from './legacyScale'

import { DocumentCache } from '../assets/DocumentCache'
const lookCache = new DocumentCache<string, WebEntityData>(32, 48 * 1024 * 1024, estimateEntityBytes)
registerDocumentCache('looks', lookCache)

/** Entity documents carrying resolved `part_ref` names (animation graphic
    ids are 0-based indices into `aod.graphics`). Older v1 documents map the
    raw id onto part names and render incomplete meshes plus solid-colour
    plates, so they are treated as missing and re-extracted on demand. */
export const ENTITY_FORMAT = 'giny.dofus3.entity.v2'

function isFreshEntity(entity: WebEntityData | null): entity is WebEntityData {
  return !!entity && entity.format === ENTITY_FORMAT && Object.keys(entity.animations).length > 0
}

export async function loadEntityData(
  relativePath = DEFAULT_ENTITY_DOCUMENT, options: LoadOptions = {},
): Promise<WebEntityData> {
  const prepared = await preparedEntity(relativePath, options)
  if (prepared) return prepared
  const entity = await readLegacyEntityDocument(relativePath, options)
  if (!entity) throw new Error(`Unable to load entity ${relativePath}`)
  if (Object.keys(entity.animations).length === 0) {
    throw new Error(`Entity ${relativePath} has no animations`)
  }
  return entity
}

export async function loadEntityLook(look: string, options: LoadOptions = {}): Promise<WebEntityData> {
  const publication = await entityPublication(options.signal)
  return lookCache.get(`${publication}:${look}`, (_signal, context) => loadEntityLookUncached(look, context), options)
}

/** BoneIndex class 0 maps AnimTacle/Hit/Mort to the separate 1-combat bundle.
 * Keep composed skin parts; add missing skeleton parts and official clips. */
export async function loadCombatEntityLook(look: string, breed = 0, options: LoadOptions = {}): Promise<WebEntityData> {
  const base = await loadEntityLook(look, options)
  if (base.boneId !== 1) return base
  const combat = await loadCombatAsset('classes', 0, options)
  const casts = breed > 0 ? await loadCombatAsset('classes', breed, options).catch(error => { throwIfAborted(options.signal); console.warn('[combat-assets]', error); return null }) : null
  const bindings = await loadCombatBindings(look, options)
  const parts = { ...combat.parts, ...casts?.parts, ...base.parts }
  for (const [ref, part] of Object.entries(base.parts)) {
    const slash = ref.lastIndexOf('/')
    if (slash >= 0 && ref.startsWith('skins_assets_')) parts['@slot:' + ref.slice(slash + 1)] = part
  }
  for (const [slot, binding] of Object.entries(bindings)) {
    const part = base.parts[binding.part]
    if (part) parts['@slot:' + slot] = { leaves: binding.leaves === null ? part.leaves : binding.leaves.map(i => part.leaves[i]).filter(Boolean) }
  }
  // Slots absent from the composed look are intentionally empty (equipment, hair, carried actors).
  return { ...base, parts, animations: { ...combat.animations, ...base.animations, ...casts?.animations }, animationFiles: { ...combat.animationFiles, ...base.animationFiles, ...casts?.animationFiles } }
}

async function readEntityDocument(relativePath: string, options: LoadOptions): Promise<WebEntityData | null> {
  try {
    const prepared = await preparedEntity(relativePath, options)
    if (prepared) return prepared
    const entity = await readLegacyEntityDocument(relativePath, options)
    return isFreshEntity(entity) ? entity : null
  } catch (error) {
    throwIfAborted(options.signal)
    console.warn(`[loader] Impossible de lire l'entité ${relativePath}:`, error)
    return null
  }
}

async function loadEntityLookUncached(look: string, options: LoadOptions): Promise<WebEntityData> {
  const parsed = normalizeLegacyPlayerScale(parseEntityLook(look))
  for (const relativePath of entityDocumentCandidates(look)) {
    const entity = await readEntityDocument(relativePath, options)
    if (entity) {
      return parsed ? { ...entity, look: parsed } : entity
    }
  }
  const ensured = await ensureData('look', look, options.signal, options)
  if (!ensured.ok || !ensured.path) {
    const fallback = await readEntityDocument(DEFAULT_ENTITY_DOCUMENT, options)
    if (fallback) {
      return parsed ? { ...fallback, look: parsed } : fallback
    }
    throw new Error(ensured.error ?? 'Extraction du personnage impossible.')
  }
  const entity = await readEntityDocument(ensured.path, options)
  if (!entity) {
    throw new Error(`Entity ${ensured.path} has no animations`)
  }
  return parsed ? { ...entity, look: parsed } : entity
}

import { registerDocumentCache } from '../assets/documentBudgets'
import { cancellable, type LoadOptions } from '../assets/TaskQueue'
import { gameDataUrl } from '../../data/assetUrl'
import { adaptEntityDocument } from '../entities/adapter'
import { entityDocumentCandidates } from '../entities/look'
import type { WebEntityData } from '../entities/types'
import { DocumentCache } from '../assets/DocumentCache'
import { estimateEntityBytes } from '../entities/types'
type Entry = { path: string; clips: number }
type Manifest = { classes: Record<string, Entry>; gfx: Record<string, Entry>; looks?: Record<string,string> }
let manifest: Promise<Manifest> | undefined
const documents = new DocumentCache<string, WebEntityData>(12, 24 * 1024 * 1024, estimateEntityBytes)
registerDocumentCache('combatAnimations', documents)
export function combatAssets(): Promise<Manifest> {
  return manifest ??= fetch(gameDataUrl('entities/combat-assets.json'), { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error(`Ressources de sorts non préparées (HTTP ${r.status}).`)
    return await r.json() as Manifest
  }).catch(error => { manifest = undefined; throw error })
}
export async function loadCombatAsset(kind: 'classes' | 'gfx', id: number, options: LoadOptions = {}): Promise<WebEntityData> {
  const entry = (await cancellable(combatAssets(), options.signal))[kind][String(id)]
  if (!entry) throw new Error(`Animation officielle ${kind}/${id} non préparée.`)
  return documents.get(entry.path, async signal => {
    const response = await fetch(gameDataUrl(entry.path), { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`Animation officielle ${kind}/${id} : HTTP ${response.status}`)
    return adaptEntityDocument(await response.json())
  }, options)
}

export type CombatSlotBinding = { part: string; leaves: number[] | null }
const bindings = new DocumentCache<string, Record<string, CombatSlotBinding>>(64, 4 * 1024 * 1024,
  value => JSON.stringify(value).length * 2)
registerDocumentCache('combatBindings', bindings)
export async function loadCombatBindings(look: string, options: LoadOptions = {}): Promise<Record<string, CombatSlotBinding>> {
  const paths = (await cancellable(combatAssets(), options.signal)).looks
  const path = entityDocumentCandidates(look).map(p => paths?.[p]).find(Boolean)
  if (!path) return {}
  return bindings.get(path, async signal => {
    const response = await fetch(gameDataUrl(path), { signal })
    if (!response.ok) throw new Error(`Composition combat : HTTP ${response.status}`)
    return await response.json() as Record<string, CombatSlotBinding>
  }, options)
}

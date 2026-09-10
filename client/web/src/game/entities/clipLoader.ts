import { registerDocumentCache } from '../assets/documentBudgets'
import { RefreshableResource } from '../assets/RefreshableResource'
import { gameDataUrl } from '../../data/assetUrl'
import { DocumentCache } from '../assets/DocumentCache'
import { cancellable, TaskQueue, type LoadOptions } from '../assets/TaskQueue'
import { adaptAnimation, adaptEntityDocument } from './adapter'
import { parseEntityJson } from './parseEntityJson'
import { estimateEntityBytes, type EntityAnimation, type WebEntityData } from './types'
type Manifest = { format: string; entities: Record<string, string>; previews: Record<string, string>; unavailable?: Record<string, string> }
let publication = 0
const publications = new WeakMap<Manifest, number>()
const manifest = new RefreshableResource<Manifest>(async () => {
  const response = await fetch(gameDataUrl('optimized/entities-manifest.json'), { cache: 'no-store' })
  if (!response.ok) throw new Error(`Manifeste des entités : HTTP ${response.status}`)
  const value = await response.json() as Manifest
  if (value.format !== 'giny.entity-clips.v1') throw new Error('Version du manifeste des entités incompatible')
  return value
})
const clipQueue = new TaskQueue(6)
const documentQueue = new TaskQueue(4)
const documents = new DocumentCache<string, WebEntityData>(32, 32 * 1024 * 1024, estimateEntityBytes)
registerDocumentCache('entityDocuments', documents)
export const animationCache = new DocumentCache<string, EntityAnimation>(16, 24 * 1024 * 1024,
  clip => clip.frames.reduce((bytes, frame) => bytes + 32 + frame.length * 256, 256))
registerDocumentCache('entityAnimations', animationCache)
export function invalidateEntityManifest(): void { manifest.invalidate(); publication++; documents.clear(); animationCache.clear() }
export function entityManifest(): Promise<Manifest | null> { return manifest.get() }
export async function entityPublication(signal?: AbortSignal): Promise<number> {
  const value = await manifest.get(signal)
  if (!value) return publication
  let token = publications.get(value)
  if (token === undefined) { token = ++publication; publications.set(value, token) }
  return token
}
export async function preparedEntity(relative: string, options: LoadOptions = {}): Promise<WebEntityData | null> {
  const path = (await cancellable(entityManifest(), options.signal))?.entities[relative]
  if (!path) return null
  if (options.priority !== 'background') documentQueue.promote(path)
  return documents.get(path, (signal, context) => documentQueue.run(async () => {
    const response = await fetch(gameDataUrl(path), { signal })
    if (!response.ok) throw new Error(`Entité préparée : HTTP ${response.status}`)
    return adaptEntityDocument(parseEntityJson(await response.text()))
  }, { ...context, signal, key: path }), options)
}
export function loadEntityClip(data: WebEntityData, name: string, signal?: AbortSignal, priority: 'active' | 'background' = 'active'): Promise<EntityAnimation> {
  const path = data.animationFiles?.[name]
  if (!path) return Promise.resolve(data.animations[name])
  if (priority === 'active') clipQueue.promote(path)
  return animationCache.get(path, sharedSignal => clipQueue.run(async () => {
    const response = await fetch(gameDataUrl(path), { signal: sharedSignal })
    if (!response.ok) throw new Error(`Animation ${name} : HTTP ${response.status}`)
    const clip = adaptAnimation(name, parseEntityJson(await response.text()), data.frameRate)
    if (!clip.frames.length) throw new Error(`Animation vide : ${name}`)
    return clip
  }, { signal: sharedSignal, priority, key: path }), { signal, priority })
}

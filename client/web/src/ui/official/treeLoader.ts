import { registerDocumentCache } from '../../game/assets/documentBudgets'
import { DocumentCache } from '../../game/assets/DocumentCache'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { componentStyles } from './stylesheet'
import type { OfficialTreeName, VisualTreeNode } from './types'
import { INLINE_UITK_TEMPLATES } from './uitk'
import preparedRoutes from 'virtual:giny-prepared-ui'
import { prepared } from './treePrep'

export function useComponentStyles() {
  useEffect(() => { componentStyles.load() }, [])
  return useSyncExternalStore(componentStyles.subscribe, componentStyles.snapshot, componentStyles.snapshot)
}

export function useOfficialTree(tree: OfficialTreeName, templates: readonly string[] = []) {
  const [payload, setPayload] = useState<{ screen: VisualTreeNode; templates: Record<string, VisualTreeNode> } | null>(null)
  const templateKey = templates.join('|')
  useEffect(() => {
    let active = true
    const names = templateKey ? templateKey.split('|') : []
    Promise.all([
      loadPreparedTree(tree),
      ...names.map((name) => loadTree(name).catch((err) => {
        console.warn(`[useOfficialTree] Échec chargement template ${name}:`, err)
        return null
      })),
    ])
      .then(([screen, ...bodies]) => {
        if (!active) return
        const loaded: Record<string, VisualTreeNode> = {}
        names.forEach((name, index) => {
          const body = bodies[index]
          if (body) loaded[name] = body
        })
        setPayload({ screen, templates: loaded })
      })
      .catch((err) => {
        if (!active) return
        console.error(`[useOfficialTree] Échec chargement arbre ${tree}:`, err)
      })
    return () => { active = false }
  }, [tree, templateKey])
  return payload
}

let viewport = { width: typeof innerWidth === 'number' ? innerWidth : 0, height: typeof innerHeight === 'number' ? innerHeight : 0 }
const viewportListeners = new Set<() => void>()
function resizeViewport() {
  if (viewport.width === innerWidth && viewport.height === innerHeight) return
  viewport = { width: innerWidth, height: innerHeight }
  for (const listener of viewportListeners) listener()
}
function subscribeViewport(listener: () => void) {
  if (!viewportListeners.size) { resizeViewport(); addEventListener('resize', resizeViewport) }
  viewportListeners.add(listener)
  return () => { viewportListeners.delete(listener); if (!viewportListeners.size) removeEventListener('resize', resizeViewport) }
}
const viewportSnapshot = () => viewport
export function useViewport() {
  return useSyncExternalStore(subscribeViewport, viewportSnapshot, viewportSnapshot)
}

const treeCaches = new WeakMap<typeof fetch, DocumentCache<string, VisualTreeNode>>()
export async function loadTree(name: string): Promise<VisualTreeNode> {
  let cache = treeCaches.get(fetch)
  if (!cache) { cache = new DocumentCache(64, 8 * 1024 * 1024, tree => JSON.stringify(tree).length * 2); treeCaches.set(fetch, cache); registerDocumentCache('uiTrees', cache) }
  // Consumers may adapt their tree: retain one parsed source and hand out independent copies.
  return structuredClone(await cache.get(name, () => readTree(name)))
}

async function readTree(name: string): Promise<VisualTreeNode> {
  const inline = INLINE_UITK_TEMPLATES[name]
  if (inline) return structuredClone(inline)
  const [asset, fragment] = name.split('#')
  if (fragment) {
    const root = await loadTree(asset)
    const find = (node: VisualTreeNode): VisualTreeNode | undefined => (node.name === fragment || node.binding === fragment) ? node : node.children?.map(find).find(Boolean)
    const found = find(root)
    if (!found) throw new Error(`VisualTree fragment ${name} introuvable.`)
    return { type: 'UXML', children: [found] }
  }
  const response = await fetch(`/ui-data/trees/${name}.json`)
  if (!response.ok) throw new Error(`VisualTree ${name} introuvable.`)
  return response.json() as Promise<VisualTreeNode>
}

/** Full documents use host-compiled adaptations; dynamic inline/fragment trees retain preparation. */
export async function loadPreparedTree(name: string): Promise<VisualTreeNode> {
  const route = preparedRoutes[name]
  if (!route) return prepared(await loadTree(name))
  let cache = treeCaches.get(fetch)
  if (!cache) { cache = new DocumentCache(64, 8 * 1024 * 1024, tree => JSON.stringify(tree).length * 2); treeCaches.set(fetch, cache); registerDocumentCache('uiTrees', cache) }
  return structuredClone(await cache.get(route, async () => {
    const response = await fetch(route)
    if (!response.ok) throw new Error(`VisualTree préparé ${name} introuvable.`)
    return response.json() as Promise<VisualTreeNode>
  }))
}

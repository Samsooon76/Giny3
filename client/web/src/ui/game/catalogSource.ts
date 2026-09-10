/** Shared decoded tables across creation, HUD and encyclopedia. Failed reads are retryable. */
let sources = new WeakMap<typeof fetch, Map<string, Promise<unknown>>>()
export function resetCatalogSources() { sources = new WeakMap() }
export function catalogJson<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  let cache = sources.get(fetcher)
  if (!cache) { cache = new Map(); sources.set(fetcher, cache) }
  let pending = cache.get(path)
  if (!pending) {
    const owner = cache
    pending = fetcher(path).then(response => {
      if (!response.ok) throw new Error(`Catalogue ${path}: HTTP ${response.status}`)
      return response.json()
    }).catch(error => { owner.delete(path); throw error })
    cache.set(path, pending)
  }
  return pending as Promise<T>
}

type Entry = { bytes: number; owners: Map<string, number> }
const retained = new Map<object, Entry>()
/** Identity-based retention accounting. Sizes are estimates, not process heap measurements. */
export function retainDocument(value: object, owner: string, estimatedBytes: number): () => void {
  let entry = retained.get(value)
  if (!entry) { entry = { bytes: estimatedBytes, owners: new Map() }; retained.set(value, entry) }
  entry.bytes = Math.max(entry.bytes, estimatedBytes)
  entry.owners.set(owner, (entry.owners.get(owner) ?? 0) + 1)
  const owned = entry
  let released = false
  return () => {
    if (released) return
    released = true
    const count = (owned.owners.get(owner) ?? 1) - 1
    if (count) owned.owners.set(owner, count); else owned.owners.delete(owner)
    if (!owned.owners.size) retained.delete(value)
  }
}
export function updateDocumentEstimate(value: object, estimatedBytes: number): void {
  const entry = retained.get(value)
  if (entry) entry.bytes = estimatedBytes
}
export function documentOwnershipStats() {
  let estimatedBytes = 0, outsideCachesBytes = 0
  const owners: Record<string, { documents: number; references: number; estimatedBytes: number }> = {}
  for (const entry of retained.values()) {
    estimatedBytes += entry.bytes
    if (![...entry.owners.keys()].some(owner => owner.startsWith('cache:'))) outsideCachesBytes += entry.bytes
    for (const [name, references] of entry.owners) {
      const owner = owners[name] ??= { documents: 0, references: 0, estimatedBytes: 0 }
      owner.documents++; owner.references += references; owner.estimatedBytes += entry.bytes
    }
  }
  return { documents: retained.size, estimatedBytes, outsideCachesBytes, owners }
}

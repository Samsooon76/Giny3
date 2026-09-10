import type { ServerCharacterPreview } from './types'

export function parseServerCharacters(value: unknown): Map<number, ServerCharacterPreview[]> {
  if (typeof value === 'string') value = JSON.parse(value)
  const result = new Map<number, ServerCharacterPreview[]>()
  if (!value || typeof value !== 'object' || !('servers' in value) || !Array.isArray(value.servers)) return result
  for (const server of value.servers) {
    if (!server || !Number.isSafeInteger(server.id) || !Array.isArray(server.characters)) continue
    const seen = new Set<number>()
    const characters: ServerCharacterPreview[] = []
    for (const character of server.characters) {
      if (!character || !Number.isSafeInteger(character.id) || seen.has(character.id) || typeof character.name !== 'string' || typeof character.look !== 'string' || !character.look) continue
      seen.add(character.id)
      characters.push({ id: character.id, name: character.name, look: character.look })
    }
    result.set(server.id, characters)
  }
  return result
}

export const GAME_DATA_PREFIX = '/game-data'

export const DEFAULT_MAP_ID = 154644

export function gameDataUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '')
  return `${GAME_DATA_PREFIX}/${clean}`
}

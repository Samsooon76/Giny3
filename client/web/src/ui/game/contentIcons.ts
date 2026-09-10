/** Game-data pictos from the DataRoot / Picto index. Callers never invent a path. */

import { itemIcon, spellIcon } from './catalog'

export function spellIconUrls(iconId?: number): string[] {
  const url = spellIcon(iconId)
  return url ? [url] : []
}

export function itemIconUrls(item: { gid: number; icon_id?: number }): string[] {
  const url = itemIcon(item)
  return url ? [url] : []
}

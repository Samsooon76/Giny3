import { catalogJson } from './catalogSource'
import { tableRecords } from './catalog'
export type NpcTexts = { messages: Record<string, string>; replies: Record<string, string> }
type NpcRecord = { dialogMessages?: { values: (number | string)[] }[]; dialogReplies?: { values: (number | string)[] }[] }
export async function loadNpcTexts(templateId: number): Promise<NpcTexts> {
  const [npcSource, messageSource, i18n] = await Promise.all([
    catalogJson<unknown>('/game-data/data/npcs.json'),
    catalogJson<unknown>('/game-data/data/npcmessages.json'),
    catalogJson<{ by_id: Record<string, string> }>('/game-data/client/i18n.json'),
  ])
  const npc = tableRecords<NpcRecord>(npcSource)?.[templateId]
  const messages: Record<string, string> = {}, replies: Record<string, string> = {}
  for (const [id, row] of Object.entries(tableRecords<{ messageId: number | string }>(messageSource) ?? {})) {
    const text = i18n.by_id[String(row.messageId)]
    if (typeof text === 'string') messages[id] = text
  }
  for (const [entries, target] of [[npc?.dialogMessages, messages], [npc?.dialogReplies, replies]] as const) {
    for (const entry of entries ?? []) {
      const [id, textId] = entry.values
      const text = i18n.by_id[String(textId)]
      if (typeof text === 'string') target[String(id)] = text
    }
  }
  return { messages, replies }
}
/** Catalog markup is rendered as text, never executed as HTML. */
export function npcText(text: string, params: string[] = []): string {
  const plain = text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, entity => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity] ?? entity)
  return plain.replace(/#(\d+)/g, (original, index: string) => params[Number(index) - 1] ?? original)
}
export function npcPrice(price: number, quantity: number, selling = false): number | null {
  if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 1) return null
  const result = Math.max(selling ? 1 : 0, Math.floor((selling ? price / 10 : price) * quantity))
  return result > 0 && result <= 2147483647 ? result : null
}

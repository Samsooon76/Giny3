export type NpcItem = { uid: number; gid: number; name: string; quantity: number; sellPrice?: number; basePrice?: number }
export type NpcState = {
  sessionId: string; revision: number; mapId: number; actorId: number; templateId: number; name: string
  kind: 'talk' | 'shop' | 'trade'; messageId: number; dialogParams: string[]; replies: number[]
  tokenId: number; kamas: number; currencyBalance: number; offers: { gid: number; name: string; price: number }[] | null
  inventory: NpcItem[]; local: NpcItem[] | null; remote: NpcItem[] | null; acceptedGids: number[]
}
export type NpcSessionArgs = { sessionId: string; revision: number }
export type NpcAction =
  | { action: 'npc.sync'; args: Record<string, never> }
  | { action: 'npc.action'; args: { actorId: number; mapId: number; actionId: number } }
  | { action: 'npc.reply'; args: NpcSessionArgs & { replyId: number } }
  | { action: 'npc.buy'; args: NpcSessionArgs & { gid: number; quantity: number } }
  | { action: 'npc.sell' | 'npc.move'; args: NpcSessionArgs & { uid: number; quantity: number } }
  | { action: 'npc.ready' | 'npc.leave'; args: NpcSessionArgs }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const ids = (v: unknown): v is number[] => Array.isArray(v) && v.every(n => integer(n) && n > 0)
function items(v: unknown): boolean {
  return Array.isArray(v) && v.every(i => object(i) && integer(i.uid) && integer(i.gid) && i.gid > 0 && integer(i.quantity) && i.quantity > 0 && typeof i.name === 'string'
    && (i.basePrice === undefined || typeof i.basePrice === 'number' && Number.isFinite(i.basePrice) && i.basePrice >= 1))
}
export function parseNpcModuleState(json: string): { characterId: string; revision: number; state: NpcState | null } | null {
  try {
    const e = JSON.parse(json), s = e?.state
    if (e?.schemaVersion !== 1 || e.module !== 'npc' || typeof e.characterId !== 'string' || !/^[1-9]\d*$/.test(e.characterId) || !integer(e.revision) || e.revision < 1) return null
    if (s === null) return { characterId: e.characterId, revision: e.revision, state: null }
    if (!object(s) || typeof s.sessionId !== 'string' || !s.sessionId || s.revision !== e.revision || !integer(s.mapId) || !integer(s.actorId) || !integer(s.templateId) || typeof s.name !== 'string'
      || !['talk', 'shop', 'trade'].includes(String(s.kind)) || !integer(s.messageId) || !Array.isArray(s.dialogParams) || !s.dialogParams.every(p => typeof p === 'string') || !ids(s.replies)
      || !integer(s.tokenId) || !integer(s.kamas) || !integer(s.currencyBalance) || !items(s.inventory) || !ids(s.acceptedGids)) return null
    if (s.offers !== null && (!Array.isArray(s.offers) || !s.offers.every(i => object(i) && integer(i.gid) && i.gid > 0 && typeof i.name === 'string' && typeof i.price === 'number' && Number.isFinite(i.price) && i.price >= 1))) return null
    if (s.local !== null && !items(s.local) || s.remote !== null && !items(s.remote)) return null
    if (s.kind === 'shop' && s.offers === null || s.kind === 'trade' && (s.local === null || s.remote === null)) return null
    return { characterId: e.characterId, revision: e.revision, state: s as NpcState }
  } catch { return null }
}

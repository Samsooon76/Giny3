export type RecurringQuest = {
  id: number; title: string; description: string; period: string
  currentAmount: number; targetAmount: number; completed: boolean; rewardClaimed: boolean
  expiresUnix: number; rewards: { label: string; type: string; amount: number; itemId?: number }[]
}
export type BattlePassSlot = { label: string; claimed: boolean; claimable: boolean; locked: boolean; lockedReason: string }
export type QuestState = {
  serverUnix: number; dailyResetUnix: number; weeklyResetUnix: number
  daily: { quests: RecurringQuest[] }; weekly: { quests: RecurringQuest[] }; unclaimed: RecurringQuest[]
  battlePass: { seasonName: string; seasonEndsUnix: number; level: number; currentXp: number; xpRequired: number; vip: boolean; levels: { level: number; free: BattlePassSlot; vip: BattlePassSlot }[] }
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
function isQuest(q: unknown): q is RecurringQuest {
  return object(q) && Number.isSafeInteger(q.id) && typeof q.title === 'string' && typeof q.description === 'string'
    && number(q.currentAmount) && number(q.targetAmount) && q.targetAmount > 0 && number(q.expiresUnix)
    && typeof q.completed === 'boolean' && typeof q.rewardClaimed === 'boolean'
    && Array.isArray(q.rewards) && q.rewards.every(r => object(r) && typeof r.label === 'string' && number(r.amount))
}
function isSlot(s: unknown): s is BattlePassSlot {
  return object(s) && typeof s.label === 'string' && typeof s.claimed === 'boolean' && typeof s.claimable === 'boolean' && typeof s.locked === 'boolean'
}
export function parseQuestModuleState(json: string): { characterId: string; state: QuestState } | null {
  try {
    const envelope = JSON.parse(json), s = envelope?.state
    if (envelope?.schemaVersion !== 1 || envelope.module !== 'quests' || !/^[1-9]\d*$/.test(envelope.characterId) || typeof envelope.characterId !== 'string') return null
    if (!object(s) || !number(s.serverUnix) || !number(s.dailyResetUnix) || !number(s.weeklyResetUnix)) return null
    if (!object(s.daily) || !Array.isArray(s.daily.quests) || !s.daily.quests.every(isQuest)) return null
    if (!object(s.weekly) || !Array.isArray(s.weekly.quests) || !s.weekly.quests.every(isQuest)) return null
    if (!Array.isArray(s.unclaimed) || !s.unclaimed.every(isQuest)) return null
    const b = s.battlePass
    if (!object(b) || typeof b.seasonName !== 'string' || !number(b.level) || !number(b.currentXp) || !number(b.xpRequired)
      || !Array.isArray(b.levels) || !b.levels.every(l => object(l) && Number.isInteger(l.level) && isSlot(l.free) && isSlot(l.vip))) return null
    return { characterId: envelope.characterId, state: s as QuestState }
  } catch { return null }
}

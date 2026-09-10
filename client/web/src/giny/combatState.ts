import type { HudSpell } from './types'
export type CombatFighter = {
  preview_stats?: { id: number; total: number }[]; preview_complex?: boolean
  id: number; name: string; level: number; look: string; team: number; cell: number; direction: number
  life: number; max_life: number; shield: number; ap: number; mp: number; alive: boolean; ready: boolean; breed: number
  /** Observable movement profile (modern snapshot). All optional: unknown means unknown, never zero-filled. */
  tackle_block?: number; tackle_evade?: number; dodge_ap?: number; dodge_mp?: number
  can_tackle?: boolean; can_be_tackled?: boolean; can_move?: boolean
  carried?: boolean; controller_id?: number; invisible?: boolean
}
export type CombatSnapshot = {
  fight_key: string; fight_id: number; map_id: number; phase: 'preparation' | 'fighting' | 'finishing'
  turn: number; active_id: number; controlled_id: number; team: number; leader: boolean; ready: boolean
  remaining_ms: number; placement: number[]; enemy_placement: number[]; timeline: number[]
  spells?: HudSpell[]; fighters: CombatFighter[]; cooldowns: Record<string, unknown>[]; marks: CombatMark[]
}
/** Recipient-filtered mark (glyph/trap). Hidden marks carry no coordinates. */
export type CombatMark = {
  markId: number; markType: number; active: boolean; author: number; team: number
  center: number; spell: number; cells: Array<{ cellId: number; color: number }>
}
/** Normalize a GameActionMark-shaped payload (snapshot or live event).
    Returns null when unusable; a hidden mark normalizes to empty cells and
    center -1, never leaking coordinates. */
export function normalizeMark(raw: unknown): CombatMark | null {
  const m = record(raw)
  const cells = rows(m.cells)
    .map(c => ({ cellId: number(c.cellId, -1), color: number(c.cellColor, 0) }))
    .filter(c => c.cellId >= 0)
  if (!Number.isSafeInteger(number(m.markId, NaN))) return null
  return {
    markId: number(m.markId), markType: number(m.markType), active: Boolean(m.active),
    author: number(m.markAuthorId), team: number(m.markTeamId),
    center: number(m.markimpactCell, -1), spell: number(m.markSpellId), cells,
  }
}
export type CombatEvent = {
  schemaVersion: 1; messageId?: number; revision: number; characterId: string; fightKey: string | null
  name: string; data: Record<string, unknown>; snapshot: CombatSnapshot | null
}
export type CombatChallenge = { id: number; name: string; description: string; xp: number; drop: number; state: number }
export type PointsResource = 'ap' | 'mp'
export type CombatVariation = { target: number; source: number; delta: number; resource: PointsResource; reason: string; revision: number }
export type CombatTackle = { target: number; tacklers: number[]; revision: number }
export type CombatDodge = { target: number; source: number; resource: PointsResource | null; dodged: number; revision: number }
export type CombatStatistics = { damage: number; received: number; heal: number; healed: number; kills: number }
export type CombatResult = { key: string; duration: number; turn?: number; statistics?: Record<string, CombatStatistics>; participants: Array<{
  id: number; name: string; level: number; look: string; outcome: number; alive: boolean
  xp: string; kamas: string; loot: { gid: number; quantity: number }[]
}> }
export type CombatState = {
  statistics?: Record<string, CombatStatistics>
  snapshot: CombatSnapshot | null; deadline: number; proposals: CombatChallenge[]; challenges: CombatChallenge[]
  challengeDeadline: number; bonus: number; mode: number; result: CombatResult | null; revision: number
  /** Typed movement/resource journal (bounded). The original message stays in the event `data`. */
  variations: CombatVariation[]; tackles: CombatTackle[]; dodges: CombatDodge[]
  /** Explicit sequence nesting (roots on the legacy wire, children as
      modern-only synthetic events) plus the last closed action identity. */
  sequenceDepth: number; lastSequence: { type: number; author: number; action: number } | null
  /** Open sequence stack, root first. Root starts carry no id on the legacy
      wire (id -1); child start/end events carry sequenceId/parentId, which is
      what groups a signal with its variations causally instead of by delay. */
  sequenceStack: Array<{ id: number; type: number; author: number }>
}
export const emptyCombat = (): CombatState => ({ snapshot: null, deadline: 0, proposals: [], challenges: [], challengeDeadline: 0, bonus: 0, mode: 0, result: null, revision: 0, variations: [], tackles: [], dodges: [], sequenceDepth: 0, lastSequence: null, sequenceStack: [] })
export const number = (v: unknown, fallback = 0): number => Number.isFinite(Number(v)) ? Number(v) : fallback
export const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
export const rows = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map(record) : []
/** Protocol actionIds whose resource is authoritative (ActionsEnum). Anything else,
 * including a bare actionId 0 without emission metadata, resolves to null so the
 * caller awaits the snapshot instead of guessing PA vs PM from context. */
const KNOWN_VARIATION_RESOURCE: Record<number, PointsResource> = { 78: 'mp', 101: 'ap', 120: 'ap', 127: 'mp', 133: 'ap', 134: 'mp' }
export function variationResource(d: Record<string, unknown>): PointsResource | null {
  const meta = typeof d.resource === 'string' ? d.resource : ''
  if (meta === 'ap' || meta === 'mp') return meta
  return KNOWN_VARIATION_RESOURCE[number(d.actionId, -1)] ?? null
}
export function variationReason(d: Record<string, unknown>): string {
  if (typeof d.reason === 'string' && d.reason) return d.reason
  return number(d.delta) < 0 ? 'withdraw' : 'gain'
}
/** Floating label for a resource delta. Pure so the journal stays exact. */
export function variationLabel(delta: number, resource: PointsResource): string {
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${resource === 'ap' ? 'PA' : 'PM'}`
}
/** Placeholder floating-text palette. Explicitly NOT the official one: hues
    only need to keep PA and PM apart until the official font/atlas/curves are
    extracted (combat-presentation-manifest, family papm). */
export const VARIATION_COLORS: Record<PointsResource, number> = { ap: 0x7fb8ff, mp: 0xffb45e }
export const DODGE_COLOR = 0xb9c4d6
/** Authoritative cell list of a GameMapMovementMessage: expanded `path` when the
 * projection carries it, otherwise the direction-compressed `keyMovements`
 * (cell = key & 4095, same masking as PathReader.ReadCell). */
export function movementCells(d: Record<string, unknown>): number[] {
  if (Array.isArray(d.path)) return d.path.map(v => number(v)).filter(v => v >= 0)
  if (Array.isArray(d.keyMovements)) return d.keyMovements.map(v => number(v) & 4095).filter(v => v >= 0)
  return []
}
const integers = (v: unknown) => Array.isArray(v) && v.every(n => Number.isSafeInteger(n))
export function parseCombatEvent(json: string): CombatEvent | null {
  const v = JSON.parse(json)
  if (v.schemaVersion !== 1 || !Number.isSafeInteger(v.revision) || v.revision <= 0 || typeof v.name !== 'string' || typeof v.characterId !== 'string' || !v.data || typeof v.data !== 'object') return null
  if (v.snapshot) {
    const s = v.snapshot
    if (typeof s.fight_key !== 'string' || !['preparation', 'fighting', 'finishing'].includes(s.phase) || !Number.isSafeInteger(s.map_id) || !Array.isArray(s.fighters) || !integers(s.timeline) || !integers(s.placement) || !integers(s.enemy_placement)) return null
    if (!s.fighters.every((f: CombatFighter) => Number.isSafeInteger(f.id) && Number.isInteger(f.cell) && f.cell >= -1 && f.cell < 560 && typeof f.look === 'string' && typeof f.name === 'string' && Number.isFinite(f.life))) return null
    // Marks are normalized at the boundary: a non-array rejects the snapshot,
    // a single unusable entry is dropped without killing the checkpoint.
    const rawMarks = (s as { marks?: unknown }).marks
    if (rawMarks !== undefined && !Array.isArray(rawMarks)) return null
    ;(s as { marks: CombatMark[] }).marks = rawMarks === undefined ? [] : rawMarks.map(normalizeMark).filter((m): m is CombatMark => m !== null)
  }
  return v as CombatEvent
}
function challenge(raw: Record<string, unknown>): CombatChallenge {
  return { id: number(raw.challengeId), name: String(raw.name ?? `Challenge ${raw.challengeId}`), description: String(raw.description ?? ''), xp: number(raw.xpBonus), drop: number(raw.dropBonus), state: number(raw.state) }
}
export function reduceCombat(previous: CombatState, e: CombatEvent, now = Date.now()): CombatState {
  if (e.revision <= previous.revision) return previous
  const d = e.data
  let state = { ...previous, revision: e.revision }
  if (e.snapshot) {
    if (previous.snapshot?.fight_key !== e.snapshot.fight_key) state = { ...emptyCombat(), result: previous.result, revision: e.revision, statistics: e.snapshot.phase === 'preparation' ? {} : undefined }
    state.snapshot = e.snapshot
    // TurnStart is emitted before Giny starts its timer. The following root
    // sequence checkpoint may still report zero: retain the announced deadline.
    if (e.snapshot.remaining_ms > 0 || !previous.snapshot || previous.snapshot.fight_key !== e.snapshot.fight_key) state.deadline = now + e.snapshot.remaining_ms
  }
  const s = state.snapshot
  if (e.name === 'GameContextCreateMessage' && number(d.context) === 1) return { ...emptyCombat(), result: state.result, revision: e.revision }
  if (!s) return state
  if (e.fightKey && e.fightKey !== s.fight_key) return previous
  const count = (id: unknown, key: keyof CombatStatistics, amount: number) => {
    if (!state.statistics || !s.fighters.some(f => f.id === Number(id))) return
    const k = String(id), old = state.statistics[k] ?? { damage: 0, received: 0, heal: 0, healed: 0, kills: 0 }
    state.statistics = { ...state.statistics, [k]: { ...old, [key]: old[key] + amount } }
  }
  if (e.name.includes('LifePointsLost') || e.name.includes('LifeAndShieldPointsLost')) {
    count(d.sourceId, 'damage', number(d.loss)); count(d.targetId, 'received', number(d.loss))
  }
  if (e.name === 'GameActionFightLifePointsGainMessage') { count(d.sourceId, 'heal', number(d.delta)); count(d.targetId, 'healed', number(d.delta)) }
  if (e.name === 'GameActionFightDeathMessage') {
    const target = s.fighters.find(f => f.id === number(d.targetId)), source = s.fighters.find(f => f.id === number(d.sourceId))
    if (target && source && target.team !== source.team) count(d.sourceId, 'kills', 1)
  }
  const update = (id: number, patch: Partial<CombatFighter>) => {
    state.snapshot = { ...state.snapshot!, fighters: state.snapshot!.fighters.map(f => f.id === id ? { ...f, ...patch } : f) }
  }
  if (e.name === 'GameFightStartMessage') state.snapshot = { ...s, phase: 'fighting' }
  if (e.name === 'GameFightTurnStartMessage' || e.name === 'GameFightTurnResumeMessage') {
    state.snapshot = { ...s, active_id: number(d.id, s.active_id), phase: 'fighting' }
    state.deadline = now + number(d.remainingTime ?? d.waitTime) * 100
  }
  if (e.name === 'GameFightTurnEndMessage') state.snapshot = { ...s, active_id: 0 }
  if (e.name === 'SequenceStartMessage') {
    state.sequenceStack = [...state.sequenceStack, { id: -1, type: number(d.sequenceType), author: number(d.authorId) }]
    state.lastSequence = { type: number(d.sequenceType), author: number(d.authorId), action: -1 }
  }
  if (e.name === 'SequenceChildStartMessage') {
    state.sequenceStack = [...state.sequenceStack, { id: number(d.sequenceId, -1), type: number(d.sequenceType), author: number(d.authorId) }]
  }
  if (e.name === 'SequenceChildEndMessage') {
    const id = number(d.sequenceId, -1)
    const stack = [...state.sequenceStack]
    const at = stack.map(s => s.id).lastIndexOf(id)
    // Pop the child and anything opened above it; an unknown id leaves the
    // stack untouched instead of corrupting the grouping.
    if (at >= 0) stack.splice(at)
    state.sequenceStack = stack
  }
  if (e.name === 'SequenceEndMessage') {
    const stack = [...state.sequenceStack]
    // Close unclosed children first, then the root they belong to.
    let root = stack.length - 1
    while (root >= 0 && stack[root].id !== -1) root -= 1
    state.sequenceStack = root >= 0 ? stack.slice(0, root) : []
    state.lastSequence = { type: number(d.sequenceType), author: number(d.authorId), action: number(d.actionId, -1) }
  }
  state.sequenceDepth = state.sequenceStack.length
  if (e.name === 'GameFightNewRoundMessage') state.snapshot = { ...s, turn: number(d.roundNumber) }
  if (e.name === 'GameActionFightDeathMessage') update(number(d.targetId), { alive: false, life: 0 })
  if (e.name === 'GameActionFightLifePointsLostMessage' || e.name === 'GameActionFightLifeAndShieldPointsLostMessage') {
    const target = s.fighters.find(f => f.id === number(d.targetId))
    if (target) update(target.id, { life: Math.max(0, target.life - number(d.loss)), max_life: Math.max(1, target.max_life - number(d.permanentDamages)), shield: Math.max(0, target.shield - number(d.shieldLoss)) })
  }
  if (e.name === 'GameActionFightLifePointsGainMessage') {
    const target = s.fighters.find(f => f.id === number(d.targetId))
    if (target) update(target.id, { life: Math.min(target.max_life, target.life + number(d.delta)) })
  }
  if (e.name === 'GameActionFightPointsVariationMessage') {
    const resource = variationResource(d)
    const target = s.fighters.find(f => f.id === number(d.targetId))
    const delta = number(d.delta)
    // Server arithmetic stays authoritative: apply the signed delta raw, never
    // re-derive it. An unresolvable resource (bare actionId 0 from an old
    // server) applies nothing here; the checkpoint snapshot reconciles.
    if (target && resource && Number.isSafeInteger(delta) && delta !== 0) {
      update(target.id, resource === 'ap' ? { ap: target.ap + delta } : { mp: target.mp + delta })
    }
    if (target && resource) {
      state.variations = [...state.variations.slice(-49), { target: target.id, source: number(d.sourceId), delta, resource, reason: variationReason(d), revision: e.revision }]
    }
  }
  if (e.name === 'GameActionFightTackledMessage') {
    const tacklers = Array.isArray(d.tacklersIds) ? d.tacklersIds.map(v => number(v)) : []
    state.tackles = [...state.tackles.slice(-49), { target: number(d.sourceId), tacklers, revision: e.revision }]
  }
  if (e.name === 'GameActionFightDodgePointLossMessage') {
    const action = number(d.actionId, -1)
    const resource: PointsResource | null = action === 308 ? 'ap' : action === 309 ? 'mp' : null
    // Journal only: a dodged amount is never debited.
    state.dodges = [...state.dodges.slice(-49), { target: number(d.targetId), source: number(d.sourceId), resource, dodged: number(d.amount), revision: e.revision }]
  }
  if (e.name === 'GameMapMovementMessage') {
    const cells = movementCells(d)
    if (cells.length > 0) update(number(d.actorId), { cell: cells[cells.length - 1] })
  }
  if (e.name === 'GameActionFightTeleportOnSameMapMessage' || e.name === 'GameActionFightSlideMessage') update(number(d.targetId), { cell: number(d.cellId ?? d.endCellId) })
  if (e.name === 'GameActionFightMarkCellsMessage') {
    const mark = normalizeMark(d.mark)
    if (mark) state.snapshot = { ...s, marks: [...s.marks.filter(m => m.markId !== mark.markId), mark] }
  }
  if (e.name === 'GameActionFightUnmarkCellsMessage') {
    state.snapshot = { ...s, marks: s.marks.filter(m => m.markId !== number(d.markId)) }
  }
  if (e.name === 'ChallengeProposalMessage') { state.proposals = rows(d.challengeProposals).map(challenge); state.challengeDeadline = now + number(d.timer) * 1000 }
  if (e.name === 'ChallengeAddMessage') {
    const c = challenge(record(d.challengeInformation))
    state.challenges = [...state.challenges.filter(x => x.id !== c.id), c]; state.proposals = []
  }
  if (e.name === 'ChallengeResultMessage') state.challenges = state.challenges.map(c => c.id === number(d.challengeId) ? { ...c, state: d.success ? 0 : 1 } : c)
  if (e.name === 'ChallengeBonusChoiceSelectedMessage') state.bonus = number(d.challengeBonus)
  if (e.name === 'ChallengeModSelectedMessage') state.mode = number(d.challengeMod)
  if (e.name === 'GameFightEndMessage') {
    state.snapshot = { ...s, phase: 'finishing' }
    state.result = { key: s.fight_key, duration: number(d.duration), turn: s.turn, statistics: state.statistics, participants: rows(d.results).map(r => {
      const fighter = s.fighters.find(f => f.id === number(r.id)), rewards = record(r.rewards)
      const xp = rows(r.additional).find(a => a._type === 'FightResultExperienceData')
      return { id: number(r.id), name: fighter?.name ?? `Combattant ${r.id}`, level: number(r.level, fighter?.level), look: fighter?.look ?? '', outcome: number(r.outcome), alive: Boolean(r.alive), xp: String(xp?.experienceFightDelta ?? '0'), kamas: String(rewards.kamas ?? '0'), loot: rows(rewards.objects).map(o => ({ gid: number(o.objectId), quantity: number(o.quantity) })) }
    }) }
  }
  return state
}

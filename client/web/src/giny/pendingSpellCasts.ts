import type { CombatEvent, CombatSnapshot } from './combatState'

type Request = { spellId: number; levelId?: number; fighter: number; fight: string; turn: number; sentAt: number }
/** Legacy refusals carry a spell-level id, but no caster. Never turn an
 * unsolicited broadcast (especially an AI failure) into a player error. */
export class PendingSpellCasts {
  private requests: Request[] = []
  add(state: CombatSnapshot, spellId: number, levelId?: number): () => void {
    const request = { spellId, levelId, fighter: state.controlled_id, fight: state.fight_key, turn: state.turn, sentAt: Date.now() }
    this.requests.push(request)
    return () => { this.requests = this.requests.filter(r => r !== request) }
  }
  clear(): void { this.requests = [] }
  receive(event: CombatEvent, state: CombatSnapshot | null): boolean {
    this.requests = this.requests.filter(r => state?.phase === 'fighting' && r.fight === state.fight_key &&
      r.fight === event.fightKey && r.turn === state.turn && r.fighter === state.controlled_id &&
      state.active_id === r.fighter && Date.now() - r.sentAt < 10000)
    const failed = event.name === 'GameActionFightNoSpellCastMessage'
    const success = event.name === 'GameActionFightSpellCastMessage' || event.name === 'GameActionFightCloseCombatMessage'
    if (!failed && !success) return false
    const index = this.requests.findIndex(r => {
      if (success) return Number(event.data.sourceId) === r.fighter &&
        (event.name === 'GameActionFightCloseCombatMessage' ? r.spellId === 0 : Number(event.data.spellId) === r.spellId)
      if (event.data.sourceId != null && Number(event.data.sourceId) !== r.fighter) return false
      const level = Number(event.data.spellLevelId)
      return Number.isInteger(level) && level >= 0 && (r.levelId == null || level === r.levelId)
    })
    if (index < 0) return false
    this.requests.splice(index, 1)
    return failed
  }
}

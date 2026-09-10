import type { NpcAction } from './npcState'
export type GameAction = NpcAction
  | { action: 'quests.sync'; args: Record<string, never> }
  | { action: 'quests.claim'; args: { questId: number } }
  | { action: 'battlepass.claim'; args: { level: number; vip: 0 | 1 } }
  | { action: 'item.equip'; args: { uid: number; position: number } }
  | { action: 'item.use'; args: { uid: number } }
  | { action: 'stats.boost'; args: { statId: number; amount: number } }
  | { action: 'stats.reset'; args: Record<string, never> }
  | { action: 'spell.activate'; args: { spellId: number } }
  | { action: 'title.select' | 'ornament.select'; args: { id: number } }

/** Commands are correlated per connection. Never retry a timed-out mutation. */
export class ActionBroker {
  private pending = new Map<string, { characterId: string; resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  request(characterId: string, command: GameAction, send: (json: string) => void, resync: () => void): Promise<void> {
    if (this.pending.size) return Promise.reject(new Error('Une action est déjà en cours.'))
    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('Résultat non confirmé. Vérifiez les données resynchronisées avant de réessayer.'))
        resync()
      }, 8000)
      this.pending.set(requestId, { characterId, resolve, reject, timer })
      try { send(JSON.stringify({ schemaVersion: 1, requestId, characterId, ...command })) }
      catch (error) {
        clearTimeout(timer)
        this.pending.delete(requestId)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  receive(json: string): void {
    try {
      const result = JSON.parse(json)
      if (result?.schemaVersion !== 1 || typeof result.requestId !== 'string' || typeof result.success !== 'boolean') return
      const entry = this.pending.get(result.requestId)
      if (!entry || result.characterId !== entry.characterId) return
      clearTimeout(entry.timer)
      this.pending.delete(result.requestId)
      if (result.success) entry.resolve()
      else entry.reject(new Error(typeof result.message === 'string' && result.message ? result.message : 'Action refusée par Giny.'))
    } catch { /* Ignore malformed results; timeout will request a fresh snapshot. */ }
  }

  close(error = new Error('Connexion fermée. Le résultat de l’action doit être vérifié après reconnexion.')): void {
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error) }
    this.pending.clear()
  }
}

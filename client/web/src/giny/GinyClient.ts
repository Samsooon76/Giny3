import { parseNpcModuleState, type NpcState } from './npcState'
import { SessionChat } from './SessionChat'
import { FrameReplies } from './FrameReplies'
import { HudRefreshQueue } from './HudRefreshQueue'
import { privateChatPayload } from './privateChat'
import { parseServerCharacters } from './serverCharacters'
import type { ServerCharacterPreview } from './types'
import { PendingSpellCasts } from './pendingSpellCasts'
import { spellLevel } from '../ui/game/catalog'
import { CombatSequencer } from '../game/combat/CombatSequencer'
import { emptyCombat, parseCombatEvent, reduceCombat, number as combatNumber, type CombatEvent, type CombatState } from './combatState'
import { Reader, Writer } from './binary'
import { ActionBroker, type GameAction } from './actions'
import { parseQuestModuleState, type QuestState } from './questState'
import { readModernJson } from './modernJson'
import { logEvent } from '../debug/sessionLogger'
import { packClientFrame, ServerFrameCodec, type GinyFrame } from './frameCodec'
import { MESSAGES } from './messages'
import { openGinyTransport, type GinyTransport } from './transport'
import {
  characterNameError,
  coordToCellId,
  creationError,
  decryptTicket,
  encodeMovement,
  loadCreationCatalog,
  MovementRefusedError,
  parseCharacterHud,
  parseCharacters,
  parseIdentification,
  parseInteractiveElementUpdated,
  parseInteractiveUseEnded,
  parseInteractiveUseError,
  parseInteractiveUsed,
  parseMovement,
  parseSelectedCharacter,
  parseSelectedServer,
  parseServers,
  readServer,
  parseServerSelectionRefused,
  serverUnavailableMessage,
  parseStatedElementUpdated,
  type InteractiveEvent,
  type InternalSelectedServer,
} from './parsers'
import type {
  Account, Character, CharacterHud, ChatLine, CreationCatalog, CreationRequest, GameServer, Movement,
  SelectedServer, WorldActor, WorldInteractive, WorldSession,
} from './types'
import { CHAT_CHANNEL } from './types'

export { characterNameError, parseCharacterHud } from './parsers'
export type { InteractiveEvent } from './parsers'
const MESSAGE_NAMES = new Map<number, string>(Object.entries(MESSAGES).map(([name, id]) => [id as number, name]))
type MapSnapshot = Pick<WorldSession, 'actors' | 'interactives'>

function messageName(messageId: number): string {
  return MESSAGE_NAMES.get(messageId) ?? `inconnu(${messageId})`
}

export class GinyClient {
  private mapChangePending = false
  private actions = new ActionBroker()
  private pendingSpellCasts = new PendingSpellCasts()
  private combatState = emptyCombat()
  private presentedCombatState = emptyCombat()
  private projectedIds = new Set<number>()
  private combatListeners = new Set<() => void>()
  private combatPresenter: ((event: CombatEvent, state: CombatState, signal: AbortSignal) => Promise<void>) | null = null
  combatBusy = false
  /** Highest revision whose presentation fully settled. Lags behind `revision`
      while animations play; the HUD follows the presented state, never ahead. */
  presentedRevision = 0
  private combatQueue = new CombatSequencer(busy => { this.combatBusy = busy; this.notifyCombat() }, error => logEvent('error', 'combat-animation', String(error)))
  getCombatState = (): CombatState => this.presentedCombatState
  getAuthoritativeCombatState = (): CombatState => this.combatState
  onCombat = (listener: () => void): (() => void) => { this.combatListeners.add(listener); return () => { this.combatListeners.delete(listener) } }
  private notifyCombat(): void { this.combatListeners.forEach(listener => listener()) }
  setCombatPresenter(presenter: typeof this.combatPresenter): void { this.combatPresenter = presenter }
  dismissCombatResult(): void { this.combatState = { ...this.combatState, result: null }; this.presentedCombatState = { ...this.presentedCombatState, result: null }; this.notifyCombat() }

  private receiveCombat(event: CombatEvent): void {
    if (event.characterId !== String(this.selectedCharacter?.id) || event.revision <= this.combatState.revision) return
    if (event.messageId) this.projectedIds.add(event.messageId)
    if (event.snapshot && this.combatState.snapshot && event.snapshot.fight_key !== this.combatState.snapshot.fight_key) { this.combatQueue.reset(); this.presentedRevision = 0 }
    if (event.snapshot) this.clearNpc()
    const state = reduceCombat(this.combatState, event)
    this.combatState = state
    if (this.pendingSpellCasts.receive(event, state.snapshot)) this.chat.emit({ id: this.chat.nextId(), kind: 'error', channel: CHAT_CHANNEL.INFO, content: 'Sort refusé : vérifiez la portée, la ligne de vue, la cible et les conditions du sort.', timestamp: Date.now() })
    // Official fight-log templates ui.fight.dodgeAP / ui.fight.dodgeMP,
    // rendered as plain text. The dodged amount is journalled, never debited.
    if (event.name === 'GameActionFightDodgePointLossMessage') {
      const action = combatNumber(event.data.actionId, -1)
      const resource = action === 308 ? 'PA' : action === 309 ? 'PM' : null
      const target = state.snapshot?.fighters.find(f => f.id === combatNumber(event.data.targetId))
      const dodged = combatNumber(event.data.amount)
      if (target && resource && dodged > 0) this.chat.emit({ id: this.chat.nextId(), kind: 'info', channel: CHAT_CHANNEL.INFO, content: `${target.name} esquive la perte de ${dodged} ${resource}.`, timestamp: Date.now() })
    }
    this.combatQueue.enqueue(async signal => { await this.combatPresenter?.(event, state, signal) }, () => {
      this.presentedRevision = Math.max(this.presentedRevision, event.revision)
      this.presentedCombatState = state
      this.notifyCombat()
      if (event.name === 'GameFightTurnReadyRequestMessage') this.send(9655, new Writer().u8(1).finish())
      if (event.name === 'SequenceEndMessage' && combatNumber(event.data.authorId) === this.selectedCharacter?.id) {
        const id = combatNumber(event.data.actionId)
        if (id >= 0 && id <= 255) this.send(5751, new Writer().u8(1).u8(id).finish())
      }
    })
  }

  combatCommand(action: 'attack' | 'place' | 'ready' | 'pass' | 'cast' | 'challenges' | 'challengeMode' | 'challenge' | 'bonus' | 'leave', value = 0, cell = -1): void {
    const s = this.combatState.snapshot
    if (action === 'attack') {
      if (s || !Number.isSafeInteger(value)) throw new Error('Attaque indisponible.')
      this.send(9329, new Writer().f64(value).finish()); return
    }
    if (!s || s.phase === 'finishing') throw new Error('Aucun combat actif.')
    const preparation = s.phase === 'preparation'
    if (['place', 'ready', 'challenges', 'challengeMode', 'challenge', 'bonus'].includes(action) && !preparation) throw new Error('La préparation est terminée.')
    if (['cast', 'pass'].includes(action) && (preparation || s.active_id !== s.controlled_id || this.combatBusy)) throw new Error('Attendez votre tour et la fin des animations.')
    if (action === 'place') {
      if (s.ready || !s.placement.includes(value) || s.fighters.some(f => f.alive && f.cell === value && f.id !== s.controlled_id)) throw new Error('Cette cellule de placement est indisponible.')
      this.send(7043, new Writer().varUInt(value).finish())
    } else if (action === 'ready') this.send(4840, new Writer().u8(value ? 1 : 0).finish())
    else if (action === 'pass') this.send(3915, new Writer().u8(0).finish())
    else if (action === 'cast') {
      if (!Number.isInteger(value) || value < 0 || value > 32767 || cell < 0 || cell > 559) throw new Error('Sort ou cible invalide.')
      const grade = s.spells?.find(spell => spell.id === value)?.grade ?? 1
      const cancel = this.pendingSpellCasts.add(s, value, value === 0 ? 0 : spellLevel(value, grade)?.id)
      try { this.send(6438, new Writer().varUInt(value).i16(cell).finish(), `sort=${value} cellule=${cell}`) }
      catch (error) { cancel(); throw error }
    } else if (action === 'challengeMode') {
      if (!s.leader) throw new Error('Seul le chef choisit les challenges.')
      this.send(4455, new Writer().u8(value === 1 ? 1 : 0).finish())
    } else if (action === 'challenges') {
      if (!s.leader) throw new Error('Seul le chef choisit les challenges.')
      this.send(9700, new Writer().u8(value === 1 ? 1 : 0).finish())
    } else if (action === 'challenge') {
      if (!s.leader || !this.combatState.proposals.some(c => c.id === value)) throw new Error('Challenge indisponible.')
      this.send(8427, new Writer().varUInt(value).finish())
    } else if (action === 'bonus') this.send(2271, new Writer().u8(value === 1 ? 1 : 0).finish())
    else if (action === 'leave') this.send(4314, new Uint8Array())
  }

  combatMove(path: number[]): void {
    const s = this.combatState.snapshot
    if (!s || s.phase !== 'fighting' || s.active_id !== s.controlled_id || this.combatBusy || path.length < 2) throw new Error('Déplacement indisponible.')
    const keys = encodeMovement(path), writer = new Writer().u16(keys.length)
    keys.forEach(key => writer.u16(key))
    this.send(MESSAGES.GAME_MAP_MOVEMENT_REQUEST, writer.f64(s.map_id).finish())
  }

  private npcState: NpcState | null = null
  private npcRevision = 0
  private npcListeners = new Set<() => void>()
  getNpcState = (): NpcState | null => this.npcState
  onNpcState = (listener: () => void): (() => void) => { this.npcListeners.add(listener); return () => { this.npcListeners.delete(listener) } }
  private clearNpc(): void { this.npcState = null; this.npcListeners.forEach(listener => listener()) }

  private questStates = new Map<string, QuestState>()
  private questListeners = new Set<() => void>()
  getQuestState(): QuestState | null { return this.questStates.get(String(this.selectedCharacter?.id)) ?? null }
  onQuestState(listener: () => void): () => void { this.questListeners.add(listener); return () => this.questListeners.delete(listener) }
  private transport: GinyTransport | null = null
  private codec = new ServerFrameCodec()
  private replies = new FrameReplies()
  private controlWaiters: Array<{ resolve: () => void; reject: (error: Error) => void; timeout: number }> = []
  private sequence = 0
  private aesKey = new Uint8Array()
  private selectedInternal: InternalSelectedServer | null = null
  private selectedCharacter: Character | null = null
  private characterLoaded = false
  private currentMapId = 0
  private actorChangeListeners = new Set<() => void>()
  private movementListeners = new Set<(movement: Movement) => void>()
  private hudListeners = new Set<(hud: CharacterHud) => void>()
  private interactiveListeners = new Set<(event: InteractiveEvent) => void>()
  private mapListeners = new Set<(session: WorldSession) => void>()
  private chat = new SessionChat()
  private disconnectListeners = new Set<(reason: string) => void>()
  private switchingTarget = false
  private target: 'auth' | 'world' | null = null
  private expectedAuthDisconnect = false
  private manualClose = false
  private generation = 0
  /** Guards against two server-driven map changes overlapping. */
  private serverMapChange: Promise<void> | null = null
  private mapSnapshotRequest: { mapId: number; promise: Promise<MapSnapshot> } | null = null
  private lastHud: CharacterHud | null = null
  private hudRequest: Promise<CharacterHud | null> | null = null
  private readonly hudNotifications = new HudRefreshQueue(async () => {
    if (this.characterLoaded && document.visibilityState !== 'hidden') await this.requestCharacterHud()
  })
  private catalog: CreationCatalog | null = null
  account: Account | null = null

  async authenticate(identifier: string, password: string): Promise<Account> {
    this.close()
    const generation = this.generation
    await this.openBridge()
    this.assertCurrent(generation)
    await this.connectTarget({ type: 'connect-auth' })
    this.assertCurrent(generation)
    await this.readUntil([MESSAGES.HELLO_CONNECT])
    this.assertCurrent(generation)
    this.aesKey = crypto.getRandomValues(new Uint8Array(32))
    const credentials = new Writer().utf(identifier).utf(password).raw(this.aesKey).finish()
    const payload = new Writer()
      .u8(0).raw(Uint8Array.from([3, 0, 0])).i32(0).u8(0).utf('fr')
      .varUInt(credentials.length).raw(credentials).u16(0).varUInt(0).u16(0).finish()
    const response = await this.requestFrame([MESSAGES.IDENTIFICATION_SUCCESS, MESSAGES.IDENTIFICATION_FAILED], () =>
      this.send(MESSAGES.IDENTIFICATION, payload))
    this.assertCurrent(generation)
    if (response.messageId === MESSAGES.IDENTIFICATION_FAILED) {
      throw new Error(`Authentification Giny refusée (reason=${response.payload[0] ?? -1}).`)
    }
    this.account = parseIdentification(response.payload)
    this.send(MESSAGES.MODERN_SERVER_CHARACTERS_REQUEST, new Uint8Array())
    return this.account
  }

  private serverPreviews = new Map<number, ServerCharacterPreview[]>()
  private knownServers: GameServer[] | null = null
  private serverListeners = new Set<(servers: GameServer[]) => void>()
  onServers(listener: (servers: GameServer[]) => void): () => void {
    this.serverListeners.add(listener)
    return () => { this.serverListeners.delete(listener) }
  }
  private publishServers(servers: GameServer[]): void {
    servers = servers.map(server => ({ ...server, characters: (this.serverPreviews.get(server.id) ?? []).slice(0, server.charactersCount) }))
    this.knownServers = servers
    logEvent('network', 'server-status', servers.map(server => `${server.id}: ${server.status}${server.selectable ? '' : ' (indisponible)'}`).join(', '))
    this.serverListeners.forEach(listener => listener(servers))
  }

  async listServers(): Promise<GameServer[]> {
    if (this.knownServers) return this.knownServers
    const frame = await this.readUntil([MESSAGES.SERVERS_LIST])
    return this.knownServers ?? parseServers(frame.payload)
  }

  async selectServer(serverId: number): Promise<SelectedServer> {
    const known = this.knownServers?.find(server => server.id === serverId)
    if (this.knownServers && !known?.selectable) throw new Error(serverUnavailableMessage(known))
    // Auth hangs up in the same TCP burst as SelectedServerData (`client.Disconnect()`
    // in ConnectionHandler.SelectServer). Electron/vite deliver that `disconnected`
    // *before* this function continues past `readUntil`, so the flag must be up
    // before we send SERVER_SELECTION — otherwise App.tsx logout() closes the
    // gateway and connect-world throws "Passerelle Giny fermée."
    this.switchingTarget = true
    this.expectedAuthDisconnect = false
    const generation = this.generation
    try {
      const response = await this.requestFrame([MESSAGES.SELECTED_SERVER_DATA, MESSAGES.SELECTED_SERVER_REFUSED], () =>
        this.send(MESSAGES.SERVER_SELECTION, new Writer().varUInt(serverId).finish()))
      this.assertCurrent(generation)
      if (response.messageId === MESSAGES.SELECTED_SERVER_REFUSED) throw parseServerSelectionRefused(response.payload)
      const selected = parseSelectedServer(response.payload)
      const ticket = await decryptTicket(selected.encryptedTicket, this.aesKey)
      this.assertCurrent(generation)
      // Drop leftover Auth frames before World speaks; do it *before* connect so a
      // HELLO_GAME that races with `{type:connected}` is not wiped by reset.
      this.codec.reset()
      this.replies.discard()
      await this.connectTarget({ type: 'connect-world', host: selected.host, port: selected.ports[0] })
      this.assertCurrent(generation)
      await this.readUntil([MESSAGES.HELLO_GAME])
      this.assertCurrent(generation)
      const accepted = await this.requestFrame([MESSAGES.AUTHENTICATION_TICKET_ACCEPTED, MESSAGES.AUTHENTICATION_TICKET_REFUSED], () =>
        this.send(MESSAGES.AUTHENTICATION_TICKET, new Writer().utf('fr').utf(ticket).finish()))
      this.assertCurrent(generation)
      if (accepted.messageId === MESSAGES.AUTHENTICATION_TICKET_REFUSED) throw new Error('Ticket World refusé par Giny.')
      this.selectedInternal = selected
      return selected
    } finally {
      if (generation === this.generation) {
        this.switchingTarget = false
        this.expectedAuthDisconnect = false
      }
    }
  }

  async listCharacters(): Promise<{ characters: Character[]; catalog: CreationCatalog }> {
    const generation = this.generation
    const response = await this.requestFrame([MESSAGES.CHARACTERS_LIST], () =>
      this.send(MESSAGES.CHARACTERS_LIST_REQUEST, new Uint8Array()))
    this.assertCurrent(generation)
    if (!this.catalog) {
      const catalog = await loadCreationCatalog()
      this.assertCurrent(generation)
      this.catalog = catalog
    }
    return { characters: parseCharacters(response.payload, this.catalog), catalog: this.catalog }
  }

  async createCharacter(request: CreationRequest): Promise<Character> {
    const generation = this.generation
    const nameError = characterNameError(request.name)
    if (nameError) throw new Error(nameError)
    if (request.breedId <= 0 || request.cosmeticId <= 0 || request.colors.length !== 5) {
      throw new Error('Création incomplète : classe, tête et cinq couleurs sont requises.')
    }
    const writer = new Writer().utf(request.name.trim()).u8(request.breedId).u8(request.sex ? 1 : 0)
    request.colors.forEach((color) => writer.i32(color))
    writer.varUInt(request.cosmeticId)
    const response = await this.requestFrame([MESSAGES.CHARACTER_CREATION_RESULT], () =>
      this.send(MESSAGES.CHARACTER_CREATION_REQUEST, writer.finish()))
    this.assertCurrent(generation)
    const result = response.payload[0] ?? -1
    if (result !== 0) throw new Error(creationError(result, response.payload[1] ?? 0))
    const selected = await this.readUntil([MESSAGES.CHARACTER_SELECTED_SUCCESS, MESSAGES.CHARACTER_SELECTED_ERROR])
    this.assertCurrent(generation)
    if (selected.messageId === MESSAGES.CHARACTER_SELECTED_ERROR) throw new Error('Le personnage a été créé mais sa sélection a échoué.')
    this.selectedCharacter = parseSelectedCharacter(selected.payload, this.catalog)
    await this.readUntil([MESSAGES.CHARACTER_LOADING_COMPLETE])
    this.assertCurrent(generation)
    this.characterLoaded = true
    return this.selectedCharacter
  }

  async enterWorld(characterId: number): Promise<WorldSession> {
    if (!this.account || !this.selectedInternal) throw new Error('Session Giny incomplète.')
    const generation = this.generation
    if (this.selectedCharacter?.id !== characterId) {
      const selected = await this.requestFrame([MESSAGES.CHARACTER_SELECTED_SUCCESS, MESSAGES.CHARACTER_SELECTED_ERROR], () =>
        this.send(MESSAGES.CHARACTER_SELECTION, new Writer().varUInt(characterId).finish()))
      this.assertCurrent(generation)
      if (selected.messageId === MESSAGES.CHARACTER_SELECTED_ERROR) throw new Error('Sélection du personnage refusée par Giny.')
      this.selectedCharacter = parseSelectedCharacter(selected.payload, this.catalog)
      this.characterLoaded = false
    }
    if (!this.characterLoaded) {
      await this.readUntil([MESSAGES.CHARACTER_LOADING_COMPLETE])
      this.assertCurrent(generation)
      this.characterLoaded = true
    }
    // Enable the modern event projection before a possible combat reconnection.
    await this.requestCharacterHud()
    this.assertCurrent(generation)
    let current = await this.requestFrame([MESSAGES.CURRENT_MAP, MESSAGES.MODERN_FIGHT_SNAPSHOT], () =>
      this.send(MESSAGES.GAME_CONTEXT_CREATE_REQUEST, new Uint8Array()))
    this.assertCurrent(generation)
    while (current.messageId === MESSAGES.MODERN_FIGHT_SNAPSHOT) {
      const fight = this.combatState.snapshot
      if (fight) {
        this.currentMapId = fight.map_id
        const local = fight.fighters.find(f => f.id === this.selectedCharacter!.id)
        return { mapId: fight.map_id, subareaId: this.lastHud?.map.subarea_id ?? 0, account: this.account,
          server: this.selectedInternal, character: this.selectedCharacter!, cellId: local?.cell ?? 0,
          direction: local?.direction ?? 1, actors: [], interactives: [], hud: this.lastHud }
      }
      current = await this.readUntil([MESSAGES.CURRENT_MAP, MESSAGES.MODERN_FIGHT_SNAPSHOT])
      this.assertCurrent(generation)
    }
    this.currentMapId = Math.trunc(new Reader(current.payload).f64())
    return this.loadWorldSession()
  }

  async changeMap(mapId: number): Promise<WorldSession> {
    if (!this.account || !this.selectedInternal || !this.selectedCharacter) {
      throw new Error('Session Giny incomplète.')
    }
    if (!Number.isSafeInteger(mapId) || mapId <= 0 || mapId === this.currentMapId) {
      throw new Error('Transition de carte invalide.')
    }
    if (this.mapChangePending) throw new Error('Un changement de carte est déjà en cours.')
    const generation = this.generation
    this.mapChangePending = true
    try {
      const current = await this.requestFrame([MESSAGES.CURRENT_MAP], () =>
        this.send(MESSAGES.CHANGE_MAP, new Writer().f64(mapId).u8(0).finish(), `map=${this.currentMapId} → ${mapId}`), 10000)
      this.assertCurrent(generation)
      this.currentMapId = Math.trunc(new Reader(current.payload).f64())
      const session = await this.loadWorldSession()
      this.assertCurrent(generation)
      return session
    } finally {
      if (generation === this.generation) this.mapChangePending = false
    }
  }

  private async loadWorldSession(): Promise<WorldSession> {
    if (!this.account || !this.selectedInternal || !this.selectedCharacter || !this.currentMapId) {
      throw new Error('Session Giny incomplète.')
    }
    const generation = this.generation, mapId = this.currentMapId
    const account = this.account, server = this.selectedInternal, character = this.selectedCharacter
    const check = () => {
      this.assertCurrent(generation)
      if (this.currentMapId !== mapId) throw new Error('La carte a changé pendant son chargement.')
    }
    const complementary = await this.requestFrame([MESSAGES.MAP_COMPLEMENTARY_INFORMATION], () =>
      this.send(MESSAGES.MAP_INFORMATION_REQUEST, new Writer().f64(mapId).finish()))
    check()
    const header = new Reader(complementary.payload)
    const subareaId = header.varUInt()
    if (header.f64() !== mapId) throw new Error('La carte a changé pendant son chargement.')
    const { actors, interactives } = await this.snapshot(mapId)
    check()
    // Giny emits this idle sentinel while the map finishes loading. It must
    // never satisfy the next, unrelated movement request.
    this.replies.discard(MESSAGES.GAME_MAP_NO_MOVEMENT)
    const local = actors.find((actor) => actor.id === character.id)
    const hud = await this.requestCharacterHud()
    check()
    return {
      mapId,
      subareaId,
      account,
      server,
      character,
      cellId: local?.cell_id ?? 0,
      direction: local?.direction ?? 1,
      actors,
      interactives,
      hud,
    }
  }

  async requestCharacterHud(): Promise<CharacterHud | null> {
    if (this.hudRequest) return this.hudRequest
    const generation = this.generation
    const request = (async () => {
      try {
        const frame = await this.requestFrame([MESSAGES.MODERN_CHARACTER_SNAPSHOT], () =>
          this.send(MESSAGES.MODERN_CHARACTER_SNAPSHOT_REQUEST, new Uint8Array()), 2500)
        this.assertCurrent(generation)
        const parsed = parseCharacterHud(frame.payload)
        return parsed ? this.decorateCharacterHud(parsed) : this.lastHud
      } catch {
        return generation === this.generation ? this.lastHud : null
      }
    })()
    this.hudRequest = request
    void request.then(() => {
      if (this.hudRequest === request) this.hudRequest = null
    })
    return request
  }

  async snapshot(expectedMapId = this.currentMapId): Promise<MapSnapshot> {
    const generation = this.generation
    if (this.mapSnapshotRequest && this.mapSnapshotRequest.mapId !== expectedMapId) {
      // Replies have no request ID. Finish the old map's request before sending
      // another one, so its reply cannot satisfy the new map's waiter.
      await this.mapSnapshotRequest.promise.catch(() => undefined)
      this.assertCurrent(generation)
      if (this.currentMapId !== expectedMapId) throw new Error('La carte a changé pendant son chargement.')
      return this.snapshot(expectedMapId)
    }
    if (!this.mapSnapshotRequest) {
      const promise = this.requestFrame([MESSAGES.MODERN_MAP_SNAPSHOT], () =>
        this.send(MESSAGES.MODERN_MAP_SNAPSHOT_REQUEST, new Uint8Array())).then(frame => {
        const parsed = JSON.parse(readModernJson(frame.payload)) as {
          map_id?: number; actors?: WorldActor[]; interactives?: WorldInteractive[]; error?: string
        }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.map_id != null && parsed.map_id !== expectedMapId) throw new Error('La carte a changé pendant son chargement.')
        return { actors: parsed.actors ?? [], interactives: parsed.interactives ?? [] }
      })
      this.mapSnapshotRequest = { mapId: expectedMapId, promise }
    }
    const request = this.mapSnapshotRequest
    try {
      const snapshot = await request.promise
      this.assertCurrent(generation)
      if (this.currentMapId !== expectedMapId) throw new Error('La carte a changé pendant son chargement.')
      return snapshot
    } finally {
      if (this.mapSnapshotRequest === request) this.mapSnapshotRequest = null
    }
  }

  /** Ask the emulator to run an interactive element's skill (door, zaap, resource).

      The server answers with `InteractiveUsed` then either `InteractiveUseEnded`
      (harvest finished) or an unsolicited `CurrentMap` (the action teleported
      us); a refusal comes back as `InteractiveUseError`. All of them reach the
      renderer through `onInteractive` / `onMapChanged`, so this call is fire and
      forget. */
  useInteractive(elementId: number, skillInstanceUid = 0): void {
    if (!Number.isSafeInteger(elementId) || elementId < 0) {
      throw new Error('Élément interactif invalide.')
    }
    this.send(
      MESSAGES.INTERACTIVE_USE_REQUEST,
      new Writer().varUInt(elementId).varUInt(skillInstanceUid).finish(),
    )
  }

  async requestMovement(path: number[], mapId: number): Promise<number[]> {
    if (mapId !== this.currentMapId || path.length < 2) throw new Error('Chemin de mouvement invalide.')
    const generation = this.generation
    const keys = encodeMovement(path)
    const writer = new Writer().u16(keys.length)
    keys.forEach((key) => writer.u16(key))
    writer.f64(mapId)
    let response = await this.requestFrame([MESSAGES.GAME_MAP_MOVEMENT, MESSAGES.GAME_MAP_NO_MOVEMENT], () =>
      this.send(MESSAGES.GAME_MAP_MOVEMENT_REQUEST, writer.finish(),
        `map=${mapId} [${path[0]} → ${path[path.length - 1]}] (${path.length} cellules)`))
    while (true) {
      this.assertCurrent(generation)
      if (mapId !== this.currentMapId) throw new Error('La carte a changé pendant le déplacement.')
      if (response.messageId === MESSAGES.GAME_MAP_NO_MOVEMENT) {
        if (response.payload.length >= 4) {
          const reader = new Reader(response.payload)
          const cellX = reader.i16()
          const cellY = reader.i16()
          const serverCell = coordToCellId(cellX, cellY)
          logEvent('error', 'MOVEMENT_REFUSED', JSON.stringify({
            mapId, currentMapId: this.currentMapId, characterId: this.selectedCharacter?.id,
            serverCell, serverCoordinates: { x: cellX, y: cellY },
            clientCell: path[0], destinationCell: path[path.length - 1], path, encodedPath: keys,
          }, null, 2))
          throw new MovementRefusedError(
            `Mouvement refusé par Giny (position serveur attendue : cellule ${serverCell} [x=${cellX}, y=${cellY}], client envoyé : cellule ${path[0]}).`,
            serverCell,
            cellX,
            cellY,
            path[0],
          )
        }
        logEvent('error', 'MOVEMENT_REFUSED', JSON.stringify({ mapId, currentMapId: this.currentMapId,
          path, encodedPath: keys, serverPositionUnavailable: true, payloadLength: response.payload.length }, null, 2))
        throw new MovementRefusedError('Mouvement refusé par Giny.', -1, 0, 0, path[0])
      }
      const movement = parseMovement(response.payload)
      if (movement.actorId === this.selectedCharacter?.id) return movement.path
      this.emitMovement(movement)
      response = await this.readUntil([MESSAGES.GAME_MAP_MOVEMENT, MESSAGES.GAME_MAP_NO_MOVEMENT])
    }
  }

  cancelMovement(mapId: number, cellId: number): void {
    if (mapId === this.currentMapId) this.send(MESSAGES.GAME_MAP_MOVEMENT_CANCEL, new Writer().varUInt(cellId).finish())
  }

  confirmMovement(mapId: number): void {
    if (mapId === this.currentMapId) this.send(MESSAGES.GAME_MAP_MOVEMENT_CONFIRM, new Uint8Array())
  }

  /** `ChatClientMultiMessage`: UTF content then the activable channel byte. */
  sendChat(content: string, channel: number = CHAT_CHANNEL.GLOBAL): void {
    const text = content.trim()
    if (!text) return
    const privatePayload = privateChatPayload(text)
    if (privatePayload) { this.send(MESSAGES.CHAT_CLIENT_PRIVATE, privatePayload); return }
    this.send(MESSAGES.CHAT_CLIENT_MULTI, new Writer().utf(text).u8(channel).finish(), text)
  }

  onChat(listener: (line: ChatLine) => void, replayHistory = true): () => void {
    return this.chat.subscribe(listener, replayHistory)
  }

  onActorsChanged(listener: () => void): () => void {
    this.actorChangeListeners.add(listener)
    return () => { this.actorChangeListeners.delete(listener) }
  }

  onMovement(listener: (movement: Movement) => void): () => void {
    this.movementListeners.add(listener)
    return () => this.movementListeners.delete(listener)
  }

  onHud(listener: (hud: CharacterHud) => void): () => void {
    this.hudListeners.add(listener)
    return () => this.hudListeners.delete(listener)
  }

  onInteractive(listener: (event: InteractiveEvent) => void): () => void {
    this.interactiveListeners.add(listener)
    return () => this.interactiveListeners.delete(listener)
  }

  /** A map change the client did not ask for: an interactive teleport, a zaap,
      a death, an admin command. The emulator just pushes `CurrentMap`. */
  onMapChanged(listener: (session: WorldSession) => void): () => void {
    this.mapListeners.add(listener)
    return () => this.mapListeners.delete(listener)
  }

  /** Keep the web projection aligned with emulator state even when an old
      gameplay path does not emit a modern snapshot yet. Server pushes remain
      immediate; this low-frequency reconciliation is the safety net. */
  startHudSynchronization(intervalMs = 10000): () => void {
    let active = true
    const refresh = () => {
      if (active && this.characterLoaded && document.visibilityState !== 'hidden') {
        void this.requestCharacterHud()
      }
    }
    const timer = window.setInterval(refresh, Math.max(500, intervalMs))
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    refresh()
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }

  onDisconnect(handler: (reason: string) => void): () => void {
    this.disconnectListeners.add(handler)
    return () => this.disconnectListeners.delete(handler)
  }

  private emitDisconnect(reason: string): void {
    if (this.manualClose) return
    this.close()
    logEvent('network', 'disconnected', reason)
    this.disconnectListeners.forEach((listener) => {
      try { listener(reason) } catch { /* ignore */ }
    })
  }

  close(): void {
    this.generation++
    this.hudNotifications.reset()
    this.pendingSpellCasts.clear()
    this.combatQueue.reset()
    this.combatState = emptyCombat()
    this.presentedCombatState = emptyCombat()
    this.presentedRevision = 0
    this.projectedIds.clear()
    this.notifyCombat()
    this.clearNpc()
    this.npcRevision = 0
    this.questStates.clear()
    this.actions.close()
    this.manualClose = true
    this.transport?.close()
    this.transport = null
    this.switchingTarget = false
    this.target = null
    this.expectedAuthDisconnect = false
    this.replies.discard()
    this.knownServers = null
    this.serverPreviews.clear()
    this.replies.fail(new Error('Connexion Giny fermée.'))
    this.controlWaiters.splice(0).forEach((waiter) => {
      clearTimeout(waiter.timeout)
      waiter.reject(new Error('Connexion Giny fermée.'))
    })
    this.codec.reset()
    this.sequence = 0
    this.selectedInternal = null
    this.account = null
    this.selectedCharacter = null
    this.characterLoaded = false
    this.currentMapId = 0
    this.lastHud = null
    this.hudRequest = null
    this.serverMapChange = null
    this.mapSnapshotRequest = null
    this.mapChangePending = false
    this.chat.reset()
    this.manualClose = false
  }

  private async openBridge(): Promise<void> {
    const generation = this.generation
    const transport = await openGinyTransport()
    if (generation !== this.generation) {
      transport.close()
      throw new Error('Connexion Giny fermée.')
    }
    this.transport = transport
    transport.onMessage((data) => {
      if (this.transport === transport) this.onTransportMessage(data)
    })
    transport.onClose((error) => {
      if (this.transport === transport) {
        this.failAll(error)
        if (!this.manualClose) {
          this.emitDisconnect('Passerelle Giny déconnectée.')
        }
      }
    })
  }

  private connectTarget(control: object): Promise<void> {
    if (!this.transport) return Promise.reject(new Error('Passerelle Giny fermée.'))
    const generation = this.generation
    this.target = (control as { type: string }).type === 'connect-auth' ? 'auth' : 'world'
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          const index = this.controlWaiters.indexOf(waiter)
          if (index >= 0) this.controlWaiters.splice(index, 1)
          reject(new Error('Le serveur Giny ne répond pas. Vérifie que Auth et World sont lancés.'))
        }, 5000) as unknown as number,
      }
      this.controlWaiters.push(waiter)
      try { this.transport!.send(JSON.stringify(control)) } catch (error) {
        const index = this.controlWaiters.indexOf(waiter)
        if (index >= 0) this.controlWaiters.splice(index, 1)
        clearTimeout(waiter.timeout)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }).then(() => this.assertCurrent(generation))
  }

  private onTransportMessage(data: string | Uint8Array): void {
    if (typeof data === 'string') {
      let control: { type: string; message?: string }
      try { control = JSON.parse(data) } catch {
        logEvent('error', 'gateway-control', 'Commande de passerelle invalide reçue.')
        return
      }
      if (!control || typeof control.type !== 'string') return
      if (control.type === 'connected' || control.type === 'error') {
        const waiter = this.controlWaiters.shift()
        if (control.type === 'connected' && waiter) { clearTimeout(waiter.timeout); waiter.resolve() }
        if (control.type === 'error' && waiter) { clearTimeout(waiter.timeout); waiter.reject(new Error(control.message ?? 'Erreur Giny.')) }
        else if (control.type === 'error') {
          const reason = typeof control.message === 'string' ? control.message : 'Erreur Giny.'
          this.failAll(new Error(reason))
          this.emitDisconnect(reason)
        }
      } else if (control.type === 'disconnected') {
        // A target close during server switch (Auth -> World) is expected.
        // If not switching targets and not manually closed, the connection was lost.
        const expected = this.switchingTarget && this.target === 'auth' && this.expectedAuthDisconnect
        this.expectedAuthDisconnect = false
        if (!expected && !this.manualClose) {
          this.failAll(new Error('Le serveur Giny s’est déconnecté.'))
          this.emitDisconnect('La connexion avec le serveur a été perdue.')
        }
      }
      return
    }
    for (const frame of this.codec.push(data)) this.dispatchFrame(frame)
  }

  private dispatchFrame(frame: GinyFrame): void {
    if (frame.messageId === MESSAGES.SELECTED_SERVER_DATA && this.switchingTarget && this.target === 'auth') this.expectedAuthDisconnect = true
    if (frame.messageId === MESSAGES.CURRENT_MAP) this.clearNpc()
    if (this.characterLoaded && ACTOR_NOTIFICATIONS.has(frame.messageId))
      this.actorChangeListeners.forEach(listener => listener())
    if (this.characterLoaded && HUD_NOTIFICATIONS.has(frame.messageId)) this.hudNotifications.request()
    if (frame.messageId === MESSAGES.MODERN_SERVER_CHARACTERS) {
      try {
        this.serverPreviews = parseServerCharacters(readModernJson(frame.payload))
        if (this.knownServers) this.publishServers(this.knownServers)
      } catch { logEvent('network', 'server-portraits', 'Aperçus de personnages invalides reçus.') }
      return
    }
    if (frame.messageId === MESSAGES.SERVERS_LIST || frame.messageId === MESSAGES.SERVER_STATUS_UPDATE) {
      if (frame.messageId === MESSAGES.SERVERS_LIST) this.publishServers(parseServers(frame.payload))
      else {
        const updated = readServer(new Reader(frame.payload))
        const listed = this.knownServers ?? []
        this.publishServers(listed.some(server => server.id === updated.id)
          ? listed.map(server => server.id === updated.id ? updated : server) : [...listed, updated])
      }
      this.replies.take(frame.messageId)?.(frame)
      return // Push updates must not accumulate as stale responses in the queue.
    }
    if (frame.messageId === MESSAGES.MODERN_FIGHT_SNAPSHOT) {
      try {
        const event = parseCombatEvent(readModernJson(frame.payload))
        if (event) this.receiveCombat(event)
      } catch (error) { logEvent('error', 'combat-protocol', String(error)) }
      this.replies.take(frame.messageId)?.(frame)
      return
    }
    if (this.projectedIds.has(frame.messageId) && ![MESSAGES.CURRENT_MAP, MESSAGES.GAME_MAP_MOVEMENT].includes(frame.messageId as never)) return
    // The recipient-specific modern stream owns combat movement presentation.
    if (frame.messageId === MESSAGES.GAME_MAP_MOVEMENT && this.combatState.snapshot) return

    if (frame.messageId === MESSAGES.MODERN_MODULE_STATE) {
      try {
        const json = readModernJson(frame.payload)
        const npc = parseNpcModuleState(json)
        if (npc) {
          if (npc.characterId === String(this.selectedCharacter?.id) && npc.revision > this.npcRevision) {
            this.npcRevision = npc.revision
            this.npcState = npc.state?.mapId === this.currentMapId && !this.combatState.snapshot ? npc.state : null
            this.npcListeners.forEach(listener => listener())
          }
          return
        }
        const data = parseQuestModuleState(json)
        if (data) {
          if (this.questStates.size >= 4) this.questStates.clear()
          this.questStates.set(data.characterId, data.state)
          this.questListeners.forEach(listener => listener())
        }
      } catch { /* malformed state does not replace the last valid snapshot */ }
      return
    }
    if (frame.messageId === MESSAGES.MODERN_ACTION_RESULT) {
      try { this.actions.receive(new Reader(frame.payload).utf()) } catch { /* malformed result */ }
      return
    }
    let detail = `${frame.payload.length} octets`
    const chat = this.chat.parse(frame)
    if (frame.messageId === MESSAGES.GAME_MAP_NO_MOVEMENT && frame.payload.length >= 4) {
      const r = new Reader(frame.payload)
      const cx = r.i16()
      const cy = r.i16()
      detail = `pos serveur cellule ${coordToCellId(cx, cy)} (x=${cx}, y=${cy})`
    } else if (frame.messageId === MESSAGES.CURRENT_MAP && frame.payload.length >= 8) {
      detail = `map ${Math.trunc(new Reader(frame.payload).f64())}`
    } else if (frame.messageId === MESSAGES.GAME_MAP_MOVEMENT && frame.payload.length > 0) {
      try {
        const m = parseMovement(frame.payload)
        detail = `acteur ${m.actorId} [${m.path[0]} → ${m.path[m.path.length - 1]}] (${m.path.length} cellules)`
      } catch { /* keep octets */ }
    } else if (chat) {
      detail = chat.sender ? `${chat.sender}: ${chat.content}` : chat.content
    }
    logEvent('network', `← ${messageName(frame.messageId)}`, detail)
    const deliver = this.replies.take(frame.messageId)
    if (deliver) {
      if (frame.messageId === MESSAGES.MODERN_CHARACTER_SNAPSHOT) {
        const hud = this.decorateCharacterHud(parseCharacterHud(frame.payload))
        if (hud) this.emitHud(hud)
      }
      deliver(frame)
      return
    }
    if (frame.messageId === MESSAGES.GAME_MAP_MOVEMENT) {
      this.emitMovement(parseMovement(frame.payload))
      return
    }
    if (frame.messageId === MESSAGES.MODERN_CHARACTER_SNAPSHOT) {
      const hud = this.decorateCharacterHud(parseCharacterHud(frame.payload))
      if (hud) this.emitHud(hud)
      return
    }
    if (chat) {
      // Legacy Giny reports rejected exits as chat instead of CURRENT_MAP.
      // BASIC_NO_OPERATION also acknowledges movement, so it cannot signal refusal.
      if (this.mapChangePending && frame.messageId === MESSAGES.TEXT_INFORMATION) {
        const reason = chat.content.replace(/<[^>]*>/g, '').trim()
        if (['Unknown map transition.', 'Unknown map.', "Aucune cellule d'arrivée praticable sur cette carte."].includes(reason)) {
          this.replies.fail(new Error(`Changement de carte refusé : ${reason}`), MESSAGES.CURRENT_MAP)
        }
      }
      this.chat.emit(chat)
      return
    }
    // Hidden module text is consumed too; it must not accumulate in frame waiters.
    if (frame.messageId === MESSAGES.TEXT_INFORMATION || frame.messageId === MESSAGES.CHAT_SERVER) return
    const interactive = this.parseInteractiveFrame(frame)
    if (interactive) {
      this.interactiveListeners.forEach((listener) => listener(interactive))
      return
    }
    // Nobody is awaiting a map: the emulator teleported us on its own (zaap,
    // door, death). Reload the world here or the client stays on the old map
    // while the server has already moved the character.
    if (frame.messageId === MESSAGES.CURRENT_MAP && this.characterLoaded) {
      this.handleServerMapChange(frame)
      return
    }
    // Only protocol replies needed by later handshake steps are buffered.
    // Inventory, actor and other gameplay notifications must not grow this
    // queue for the whole session; their stores refresh from modern snapshots.
    if (BUFFERED_REPLIES.has(frame.messageId)) this.replies.queue(frame)
  }

  private parseInteractiveFrame(frame: GinyFrame): InteractiveEvent | null {
    try {
      if (frame.messageId === MESSAGES.INTERACTIVE_USED) return parseInteractiveUsed(frame.payload)
      if (frame.messageId === MESSAGES.INTERACTIVE_USE_ENDED) return parseInteractiveUseEnded(frame.payload)
      if (frame.messageId === MESSAGES.INTERACTIVE_USE_ERROR) return parseInteractiveUseError(frame.payload)
      if (frame.messageId === MESSAGES.INTERACTIVE_ELEMENT_UPDATED) return parseInteractiveElementUpdated(frame.payload)
      if (frame.messageId === MESSAGES.STATED_ELEMENT_UPDATED) return parseStatedElementUpdated(frame.payload)
    } catch (error) {
      // A malformed interactive frame must not break the world session.
      logEvent('error', 'interactive-frame', error instanceof Error ? error.message : String(error))
      return null
    }
    return null
  }

  private handleServerMapChange(frame: GinyFrame): void {
    const mapId = Math.trunc(new Reader(frame.payload).f64())
    if (!Number.isSafeInteger(mapId) || mapId <= 0) return
    this.currentMapId = mapId
    const generation = this.generation
    const previous = this.serverMapChange ?? Promise.resolve()
    const chained = previous
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this.generation || mapId !== this.currentMapId) return
        const session = await this.loadWorldSession()
        if (generation !== this.generation || mapId !== this.currentMapId) return
        this.mapListeners.forEach((listener) => listener(session))
      })
      .catch((error: unknown) => {
        logEvent('error', 'server-map-change', error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (this.serverMapChange === chained) this.serverMapChange = null
      })
    this.serverMapChange = chained
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation) throw new Error('Connexion Giny fermée.')
  }

  private async readUntil(ids: number[], timeoutMs = 5000): Promise<GinyFrame> {
    const generation = this.generation
    const frame = await this.replies.read(ids, timeoutMs)
    this.assertCurrent(generation)
    return frame
  }

  private async requestFrame(ids: number[], send: () => void, timeoutMs = 5000): Promise<GinyFrame> {
    const generation = this.generation
    const frame = await this.replies.request(ids, timeoutMs, send)
    this.assertCurrent(generation)
    return frame
  }

  private send(messageId: number, payload: Uint8Array, detail?: string): void {
    if (!this.transport || !this.transport.isOpen()) throw new Error('Connexion Giny fermée.')
    this.sequence += 1
    logEvent('network', `→ ${messageName(messageId)}`, detail ?? `${payload.length} octets`)
    this.transport.send(packClientFrame(messageId, this.sequence, payload))
  }

  private emitMovement(movement: Movement): void { this.movementListeners.forEach((listener) => listener(movement)) }
  private decorateCharacterHud(hud: CharacterHud | null): CharacterHud | null {
    if (!hud || !this.catalog) return hud
    const icons = new Map(this.catalog.classes.flatMap((breed) => breed.spells.map((spell) => [spell.id, spell.icon_id] as const)))
    return {
      ...hud,
      shortcuts: hud.shortcuts.map((shortcut) => ({ ...shortcut, icon_id: icons.get(shortcut.spell_id) })),
      spells: hud.spells.map((spell) => ({ ...spell, icon_id: icons.get(spell.id) })),
    }
  }
  private emitHud(hud: CharacterHud): void {
    this.lastHud = hud
    this.hudListeners.forEach((listener) => listener(hud))
  }
  private failAll(error: Error): void {
    this.actions.close(error)
    this.replies.fail(error)
    this.controlWaiters.splice(0).forEach((waiter) => { clearTimeout(waiter.timeout); waiter.reject(error) })
  }

  performAction(command: GameAction): Promise<void> {
    const character = this.selectedCharacter
    if (!character || !this.characterLoaded || !this.lastHud?.capabilities?.includes(command.action))
      return Promise.reject(new Error('Cette action nécessite les données du serveur Giny à jour.'))
    return this.actions.request(String(character.id), command,
      json => this.send(MESSAGES.MODERN_ACTION_REQUEST, new Writer().utf(json).finish()),
      () => {
        void this.requestCharacterHud()
        if (command.action.startsWith('npc.') && command.action !== 'npc.sync') void this.performAction({ action: 'npc.sync', args: {} }).catch(() => {})
      })
  }
}

const HUD_NOTIFICATIONS = new Set<number>([
      MESSAGES.CHARACTER_STATS_LIST, MESSAGES.INVENTORY_CONTENT, MESSAGES.INVENTORY_WEIGHT,
      MESSAGES.OBJECT_MOVEMENT, MESSAGES.OBJECT_MODIFIED, MESSAGES.OBJECT_ADDED,
      MESSAGES.OBJECT_QUANTITY, MESSAGES.OBJECT_DELETED, MESSAGES.KAMAS_UPDATE,
      MESSAGES.SPELL_LIST, MESSAGES.SHORTCUT_BAR_CONTENT, MESSAGES.JOB_EXPERIENCE_MULTI_UPDATE,
      MESSAGES.ACHIEVEMENT_LIST,
    ])

const ACTOR_NOTIFICATIONS = new Set<number>([
  MESSAGES.ROLEPLAY_SHOW_ACTOR, MESSAGES.ROLEPLAY_SHOW_ACTORS,
  MESSAGES.CONTEXT_REMOVE_ACTOR, MESSAGES.CONTEXT_REMOVE_ACTORS,
])

const BUFFERED_REPLIES = new Set<number>([
  MESSAGES.HELLO_CONNECT, MESSAGES.IDENTIFICATION_SUCCESS, MESSAGES.IDENTIFICATION_FAILED,
  MESSAGES.SELECTED_SERVER_DATA, MESSAGES.SELECTED_SERVER_REFUSED, MESSAGES.HELLO_GAME,
  MESSAGES.AUTHENTICATION_TICKET_ACCEPTED, MESSAGES.AUTHENTICATION_TICKET_REFUSED,
  MESSAGES.CHARACTERS_LIST, MESSAGES.CHARACTER_CREATION_RESULT,
  MESSAGES.CHARACTER_SELECTED_SUCCESS, MESSAGES.CHARACTER_SELECTED_ERROR,
  MESSAGES.CHARACTER_LOADING_COMPLETE, MESSAGES.CURRENT_MAP,
  MESSAGES.MAP_COMPLEMENTARY_INFORMATION, MESSAGES.MODERN_MAP_SNAPSHOT,
  MESSAGES.GAME_MAP_NO_MOVEMENT,
])

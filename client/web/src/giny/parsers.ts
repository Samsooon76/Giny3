import { readModernJson } from './modernJson'
import { Reader } from './binary'
import type {
  Account, Character, CharacterHud, ChatLine, CreationCatalog, GameServer, Movement, SelectedServer,
} from './types'
import { CHAT_CHANNEL } from './types'

export type InternalSelectedServer = SelectedServer & { encryptedTicket: Uint8Array }

export function parseIdentification(payload: Uint8Array): Account {
  const reader = new Reader(payload); reader.u8()
  return { username: reader.utf(), nickname: reader.utf(), tag: reader.utf(), id: reader.i32() }
}

export function readServer(reader: Reader): GameServer {
  const flags = reader.u8(), id = reader.varUInt(), type = reader.u8(), status = reader.u8()
  const population = reader.u8(), charactersCount = reader.u8(), characterSlots = reader.u8(); reader.f64()
  // Auth's selectable flag is true even while World has no IPC connection.
  return { id, name: `Giny ${id}`, type, status: serverStatus(status), population: String(population), charactersCount, characterSlots, selectable: Boolean(flags & 2) && status === 3, monoAccount: Boolean(flags & 1) }
}

export function parseServers(payload: Uint8Array): GameServer[] {
  const reader = new Reader(payload)
  return Array.from({ length: reader.u16() }, () => readServer(reader))
}

export function serverUnavailableMessage(server: Pick<GameServer, 'status' | 'selectable'> | undefined): string {
  if (!server) return 'Sélectionne un serveur disponible.'
  const messages: Record<string, string> = {
    Offline: 'World est hors ligne ou termine son démarrage. La disponibilité se mettra à jour automatiquement.',
    Starting: 'World démarre. La disponibilité se mettra à jour automatiquement.',
    NoJoin: 'Ce serveur n’accepte pas de connexion pour le moment.',
    Saving: 'World effectue une sauvegarde. Patiente quelques instants.',
    Stopping: 'World est en cours d’arrêt.', Full: 'Le serveur est complet.',
  }
  return server.selectable ? '' : messages[server.status] ?? 'Ce serveur est indisponible pour le moment.'
}

export class ServerSelectionRefusedError extends Error {
  readonly serverId: number
  readonly reason: number
  readonly status: string
  constructor(serverId: number, reason: number, status: string) {
    const reasons: Record<number, string> = {
      1: 'Giny a refusé la connexion sans préciser de raison.',
      3: 'Ce serveur est réservé aux abonnés.', 4: 'Ce serveur est réservé aux joueurs réguliers.',
      5: 'Giny ne peut pas vérifier la restriction monocompte.',
      6: 'Un compte utilise déjà cette adresse IP sur ce serveur monocompte.',
      7: 'Le serveur est surchargé. Réessaie dans quelques instants.',
    }
    super(reason === 0 ? serverUnavailableMessage({ status, selectable: false }) : reasons[reason] ?? `Sélection refusée par Giny (code ${reason}, état ${status}).`)
    this.name = 'ServerSelectionRefusedError'
    this.serverId = serverId; this.reason = reason; this.status = status
  }
}

export function parseServerSelectionRefused(payload: Uint8Array): ServerSelectionRefusedError {
  const reader = new Reader(payload)
  return new ServerSelectionRefusedError(reader.varUInt(), reader.u8(), serverStatus(reader.u8()))
}

export function parseSelectedServer(payload: Uint8Array): InternalSelectedServer {
  const reader = new Reader(payload), id = reader.varUInt(), host = reader.utf()
  const ports = Array.from({ length: reader.u16() }, () => reader.varUInt())
  const canCreateCharacter = Boolean(reader.u8()), encryptedTicket = reader.raw(reader.varUInt())
  return { id, name: `Giny ${id}`, host, ports, canCreateCharacter, encryptedTicket, status: 'Selected', population: '', selectable: true, monoAccount: false, type: 0, charactersCount: 0, characterSlots: 0 }
}

export function parseCharacters(payload: Uint8Array, catalog: CreationCatalog | null): Character[] {
  const reader = new Reader(payload)
  return Array.from({ length: reader.u16() }, () => {
    const typeId = reader.u16(), character = readCharacter(reader, catalog)
    if (typeId === 3983) { reader.u8(); reader.varUInt(); reader.varUInt() }
    return character
  })
}

export function parseSelectedCharacter(payload: Uint8Array, catalog: CreationCatalog | null): Character {
  return readCharacter(new Reader(payload), catalog)
}

function readCharacter(reader: Reader, catalog: CreationCatalog | null): Character {
  const id = reader.varUInt(), name = reader.utf(), level = reader.varUInt(), look = readEntityLook(reader)
  const breedId = reader.u8(), sex = Boolean(reader.u8()), prestige = reader.varUInt()
  const breedName = catalog?.classes.find((item) => item.breed_id === breedId)?.label ?? `Classe ${breedId}`
  return { id, name, level, look, breedId, breedName, sex, prestige }
}

function readEntityLook(reader: Reader): string {
  const bone = reader.varUInt()
  const skins = Array.from({ length: reader.u16() }, () => String(reader.varUInt()))
  const colors = Array.from({ length: reader.u16() }, () => {
    const encoded = reader.i32() >>> 0
    return `${encoded >>> 24}=#${(encoded & 0xffffff).toString(16).padStart(6, '0')}`
  })
  const scales = Array.from({ length: reader.u16() }, () => String(reader.varUInt()))
  const subentities = Array.from({ length: reader.u16() }, () => `${reader.u8()}@${reader.u8()}=${readEntityLook(reader)}`)
  return `{${bone}|${skins.join(',')}|${colors.join(',')}|${scales.join(',')}|${subentities.join(',')}}`
}

export function parseMovement(payload: Uint8Array): Movement {
  const reader = new Reader(payload), count = reader.u16(), keys: number[] = [], path: number[] = []
  for (let index = 0; index < count; index += 1) { const key = reader.u16(); keys.push(key); path.push(key & 4095) }
  return { keys, path, forcedDirection: reader.i16(), actorId: Math.trunc(reader.f64()) }
}

/** Server-pushed UI sync payloads (`[QUEST_STATE]…`, `[POKEFUS_STATE]…`,
    `[GUILD_CAMP_STATE]…`) travel inside a `TextInformationMessage` via
    `Character.Reply`. They are machine state for future panels, never chat
    text: showing them leaks URL-encoded JSON into `listChat` (one unbroken
    token that overflows the whole HUD). */
export const HIDDEN_CHAT_PREFIXES = ['[QUEST_STATE]', '[POKEFUS_STATE]', '[GUILD_CAMP_STATE]'] as const

const HIDDEN_CHAT_PATTERN = /^\[[A-Z0-9_]+_STATE\]/

export function isHiddenChatLine(raw: string): boolean {
  // `Reply(value, color)` wraps in `<font>`/`<b>`; state payloads are plain,
  // but strip leading markup anyway so a colored sync can never leak.
  const stripped = raw.replace(/^(?:\s*<[^>]+>\s*)*/, '').trimStart()
  if (HIDDEN_CHAT_PREFIXES.some((prefix) => stripped.startsWith(prefix))) return true
  return HIDDEN_CHAT_PATTERN.test(stripped)
}

/** `ChatAbstractServerMessage` then `ChatServerMessage` fields. */
export function parseChatServerMessage(payload: Uint8Array, id: string): ChatLine {
  const reader = new Reader(payload)
  const channel = reader.u8()
  const content = reader.utf()
  const timestamp = reader.i32()
  reader.utf()
  const senderId = reader.f64()
  const senderName = reader.utf()
  return {
    id,
    kind: 'message',
    channel,
    senderId,
    sender: senderName || undefined,
    content,
    timestamp,
  }
}

/** `TextInformationMessage`. Giny command replies use `msgId = 0` and put the
    raw (often HTML) text in `parameters[0]`. */
export function parseTextInformation(payload: Uint8Array, id: string): ChatLine | null {
  const reader = new Reader(payload)
  reader.u8()
  const msgId = reader.varUInt()
  const parameters = Array.from({ length: reader.u16() }, () => reader.utf())
  const content = msgId === 0
    ? (parameters[0] ?? '')
    : parameters.filter(Boolean).join(' ')
  if (!content.trim()) return null
  if (isHiddenChatLine(content)) return null
  return {
    id,
    kind: 'info',
    channel: CHAT_CHANNEL.INFO,
    content,
    timestamp: Math.trunc(Date.now() / 1000),
  }
}

export function parseChatError(payload: Uint8Array, id: string): ChatLine {
  return {
    id,
    kind: 'error',
    channel: CHAT_CHANNEL.INFO,
    content: String(payload[0] ?? 0),
    timestamp: Math.trunc(Date.now() / 1000),
  }
}

/** Server-pushed interactive events, normalised into one union.

    The five official messages carry the same three facts the renderer needs:
    which element, in which state, and whether the local player is busy on it. */
export type InteractiveEvent =
  | { kind: 'used'; actorId: number; elementId: number; skillId: number; duration: number; canMove: boolean }
  | { kind: 'ended'; elementId: number; skillId: number }
  | { kind: 'error'; elementId: number }
  | { kind: 'element'; elementId: number; elementTypeId: number; enabled: boolean }
  | { kind: 'stated'; elementId: number; cellId: number; state: number }

export function parseInteractiveUsed(payload: Uint8Array): InteractiveEvent {
  const reader = new Reader(payload)
  const actorId = reader.varUInt(), elementId = reader.varUInt()
  const skillId = reader.varUInt(), duration = reader.varUInt()
  return { kind: 'used', actorId, elementId, skillId, duration, canMove: reader.u8() !== 0 }
}

export function parseInteractiveUseEnded(payload: Uint8Array): InteractiveEvent {
  const reader = new Reader(payload)
  return { kind: 'ended', elementId: reader.varUInt(), skillId: reader.varUInt() }
}

export function parseInteractiveUseError(payload: Uint8Array): InteractiveEvent {
  return { kind: 'error', elementId: new Reader(payload).varUInt() }
}

/** `InteractiveElement`: two int ids, then the enabled and disabled skill
    lists. An element is usable exactly when its enabled list is not empty. */
export function parseInteractiveElementUpdated(payload: Uint8Array): InteractiveEvent {
  const reader = new Reader(payload)
  const elementId = reader.i32(), elementTypeId = reader.i32()
  const enabled = readSkillList(reader)
  readSkillList(reader)
  return { kind: 'element', elementId, elementTypeId, enabled: enabled > 0 }
}

function readSkillList(reader: Reader): number {
  const count = reader.u16()
  for (let index = 0; index < count; index += 1) {
    reader.u16()
    reader.varUInt()
    reader.i32()
  }
  return count
}

export function parseStatedElementUpdated(payload: Uint8Array): InteractiveEvent {
  const reader = new Reader(payload)
  const elementId = reader.i32(), cellId = reader.varUInt(), state = reader.varUInt()
  return { kind: 'stated', elementId, cellId, state }
}

export function parseCharacterHud(payload: Uint8Array): CharacterHud | null {
  try {
    const parsed = JSON.parse(readModernJson(payload)) as CharacterHud & { error?: string; unchanged?: boolean }
    if (parsed?.unchanged === true) return null
    const snapshotError = (parsed as unknown as { error?: string } | null)?.error
    if (!isCharacterHud(parsed)) {
      console.warn('[Giny HUD] Snapshot refusé', snapshotError ?? 'structure incomplète')
      return null
    }
    // Arrays were added progressively to the modern projection. Keeping their
    // absence backward compatible prevents one older emulator payload from
    // blanking the whole HUD while still rejecting structurally unsafe data.
    parsed.secondary = Array.isArray(parsed.secondary) ? parsed.secondary : []
    parsed.shortcuts = Array.isArray(parsed.shortcuts) ? parsed.shortcuts : []
    parsed.spells = Array.isArray(parsed.spells) ? parsed.spells : []
    parsed.items = Array.isArray(parsed.items) ? parsed.items : []
    parsed.quests = Array.isArray(parsed.quests) ? parsed.quests : []
    parsed.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : []
    parsed.synchronized = true
    return parsed
  } catch (error) {
    console.warn('[Giny HUD] Snapshot illisible', error)
    return null
  }
}

function isCharacterHud(value: CharacterHud & { error?: string }): value is CharacterHud {
  return Boolean(
    value && !value.error && value.character?.name && value.account && value.map &&
    value.life && value.energy && value.experience && value.points && value.weight &&
    value.characteristics && value.combat,
  )
}

export function encodeMovement(path: number[]): number[] {
  let previousDirection = 1
  return path.map((cell, index) => {
    if (cell < 0 || cell > 559) throw new Error('Cellule de mouvement invalide.')
    if (index < path.length - 1) {
      previousDirection = directionBetween(cell, path[index + 1])
      if (previousDirection < 0) throw new Error('Cellules non adjacentes.')
    }
    return (previousDirection << 12) | cell
  })
}

function directionBetween(from: number, to: number): number {
  const points: Array<[number, number]> = Array.from({ length: 560 }, () => [0, 0])
  let cell = 0, x = 0, y = 0
  for (let pair = 0; pair < 20; pair += 1) {
    for (let k = 0; k < 14; k += 1) points[cell++] = [x + k, y + k]
    x += 1
    for (let k = 0; k < 14; k += 1) points[cell++] = [x + k, y + k]
    y -= 1
  }
  const dx = points[to][0] - points[from][0], dy = points[to][1] - points[from][1]
  return [[1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]].findIndex(([vx, vy]) => vx === dx && vy === dy)
}

/** Convert Dofus orthogonal coordinates (x, y) into cellId (0..559). */
export function coordToCellId(x: number, y: number): number {
  return (x - y) * 14 + y + Math.trunc((x - y) / 2)
}

export class MovementRefusedError extends Error {
  readonly serverCell: number
  readonly serverX: number
  readonly serverY: number
  readonly clientStartCell: number

  constructor(message: string, serverCell = -1, serverX = 0, serverY = 0, clientStartCell = -1) {
    super(message)
    this.name = 'MovementRefusedError'
    this.serverCell = serverCell
    this.serverX = serverX
    this.serverY = serverY
    this.clientStartCell = clientStartCell
  }
}

export async function decryptTicket(encrypted: Uint8Array, key: Uint8Array): Promise<string> {
  if (key.length !== 32 || encrypted.length === 0 || encrypted.length % 16 !== 0) throw new Error('Ticket World Giny invalide.')
  const cryptoKey = await crypto.subtle.importKey('raw', key.slice().buffer, { name: 'AES-CBC' }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: key.slice(0, 16) }, cryptoKey, encrypted.slice().buffer)
  return new TextDecoder('ascii').decode(decrypted)
}

export async function loadCreationCatalog(): Promise<CreationCatalog> {
  const response = await fetch('/game-data/client/creation_catalog.json')
  if (!response.ok) throw new Error('Catalogue de création officiel introuvable.')
  return response.json() as Promise<CreationCatalog>
}

export function characterNameError(raw: string): string {
  const name = raw.trim().replace(/^\[(.*)\]$/, '$1').trim()
  if (name.length < 2 || name.length > 20) return 'Le nom doit faire entre 2 et 20 lettres.'
  if (!/^[A-Z][a-z]{1,19}(?:-[A-Z]?[a-z]+){0,2}$/.test(name)) return 'Majuscule au début, lettres sans accent et deux tirets maximum.'
  if (/(.)\1\1/i.test(name)) return 'Pas plus de deux lettres identiques d’affilée.'
  return ''
}

export function creationError(result: number, reason: number): string {
  if (result === 3) return 'Trop de personnages sur ce compte.'
  if (result === 4) return 'Cette classe n’est pas autorisée sur le serveur.'
  if (result === 5) return 'La création est temporairement indisponible.'
  return result === 2 ? `Nom refusé par Giny (reason=${reason}).` : 'Création refusée par Giny.'
}

function serverStatus(value: number): string {
  return ['Unknown', 'Offline', 'Starting', 'Online', 'NoJoin', 'Saving', 'Stopping', 'Full'][value] ?? `Status ${value}`
}

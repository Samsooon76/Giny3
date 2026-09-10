import type { ChatLine } from '../../giny/types'
import { isHiddenChatLine } from '../../giny/parsers'

type Listener = () => void

/** Canaux officiels (`chatchannels.json` : id → raccourci tapé dans le champ).
    L'ordre est celui du cycle au clic sur `btn_dialect` / Tab. */
export const CHAT_CHANNELS = [
  { id: 0, shortcut: '/s' },
  { id: 1, shortcut: '/t' },
  { id: 2, shortcut: '/g' },
  { id: 3, shortcut: '/a' },
  { id: 4, shortcut: '/p' },
  { id: 5, shortcut: '/b' },
  { id: 6, shortcut: '/r' },
  { id: 8, shortcut: '/q' },
  { id: 13, shortcut: '/k' },
  { id: 14, shortcut: '/co' },
  { id: 16, shortcut: '/c' },
  { id: 17, shortcut: '/e' },
  { id: 18, shortcut: '/te' },
  { id: 19, shortcut: '/ra' },
] as const

export const CHAT_DRAFT_MAX_LENGTH = 256

type ChatState = {
  draft: string
  lines: ChatLine[]
  /** Canal actif (`btn_dialect`). */
  channel: number
  /** Chat replié (`header_buttonLeft` expand) : seule la saisie reste. */
  collapsed: boolean
  /** Lignes arrivées pendant que la liste n'était pas épinglée en bas. */
  unread: number
}

const ignoredPlayers = new Set<number>()
const MAX_LINES = 200

const INITIAL: ChatState = { draft: '', lines: [], channel: 0, collapsed: false, unread: 0 }

let state: ChatState = { ...INITIAL }
let seq = 0
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function set(next: ChatState) {
  state = next
  emit()
}

export function nextChatLineId(): string {
  seq += 1
  return `local-${seq}`
}

export function chatChannelShortcut(channel: number): string {
  return CHAT_CHANNELS.find((entry) => entry.id === channel)?.shortcut ?? '/s'
}

export function chatChannelFromShortcut(shortcut: string): number | undefined {
  const needle = shortcut.trim().toLowerCase()
  return CHAT_CHANNELS.find((entry) => entry.shortcut.toLowerCase() === needle)?.id
}

/** `/g salut` → canal guilde + `salut`. Sans préfixe connu, le canal actif. */
export function splitChatPrefix(raw: string, fallback: number): { channel: number; content: string } {
  const match = raw.match(/^\s*(\/\S+)\s+([\s\S]+)$/)
  if (match) {
    const channel = chatChannelFromShortcut(match[1])
    if (channel != null) return { channel, content: match[2] }
  }
  return { channel: fallback, content: raw }
}

export const chatStore = {
  isIgnored(id: number) { return ignoredPlayers.has(id) },
  setIgnored(id: number, ignored: boolean) {
    if (ignored) ignoredPlayers.add(id); else ignoredPlayers.delete(id)
    set({ ...state, lines: ignored ? state.lines.filter(line => line.senderId !== id) : state.lines })
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  snapshot(): ChatState {
    return state
  },
  setDraft(draft: string) {
    const clipped = draft.slice(0, CHAT_DRAFT_MAX_LENGTH)
    if (state.draft === clipped) return
    set({ ...state, draft: clipped })
  },
  setChannel(channel: number) {
    if (state.channel === channel) return
    set({ ...state, channel })
  },
  cycleChannel() {
    const index = CHAT_CHANNELS.findIndex((entry) => entry.id === state.channel)
    const next = CHAT_CHANNELS[(index + 1) % CHAT_CHANNELS.length] ?? CHAT_CHANNELS[0]
    if (next && next.id !== state.channel) set({ ...state, channel: next.id })
  },
  toggleCollapsed() {
    set({ ...state, collapsed: !state.collapsed, unread: state.collapsed ? state.unread : 0 })
  },
  setCollapsed(collapsed: boolean) {
    if (state.collapsed === collapsed) return
    set({ ...state, collapsed, unread: collapsed ? 0 : state.unread })
  },
  markUnread(count: number) {
    if (count <= 0 || state.unread === count) return
    set({ ...state, unread: count })
  },
  markRead() {
    if (state.unread === 0) return
    set({ ...state, unread: 0 })
  },
  append(line: ChatLine) {
    if (isHiddenChatLine(line.content) || (line.senderId != null && ignoredPlayers.has(line.senderId))) return
    const lines = state.lines.some((entry) => entry.id === line.id)
      ? state.lines
      : [...state.lines, line].slice(-MAX_LINES)
    if (lines === state.lines) return
    set({ ...state, lines })
  },
  clear() {
    ignoredPlayers.clear()
    seq = 0
    set({ ...INITIAL })
  },
}

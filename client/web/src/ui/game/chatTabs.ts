import type { ChatLine } from '../../giny/types'

/** Receive filters include private/system channels, unlike the send-channel cycle. */
export const CHAT_FILTERS = [
  { id: 0, label: 'Général (/s)' }, { id: 1, label: 'Équipe (/t)' },
  { id: 2, label: 'Guilde (/g)' }, { id: 3, label: 'Alliance (/a)' },
  { id: 4, label: 'Groupe (/p)' }, { id: 5, label: 'Commerce (/b)' },
  { id: 6, label: 'Recrutement (/r)' }, { id: 9, label: 'Privé (/w)' },
  { id: 10, label: 'Informations' }, { id: 11, label: 'Combat' },
  { id: 13, label: 'Kolizéum (/k)' }, { id: 14, label: 'Communauté (/co)' },
  { id: 15, label: 'Événements' }, { id: 16, label: 'Fabrication (/c)' },
  { id: 18, label: 'Territoire (/te)' }, { id: 19, label: 'Raid de guilde (/ra)' },
] as const
export const CHAT_TAB_ICONS = [
  { icon: 'guild', label: 'Guilde' }, { icon: 'chat', label: 'Discussion' },
  { icon: 'crossedSwords', label: 'Épées' }, { icon: 'crown', label: 'Couronne' },
  { icon: 'magnifier', label: 'Recherche' }, { icon: 'skull', label: 'Crâne' },
  { icon: 'dice', label: 'Dé' }, { icon: 'kamas', label: 'Commerce' },
  { icon: 'heart', label: 'Cœur' }, { icon: 'house', label: 'Maison' },
  { icon: 'info', label: 'Informations' }, { icon: 'party', label: 'Social' },
  { icon: 'hammer', label: 'Fabrication' }, { icon: 'flask', label: 'Fiole' },
  { icon: 'shield', label: 'Bouclier' }, { icon: 'starFilled', label: 'Étoile' },
] as const
export type ChatTab = { id: string; label: string; icon: string; channels: number[] }
export type ChatTabsState = { tabs: ChatTab[]; activeId: string; combatId: string | null }
const STORAGE_KEY = 'giny.chat-tabs.v1'
export function defaultChatTabs(): ChatTabsState {
  return {
    tabs: [
      { id: 'general', label: 'Général', icon: 'party', channels: [0, 1, 2, 3, 4, 6, 9, 10, 16] },
      { id: 'combat', label: 'Combat', icon: 'crossedSwords', channels: [0, 1, 4, 9, 10, 11] },
      { id: 'recruitment', label: 'Recrutement', icon: 'skull', channels: [5, 6, 9, 10] },
    ], activeId: 'general', combatId: null,
  }
}
export function readChatTabs(raw: string | null): ChatTabsState {
  try {
    const value = JSON.parse(raw ?? 'null') as ChatTabsState | null
    if (!value || !Array.isArray(value.tabs) || !value.tabs.length || value.tabs.length > 20) return defaultChatTabs()
    const ids = new Set<string>()
    for (const tab of value.tabs) {
      if (!tab || typeof tab.id !== 'string' || ids.has(tab.id) || typeof tab.label !== 'string'
        || !CHAT_TAB_ICONS.some(entry => entry.icon === tab.icon) || !Array.isArray(tab.channels)
        || !tab.channels.every(id => CHAT_FILTERS.some(channel => channel.id === id))) return defaultChatTabs()
      ids.add(tab.id)
    }
    return { tabs: value.tabs, activeId: ids.has(value.activeId) ? value.activeId : value.tabs[0].id,
      combatId: value.combatId && ids.has(value.combatId) ? value.combatId : null }
  } catch { return defaultChatTabs() }
}
function restore(): ChatTabsState {
  try { return readChatTabs(localStorage.getItem(STORAGE_KEY)) } catch { return defaultChatTabs() }
}
let state = restore()
const listeners = new Set<() => void>()
function set(next: ChatTabsState) {
  state = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* Session-only if storage is unavailable. */ }
  listeners.forEach(listener => listener())
}
export function matchesChatTab(tab: ChatTab, line: ChatLine): boolean {
  return tab.channels.includes(line.channel)
}
export const chatTabs = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: () => state,
  select(id: string) { if (state.tabs.some(tab => tab.id === id)) set({ ...state, activeId: id }) },
  toggleChannel(id: string, channel: number) {
    if (!CHAT_FILTERS.some(entry => entry.id === channel)) return
    set({ ...state, tabs: state.tabs.map(tab => tab.id !== id ? tab : { ...tab,
      channels: tab.channels.includes(channel) ? tab.channels.filter(value => value !== channel) : [...tab.channels, channel] }) })
  },
  setIcon(id: string, icon: string) {
    if (!CHAT_TAB_ICONS.some(entry => entry.icon === icon)) return
    set({ ...state, tabs: state.tabs.map(tab => tab.id === id ? { ...tab, icon } : tab) })
  },
  setCombat(id: string) {
    if (state.tabs.some(tab => tab.id === id)) set({ ...state, combatId: state.combatId === id ? null : id })
  },
  enterCombat() { if (state.combatId) chatTabs.select(state.combatId) },
  add() {
    if (state.tabs.length >= 20) return
    const id = `tab-${crypto.randomUUID()}`
    set({ ...state, activeId: id, tabs: [...state.tabs,
      { id, label: `Onglet ${state.tabs.length + 1}`, icon: 'chat', channels: [...state.tabs[0].channels] }] })
  },
  remove(id: string) {
    if (state.tabs.length <= 1 || !state.tabs.some(tab => tab.id === id)) return
    const tabs = state.tabs.filter(tab => tab.id !== id)
    set({ tabs, activeId: state.activeId === id ? tabs[0].id : state.activeId, combatId: state.combatId === id ? null : state.combatId })
  },
}

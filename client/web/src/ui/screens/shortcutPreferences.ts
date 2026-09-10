import catalog from './shortcutCatalog.json'
export type ShortcutRow = { id: string; label: string; key: string; fixed?: boolean; windowId?: string }
export const SHORTCUT_SECTIONS: Array<{ title: string; rows: ShortcutRow[] }> = catalog
export const SHORTCUT_CATEGORIES = ['Clavier', ...catalog.map(section => section.title)]
type State = { profile: string; profiles: Record<string, Record<string, string>> }
const KEY = 'giny.shortcuts.v1'
const allRows = SHORTCUT_SECTIONS.flatMap(section => section.rows)
function restore(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!['Profil 1', 'Profil 2', 'Profil 3'].includes(saved?.profile)) throw Error()
    const profiles: State['profiles'] = {}
    for (const name of ['Profil 1', 'Profil 2', 'Profil 3']) {
      profiles[name] = Object.fromEntries(allRows.filter(row => !row.fixed && typeof saved.profiles?.[name]?.[row.id] === 'string' && saved.profiles[name][row.id].length <= 80).map(row => [row.id, saved.profiles[name][row.id]]))
    }
    return { profile: saved.profile, profiles }
  } catch { return { profile: 'Profil 1', profiles: {} } }
}
let state = restore()
const listeners = new Set<() => void>()
function save(next: State) { state = next; try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* Session-only. */ } listeners.forEach(fn => fn()) }
export const shortcutPreferences = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  snapshot: () => state,
  get(id: string) { return state.profiles[state.profile]?.[id] ?? allRows.find(row => row.id === id)?.key ?? '' },
  profile(name: string) { if (['Profil 1', 'Profil 2', 'Profil 3'].includes(name)) save({ ...state, profile: name }) },
  set(id: string, key: string) {
    if (!allRows.some(row => row.id === id && !row.fixed)) return
    save({ ...state, profiles: { ...state.profiles, [state.profile]: { ...state.profiles[state.profile], [id]: key } } })
  },
  reset(ids?: string[]) {
    const values = { ...state.profiles[state.profile] }
    for (const id of ids ?? Object.keys(values)) delete values[id]
    save({ ...state, profiles: { ...state.profiles, [state.profile]: values } })
  },
}
export function keyLabel(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>) {
  const names: Record<string, string> = { Escape: 'Échap', Enter: 'Entrée', ' ': 'Espace', Tab: 'Tabulation', ArrowUp: 'Flèche haut', ArrowDown: 'Flèche bas', ArrowLeft: 'Flèche gauche', ArrowRight: 'Flèche droite', PageUp: 'Page précédente', PageDown: 'Page suivante' }
  return [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Maj', event.metaKey && 'Cmd', names[event.key] ?? event.key.toUpperCase()].filter(Boolean).join(' + ')
}

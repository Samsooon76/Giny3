import themes from './themes.json'

/** Palettes copied from the extracted styles/<Theme>.json :root rules. */
export const UI_THEMES = themes
const KEY = 'giny.ui-theme.v1'
export function validTheme(id: unknown): string {
  return themes.some(theme => theme.id === id) ? String(id) : 'Standard'
}
function restore() {
  try { return validTheme(localStorage.getItem(KEY)) } catch { return 'Standard' }
}
let current = restore()
const listeners = new Set<() => void>()
export const themeStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  snapshot: () => current,
  select(id: string) {
    current = validTheme(id)
    try { localStorage.setItem(KEY, current) } catch { /* Theme remains active for this session. */ }
    listeners.forEach(listener => listener())
  },
  reset() { themeStore.select('Standard') },
}

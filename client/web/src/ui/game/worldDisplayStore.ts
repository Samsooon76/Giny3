type WorldDisplay = { grid: boolean; foreground: boolean; coordinates: boolean }
const key = 'giny.world-display.v1'
let state: WorldDisplay = { grid: false, foreground: true, coordinates: true }
try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); for (const name of Object.keys(state) as (keyof WorldDisplay)[]) if (typeof saved?.[name] === 'boolean') state[name] = saved[name] } catch { /* session defaults */ }
const listeners = new Set<() => void>()
export const worldDisplayStore = {
  snapshot: () => state,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  toggle(name: keyof WorldDisplay) { state = { ...state, [name]: !state[name] }; try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* memory only */ } listeners.forEach(fn => fn()) },
}

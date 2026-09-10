/** Where every official window currently sits.

    The official client persists each `MagneticDragWindow` and `WindowFigma`
    placement per account, which is why a player's chat stays where they left
    it. This store is that memory: keyed by the window's official element name,
    holding only what the player actually changed. A window nobody has touched
    has no entry at all and keeps the placement its extracted USS declares. */

import { dockedEdges, type Edge, type Rect, type Bounds } from './magnetism'

export type WindowLayout = Rect & {
  /** Canvas edges the window is anchored to, recomputed after every gesture. */
  docked: Edge[]
  z?: number
  /** `HideWidget`: the module is gone until `DisplayAllWidget` brings every
      one of them back, which is why that entry exists at all. */
  hidden?: boolean
  /** `ReduceWidgetHeader`: the `.header.widget.horizontal.small` title instead
      of `.large`. */
  reducedHeader?: boolean
}

export type LayoutState = Record<string, WindowLayout>

const STORAGE_KEY = 'giny.ui.layout.v2'

function createStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshot: () => state,
    set(next: T) {
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
  }
}

// Focus belongs to this session, independently of saved window geometry.
const windowStack = createStore<Record<string, number>>({})
export const windowStackStore = {
  subscribe: windowStack.subscribe,
  snapshot: windowStack.snapshot,
  raise(id: string) {
    const ordered = Object.entries(windowStack.snapshot())
      .filter(([key]) => key !== id)
      .sort((a, b) => a[1] - b[1])
    // Compact ranks so repeated interactions cannot overflow the CSS z-index.
    windowStack.set(Object.fromEntries([...ordered.map(([key], index) => [key, index + 1]), [id, ordered.length + 1]]))
  },
}

function load(): LayoutState {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return {}
    const state: LayoutState = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const layout = value as Partial<WindowLayout>
      if (![layout.x, layout.y, layout.w, layout.h].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) continue
      state[id] = {
        x: layout.x as number, y: layout.y as number, w: layout.w as number, h: layout.h as number,
        docked: Array.isArray(layout.docked) ? (layout.docked as Edge[]) : [],
        z: typeof layout.z === 'number' ? layout.z : undefined,
        hidden: layout.hidden === true || undefined,
        reducedHeader: layout.reducedHeader === true || undefined,
      }
    }
    return state
  } catch {
    return {}
  }
}

const store = createStore<LayoutState>(load())
const appliedPresets = new Set<string>()
const guides = createStore<{ owner: string; lines: import('./magnetism').Guide[] }>({ owner: '', lines: [] })

let flush: ReturnType<typeof setTimeout> | undefined
function persist(state: LayoutState) {
  if (typeof localStorage === 'undefined') return
  clearTimeout(flush)
  // A drag writes on every pointer move; the disk only needs the last one.
  flush = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota or private mode */ }
  }, 200)
}

export const layoutStore = {
  subscribe: store.subscribe,
  snapshot: store.snapshot,
  get(id: string): WindowLayout | undefined {
    return store.snapshot()[id]
  },
  /** Apply a new host layout once, retaining the prior layout as a backup.
   * Later drags and resizes remain authoritative, including after reload. */
  applyPreset(version: string, rects: Record<string, Rect>, bounds: Bounds): void {
    const key = `${STORAGE_KEY}.preset.${version}`
    if (appliedPresets.has(key)) return
    try { if (localStorage.getItem(key)) { appliedPresets.add(key); return } } catch { /* memory only */ }
    const previous = store.snapshot()
    const next = { ...previous }
    for (const [id, rect] of Object.entries(rects)) {
      next[id] = { ...previous[id], ...rect, docked: dockedEdges(rect, bounds) }
    }
    appliedPresets.add(key)
    clearTimeout(flush)
    store.set(next)
    // Persist the geometry before the marker, so a closed tab cannot leave a
    // completed migration with the old rectangles still on disk.
    try {
      localStorage.setItem(`${key}.backup`, JSON.stringify(previous))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      localStorage.setItem(key, '1')
    } catch { /* memory only */ }
  },
  set(id: string, layout: WindowLayout): void {
    const next = { ...store.snapshot(), [id]: layout }
    store.set(next)
    persist(next)
  },
  /** Highest `z` handed out so far, so a raised window lands above the rest. */
  topZ(): number {
    return Object.values(store.snapshot()).reduce((top, layout) => Math.max(top, layout.z ?? 0), 0)
  },
  reset(id?: string): void {
    if (!id) {
      store.set({})
      persist({})
      return
    }
    const next = { ...store.snapshot() }
    delete next[id]
    store.set(next)
    persist(next)
  },
}

/** Sizes measured off the rendered tree, for the windows whose stylesheet
    declares none. Deliberately not persisted: it is derived from the extracted
    interface, so it has to follow it rather than outlive it. */
const measured = createStore<Record<string, { w: number; h: number }>>({})

export const measureStore = {
  subscribe: measured.subscribe,
  snapshot: measured.snapshot,
  set(id: string, size: { w: number; h: number }) {
    const current = measured.snapshot()[id]
    if (current && current.w === size.w && current.h === size.h) return
    measured.set({ ...measured.snapshot(), [id]: size })
  },
}

/** `LockWidgetPosition` is worded for every module at once — "Verrouiller la
    position des modules" — so it is a shared setting, not a per-window one. */
export type WindowPrefs = { locked: boolean }

const PREFS_KEY = 'giny.ui.prefs.v1'

function loadPrefs(): WindowPrefs {
  if (typeof localStorage === 'undefined') return { locked: false }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    return { locked: (parsed as WindowPrefs | null)?.locked === true }
  } catch {
    return { locked: false }
  }
}

const prefs = createStore<WindowPrefs>(loadPrefs())

export const prefsStore = {
  subscribe: prefs.subscribe,
  snapshot: prefs.snapshot,
  set(patch: Partial<WindowPrefs>) {
    const next = { ...prefs.snapshot(), ...patch }
    prefs.set(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* quota or private mode */ }
  },
}

/** One change applied to every module at once, for the `*All` entries. */
export function updateAllWindows(windows: Array<{ id: string; layout: WindowLayout }>, patch: Partial<WindowLayout>): void {
  const next = { ...store.snapshot() }
  for (const entry of windows) next[entry.id] = { ...(next[entry.id] ?? entry.layout), ...patch }
  store.set(next)
  persist(next)
}

/** Which module has its menu open. At most one, the way a context menu
    behaves; the popup is drawn inside that module's own header slot, so
    nothing else has to be remembered. */
const menu = createStore<string | null>(null)

export const menuStore = {
  subscribe: menu.subscribe,
  snapshot: menu.snapshot,
  close() { menu.set(null) },
  toggle(id: string) { menu.set(menu.snapshot() === id ? null : id) },
}

export const guideStore = {
  subscribe: guides.subscribe,
  snapshot: guides.snapshot,
  set: guides.set,
  clear() { guides.set({ owner: '', lines: [] }) },
}

/** The options menu a module opens from the three dots in its header.

    Its entries are built in C#, so the extractor reads them out of the client's
    own constants and I18n table and writes them to `menus.json`. Nothing here
    invents a label or an entry: what the file carries is what the menu shows.

    The file holds the shared part of the menu — the entries the client's
    `UiOption*Widget*` constants describe. A module can also add rows of its own
    (the health gauge's PV display modes, the chat's channel sizes); those live
    only inside the compiled `BuildContextualMenu`, and the client's metadata is
    hardened against being read, so they are absent until they can be extracted
    rather than guessed. */

export type WidgetMenuScope = 'module' | 'all'

export type WidgetMenuEntry = {
  /** The client's own constant, e.g. `HideWidget`. The renderer switches on it. */
  option: string
  /** The I18n key it was resolved through, kept so the mapping stays auditable. */
  key: string
  label: string
  scope: WidgetMenuScope
}

/** What a module can say about itself when the menu asks. */
export type WidgetMenuContext = {
  /** The module has an official handle, so it has a title to reduce. */
  titled: boolean
  reducedHeader: boolean
  locked: boolean
}

export type WidgetMenuState = { shown: boolean; enabled: boolean; checked: boolean }

/** How one entry behaves for a given module.

    Which entries exist is the extractor's business; this only decides what
    each one can do here. `SmallWidget` and `LargeWidget` swap a module for a
    variant laid out in C#, and `DuplicateWidget` mounts a second copy of it —
    neither is described by the extracted UXML, so they are shown disabled
    rather than omitted or given some approximation. */
export function widgetMenuState(option: string, context: WidgetMenuContext): WidgetMenuState {
  const off = { shown: true, enabled: false, checked: false }
  switch (option) {
    case 'ReduceWidgetHeader':
      return { shown: context.titled && !context.reducedHeader, enabled: context.titled, checked: false }
    case 'MaximizeWidgetHeader':
      return { shown: context.titled && context.reducedHeader, enabled: context.titled, checked: false }
    case 'LockWidgetPosition':
      return { shown: true, enabled: true, checked: context.locked }
    case 'HideWidget':
    case 'HideAllWidget':
    case 'DisplayAllWidget':
    case 'ReduceAll':
    case 'MaximizeAll':
      return { shown: true, enabled: true, checked: false }
    default:
      return off
  }
}

const MENUS_URL = '/ui-data/menus.json'

let entries: readonly WidgetMenuEntry[] = []
const listeners = new Set<() => void>()
let started = false

export const widgetMenu = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  snapshot: () => entries,
  load() {
    if (started) return
    started = true
    fetch(MENUS_URL)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { shared?: WidgetMenuEntry[] } | null) => {
        if (!payload?.shared?.length) return
        entries = payload.shared
        for (const listener of listeners) listener()
      })
      .catch(() => undefined)
  },
}

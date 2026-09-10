/** Shared open state for `mainMenu`.

    `GameMenu.btn_menu` lives on the in-game HUD canvas; `AuthenticatedChrome`
    still mounts the compiled JSON `mainMenu` overlay. Login screens keep
    their own `gameMenu` overlay and write the same store. */
type Listener = () => void

let open = false
let optionsOpen = false
let optionsTarget: 'general' | 'shortcuts' | 'chat' = 'general'
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

export const chromeMenuStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  optionsSnapshot() { return optionsOpen },
  optionsTarget() { return optionsTarget },
  showOptions() { optionsTarget = 'general'; optionsOpen = true; open = false; emit() },
  showOptionsAt(target: 'shortcuts' | 'chat') { optionsTarget = target; optionsOpen = true; open = false; emit() },
  closeOptions() { optionsOpen = false; emit() },
  snapshot() {
    return open
  },
  set(value: boolean) {
    if (open === value) return
    open = value
    emit()
  },
  toggle() {
    chromeMenuStore.set(!open)
  },
}

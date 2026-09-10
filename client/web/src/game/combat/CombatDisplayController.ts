import type { Container } from 'pixi.js'

export type CombatDisplayOptions = { tactical: boolean; grid: boolean }

const STORAGE_KEY = 'giny.combatDisplay.v1'

/** Presentation-only tactical/grid state (project adapter, not an official class).
 *
 * Tactical mode and the grid are independent options, exactly as in the
 * official client (ui.shortcuts.showTacticMode vs ui.shortcuts.showFightMap).
 * The EndTurnWidget `tg_*` bindings are ping/pointing/spectator/lock controls,
 * never a tactical switch, so this controller is driven by the project
 * keyboard shortcut and the programmatic API until the official control,
 * icon and key binding are extracted (see combat-presentation-manifest).
 *
 * Decor reclassification (which occlusive layers the official tactical mode
 * hides) is pending extraction: the hide/restore mechanism below is real and
 * tested, but the classification table starts empty so nothing is hidden by
 * guesswork. Grid geometry comes from the shared official cell constants;
 * the overlay palette stays an explicit placeholder.
 */
export class CombatDisplayController {
  private options: CombatDisplayOptions = { tactical: false, grid: false }
  private listeners = new Set<() => void>()
  /** Occlusive decor containers registered by the renderer, hidden in tactical mode. */
  private tacticalLayers: Container[] = []
  private savedVisibility = new Map<Container, boolean>()

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CombatDisplayOptions>
        this.options = { tactical: parsed.tactical === true, grid: parsed.grid === true }
      }
    } catch { /* Preferences are best-effort; defaults are off. */ }
  }

  get tactical(): boolean { return this.options.tactical }
  get grid(): boolean { return this.options.grid }

  onChange(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  setTactical(on: boolean): void { this.set({ tactical: on }) }
  setGrid(on: boolean): void { this.set({ grid: on }) }
  toggleTactical(): boolean { this.set({ tactical: !this.options.tactical }); return this.options.tactical }
  toggleGrid(): boolean { this.set({ grid: !this.options.grid }); return this.options.grid }

  /** Register decor layers the official classification marks as occlusive.
      Empty until the tactical background/obstacle extraction lands. */
  registerTacticalLayers(layers: Container[]): void { this.tacticalLayers = [...layers] }

  /** Hide registered occlusive decor, preserving each layer's prior visibility. */
  applyTactical(): void {
    for (const layer of this.tacticalLayers) {
      if (!this.savedVisibility.has(layer)) this.savedVisibility.set(layer, layer.visible)
      layer.visible = false
    }
  }

  /** Restore the exact visibility captured before tactical mode. */
  restoreDecor(): void {
    for (const [layer, visible] of this.savedVisibility) {
      if (!layer.destroyed) layer.visible = visible
    }
    this.savedVisibility.clear()
  }

  get hiddenLayerCount(): number { return this.savedVisibility.size }

  private set(patch: Partial<CombatDisplayOptions>): void {
    const next = { ...this.options, ...patch }
    if (next.tactical === this.options.tactical && next.grid === this.options.grid) return
    this.options = next
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.options)) } catch { /* best-effort */ }
    this.listeners.forEach(listener => listener())
  }
}

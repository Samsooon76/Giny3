import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { layoutStore } from '../official/layoutStore'
import { textTooltip } from '../official/tooltipStore'
import type { BindingResolver } from '../official/types'
import { HUD_LAYOUT } from './hudLayout'

/** Names from widgetManager.uxml mapped to their MagneticDragWindow ids. */
export const HUD_MODULES = [
  { binding: 'tg_xp', id: 'widgetProgressGauge', label: 'Expérience' },
  { binding: 'tg_quests', id: 'QuestList', label: 'Suivi des quêtes' },
  { binding: 'tg_map', id: 'CartographyBanner', label: 'Mini-carte' },
  { binding: 'tg_emote', id: 'Smiley', label: 'Émoticônes', initiallyHidden: true },
  { binding: 'tg_chat', id: 'Chat', label: 'Chat' },
  { binding: 'tg_player', id: 'CharacterInformations', label: 'Informations du personnage' },
  { binding: 'tg_spells', id: 'ActionBar', label: 'Barre de sorts et objets' },
  { binding: 'tg_modules', id: 'BannerMenu', label: 'Menu des interfaces' },
] as const

export function moduleVisible(id: string): boolean {
  return !(layoutStore.get(id)?.hidden ?? (id === 'Smiley'))
}

export function setModuleVisible(id: string, visible: boolean): void {
  const layout = layoutStore.get(id)
  const seed = HUD_LAYOUT[id]
  if (layout || seed) layoutStore.set(id, { ...(layout ?? { ...seed, docked: [] }), hidden: !visible })
}

const FOLD_KEY = 'giny.ui.widget-manager.folded.v1'

function ModuleDisplayMenu({ close }: { close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useSyncExternalStore(layoutStore.subscribe, layoutStore.snapshot)
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('pointerdown', dismiss); window.removeEventListener('keydown', escape, true) }
  }, [close])
  return <div ref={ref} className="hud-module-display-menu" role="group" aria-label="Affichage des modules">
    {HUD_MODULES.map(module => <label key={module.id}>
      <input type="checkbox" checked={moduleVisible(module.id)} onChange={event => setModuleVisible(module.id, event.target.checked)} />
      {module.label}
    </label>)}
    <button onClick={() => HUD_MODULES.forEach(module => setModuleVisible(module.id, true))}>Afficher tous les modules</button>
    <button onClick={() => HUD_MODULES.forEach(module => setModuleVisible(module.id, false))}>Masquer tous les modules</button>
  </div>
}

export function useHudWidgetManager(): BindingResolver {
  useSyncExternalStore(layoutStore.subscribe, layoutStore.snapshot)
  const [folded, setFolded] = useState(() => {
    try { return localStorage.getItem(FOLD_KEY) === 'true' } catch { return false }
  })
  const [settings, setSettings] = useState(false)
  const fold = (value: boolean) => {
    setFolded(value)
    setSettings(false)
    try { localStorage.setItem(FOLD_KEY, String(value)) } catch { /* memory only */ }
  }
  return binding => {
    if (binding === 'widgetManager') return {
      hidden: false,
      style: { left: 'auto', right: 152, top: 0, width: 'auto', height: 'auto', alignItems: 'flex-end', overflow: 'visible' },
      children: settings ? <ModuleDisplayMenu close={() => setSettings(false)} /> : undefined,
    }
    if (binding === 'ctr_widgetMenu') return { style: { marginRight: 0 } }
    if (binding === 'ctr_maximized') return { hidden: folded }
    if (binding === 'btn_minimize') return { hidden: folded, onClick: () => fold(true), tooltip: textTooltip('Replier les raccourcis des modules') }
    if (binding === 'btn_maximize') return { hidden: !folded, onClick: () => fold(false), tooltip: textTooltip('Déplier les raccourcis des modules') }
    if (binding === 'btn_settings') return { onClick: () => setSettings(value => !value), tooltip: textTooltip('Afficher ou masquer les modules'), state: settings ? 'pressed' : undefined }
    const module = HUD_MODULES.find(item => item.binding === binding)
    if (module) {
      const visible = moduleVisible(module.id)
      return { checked: visible, onClick: () => setModuleVisible(module.id, !moduleVisible(module.id)), tooltip: textTooltip(`${visible ? 'Masquer' : 'Afficher'} : ${module.label}`) }
    }
    // Contextual modules are absent from the supplied overworld capture.
    if (['tg_treasureHunt', 'tg_breach', 'tg_party', 'tg_alteration', 'tg_items', 'toggle_indicatorCircle'].includes(binding)) return { hidden: true }
    return undefined
  }
}

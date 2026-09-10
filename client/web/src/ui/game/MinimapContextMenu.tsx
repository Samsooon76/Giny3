import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { HINT_FILTERS, HINT_CATEGORY_IDS } from './worldmap'
import { worldmapViewStore } from './worldmapStore'
import { chatStore } from './chatStore'
import { setModuleVisible } from './hudWidgetManager'
import './minimapContextMenu.css'

const FILTER_LABELS = ['Points de repère', 'Moyens de transport', 'Donjons', 'Quêtes disponibles', 'Quêtes répétables', 'Hôtels de vente', 'Ateliers', 'Lieu de classes', 'Divers', 'Possessions', 'Territoires de conquêtes', 'Anomalies']
export type MinimapMenuAnchor = { x: number; y: number; mapX: number; mapY: number }

export function MinimapContextMenu({ anchor, worldmapId, onClose, onRecenter }: {
  anchor: MinimapMenuAnchor; worldmapId: number; onClose: () => void; onRecenter: () => void
}) {
  const state = useSyncExternalStore(worldmapViewStore.subscribe, worldmapViewStore.snapshot)
  const root = useRef<HTMLDivElement>(null)
  const submenu = useRef<HTMLDivElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y })
  const [filterPosition, setFilterPosition] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    const place = () => {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.max(4, Math.min(anchor.x, innerWidth - rect.width - 4))
      const top = Math.max(4, Math.min(anchor.y, innerHeight - rect.height - 4))
      setPosition({ left, top })
      const child = submenu.current?.getBoundingClientRect()
      if (child) setFilterPosition({
        left: left >= child.width ? left - child.width : Math.min(left + rect.width, innerWidth - child.width - 4),
        top: Math.max(4, Math.min(top + rect.height - child.height, innerHeight - child.height - 4)),
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, filtersOpen])
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose() }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }
    window.addEventListener('pointerdown', dismiss, true)
    window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('pointerdown', dismiss, true); window.removeEventListener('keydown', escape, true) }
  }, [onClose])
  const action = (run: () => void) => { run(); onClose() }
  return createPortal(<div ref={root} role="menu" aria-label="Mini-carte" className="minimap-context-menu" style={position}
    onClick={event => event.stopPropagation()} onPointerOver={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); event.stopPropagation() }}
    onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); setFiltersOpen(true); return }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setFiltersOpen(false); return }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const buttons = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
    }}>
    <button role="menuitem" onClick={() => action(() => worldmapViewStore.addMarker(worldmapId, anchor.mapX, anchor.mapY))}>Placer un point de repère</button>
    <button role="menuitem" disabled={!state.markers.length} onClick={() => action(worldmapViewStore.clearMarkers)}>Retirer tous les repères</button>
    <button role="menuitemcheckbox" aria-checked={false} disabled title="Disponible avec la grille de combat">□ Afficher la grille sur la carte de jeu</button>
    <div role="separator" />
    <button role="menuitem" onClick={() => action(onRecenter)}>Recentrer sur votre position (Alt + clic)</button>
    <button role="menuitem" onClick={() => action(() => {
      chatStore.setDraft(`${chatStore.snapshot().draft}${chatStore.snapshot().draft ? ' ' : ''}[${anchor.mapX},${anchor.mapY}]`)
      setModuleVisible('Chat', true)
      chatStore.setCollapsed(false)
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-binding="ti_chatInput"] input')?.focus())
    })}><img src="/dofus3/icons/pin.png" alt="" />Partager la position</button>
    <div role="separator" />
    <button role="menuitem" aria-haspopup="menu" aria-expanded={filtersOpen} onMouseEnter={() => setFiltersOpen(true)} onClick={() => setFiltersOpen(true)}>Filtres <span className="minimap-menu-arrow">›</span></button>
    {filtersOpen && <div ref={submenu} role="menu" aria-label="Filtres de la mini-carte" className="minimap-filter-menu" style={filterPosition}>
      {Object.values(HINT_FILTERS).map((filter, index) => <button key={filter.category} role="menuitemcheckbox" aria-checked={state.filters.has(filter.category)} onClick={() => worldmapViewStore.toggleFilter(filter.category)}>
        <img src={`/dofus3/cartographyMapUI/textures/${filter.sprite}_${state.filters.has(filter.category) ? 'On' : 'Off'}.png`} alt="" />{FILTER_LABELS[index]}
      </button>)}
      <button role="menuitem" onClick={() => worldmapViewStore.setFilters(state.filters.size ? [] : HINT_CATEGORY_IDS)}><img src="/dofus3/icons/eye.png" alt="" />{state.filters.size ? 'Tout masquer' : 'Tout afficher'}</button>
    </div>}
  </div>, document.body)
}

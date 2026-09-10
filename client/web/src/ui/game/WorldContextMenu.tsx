import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { GameRenderer } from '../../game/renderer/GameRenderer'
import { worldDisplayStore } from './worldDisplayStore'
import './worldContextMenu.css'

export type WorldMenuAnchor = { x: number; y: number }
export function WorldContextMenu({ anchor, renderer, onClose }: { anchor: WorldMenuAnchor; renderer: GameRenderer; onClose: () => void }) {
  const state = useSyncExternalStore(worldDisplayStore.subscribe, worldDisplayStore.snapshot)
  const root = useRef<HTMLDivElement>(null)
  const sub = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y })
  const [subPosition, setSubPosition] = useState({ left: false, top: 0 })
  const zoom = renderer.worldZoomState()
  useLayoutEffect(() => {
    const place = () => {
      if (!root.current) return
      const box = root.current.getBoundingClientRect()
      setPosition({ left: Math.max(8, Math.min(anchor.x, innerWidth - box.width - 8)), top: Math.max(8, Math.min(anchor.y, innerHeight - box.height - 8)) })
      if (sub.current) {
        const parent = sub.current.parentElement!.getBoundingClientRect()
        const box = sub.current.getBoundingClientRect()
        setSubPosition({ left: parent.right + box.width > innerWidth - 8, top: Math.min(0, innerHeight - 8 - parent.top - box.height) })
      }
    }
    place(); addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [anchor, expanded, position.left, position.top])
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    addEventListener('pointerdown', dismiss, true); addEventListener('keydown', key, true)
    return () => { removeEventListener('pointerdown', dismiss, true); removeEventListener('keydown', key, true) }
  }, [onClose])
  const options = [
    { label: 'Afficher la grille sur la carte de jeu (Shift+&)', key: 'grid' as const },
    { label: 'Passer les entités au premier plan (Shift+É)', key: 'foreground' as const },
    { label: 'Activer le mode créature (Shift+0)' },
    { label: 'Afficher les coordonnées de la carte', key: 'coordinates' as const },
    { label: 'Afficher le nom des personnages (P)' },
  ]
  const applyZoom = (action: 'in' | 'out' | 'reset') => { renderer.zoomWorld(action, anchor); onClose() }
  return createPortal(<div ref={root} className="world-context-menu" role="menu" aria-label="Carte de jeu" style={position} onContextMenu={e => e.preventDefault()} onClick={e => e.stopPropagation()}
    onKeyDown={e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setExpanded(true); requestAnimationFrame(() => sub.current?.querySelector('button')?.focus()) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setExpanded(false); root.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
    }}>
    <button role="menuitem" disabled={!zoom.canIn} onClick={() => applyZoom('in')}>Zoom +</button>
    <button role="menuitem" disabled={!zoom.canOut} onClick={() => applyZoom('out')}>Zoom -</button>
    <button role="menuitem" disabled={!zoom.canOut} onClick={() => applyZoom('reset')}>Zoom 100%</button>
    <div role="separator" className="world-menu-separator" />
    <div className="world-menu-options" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={expanded} onClick={() => setExpanded(true)}>Options générales <span className="world-menu-arrow" aria-hidden="true">›</span></button>
      {expanded && <div ref={sub} role="menu" aria-label="Options générales" className={`world-menu-submenu${subPosition.left ? ' opens-left' : ''}`} style={{ top: subPosition.top }}>
        {options.map(option => <button key={option.label} role="menuitemcheckbox" aria-checked={option.key ? state[option.key] : false} disabled={!option.key} title={!option.key ? 'Cette fonction n’est pas encore disponible dans le client.' : undefined} onClick={() => { if (option.key) worldDisplayStore.toggle(option.key) }}>
          <span className="world-menu-check" aria-hidden="true">{option.key && state[option.key] ? '✓' : ''}</span>{option.label}
        </button>)}
      </div>}
    </div>
  </div>, document.body)
}

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { CharacterHover } from './CharacterTooltip'
import { chatStore } from './chatStore'
import { setModuleVisible } from './hudWidgetManager'
import './worldContextMenu.css'
import './characterContextMenu.css'

export function CharacterContextMenu({ target, onClose, onZoom }: { target: CharacterHover; onClose: () => void; onZoom: () => void }) {
  useSyncExternalStore(chatStore.subscribe, chatStore.snapshot)
  const root = useRef<HTMLDivElement>(null), submenu = useRef<HTMLDivElement>(null)
  const [information, setInformation] = useState(false)
  const [position, setPosition] = useState({ left: target.x, top: target.y })
  const [subPosition, setSubPosition] = useState({ left: false, top: 0 })
  const actor = target.actor
  const ignored = chatStore.isIgnored(actor.id)
  useLayoutEffect(() => {
    const place = () => {
      if (!root.current) return
      const box = root.current.getBoundingClientRect()
      setPosition({ left: Math.max(8, Math.min(target.x, innerWidth - box.width - 8)), top: Math.max(8, Math.min(target.y, innerHeight - box.height - 8)) })
      if (submenu.current) { const parent = submenu.current.parentElement!.getBoundingClientRect(); const sub = submenu.current.getBoundingClientRect(); setSubPosition({ left: parent.right + sub.width > innerWidth - 8, top: Math.min(0, innerHeight - 8 - parent.top - sub.height) }) }
    }
    place(); addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [target, information, position.left, position.top])
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    addEventListener('pointerdown', dismiss, true); addEventListener('keydown', escape, true)
    return () => { removeEventListener('pointerdown', dismiss, true); removeEventListener('keydown', escape, true) }
  }, [onClose])
  const icon = (name: string) => <span className="character-menu-icon" aria-hidden="true" style={{ maskImage: `url(/dofus3/icons/${name}.png)`, WebkitMaskImage: `url(/dofus3/icons/${name}.png)` }} />
  const icons: Record<string, string> = { 'Afficher le profil': 'party', 'Proposer un échange': 'exchange', 'Inviter dans mon groupe': 'party', 'Inviter en Kolizéum': 'crossedSwords', 'Inviter dans mon Havre-Sac': 'house', 'Ajouter à la liste des contacts': 'party' }
  const unavailable = (label: string) => <button role="menuitem" disabled title="Cette action n’est pas encore disponible dans le client.">{icons[label] && icon(icons[label])}{label}</button>
  return createPortal(<div ref={root} className="world-context-menu character-context-menu" role="menu" aria-label={`Actions pour ${actor.name}`} style={position} onContextMenu={e => e.preventDefault()} onClick={e => e.stopPropagation()}
    onKeyDown={e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setInformation(true) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setInformation(false) }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
    }}>
    <div className="character-menu-title">{actor.name}</div>
    <button role="menuitem" disabled={!actor.name || /\s/.test(actor.name)} onClick={() => { setModuleVisible('Chat', true); chatStore.setCollapsed(false); chatStore.setDraft(`/w ${actor.name} `); onClose(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-binding="ti_chatInput"] input')?.focus()) }}>{icon('chat')}Envoyer un message privé</button>
    {unavailable('Défier')}{unavailable('Rejoindre')}
    <button role="menuitem" onClick={() => { onZoom(); onClose() }}>Zoom</button>
    {unavailable('Afficher le profil')}
    <div className="world-menu-options" onMouseEnter={() => setInformation(true)} onMouseLeave={() => setInformation(false)}>
      <button role="menuitem" aria-haspopup="menu" aria-expanded={information} onClick={() => setInformation(true)}>Informations <span className="world-menu-arrow" aria-hidden="true">›</span></button>
      {information && <div ref={submenu} className={`world-menu-submenu${subPosition.left ? ' opens-left' : ''}`} role="menu" aria-label="Informations du personnage" style={{ top: subPosition.top }}>
        <div className="character-menu-info">{actor.name}</div>
        <div className="character-menu-info">Guilde : {actor.guild?.name || 'Aucune'}</div>
      </div>}
    </div>
    <div role="separator" className="world-menu-separator" />
    {unavailable('Proposer un échange')}{unavailable('Inviter dans mon groupe')}{unavailable('Inviter en Kolizéum')}{unavailable('Inviter dans mon Havre-Sac')}
    <div role="separator" className="world-menu-separator" />
    {unavailable('Ajouter à la liste des contacts')}{unavailable('Bloquer ce joueur')}
    <button role="menuitem" onClick={() => { chatStore.setIgnored(actor.id, !ignored); onClose() }}>{ignored ? 'Ne plus ignorer pour la session' : 'Ignorer pour la session'}</button>
    {unavailable('Signaler le joueur')}
  </div>, document.body)
}

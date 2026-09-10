import { useLayoutEffect, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHAT_FILTERS, CHAT_TAB_ICONS, chatTabs, type ChatTab } from './chatTabs'
import './chatTabMenu.css'

export type ChatTabMenuAnchor = { id: string; x: number; y: number }
export function ChatTabMenu({ anchor, tab, combat, canDelete, onClose }: {
  anchor: ChatTabMenuAnchor; tab: ChatTab; combat: boolean; canDelete: boolean; onClose: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const [icons, setIcons] = useState(false)
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y })
  useLayoutEffect(() => {
    const place = () => {
      const rect = menu.current?.getBoundingClientRect()
      if (rect) setPosition({ left: Math.max(8, Math.min(anchor.x, innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(anchor.y, innerHeight - rect.height - 8)) })
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [anchor, icons])
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose() }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }
    addEventListener('pointerdown', dismiss, true)
    addEventListener('keydown', escape, true)
    return () => { removeEventListener('pointerdown', dismiss, true); removeEventListener('keydown', escape, true) }
  }, [onClose])
  return createPortal(<div ref={menu} className={`chat-tab-menu ${icons ? 'has-icons' : ''}`} role="menu" aria-label={`Canaux de ${tab.label}`}
    style={position} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const buttons = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
    }}>
    <div className="chat-menu-main">
    {CHAT_FILTERS.map(channel => <button key={channel.id} type="button" role="menuitemcheckbox"
      aria-checked={tab.channels.includes(channel.id)} onClick={() => chatTabs.toggleChannel(tab.id, channel.id)}>
      <span className="chat-menu-check" aria-hidden="true" />{channel.label}
    </button>)}
    <div role="separator" className="chat-menu-separator" />
    <button type="button" role="menuitem" aria-expanded={icons} onClick={() => setIcons(value => !value)}>
      Icône associée <span className="chat-menu-arrow" aria-hidden="true">{'›'}</span>
    </button>
    <button type="button" role="menuitemcheckbox" aria-checked={combat} onClick={() => chatTabs.setCombat(tab.id)}>
      Choisir cet onglet en combat {combat && <span aria-hidden="true">✓</span>}
    </button>
    <div role="separator" className="chat-menu-separator" />
    <button type="button" role="menuitem" className="chat-menu-delete" disabled={!canDelete}
      title={canDelete ? undefined : 'Conserver au moins un onglet'} onClick={() => { chatTabs.remove(tab.id); onClose() }}>
      <img src="/dofus3/icons/trash.png" alt="" />Supprimer
    </button>
    </div>
    {icons && <div className="chat-menu-icons" role="group" aria-label="Icône associée">
      {CHAT_TAB_ICONS.map(entry => <button key={entry.icon} type="button" role="menuitemradio"
        aria-label={entry.label} aria-checked={entry.icon === tab.icon}
        onClick={() => { chatTabs.setIcon(tab.id, entry.icon); setIcons(false) }}>
        <i className="chat-menu-radio" aria-hidden="true" />
        <span className="chat-menu-icon" aria-hidden="true" style={{ maskImage: `url(/dofus3/icons/${entry.icon}.png)`, WebkitMaskImage: `url(/dofus3/icons/${entry.icon}.png)` }} />
      </button>)}
    </div>}
  </div>, document.body)
}

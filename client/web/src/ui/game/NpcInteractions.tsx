import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { GinyClient } from '../../giny/GinyClient'
import type { NpcAction, NpcItem, NpcState } from '../../giny/npcState'
import type { WorldActor } from '../../giny/types'
import { EntityPreview } from '../EntityPreview'
import { itemIcon } from './catalog'
import { loadNpcTexts, npcPrice, npcText, type NpcTexts } from './npcData'
import './worldContextMenu.css'
import './npcInteractions.css'

export type NpcTarget = { actor: WorldActor; x: number; y: number }
const labels: Record<number, string> = { 1: 'Acheter / Vendre', 2: 'Échanger', 3: 'Parler' }
const number = (value: number) => value.toLocaleString('fr-FR')

export function NpcInteractions({ client, target, actors, mapId, onCloseMenu, onError }: {
  client: GinyClient; target: NpcTarget | null; actors: WorldActor[]; mapId: number; onCloseMenu: () => void; onError: (message: string) => void
}) {
  const state = useSyncExternalStore(client.onNpcState, client.getNpcState)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  useEffect(() => { setError('') }, [state?.sessionId, mapId])
  const run = async (action: NpcAction) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { await client.performAction(action); onCloseMenu() }
    catch (e) { const text = e instanceof Error ? e.message : String(e); setError(text); onError(text) }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    {target && !state && <NpcMenu target={target} busy={busy} error={error} onClose={onCloseMenu} onAction={actionId => { void run({ action: 'npc.action', args: { actorId: target.actor.id, actionId, mapId } }) }} />}
    {state && state.mapId === mapId && <NpcPanel key={state.sessionId} state={state} actor={actors.find(a => a.id === state.actorId)} busy={busy} error={error} onAction={action => { void run(action) }} />}
  </>
}

function NpcMenu({ target, busy, error, onClose, onAction }: { target: NpcTarget; busy: boolean; error: string; onClose: () => void; onAction: (id: number) => void }) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const place = () => { const el = root.current; if (el) { el.style.left = `${Math.max(8, Math.min(target.x, innerWidth - el.offsetWidth - 8))}px`; el.style.top = `${Math.max(8, Math.min(target.y, innerHeight - el.offsetHeight - 8))}px` } }
    place(); addEventListener('resize', place); return () => removeEventListener('resize', place)
  }, [target, error])
  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node) && !busy) onClose() }
    addEventListener('pointerdown', close, true); return () => removeEventListener('pointerdown', close, true)
  }, [onClose, busy])
  return createPortal(<div className="world-context-menu npc-menu" ref={root} role="menu" aria-label={`Actions de ${target.actor.name}`} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!busy) onClose() }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('button:enabled')]; const i = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
  }}>
    <strong>{target.actor.name || 'Personnage non joueur'}</strong>
    {(target.actor.npc?.actions ?? []).filter(id => labels[id]).map(id => <button role="menuitem" key={id} disabled={busy} onClick={() => onAction(id)}>{labels[id]}</button>)}
    {!target.actor.npc?.actions.length && <p>Aucune interaction disponible.</p>}
    {busy && <p role="status">En attente du PNJ…</p>}{error && <p role="alert">{error}</p>}
  </div>, document.body)
}

export function NpcPanel({ state, actor, busy, error, onAction }: { state: NpcState; actor?: WorldActor; busy: boolean; error: string; onAction: (action: NpcAction) => void }) {
  const root = useRef<HTMLElement>(null)
  const latest = useRef({ state, busy, onAction }); latest.current = { state, busy, onAction }
  const [texts, setTexts] = useState<NpcTexts | null>(null), [textError, setTextError] = useState(''), [retry, setRetry] = useState(0)
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const args = { sessionId: state.sessionId, revision: state.revision }
  useEffect(() => {
    if (state.kind !== 'talk') return
    let active = true; setTexts(null); setTextError('')
    loadNpcTexts(state.templateId).then(value => { if (active) setTexts(value) }).catch(() => { if (active) setTextError('Les textes du dialogue n’ont pas pu être chargés.') })
    return () => { active = false }
  }, [state.templateId, state.kind, retry])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    root.current?.focus()
    const key = (e: KeyboardEvent) => {
      const { state: s, busy: pending, onAction: send } = latest.current
      const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:enabled, input:enabled, select:enabled') ?? [])]
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!pending) send({ action: 'npc.leave', args: { sessionId: s.sessionId, revision: s.revision } }); return }
      if (e.key === 'Tab') {
        e.preventDefault(); const i = controls.indexOf(document.activeElement as HTMLElement)
        controls[(i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
      }
      if (s.kind === 'talk' && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault(); const replies = [...(root.current?.querySelectorAll<HTMLButtonElement>('.npc-replies button:enabled') ?? [])]
        const i = replies.indexOf(document.activeElement as HTMLButtonElement)
        replies[(i + (e.key === 'ArrowUp' ? -1 : 1) + replies.length) % replies.length]?.focus()
      }
      // The active dialog owns keyboard input, including the game's shortcuts.
      if (!(e.key === 'Enter' || e.key === ' ')) e.stopPropagation()
    }
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus() }
  }, [])
  const currency = state.tokenId ? state.inventory.find(i => i.gid === state.tokenId)?.name || `Jetons ${state.tokenId}` : 'Kamas'
  const balance = state.currencyBalance
  const message = texts?.messages[state.messageId]
  return createPortal(<div className="npc-overlay" onPointerDown={e => e.stopPropagation()}>
    <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="npc-title" aria-busy={busy} className={`npc-panel npc-panel--${state.kind}`}>
      <header><div><span>{state.kind === 'talk' ? 'Dialogue' : state.kind === 'shop' ? 'Commerce' : 'Échange'}</span><h2 id="npc-title">{state.name}</h2></div><button className="npc-close" aria-label="Fermer l’interaction" disabled={busy} onClick={() => onAction({ action: 'npc.leave', args })}>×</button></header>
      {state.kind === 'talk' ? <div className="npc-dialog-body">
        {actor?.entity_look && <div className="npc-portrait"><EntityPreview look={actor.entity_look} mode="fit" staticImage /></div>}
        <div className="npc-conversation">
          <div className="npc-question" aria-live="polite">{message ? npcText(message, state.dialogParams) : texts ? `Texte du dialogue indisponible (message ${state.messageId}).` : textError || 'Chargement du dialogue…'}</div>
          {textError && <button onClick={() => setRetry(n => n + 1)}>Réessayer</button>}
          <div className="npc-replies">{state.replies.map((id, index) => <button key={id} disabled={busy || !texts} onClick={() => onAction({ action: 'npc.reply', args: { ...args, replyId: id } })}><span>{index + 1}.</span>{npcText(texts?.replies[id] || texts?.messages[id] || `Réponse ${id}`)}</button>)}
            {state.replies.length === 0 && <button disabled={busy} onClick={() => onAction({ action: 'npc.leave', args })}>Terminer la conversation</button>}
          </div>
        </div>
      </div> : state.kind === 'shop' ? <>
        <nav className="npc-tabs" aria-label="Opération"><button aria-pressed={tab === 'buy'} onClick={() => setTab('buy')}>Acheter</button><button aria-pressed={tab === 'sell'} onClick={() => setTab('sell')}>Vendre</button><span>{number(balance)} {currency}</span></nav>
        <div className="npc-items" aria-label={tab === 'buy' ? 'Objets en vente' : 'Objets à vendre'}>
          {tab === 'buy' ? (state.offers ?? []).map(offer => <NpcItemRow key={`buy-${offer.gid}`} item={{ ...offer, uid: offer.gid, quantity: 2147483647 }} busy={busy} verb="Acheter" price={offer.price} currency={currency} balance={balance} onSubmit={quantity => onAction({ action: 'npc.buy', args: { ...args, gid: offer.gid, quantity } })} />)
            : state.inventory.map(item => <NpcItemRow key={`sell-${item.uid}`} item={item} busy={busy} verb="Vendre" price={item.basePrice} currency={currency} selling onSubmit={quantity => onAction({ action: 'npc.sell', args: { ...args, uid: item.uid, quantity } })} />)}
          {(tab === 'buy' ? !state.offers?.length : !state.inventory.length) && <p className="npc-empty">{tab === 'buy' ? 'Ce marchand ne propose aucun objet.' : 'Aucun objet échangeable dans votre inventaire.'}</p>}
        </div>
      </> : <>
        <div className="npc-trade-columns">
          <div><h3>Votre inventaire</h3><div className="npc-items">{state.inventory.filter(i => state.acceptedGids.includes(i.gid)).map(i => ({ ...i, quantity: i.quantity - (state.local?.find(o => o.uid === i.uid)?.quantity ?? 0) })).filter(i => i.quantity > 0).map(item => <NpcItemRow key={item.uid} item={item} busy={busy} verb="Ajouter" onSubmit={quantity => onAction({ action: 'npc.move', args: { ...args, uid: item.uid, quantity } })} />)}<p className="npc-hint">Seuls les objets acceptés par ce PNJ sont proposés.</p></div></div>
          <div><h3>Vous donnez</h3><div className="npc-items">{state.local?.map(item => <NpcItemRow key={item.uid} item={item} busy={busy} verb="Retirer" onSubmit={quantity => onAction({ action: 'npc.move', args: { ...args, uid: item.uid, quantity: -quantity } })} />)}{!state.local?.length && <p className="npc-empty">Ajoutez un objet depuis votre inventaire.</p>}</div></div>
          <div><h3>Vous recevez</h3><div className="npc-items">{state.remote?.map(item => <div className="npc-reward" key={item.uid}><ItemPicto gid={item.gid} /><span>{item.name}</span><b>× {number(item.quantity)}</b></div>)}{!state.remote?.length && <p className="npc-empty">Le PNJ attend votre proposition.</p>}</div></div>
        </div>
        <footer><span>Vérifiez les objets reçus avant de valider.</span><button className="npc-primary" disabled={busy || !state.local?.length || !state.remote?.length} onClick={() => onAction({ action: 'npc.ready', args })}>Valider l’échange</button></footer>
      </>}
      {busy && <p className="npc-status" role="status">Confirmation du serveur…</p>}{error && <p className="npc-error" role="alert">{error}</p>}
    </section>
  </div>, document.body)
}
function ItemPicto({ gid }: { gid: number }) {
  const src = itemIcon({ gid })
  return <span className="npc-item-picto">{src && <img src={src} alt="" />}</span>
}
function NpcItemRow({ item, busy, verb, price, currency, balance, selling, onSubmit }: { item: NpcItem; busy: boolean; verb: string; price?: number; currency?: string; balance?: number; selling?: boolean; onSubmit: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState('1')
  const count = Number(quantity), total = price === undefined ? undefined : npcPrice(price, count, selling)
  const valid = Number.isInteger(count) && count > 0 && count <= item.quantity && (price === undefined || total !== null) && (balance === undefined || total != null && total <= balance)
  return <form className="npc-item-row" onSubmit={e => { e.preventDefault(); if (valid && !busy) onSubmit(count) }}>
    <ItemPicto gid={item.gid} /><div className="npc-item-name"><strong>{item.name}</strong><small>{verb === 'Acheter' ? `${number(price ?? 0)} ${currency} / unité` : `Quantité : ${number(item.quantity)}`}</small></div>
    <div className="npc-item-controls"><input aria-label={`Quantité : ${item.name}`} type="number" min="1" max={item.quantity} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={busy} />{price !== undefined && <output>{total != null ? `${number(total)} ${currency}` : 'Quantité invalide'}</output>}<button type="submit" disabled={busy || !valid}>{verb}</button></div>
  </form>
}

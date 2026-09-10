import { useRef, useState } from 'react'
import type { GameAction } from '../../giny/actions'
import type { CharacterHud, HudItem } from '../../giny/types'
import type { BindingOverride } from '../official/types'
import './liveActions.css'

export function defaultItemAction(item: HudItem, items: HudItem[]): GameAction | null {
  if (item.equipped) return { action: 'item.equip', args: { uid: item.uid, position: 63 } }
  if (item.usable) return { action: 'item.use', args: { uid: item.uid } }
  const positions = item.equip_positions ?? []
  const position = positions.find(p => !items.some(i => i.equipped && i.position === p)) ?? positions[0]
  return position === undefined ? null : { action: 'item.equip', args: { uid: item.uid, position } }
}

export function useLiveActions(hud: CharacterHud | null, onAction?: (command: GameAction) => Promise<void>) {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [status, setStatus] = useState('')
  const [statsOpen, setStatsOpen] = useState(false)
  const [statId, setStatId] = useState(10)
  const [amount, setAmount] = useState(1)
  const supports = (action: GameAction['action']) => !!onAction && !!hud?.capabilities?.includes(action)
  const run = async (command: GameAction) => {
    if (!supports(command.action) || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setStatus('Action en cours…')
    try { await onAction!(command); setStatus('Action confirmée par Giny.') }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)) }
    finally { pendingRef.current = false; setPending(false) }
  }
  const resolve = (tree: string, binding: string, scope?: string): BindingOverride | undefined => {
    if (tree === 'characterSheetUi' && binding === 'btn_distributeMyPoints') return {
      disabled: !supports('stats.boost') || pending,
      onClick: () => { setStatsOpen(true); setStatus('') },
    }
    if (tree !== 'equipmentStorageUi' || !hud || !/^slot_\d+$/.test(binding)) return undefined
    const gridIndex = scope?.match(/^grid:(\d+)$/)?.[1]
    const item = gridIndex !== undefined ? hud.items.filter(i => !i.equipped)[Number(gridIndex)]
      : hud.items.find(i => i.equipped && i.position === Number(binding.slice(5)))
    if (!item) return undefined
    return {
      onDoubleClick: () => { const command = defaultItemAction(item, hud.items); if (command) void run(command) },
    }
  }
  const panel = <>
    {status && !statsOpen && <div className="live-action-status" role="status">{status}<button onClick={() => setStatus('')} aria-label="Fermer">×</button></div>}
    {statsOpen && <aside className="live-action-panel" aria-label="Distribuer les caractéristiques">
      <header><strong>Caractéristiques</strong><button aria-label="Fermer" onClick={() => setStatsOpen(false)}>×</button></header>
      <form onSubmit={e => { e.preventDefault(); void run({ action: 'stats.boost', args: { statId, amount } }) }}>
        <p>{hud?.points.stats ?? 0} points disponibles</p>
        <label>Caractéristique<select value={statId} onChange={e => setStatId(Number(e.target.value))}>
          {[[10, 'Force'], [11, 'Vitalité'], [12, 'Sagesse'], [13, 'Chance'], [14, 'Agilité'], [15, 'Intelligence']].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Points à dépenser<input type="number" min={1} max={Math.min(32767, hud?.points.stats ?? 0)} required value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
        <button type="submit" disabled={pending || !supports('stats.boost') || !Number.isInteger(amount) || amount < 1 || amount > (hud?.points.stats ?? 0)}>Distribuer</button>
        <button type="button" disabled={pending || !supports('stats.reset')} onClick={() => void run({ action: 'stats.reset', args: {} })}>Réinitialiser les points</button>
      </form>
      {status && <p role="status">{status}</p>}
    </aside>}
  </>
  return { resolve, run, pending, supports, panel }
}

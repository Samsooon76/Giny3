import { useEffect, useSyncExternalStore } from 'react'
import type { Account, Character } from '../../giny/types'
import { OfficialOverlay } from '../official/OfficialScreen'
import type { BindingResolver } from '../official/types'
import type { Screen } from './types'
import { chromeMenuStore } from '../game/chromeMenuStore'
import { textTooltip } from '../official/tooltipStore'
import './mainMenu.css'
import { OptionsWindow } from './OptionsWindow'

export function AuthenticatedChrome({ account, character, screen, busy, onChangeCharacter, onChangeServer, onLogout }: {
  account: Account
  character?: Character
  screen: Screen
  busy: boolean
  onChangeCharacter: () => void
  onChangeServer: () => void
  onLogout: () => void
}) {
  const open = useSyncExternalStore(chromeMenuStore.subscribe, chromeMenuStore.snapshot, chromeMenuStore.snapshot)
  const optionsOpen = useSyncExternalStore(chromeMenuStore.subscribe, chromeMenuStore.optionsSnapshot, chromeMenuStore.optionsSnapshot)
  useEffect(() => () => { chromeMenuStore.set(false); chromeMenuStore.closeOptions() }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        chromeMenuStore.set(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
  const headerResolve: BindingResolver = (binding) => {
    if (binding === 'lbl_name') return { text: character?.name ?? account.nickname ?? account.username }
    if (binding === 'lbl_tag') return { text: account.tag ? `#${account.tag}` : `#${account.id}` }
    if (binding === 'ctr_admin') return { hidden: true }
    return undefined
  }
  const toolbarResolve: BindingResolver = (binding) => {
    if (binding === 'gameMenu') return { style: { left: 'auto', right: 0, top: 0 } }
    if (['btn_bug', 'fps', 'time'].includes(binding)) return { hidden: true }
    if (binding === 'btn_options') return { onClick: chromeMenuStore.showOptions }
    if (binding === 'btn_menu') return { onClick: () => chromeMenuStore.toggle(), state: open ? 'pressed' : undefined }
    return undefined
  }
  const menuResolve: BindingResolver = (binding) => {
    if (binding === 'mainMenu') return { style: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 360, height: 'auto' } }
    if (binding === 'dpd_changeCharacter') return { onClick: onChangeCharacter, disabled: busy || !character }
    if (binding === 'dpd_changeServer') return { onClick: onChangeServer, disabled: busy }
    if (binding === 'btn_options') return { onClick: chromeMenuStore.showOptions }
    if (binding === 'btn_quit') return { onClick: onLogout, disabled: busy }
    if (binding === 'lbl_sub_text') return { text: 'Mode découverte' }
    if (binding === 'lbl_buildNumber') return { text: 'Giny · Client web' }
    if (binding === 'btn_sub') return { disabled: true, tooltip: textTooltip('L’abonnement n’est pas disponible dans ce client.') }
    if (binding === 'btn_close' || binding === 'header_buttonRight') return { onClick: () => chromeMenuStore.set(false) }
    return undefined
  }
  return <div className="authenticated-chrome">
    {optionsOpen && <OptionsWindow onClose={chromeMenuStore.closeOptions} />}
    {screen !== 'world' && <OfficialOverlay tree="characterHeader" resolve={headerResolve} />}
    {screen !== 'world' && <OfficialOverlay tree="gameMenu" resolve={toolbarResolve} />}
    {open && <><button className="official-modal-backdrop" aria-label="Fermer le menu" onClick={() => chromeMenuStore.set(false)} /><OfficialOverlay tree="mainMenu" resolve={menuResolve} modal /></>}
  </div>
}

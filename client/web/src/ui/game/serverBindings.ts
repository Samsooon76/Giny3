import { createElement } from 'react'
import { EntityPreview } from '../EntityPreview'
import { textTooltip } from '../official/tooltipStore'
import type { ServerCharacterPreview } from '../../giny/types'
import type { BindingOverride } from '../official/types'

export type ServerCard = {
  id: number
  name: string
  charactersCount: number
  selectable: boolean
  status?: string
  characters?: ServerCharacterPreview[]
}

/** Server-authored status and account portraits in the official card slots. */
export function resolveServerCard(
  binding: string,
  item: ServerCard | undefined,
  selected: number,
  onSelect: (id: number) => void,
  onCreate: () => void,
  busy: boolean,
): BindingOverride | undefined {
  if (!item) return undefined
  if (binding === 'ctr_serverCard') return { state: item.id === selected ? 'selected' : undefined, style: { filter: item.id===selected?'drop-shadow(0 0 12px #c7e744)':undefined } }
  if (binding === 'ctr_cardClickableArea') return { onClick: () => { if (item.selectable) onSelect(item.id) } }
  if (binding === 'lbl_characters') return { text: `PERSONNAGE (${item.charactersCount})` }
  if (binding === 'icon_status') {
    const online = item.status === 'Online'
    return { replaceChildren: true, style: { backgroundImage: 'none', backgroundColor: 'transparent' },
      tooltip: textTooltip(online ? 'World en ligne' : 'World hors ligne ou indisponible'),
      children: createElement('span', { role: 'img', 'aria-label': online ? 'World en ligne' : 'World hors ligne', style: { display: 'block', width: 16, height: 16, margin: 4, borderRadius: '50%', backgroundColor: online ? '#90e052' : '#e34d4d', boxShadow: '0 1px 2px #0008' } }),
    }
  }
  if (binding === 'ctr_characterContent') return {
    replaceChildren: true, style: { gap: 8, alignItems: 'center' },
    children: (item.characters ?? []).map(character => createElement('span', {
      key: character.id, role: 'img', 'aria-label': character.name, title: character.name,
      style: { display: 'block', position: 'relative', width: 56, height: 56, flex: '0 0 56px', overflow: 'hidden', borderRadius: 4, backgroundColor: '#10110ecc' },
    }, createElement(EntityPreview, { look: character.look, mode: 'portrait', staticImage: true }))),
  }
  if (binding === 'btn_left' || binding === 'btn_right') return { hidden: true }
  if (binding === 'sv_character') return { style: { overflowX: 'auto', maxWidth: 248 } }
  if (binding === 'lbl_name') return { text: item.name }
  if (binding === 'ctr_friends') return { hidden: true }
  if (binding === 'tag_recommended') return { hidden: item.charactersCount > 0 }
  if (binding === 'ctr_character') return { hidden: item.charactersCount === 0 }
  if (binding === 'ctr_newCharacter') {
    return { hidden: item.charactersCount > 0, onClick: onCreate, disabled: busy || !item.selectable }
  }
  return undefined
}

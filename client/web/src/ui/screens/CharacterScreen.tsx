import type { Character, SelectedServer } from '../../giny/types'
import { OfficialScreen } from '../official/OfficialScreen'
import type { BindingResolver } from '../official/types'

export function CharacterScreen({ server, characters, selected, busy, message, onSelect, onCreate, onPlay, onChangeServer }: {
  server: SelectedServer | null
  characters: Character[]
  selected: number
  busy: boolean
  message: string
  onSelect: (id: number) => void
  onCreate: () => void
  onPlay: () => void
  onChangeServer: () => void
}) {
  const current = characters.find((item) => item.id === selected)
  const repeaters = { gd_character: characters.map((character) => ({ key: String(character.id), template: 'characterLine' as const, resolve: ((binding: string) => {
    if (binding === 'ctr_characterLine' || binding === 'ctr_background') return { onClick: () => onSelect(character.id), state: character.id === selected ? 'selected' : undefined, style: { boxShadow: character.id===selected?'inset 0 0 0 1px #ddeb59':undefined, borderRadius:8 } }
    if (binding === 'lbl_name') return { text: character.name }
    if (binding === 'lbl_class') return { text: character.breedName }
    if (binding === 'lbl_level') return { text: String(character.level) }
    if (binding === 'ed_character') return { look: character.look, lookMode: 'portrait', lookStatic: true, style: { width: '100%', height: '100%', top: 0 } }
    if (['btn_delete', 'ed_character_notPlayable', 'tx_warning', 'ctr_xpBonus'].includes(binding)) return { hidden: true }
    return undefined
  }) as BindingResolver })) }
  const resolve: BindingResolver = (binding) => {
    if (binding === 'lbl_title') return { text: 'MES PERSONNAGES SUR LE SERVEUR' }
    if (binding === 'ctr_class' && current) return { sprite: `/game-data/client/class-icons/symbol_${current.breedId}.png` }
    if (binding === 'dd_servers') return { text: 'CHANGER DE SERVEUR', onClick:onChangeServer, disabled:busy }
    if (binding === 'lbl_serverName') return { text: server?.name ?? '' }
    if (binding === 'lbl_nameMain') return { text: current?.name ?? message }
    if (binding === 'lbl_infoMain') return current
      ? { text: String(current.level) }
      : undefined
    if (binding === 'txt_xpMain' || binding === 'ctr_death') return { hidden: true }
    if (binding === 'ed_main') return current
      ? { look: current.look, lookMode: 'selection' }
      : undefined
    if (binding === 'btn_createCharacter') return { onClick: onCreate, disabled: busy || !server?.canCreateCharacter }
    if (binding === 'btn_play') return {
      onClick: onPlay,
      disabled: busy || !current,
    }
    return undefined
  }
  return <OfficialScreen tree="characterSelection" background="styles/images/CharacterCreationBackground.png" resolve={resolve} repeaters={repeaters} />
}

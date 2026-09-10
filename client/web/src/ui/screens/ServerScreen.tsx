import { serverUnavailableMessage } from '../../giny/parsers'
import type { Account, GameServer } from '../../giny/types'
import { OfficialScreen } from '../official/OfficialScreen'
import type { BindingResolver } from '../official/types'
import { resolveServerCard } from '../game/serverBindings'

const SERVER_TABS = [
  'tab_pioneer', 'tab_pioneer_mono', 'tab_classic', 'tab_classic_mono',
  'tab_epic', 'tab_tournament', 'tab_temporis',
]

export function ServerScreen({ account, servers, selected, busy, message, onSelect, onPlay, onCreate }: {
  account: Account | null
  servers: GameServer[]
  selected: number
  busy: boolean
  message: string
  onSelect: (id: number) => void
  onPlay: () => void
  onCreate: () => void
}) {
  const selectedServer = servers.find(server => server.id === selected)
  const notice = message || serverUnavailableMessage(selectedServer)
  const first = 3 - Math.floor(servers.length / 2)
  const serverForScope = (scope?: string) => servers[Number(scope?.match(/_(\d+)$/)?.[1] ?? -1) - first]
  const moveServer = (direction: -1 | 1) => {
    const available = servers.filter((item) => item.selectable)
    if (!available.length) return
    const current = Math.max(0, available.findIndex((item) => item.id === selected))
    onSelect(available[(current + direction + available.length) % available.length].id)
  }
  const resolve: BindingResolver = (binding, scope) => {
    const item = serverForScope(scope)
    // The official screen ships both view modes and all seven type tabs hidden;
    // the client reveals the ones it is about to fill. We drive the carousel.
    if (binding === 'ctr_listMode' || binding === 'lbl_noServer') return { hidden: true }
    if (binding === 'ctr_carouselMode') return { hidden: false, style: { overflow: 'visible' } }
    if (SERVER_TABS.includes(binding)) {
      const labels=['Pionnier','Pionnier Monocompte','Classique','Classique Monocompte','Épique','Tournoi','Temporis']
      const index=SERVER_TABS.indexOf(binding)
      const count=index===2?servers.reduce((sum,server)=>sum+server.charactersCount,0):0
      return { hidden: index===6, text: `${labels[index]} (${count}/5)`, className: index===2?'activeTrue':'activeFalse' }
    }
    if (binding.startsWith('serverCard_')) return { hidden: !item }
    if (scope?.startsWith('serverCard_') && !item) return { hidden: true }
    const card = resolveServerCard(binding, item, selected, onSelect, onCreate, busy)
    if (card) return card
    if (binding === 'lbl_accountName') return { text: account?.username ?? '' }
    // USS ships search / filter / tabs as display:none; the C# client reveals
    // them when the screen mounts. Hiding them here is why the official
    // screenshot still has a search field and "Afficher uniquement mes
    // personnages" and this preview did not.
    if (binding === 'lbl_title') return { text: 'CHOIX D’UN SERVEUR' }
    if (binding === 'tag_label' && item) return { text: item.monoAccount ? 'CLASSIQUE MONOCOMPTE' : 'CLASSIQUE' }
    if (binding === 'ctr_search' || binding === 'ctr_filter') return { hidden: false }
    if (binding === 'ctr_searchResult' || binding === 'ctr_force') return { hidden: true }
    if (binding === 'btn_moveLeft') return { onClick: () => moveServer(-1), disabled: busy || servers.length < 2 }
    if (binding === 'btn_moveRight') return { onClick: () => moveServer(1), disabled: busy || servers.length < 2 }
    if (binding === 'btn_freeAccount' || binding === 'btn_force') return { hidden: true }
    if (binding === 'ctr_warning') return { hidden: !notice }
    if (binding === 'lbl_warning') return { text: notice }
    if (binding === 'btn_play') return { onClick: onPlay, disabled: busy || !selectedServer?.selectable }
    return undefined
  }
  return <OfficialScreen tree="ServerSelection" background="styles/images/CharacterCreationBackground.png" resolve={resolve} />
}

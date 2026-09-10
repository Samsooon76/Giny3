import { worldDisplayStore } from '../game/worldDisplayStore'
import { previewJobs, jobIcon } from '../game/catalog'
import { Fragment, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { moduleOptions, type ModuleOptions } from './moduleOptions'
import { layoutStore, menuStore, type WindowLayout } from './layoutStore'
import { chromeMenuStore } from '../game/chromeMenuStore'
import { chatTabs } from '../game/chatTabs'
import { chatStore } from '../game/chatStore'
import { stripChatMarkup } from '../../giny/chatText'
import { worldmapViewStore } from '../game/worldmapStore'
import { HINT_FILTERS } from '../game/worldmap'
import { OfficialSprite } from './OfficialIcon'
import './moduleContextMenu.css'

type Entry = { label: string; kind?: 'heading' | 'separator' | 'checkbox' | 'radio' | 'color'; checked?: boolean; disabled?: boolean; icon?: string; run?: () => void; children?: Entry[] }
export function referenceModuleTitle(id: string): string | undefined {
  const name = id.toLowerCase()
  if (name.includes('characterinformation')) return 'INFORMATIONS DE PERSONNAGE'
  if (name.includes('actionbar')) return 'BARRE'
  if (name.includes('progressgauge')) return 'EXPÉRIENCE DE PERSONNAGE'
  if (name === 'chat') return 'CHAT'
  if ((name.includes('minimap') || name === 'cartographybanner')) return 'MINI-CARTE'
  if (name.includes('bannermenu')) return 'AFFICHAGE'
  if ((name.includes('emote') || name === 'smiley')) return 'ATTITUDES ET ÉMOTICÔNES'
  return undefined
}
const separator: Entry = { label: '', kind: 'separator' }
const heading = (label: string): Entry => ({ label, kind: 'heading' })
const unavailable = (label: string, kind?: Entry['kind']): Entry => ({ label, kind, disabled: true })
const FILTER_LABELS = ['Points de repère', 'Moyens de transport', 'Donjons', 'Quêtes disponibles', 'Quêtes répétables', 'Hôtels de vente', 'Ateliers', 'Lieu de classes', 'Divers', 'Possessions', 'Territoires de conquêtes', 'Anomalies']
const JOBS = [
  ['RÉCOLTE', 'Alchimiste', 'Bûcheron', 'Chasseur', 'Mineur', 'Paysan', 'Pêcheur', 'Éleveur'],
  ['FABRICATION', 'Bijoutier', 'Bricoleur', 'Cordonnier', 'Façonneur', 'Forgeron', 'Sculpteur', 'Tailleur'],
  ['FORGEMAGIE', 'Cordomage', 'Costumage', 'Façomage', 'Forgemage', 'Joaillomage', 'Sculptemage'],
]

/** Menus transcribed from images-references/2026-09-07. Unsupported game
 * operations remain explicit disabled entries, never cosmetic success states. */
export function ModuleContextMenu({ id, layout, titled }: { id: string; layout: WindowLayout; titled: boolean }) {
  useSyncExternalStore(moduleOptions.subscribe, moduleOptions.snapshot)
  const tabs = useSyncExternalStore(chatTabs.subscribe, chatTabs.snapshot)
  const map = useSyncExternalStore(worldmapViewStore.subscribe, worldmapViewStore.snapshot)
  const worldDisplay = useSyncExternalStore(worldDisplayStore.subscribe, worldDisplayStore.snapshot)
  const prefs = moduleOptions.get(id)
  const [error, setError] = useState('')
  const name = id.toLowerCase()
  const set = (patch: Partial<ModuleOptions>) => moduleOptions.set(id, patch)
  const check = (label: string, key: 'showInitiative' | 'largeMenuIcons' | 'largeChatTabs'): Entry => ({ label, kind: 'checkbox', checked: prefs[key], run: () => set({ [key]: !prefs[key] }) })
  const choices = <K extends keyof ModuleOptions>(key: K, values: [string, ModuleOptions[K]][]): Entry[] => values.map(([label, value]) => ({ label, kind: 'radio', checked: prefs[key] === value, run: () => set({ [key]: value }) }))
  const hide: Entry = { label: 'Masquer le module', icon: 'eyeSlashed', run: () => { layoutStore.set(id, { ...layout, hidden: true }); menuStore.close() } }
  const entries: Entry[] = [hide, { label: layout.reducedHeader ? 'Agrandir le titre du module' : 'Réduire le titre du module', disabled: !titled, run: () => layoutStore.set(id, { ...layout, reducedHeader: !layout.reducedHeader }) }]
  if (name.includes('characterinformation')) entries.push(separator,
    ...choices('small', [['Grand module', false], ['Petit module', true]]), check('Points d’invocation', 'showInitiative'),
    heading('AFFICHAGE DES POINTS DE VIE'), ...choices('hp', [['PV restants', 'remaining'], ['PV restants et totaux', 'total'], ['Pourcentage de PV restants', 'percent']]))
  else if (name.includes('actionbar')) entries.push(separator,
    { label: 'Nombre de lignes', children: choices('rows', [['Une Ligne', 1], ['Deux Lignes', 2], ['Trois Lignes', 3]]) },
    { ...unavailable('Afficher par défaut les sorts en combat', 'checkbox'), checked: prefs.combatSpells }, separator,
    { label: 'Paramétrer les raccourcis', run: () => { chromeMenuStore.showOptionsAt('shortcuts'); menuStore.close() } }, unavailable('Ajouter une barre'), separator,
    { label: prefs.emptyBar ? 'Restaurer la barre' : 'Vider la barre', run: () => set({ emptyBar: !prefs.emptyBar }) })
  else if (name.includes('bannermenu')) entries.push(separator, check('Augmenter la taille des icônes de menu', 'largeMenuIcons'))
  else if ((name.includes('minimap') || name === 'cartographybanner')) entries.push(separator, { label: 'Afficher la grille sur la carte de jeu', kind: 'checkbox', checked: worldDisplay.grid, run: () => worldDisplayStore.toggle('grid') },
    { label: 'Filtres', children: [...Object.values(HINT_FILTERS).map((filter, i): Entry => ({ label: FILTER_LABELS[i], icon: `${filter.sprite}_${map.filters.has(filter.category) ? 'On' : 'Off'}`, checked: map.filters.has(filter.category), run: () => worldmapViewStore.toggleFilter(filter.category) })),
      { label: map.filters.size ? 'Tout masquer' : 'Tout afficher', run: () => worldmapViewStore.setFilters(map.filters.size ? [] : Object.values(HINT_FILTERS).map(f => f.category)) }] })
  else if (name.includes('progressgauge')) {
    entries.splice(0, entries.length, unavailable('Limiter le pourcentage d’expérience obtenue (100%)'), { label: 'Couleur de jauge', kind: 'color' }, hide,
      heading('GESTION DES JAUGES'), ...choices('gauge', [['Expérience de personnage', 'character'], ['Expérience de guilde', 'guild']]).map(row => ({ ...row, kind: 'checkbox' as const })),
      unavailable('Points d’honneur', 'checkbox'), ...choices('gauge', [['Poids', 'pods'], ['Points d’énergie', 'energy']]).map(row => ({ ...row, kind: 'checkbox' as const })),
      { label: 'Expérience de métier', children: JOBS.flatMap(([title, ...jobs]) => [heading(title), ...jobs.map(label => { const job = previewJobs().find(job => job.name === label); return { ...unavailable(label, 'checkbox'), icon: job ? jobIcon(job.iconId, job.picto) : undefined } })]) })
  } else if (name === 'chat') entries.push(separator,
    { label: 'Options générales du chat', run: () => { chromeMenuStore.showOptionsAt('chat'); menuStore.close() } },
    { label: 'En savoir plus', children: [unavailable('Commandes du chat'), unavailable('Canaux de discussion')] },
    { label: 'Langue du canal Communauté', children: [unavailable('Français', 'radio')] },
    { label: 'Copier tous les messages', run: () => { void navigator.clipboard.writeText(chatStore.snapshot().lines.map(line => `${line.sender ? `${line.sender} : ` : ''}${stripChatMarkup(line.content)}`).join('\n')).catch(() => setError('La copie dans le presse-papiers a échoué.')) } },
    heading('AFFICHAGE'), { label: 'Taille de la police', children: choices('chatFont', [14,16,18,20].map(size => [`${size}`, size])) },
    { label: 'Interligne', children: choices('chatSpacing', [['Simple', 1], ['Normal', 1.2], ['Large', 1.5], ['Double', 2]]) },
    { label: 'Niveau d’opacité du fond', children: choices('chatOpacity', [['Opacité faible', 0.3], ['Opacité moyenne', 0.6], ['Opacité forte', 0.9]]) }, separator,
    { label: 'Choisir l’onglet en combat', children: tabs.tabs.map(tab => ({ label: tab.label, kind: 'radio', checked: tabs.combatId === tab.id, run: () => chatTabs.setCombat(tab.id) })) },
    check('Augmenter la taille des onglets', 'largeChatTabs'), unavailable('Replier les effets de sorts', 'checkbox'))
  return <><MenuEntries entries={[heading(referenceModuleTitle(id) ?? id), ...entries]} color={prefs.gaugeColor} onColor={gaugeColor => set({ gaugeColor })} />{error && <div role="alert" className="module-menu-error">{error}</div>}</>
}

function MenuEntries({ entries, color, onColor }: { entries: Entry[]; color?: string; onColor?: (color: string) => void }) {
  return <>{entries.map((entry, i) => <Fragment key={`${entry.label}-${i}`}>
    {entry.kind === 'heading' ? <div className="module-menu-heading">{entry.label}</div>
      : entry.kind === 'separator' ? <div className="module-menu-separator" role="separator" />
      : entry.kind === 'color' ? <label className="module-menu-color">{entry.label}<input type="color" aria-label={entry.label} value={color} onChange={e => onColor?.(e.target.value)} /></label>
      : <MenuItem entry={entry} />}
  </Fragment>)}</>
}
function MenuItem({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: false, y: 0 })
  const submenu = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !submenu.current || !row.current) return
    const rect = submenu.current.getBoundingClientRect()
    const parent = row.current.getBoundingClientRect()
    const scale = parent.width / row.current.offsetWidth || 1
    const canvas = row.current.closest('.official-canvas')?.getBoundingClientRect()
    const right = Math.min(innerWidth, canvas?.right ?? innerWidth) - 8
    const bottom = Math.min(innerHeight, canvas?.bottom ?? innerHeight) - 8
    setPosition({ left: parent.right + rect.width > right, y: Math.min(0, (bottom - parent.top - rect.height) / scale) })
  }, [open])
  return <div ref={row} className="module-menu-row" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}>
    <button type="button" role={entry.kind === 'radio' ? 'menuitemradio' : entry.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={entry.kind === 'radio' || entry.kind === 'checkbox' ? !!entry.checked : undefined}
      aria-haspopup={entry.children ? 'menu' : undefined} aria-expanded={entry.children ? open : undefined}
      disabled={entry.disabled} title={entry.disabled ? 'Cette fonction n’est pas encore disponible dans le client.' : undefined}
      className={`module-menu-item${entry.checked ? ' is-checked' : ''}${open && entry.children ? ' is-open' : ''}`}
      onKeyDown={e => { if (entry.children && e.key === 'ArrowRight') { e.preventDefault(); setOpen(true); requestAnimationFrame(() => submenu.current?.querySelector('button')?.focus()) } if (e.key === 'ArrowLeft') { e.preventDefault(); setOpen(false) } }}
      onClick={e => { e.stopPropagation(); if (entry.children) setOpen(true); else entry.run?.() }}>
      {(entry.kind === 'radio' || entry.kind === 'checkbox') && <span className={`module-menu-check is-${entry.kind}`} aria-hidden="true">{entry.checked && (entry.kind === 'checkbox' ? '✓' : '●')}</span>}
      {entry.icon && (entry.icon.startsWith('/') ? <img src={entry.icon} width={14} height={14} alt="" /> : <OfficialSprite name={entry.icon} style={{ width: 14, height: 14, flexShrink: 0 }} />)}
      <span>{entry.label}</span>{entry.children && <span className="module-menu-arrow" aria-hidden="true">›</span>}
    </button>
    {open && entry.children && <div ref={submenu} role="menu" aria-label={entry.label} className={`module-reference-menu module-submenu${position.left ? ' opens-left' : ''}`} style={{ top: position.y }}><MenuEntries entries={entry.children} /></div>}
  </div>
}

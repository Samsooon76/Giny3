import { graphicsSettings, GRAPHICS_PROFILES, type GraphicsProfile } from '../../game/graphicsSettings'
import { chromeMenuStore } from '../game/chromeMenuStore'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ShortcutSettings } from './ShortcutSettings'
import { SHORTCUT_CATEGORIES, shortcutPreferences } from './shortcutPreferences'
import { moduleOptions } from '../official/moduleOptions'
import './optionsWindow.css'
import { UI_THEMES, themeStore } from '../official/themeStore'
import { useViewport } from '../official/treeLoader'
import { OFFICIAL_CANVAS, surfaceScale } from '../official/surface'

type Setting = { id: string; label: string; initial: boolean | string; choices?: string[] }
type Section = { title: string; settings: Setting[] }
const SECTIONS: Section[] = [
  { title: 'Général', settings: [
    { id: 'theoretical', label: 'Toujours afficher les jets théoriques des effets', initial: false },
    { id: 'dropConfirm', label: 'Confirmer le dépôt d’objets au sol', initial: true },
    { id: 'livingItems', label: 'Autoriser les objets Obvijevan à parler', initial: true },
    { id: 'classIcon', label: 'Afficher l’image de la classe comme picto de la fenêtre', initial: false },
    { id: 'omega', label: 'Afficher le niveau oméga sous les ornements', initial: true },
    { id: 'marketItems', label: 'Ouvrir plusieurs objets en même temps en hôtel de vente', initial: '1 objet', choices: ['1 objet', '2 objets', '3 objets'] },
    { id: 'firstPurchase', label: 'Afficher une pop up de confirmation d’achat (sans délai) lors du premier achat d’une ressource dans une certaine quantité', initial: true },
    { id: 'priceConfirm', label: 'Afficher une pop up de confirmation d’achat lors d’un achat de la même ressource et quantité mais que le prix évolue', initial: 'Que lorsque le prix est éloigné', choices: ['Toujours', 'Que lorsque le prix est éloigné', 'Jamais'] },
  ] },
  { title: 'Combat', settings: [
    { id: 'turnDelay', label: 'Ajouter un léger délai avant de pouvoir passer un tour consécutif', initial: true },
    { id: 'usedPoints', label: 'Afficher les points d’action (PA) et points de mouvement (PM) utilisés', initial: false },
    { id: 'turnOrder', label: 'Afficher l’ordre de jeu sur les combattants', initial: false },
    { id: 'movementDistance', label: 'Afficher la distance des déplacements', initial: false },
    { id: 'movementArea', label: 'Afficher la zone de déplacement possible', initial: true },
    { id: 'stateTurns', label: 'Afficher le nombre de tours restant dans les bulles d’états', initial: true },
    { id: 'spectator', label: 'Spectateur : Afficher automatiquement les informations du combattant actuel', initial: true },
  ] },
]
const CATEGORIES = ['Jeu', 'Interface', 'Affichage', 'Son', 'Accessibilité', 'Thèmes', 'Notification', 'Assistance']
const KEY = 'giny.options.v1'
const defaults = Object.fromEntries(SECTIONS.flatMap(section => section.settings.map(s => [s.id, s.initial])))
function loadSettings(): Record<string, boolean | string> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return Object.fromEntries(SECTIONS.flatMap(section => section.settings.map(s => [s.id,
      typeof saved?.[s.id] === typeof s.initial && (!s.choices || s.choices.includes(saved[s.id])) ? saved[s.id] : s.initial,
    ])))
  } catch { return { ...defaults } }
}
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function OptionsWindow({ onClose }: { onClose: () => void }) {
  const graphicsProfile = useSyncExternalStore(graphicsSettings.subscribe, graphicsSettings.snapshot, graphicsSettings.snapshot)
  const viewport = useViewport()
  const scale = surfaceScale(OFFICIAL_CANVAS, viewport)
  const selectedTheme = useSyncExternalStore(themeStore.subscribe, themeStore.snapshot, themeStore.snapshot)
  const [tab, setTab] = useState(chromeMenuStore.optionsTarget() === 'shortcuts' ? 'shortcuts' : 'general')
  const [category, setCategory] = useState(chromeMenuStore.optionsTarget() === 'chat' ? 'Interface' : 'Jeu')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [shortcutSection, setShortcutSection] = useState('Clavier')
  const [query, setQuery] = useState('')
  const [values, setValues] = useState(loadSettings)
  const [saveError, setSaveError] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useSyncExternalStore(moduleOptions.subscribe, moduleOptions.snapshot, moduleOptions.snapshot)
  const chat = moduleOptions.get('chat')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.dataset.shortcutCapture) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return }
      if (event.key !== 'Tab') return
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? [])
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); previous?.focus() }
  }, [])
  useEffect(() => { content.current?.scrollTo(0, 0) }, [category, tab, query])
  function save(next: typeof values) {
    setValues(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)); setSaveError(false) } catch { setSaveError(true) }
  }
  function reset(section?: Section) {
    if (section) save({ ...values, ...Object.fromEntries((SECTIONS.find(item => item.title === section.title) ?? section).settings.map(s => [s.id, s.initial])) })
    else save({ ...defaults })
  }
  const search = normalize(query.trim())
  const sections = SECTIONS.map(section => ({ ...section, settings: section.settings.filter(s => !search || normalize(s.label + ' ' + section.title).includes(search)) })).filter(section => section.settings.length)
  return <div className="options-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="options-window" style={{ transform: `scale(${scale}) translateY(-60px)` }} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="options-title" tabIndex={-1}>
      <header className="options-header"><h1 id="options-title">Options</h1><button className="options-close" onClick={onClose} aria-label="Fermer les options">×</button></header>
      <nav className="options-tabs" aria-label="Onglets des options">
        <button aria-pressed={tab === 'general'} onClick={() => setTab('general')}>Général</button>
        <button aria-pressed={tab === 'shortcuts'} onClick={() => setTab('shortcuts')}>Raccourcis</button>
      </nav>
      <div className="options-body">
        <aside className="options-sidebar">
          <div className="options-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher une option" placeholder="Recherche" value={query} onChange={e => setQuery(e.target.value)} /></div>
          <nav aria-label="Catégories des options">{tab === 'shortcuts' ? <div className="shortcuts-navigation"><div className="options-category">Raccourcis</div>{SHORTCUT_CATEGORIES.map(title => <button key={title} className="options-subcategory" title={title} aria-current={shortcutSection === title ? 'true' : undefined} onClick={() => { setShortcutSection(title); setQuery(''); requestAnimationFrame(() => dialog.current?.querySelector(`[data-section="${title}"]`)?.scrollIntoView({ block: 'start' })) }}>{title}</button>)}</div> : CATEGORIES.map(name => <div key={name}>
            <button className="options-category" aria-current={category === name ? 'page' : undefined} aria-expanded={expanded === name} onClick={() => { setCategory(name); setTab('general'); setQuery(''); setExpanded(expanded === name ? null : name) }}>{name}<span aria-hidden="true">{expanded === name ? '−' : '+'}</span></button>
            {expanded === name && (name === 'Jeu' ? ['Général', 'Combat'] : name === 'Interface' ? ['Discussion'] : name === 'Thèmes' ? ['Choix du thème'] : []).map(title => <button key={title} className="options-subcategory" onClick={() => dialog.current?.querySelector(`[data-section="${title}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{title}</button>)}
          </div>)}</nav>
          <button className="options-reset options-reset-all" onClick={() => { if (tab === 'shortcuts') shortcutPreferences.reset(); else { reset(); themeStore.reset(); moduleOptions.set('chat', { timestamps: true, chatFont: 14 }) } }}>⟲ Réinitialiser</button>
        </aside>
        <div className="options-content" ref={content}>
          <div className="options-heading"><h2>{tab === 'shortcuts' ? 'Raccourcis' : search ? 'Résultats de recherche' : category}</h2>{(tab === 'shortcuts' || ['Jeu', 'Thèmes'].includes(category)) && <button className="options-reset" onClick={() => tab === 'shortcuts' ? shortcutPreferences.reset() : category === 'Thèmes' ? themeStore.reset() : reset()}>⟲ Réinitialiser</button>}</div>
          {tab === 'shortcuts' ? <ShortcutSettings query={query} />
          : category === 'Thèmes' && !search ? <section className="options-section" data-section="Choix du thème"><div className="options-section-heading"><h3>Choix du thème</h3><button className="options-reset" onClick={themeStore.reset}>⟲ Réinitialiser</button></div><div className="options-theme-grid" role="group" aria-label="Choix du thème">{UI_THEMES.map(theme => <button key={theme.id} className="options-theme-card" aria-label={theme.label} aria-pressed={selectedTheme === theme.id} title={theme.label} onClick={() => themeStore.select(theme.id)}><img src={theme.image} alt="" /></button>)}</div></section>
          : category === 'Jeu' || search ? <>{sections.map(section => <section className="options-section" key={section.title} data-section={section.title}>
            <div className="options-section-heading"><h3>{section.title}</h3><button className="options-reset" onClick={() => reset(section)}>⟲ Réinitialiser</button></div>
            {section.settings.map(setting => <label key={setting.id} className={`options-row ${values[setting.id] === true ? 'is-checked' : ''} ${setting.choices ? 'is-select' : ''}`}>
              {!setting.choices && <input type="checkbox" checked={values[setting.id] === true} onChange={e => save({ ...values, [setting.id]: e.target.checked })} />}
              <span>{setting.label}</span>
              {setting.choices && <select value={String(values[setting.id])} onChange={e => save({ ...values, [setting.id]: e.target.value })}>{setting.choices.map(choice => <option key={choice}>{choice}</option>)}</select>}
            </label>)}
          </section>)}{!sections.length && <p>Aucune option trouvée pour « {query} ».</p>}<p className="options-note" role="status">{saveError ? 'Sauvegarde locale indisponible : les changements seront perdus à la fermeture.' : 'Préférences mémorisées sur cet appareil. Leur application en jeu reste à raccorder.'}</p></>
          : category === 'Affichage' ? <section className="options-section"><h3>Qualité graphique</h3>
            <label className="options-row is-select"><span>Profil</span><select value={graphicsProfile} onChange={event => graphicsSettings.set(event.target.value as GraphicsProfile)}>
              {Object.entries(GRAPHICS_PROFILES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select></label>
            <p>Économique réduit la résolution, les animations du décor et les effets pour limiter la consommation. Qualité élevée augmente la netteté sur les écrans haute densité.</p>
            <p>La fluidité et la résolution changent immédiatement. Les cartes voisines sont libérées ou rechargées immédiatement. La densité des particules change à la prochaine carte.</p>
          </section>
          : category === 'Interface' ? <section className="options-section" data-section="Discussion"><div className="options-section-heading"><h3>Discussion</h3><button className="options-reset" onClick={() => moduleOptions.set('chat', { timestamps: true, chatFont: 14 })}>⟲ Réinitialiser</button></div><label className={`options-row ${chat.timestamps ? 'is-checked' : ''}`}><input type="checkbox" checked={chat.timestamps} onChange={e => moduleOptions.set('chat', { timestamps: e.target.checked })} /><span>Afficher l’heure des messages</span></label><label className="options-row is-select"><span>Taille du texte de discussion</span><select value={chat.chatFont} onChange={e => moduleOptions.set('chat', { chatFont: Number(e.target.value) })}>{[14, 16, 18, 20].map(size => <option key={size} value={size}>{size} px</option>)}</select></label></section>
          : <section className="options-section"><h3>{category}</h3><p>Les réglages de cette catégorie ne sont pas encore disponibles dans ce client.</p></section>}
        </div>
      </div>
    </div>
  </div>
}

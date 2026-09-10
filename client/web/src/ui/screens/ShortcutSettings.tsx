import { useState, useSyncExternalStore } from 'react'
import { SHORTCUT_SECTIONS, shortcutPreferences, keyLabel } from './shortcutPreferences'
import './shortcutSettings.css'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function ShortcutSettings({ query }: { query: string }) {
  const state = useSyncExternalStore(shortcutPreferences.subscribe, shortcutPreferences.snapshot, shortcutPreferences.snapshot)
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const search = normalize(query.trim())
  const sections = SHORTCUT_SECTIONS.map(section => ({ ...section, rows: section.rows.filter(row => !search || normalize(row.label + ' ' + section.title + ' ' + shortcutPreferences.get(row.id)).includes(search)) })).filter(section => section.rows.length)
  return <>
    {!search && <section className="options-section shortcuts-section" data-section="Clavier"><div className="options-section-heading"><h3>Clavier</h3><button className="options-reset" onClick={() => { shortcutPreferences.profile('Profil 1'); shortcutPreferences.reset() }}>⟲ Réinitialiser</button></div><label className="shortcut-profile"><span>Choix du clavier</span><select value={state.profile} onChange={event => shortcutPreferences.profile(event.target.value)}>{['Profil 1', 'Profil 2', 'Profil 3'].map(name => <option key={name}>{name}</option>)}</select></label></section>}
    {sections.map(section => <section key={section.title} className="options-section shortcuts-section" data-section={section.title}>
      <div className="options-section-heading"><h3>{section.title}</h3><button className="options-reset" onClick={() => shortcutPreferences.reset(SHORTCUT_SECTIONS.find(s => s.title === section.title)!.rows.map(row => row.id))}>⟲ Réinitialiser</button></div>
      {section.rows.map(row => <div className="shortcut-setting" key={row.id}><label htmlFor={`shortcut-${row.id}`}>{row.label}</label><input id={`shortcut-${row.id}`} className="shortcut-key" aria-label={`Raccourci : ${row.label}`} data-shortcut-capture={!row.fixed || undefined} readOnly disabled={row.fixed} value={editing === row.id ? 'Appuyez sur une touche…' : shortcutPreferences.get(row.id)} title={row.fixed ? 'Raccourci fixe' : 'Appuyez sur une combinaison. Retour arrière pour effacer, Échap pour annuler.'} onFocus={() => setEditing(row.id)} onBlur={() => setEditing(null)} onKeyDown={event => {
        event.preventDefault(); event.stopPropagation()
        if (event.key === 'Escape') { event.currentTarget.blur(); return }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
        const key = ['Backspace', 'Delete'].includes(event.key) ? '' : keyLabel(event.nativeEvent)
        const conflict = SHORTCUT_SECTIONS.flatMap(s => s.rows).find(other => other.id !== row.id && key && shortcutPreferences.get(other.id) === key)
        if (conflict) { setNotice(`Cette combinaison est déjà utilisée pour « ${conflict.label} ».`); return }
        shortcutPreferences.set(row.id, key); setNotice(''); event.currentTarget.blur()
      }} />{!row.fixed ? <button className="shortcut-reset" aria-label={`Réinitialiser : ${row.label}`} onClick={() => shortcutPreferences.reset([row.id])}>⟲</button> : <span />}</div>)}
    </section>)}
    {!sections.length && <p>Aucun raccourci trouvé pour « {query} ».</p>}
    {notice && <div className="shortcut-notice" role="alert">{notice}</div>}
    <p className="options-note">Les raccourcis de menus sont appliqués au client. Les autres affectations sont mémorisées ; leur action reste à raccorder.</p>
  </>
}

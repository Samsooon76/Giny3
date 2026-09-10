import { useCallback, useEffect, useState } from 'react'
import './creationSpells.css'
import './creationLayout.css'
import { loadCreationSpellCatalog } from '../game/catalog'
import { characterNameError } from '../../giny/GinyClient'
import type { CreationCatalog, SelectedServer } from '../../giny/types'
import { creationSpellTile, creationSpellTiles, creationSpellPairs } from '../game/creationSpellTiles'
import { WindowLayoutContext, useWindowLayout } from '../official/OfficialWindow'
import { tooltipStore } from '../official/tooltipStore'
import { OfficialScreen } from '../official/OfficialScreen'
import type { BindingOverride, BindingResolver } from '../official/types'
import { creationHeadSprite, resolveCreationChoiceSlot, resolveCreationName } from '../game/creationBindings'
import { CREATION_COLOR_FIELDS, effectiveColors } from './creation'
import type { CreationState } from './types'

export function CreationScreen({ server, catalog, value, busy, message, onChange, onBack, onCreate, onChangeServer }: {
  server: SelectedServer | null
  catalog: CreationCatalog
  value: CreationState
  busy: boolean
  message: string
  onChange: (value: CreationState) => void
  onBack: () => void
  onCreate: () => void
  onChangeServer: () => void
}) {
  const [dialog, setDialog] = useState<'spells' | 'mechanics' | null>(null)
  const [roleFilter, setRoleFilter] = useState<number | null>(null)
  const [facing, setFacing] = useState(1)
  const [breedLayout, setBreedLayout] = useState<Record<string, { sortIndex: number; breedRoles: Array<{ roleId: number; order: number }> }>>({})
  useEffect(() => {
    let active = true
    fetch('/game-data/data/breeds.json').then(response => {
      if (!response.ok) throw new Error('Catalogue des classes indisponible')
      return response.json()
    }).then(data => { if (active) setBreedLayout(data) }).catch(console.warn)
    return () => { active = false }
  }, [])
  const selectedClass = catalog.classes[value.classIndex], variant = selectedClass.variants[value.gender]
  const orderedRoles = breedLayout[selectedClass.breed_id]?.breedRoles.filter(role => role.order >= 0).sort((a, b) => a.order - b.order)
  const mainRoles = orderedRoles?.length ? orderedRoles.flatMap(role => selectedClass.roles.filter(item => item.id === role.roleId)).slice(0, 3) : [...selectedClass.roles].sort((a, b) => b.value - a.value).slice(0, 3)
  const classOrder = catalog.classes.map((item, index) => ({ item, index })).sort((a, b) => (breedLayout[a.item.breed_id]?.sortIndex ?? a.index) - (breedLayout[b.item.breed_id]?.sortIndex ?? b.index))
  const colors = effectiveColors(value, variant.colors), head = variant.heads[Math.min(value.headIndex, variant.heads.length - 1)]
  const look = applyLookColors(head?.look ?? variant.base_look, colors)
  const previewLook = useDebouncedValue(look, 90)
  const [, refreshCatalogue] = useState(0)
  useEffect(() => { let active = true; loadCreationSpellCatalog().then(() => { if (active) refreshCatalogue(n => n + 1) }).catch(console.error); return () => { active = false } }, [])
  const spells = selectedClass.spells ?? []
  const spellPairs = creationSpellPairs(spells, selectedClass.breed_id)
  const closeDialog = useCallback(() => { setDialog(null); tooltipStore.hide() }, [])
  const windowLayout = useWindowLayout({ onClose: closeDialog,
    seed: id => id === 'window_spells' ? { x: 545, y: 92, w: 400, h: 66 + Math.ceil(spellPairs.length / 2) * 62 } : undefined })
  useEffect(() => {
    if (!dialog) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog() }
    }
    addEventListener('keydown', escape, true)
    return () => removeEventListener('keydown', escape, true)
  }, [dialog, closeDialog])
  useEffect(() => { tooltipStore.hide() }, [value.classIndex])
  const selectClass = (classIndex: number) => onChange({ ...value, classIndex, headIndex: 0, colors: [] })
  const resolve: BindingResolver = (binding, scope) => {
    // The runtime fits the creation controls at 90% of the authored layout.
    // Keep this local: HUD windows still use their own 1920 × 1080 coordinates.
    if (binding === 'ctr_creationUi') return { style: { transform: 'scale(.9)', transformOrigin: 'center' } }
    const roleFilterId = CREATION_ROLE_FILTERS[binding]
    if (roleFilterId) return { checked: roleFilter === roleFilterId, onClick: () => setRoleFilter(current => current === roleFilterId ? null : roleFilterId), tooltip: { tree: 'TextTooltip', text: CREATION_ROLES[roleFilterId].label } }
    const roleIcon = /^icon_role_(\d+)$/.exec(binding)
    if (roleIcon) {
      const role = mainRoles[Number(roleIcon[1]) - 1]
      return role && CREATION_ROLES[role.id] ? { sprite: `/dofus3/icons/${CREATION_ROLES[role.id].icon}.png`, tooltip: { tree: 'TextTooltip', text: `${role.name} : ${role.description}` } } : { hidden: true }
    }
    if (binding === 'lbl_serverName') return { text: server?.name ?? '' }
    if (binding === 'dd_servers') return { onClick: onChangeServer, disabled: busy }
    if (binding === 'lbl_breed') return { text: selectedClass.label.toUpperCase(), style: { fontSize: 50, lineHeight: '60px', height: 60 } }
    if (binding === 'tx_breedSymbol') return { sprite: `/game-data/client/class-icons/symbol_${selectedClass.breed_id}.png` }
    if (binding === 'sv_heads') return { style: { height: 260, overflowY: 'auto' } }
    if (binding === 'ctr_heads') return { style: { gap: 4, width: 316, flexWrap: 'wrap' } }
    if (binding.startsWith('icon_complexity_')) return { hidden: Number(binding.split('_').pop()) > (selectedClass.complexity ?? 1) }
    if (binding === 'lbl_attitudes') return { text: 'ATTITUDES' }
    if (binding === 'lbl_stuffs') return { text: 'ÉQUIPEMENTS' }
    if (binding === 'lbl_archetype') return { text: selectedClass.gameplay }
    const breedSlot = /^ctr_breeds:(\d+)$/.exec(binding)
    if (breedSlot) {
      const entry = classOrder[Number(breedSlot[1])], index = entry?.index ?? -1, item = entry?.item
      const choice = resolveCreationChoiceSlot(
        Boolean(item),
        index === value.classIndex,
        item ? creationHeadSprite(item.breed_id, value.gender) : undefined,
        () => selectClass(index),
      )
      return { ...choice, tooltip: item ? { tree: 'TextTooltip', text: item.label } : undefined,
        style: { opacity: roleFilter && !item?.roles.some(role => role.id === roleFilter && role.value > 0) ? .25 : 1 } }
    }
    const headSlot = /^ctr_heads:(\d+)$/.exec(binding)
    if (headSlot) {
      const index = Number(headSlot[1]), item = variant.heads[index]
      return resolveCreationChoiceSlot(
        Boolean(item),
        index === value.headIndex,
        creationHeadSprite(selectedClass.breed_id, value.gender),
        () => onChange({ ...value, headIndex: index }),
      )
    }
    if (binding === 'btn_randomBreed') return {
      sprite: '/dofus3/icons/random.png',
      onClick: () => {
        const choices = catalog.classes.map((item, index) => ({ item, index })).filter(({ item }) => !roleFilter || item.roles.some(role => role.id === roleFilter && role.value > 0))
        if (choices.length) selectClass(choices[Math.floor(Math.random() * choices.length)].index)
      },
    }
    if (binding === 'btn_previous') return { onClick: () => selectClass((value.classIndex - 1 + catalog.classes.length) % catalog.classes.length) }
    if (binding === 'btn_next') return { onClick: () => selectClass((value.classIndex + 1) % catalog.classes.length) }
    if (binding === 'switch_gender') return {
      checked: value.gender === 'male',
      onClick: () => onChange({ ...value, gender: value.gender === 'male' ? 'female' : 'male', headIndex: 0, colors: [] }),
    }
    if (binding === 'input_name') return resolveCreationName(value.name, (name) => onChange({ ...value, name }))
    const colorBinding = resolveCreationColor(binding, scope, colors, (next) => onChange({ ...value, colors: next }))
    if (colorBinding) return colorBinding
    if (binding === 'btn_randomizeColorSet') return { onClick: () => onChange({ ...value, colors: colors.map(randomHex) }) }
    if (binding === 'btn_resetColorSet') return { onClick: () => onChange({ ...value, colors: [] }) }
    if (binding === 'btn_rotateLeft') return { onClick: () => setFacing(current => (current + 7) % 8) }
    if (binding === 'btn_rotateRight') return { onClick: () => setFacing(current => (current + 1) % 8) }
    if (binding === 'ed_chara') return { look: previewLook, lookMode: 'hero', lookFacing: facing }
    if (binding === 'lbl_breedInfo') return { text: selectedClass.description || selectedClass.gameplay || message || characterNameError(value.name), style: { whiteSpace: 'normal', overflow: 'auto', height: 'auto', fontSize: 16, lineHeight: '20px', margin: '16px' } }
    const spellSlot = /^spellSlot_(\d+)$/.exec(binding)
    if (spellSlot) { const spell = spells[Number(spellSlot[1]) - 1]; return spell ? creationSpellTile(spell) : { hidden: true } }
    if (binding === 'btn_showSpells') return { onClick: () => { tooltipStore.hide(); setDialog(current => current === 'spells' ? null : 'spells') }, disabled: spells.length === 0 }
    if (binding === 'btn_mechanics') return { onClick: () => setDialog('mechanics'), disabled: !selectedClass.mechanics }
    if (binding === 'header_buttonRight' && dialog === 'spells') return { onClick: closeDialog }
    if (binding === 'ctr_spells') return { style: { display: 'grid', gridTemplateColumns: '144px 144px', columnGap: 20, rowGap: 18, padding: '22px 44px', overflowY: 'auto', maxHeight: '100%' } }
    if (binding === 'window_spells') return { hidden: dialog !== 'spells', style: { zIndex: 20 } }
    if (binding === 'window_mechanics') return { hidden: true }
    if (binding === 'btn_generateName') return { onClick: () => onChange({ ...value, name: randomCharacterName() }) }
    if (binding === 'btnLeave' || binding === 'btn_leaveModif') return { hidden: true }
    if (binding === 'btn_back') return { onClick: onBack }
    if (binding === 'btn_play') return { text: 'Jouer', onClick: onCreate, disabled: busy || Boolean(characterNameError(value.name)) }
    return undefined
  }
  return <>
    <WindowLayoutContext value={{ ...windowLayout, layoutFor: (chrome, node) => { const layout = windowLayout.layoutFor(chrome, node); return chrome.id === 'window_spells' ? { ...layout, w: 400, h: 66 + Math.ceil(spellPairs.length / 2) * 62 } : layout } }}><OfficialScreen tree="characterCreation" background="styles/images/CharacterCreationBackground.png" resolve={resolve} repeaters={{ ctr_spells: creationSpellTiles(spellPairs), ctr_heads: variant.heads.map((face,index)=>({ key: String(face.id), template: 'EntityChoice', resolve: binding => binding === 'entity_choice' ? { look: applyLookColors(face.look, colors), lookMode: 'portrait', lookStatic: true, onClick: () => onChange({ ...value, headIndex:index }), style: { boxShadow: index===value.headIndex?'inset 0 0 0 2px #b6b3e6':undefined } } : undefined })) }} /></WindowLayoutContext>
    {dialog === 'mechanics' && <CreationInfoDialog selectedClass={selectedClass} onClose={closeDialog} />}
  </>
}

const CREATION_ROLES: Record<number, { icon: string; label: string }> = {
  1: { icon: 'chains', label: 'Entrave' }, 2: { icon: 'armor', label: 'Tank' },
  3: { icon: 'shield', label: 'Protection' }, 4: { icon: 'heal', label: 'Soins' },
  5: { icon: 'weapon', label: 'Dégâts' }, 6: { icon: 'areaCross', label: 'Placement' },
  7: { icon: 'gobbal', label: 'Invocation' }, 8: { icon: 'arrowTripleTop', label: 'Amélioration' },
}
const CREATION_ROLE_FILTERS: Record<string, number> = {
  tg_role_damageDealer: 5, tg_role_healer: 4, tg_role_summoner: 7, tg_role_prositioner: 6,
  tg_role_protector: 3, tg_role_debuffer: 1, tg_role_buffer: 8, tg_role_tank: 2,
}

function randomHex(): string {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`
}

function setCreationColor(colors: string[], index: number, color: string): string[] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return colors
  const next = [...colors]
  while (next.length <= index) next.push('#ffffff')
  next[index] = color.toUpperCase()
  return next
}

function resolveCreationColor(
  binding: string,
  scope: string | undefined,
  colors: string[],
  onChange: (colors: string[]) => void,
): BindingOverride | undefined {
  if (binding === 'ColorPalette') return { style: { borderRadius: '50%', background: `conic-gradient(${colors.map((c,i)=>`${c} ${i*60}deg ${(i+1)*60}deg`).join(',')})`, border: '2px solid #111524' } }
  if (/^color_\d+$/.test(binding)) return { hidden: true }
  const index = CREATION_COLOR_FIELDS.indexOf((scope ?? '') as typeof CREATION_COLOR_FIELDS[number])
  if (index < 0) return undefined
  const color = colors[index] ?? '#ffffff'
  if (binding === 'colorPickerField_color') {
    return {
      style: { backgroundColor: color },
      children: <input
        type="color"
        className="official-native-input"
        value={color}
        aria-label={`Couleur ${index + 1}`}
        onInput={(event) => onChange(setCreationColor(colors, index, event.currentTarget.value))}
      />,
    }
  }
  if (binding === 'colorPickerField_textField') return { text: color.replace(/^#/, '').toUpperCase() }
  if (binding === 'colorPickerField_CTA') {
    return { hidden: false, style: { width: 32, height: 32, backgroundColor: '#4c4940', borderRadius: 3 }, onClick: () => onChange(setCreationColor(colors, index, randomHex())) }
  }
  return undefined
}

function CreationInfoDialog({ selectedClass, onClose }: { selectedClass: CreationCatalog['classes'][number]; onClose: () => void }) {
  return <div className="creation-info-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="creation-info-dialog creation-info-dialog--mechanics" role="dialog" aria-modal="true" aria-label={`Mécaniques de ${selectedClass.label}`}>
      <header><div><small>{selectedClass.gameplay}</small><h2>Mécaniques de {selectedClass.label}</h2></div><button type="button" onClick={onClose} aria-label="Fermer">×</button></header>
      <div className="creation-mechanics" dangerouslySetInnerHTML={{ __html: sanitizeOfficialMarkup(selectedClass.mechanics) }} />
    </section>
  </div>
}

function applyLookColors(look: string, colors: string[]): string {
  const parts = look.slice(1, -1).split('|')
  parts[2] = colors.map((color, index) => `${index + 1}=${color}`).join(',')
  return `{${parts.join('|')}}`
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debounced
}

function sanitizeOfficialMarkup(value: string): string {
  return value
    .replace(/<(title|subtitle)(?:\s[^>]*)?>/gi, '<h3>')
    .replace(/<\/(title|subtitle)>/gi, '</h3>')
    .replace(/<(?!\/?(?:h3|b|li)\b)[^>]*>/gi, '')
}

function randomCharacterName(): string {
  const starts = ['Al', 'Bel', 'Cor', 'Da', 'El', 'Fa', 'Gal', 'Hel', 'Iri', 'Jo', 'Ka', 'Lum', 'Mor', 'Nel', 'Ori', 'Per', 'Qua', 'Ryn', 'Sol', 'Tor']
  const ends = ['dan', 'elle', 'ian', 'ine', 'mir', 'nor', 'os', 'ril', 'tan', 'wen']
  return starts[Math.floor(Math.random() * starts.length)] + ends[Math.floor(Math.random() * ends.length)]
}

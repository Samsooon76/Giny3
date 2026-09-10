import { useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater, RepeaterItem } from '../official/repeaters'
import { windowRepeaters } from './hudRepeaters'
import './spells.css'
import { spell, spellLevel, spellObtention, decodeEffectLine } from './catalog'
import { SpellTooltipBuilder } from './tooltipBuilders'

const FILTERS = [
  ['themes/darkStone/sprites/sword.png','Dommages','dommage'], ['heal','Soins','soin'], ['neutral','Neutre','neutre'],
  ['earth','Terre','terre'], ['fire','Feu','feu'], ['water','Eau','eau'], ['textures/text/air.png','Air','air'],
  ['icons/tx_range.png','Portée','portée'], ['icons/arrowBigUp.png','Bonus','augmente'], ['icons/arrowBigBottom.png','Malus','réduit'],
  ['shield','Boucliers','bouclier'], ['teleport','Déplacement','téléporte'], ['icons/tx_summonableCreaturesBoost.png','Invocations','invoque'], ['icons/starFilled.png','États','état'],
]
export function useSpells(hud: CharacterHud | null, onActivate?: (id: number) => void, pending = false) {
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('')
  const [levels,setLevels] = useState(true)
  const [tab,setTab] = useState(0)
  const [mode,setMode] = useState(1)
  const [selected,setSelected] = useState<Record<string,string>>({})
  const compact = mode === 2
  const rowHeight = mode === 0 ? 84 : compact ? 64 : 66
  const tileHeight = mode === 0 ? 62 : 46
  const source = hud ? windowRepeaters('playerSpell',hud) ?? {} : {}
  const pairs = [...(source.ctr_leftSpellContainer ?? []), ...(source.ctr_rightSpellContainer ?? [])]
    .filter(pair => (pair.repeaters?.gd_spellButtons ?? []).some(button => {
      const row = spell(Number(button.key))
      const name = String(button.resolve('lbl_spellName')?.text ?? '')
      const effects = spellLevel(Number(button.key), 1)?.effects ?? []
      const text = `${row?.description ?? ''} ${effects.map(decodeEffectLine).join(' ')}`.toLocaleLowerCase('fr')
      return name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')) && (!filter || text.includes(filter))
    }))
    .map(pair => ({ ...pair, resolve: (b:string,s?:string) => {
      if (['spell_container','gd_spellButtonsContainer','gd_spellButtons'].includes(b)) return {style:{...pair.resolve(b,s)?.style,height:rowHeight}}
      return pair.resolve(b,s)
    }, repeaters: { ...pair.repeaters, gd_spellButtons: pair.repeaters?.gd_spellButtons.map((button, index) => ({
      ...button,
      resolve: (b:string,s?:string) => {
        const original = button.resolve(b,s)
        if (b === 'gd_obtentionLevels_container') return { ...original, hidden: compact || !levels }
        if (b === 'btn_spell_container') return {style:{...original?.style,height:rowHeight}}
        if (b === 'container_spell') return {style:{width:'100%',height:tileHeight}}
        if (b === 'spell_icon_container') return {style:{...original?.style,left:compact?'calc(50% - 22px)':mode===0?10:2,top:(tileHeight-44)/2,width:44,height:44}}
        if (b === 'lbl_spellName_container') return {hidden:compact,style:{...original?.style,left:mode===0?68:56,height:tileHeight,width:mode===0?'calc(100% - 90px)':'calc(100% - 76px)'}}
        if (b === 'tx_lock') return {hidden: (hud?.spell_choices?.flat().find(s=>s.id===Number(button.key))?.available ?? (spellObtention(Number(button.key))[0] ?? 1) <= (hud?.character.level ?? 1))}
        if (b === 'tx_greyedOut') return {hidden:true}
        if (b === 'btn_spell') {
          const id = Number(button.key)
          const active = hud?.spells.find(s => s.id === id)
          const choice = hud?.spell_choices?.flat().find(s => s.id === id)
          const available = choice?.available ?? (spellObtention(id)[0] ?? 1) <= (hud?.character.level ?? 1)
          const isActive = available && (onActivate ? !!active : (selected[pair.key] ?? pair.repeaters?.gd_spellButtons[0]?.key) === button.key)
          return { ...original, disabled: onActivate ? pending || choice?.available === false || !hud?.capabilities?.includes('spell.activate') : false,
            onClick: () => onActivate ? onActivate(id) : setSelected(v => ({ ...v, [pair.key]: button.key })),
            style: { ...original?.style, height:tileHeight, borderRadius:index===0?'8px 0 0 8px':'0 8px 8px 0', background:isActive?'var(--highlight_secondary50)':'transparent', boxShadow:'inset 0 0 0 1px var(--highlight_secondary35)', opacity:available?1:0.3 },
            tooltip: SpellTooltipBuilder.Build(active ?? choice ?? { id, name:String(button.resolve('lbl_spellName')?.text ?? ''), grade:1, icon_id:spell(id)?.iconId ?? 0 }) }
        }
        return original
      },
    })) } })) as RepeaterItem[]
  const resolve:BindingResolver = (b,s) => {
    if(b==='PlayerSpell') return {className:`spell-window spell-window--${mode}`}
    if(b==='ctr_spellList') return {style:{width:'100%',minHeight:0}}
    if(b==='ctr_main') return {style:{flexShrink:0}}
    if(b==='ctr_grid') return {style:{height:'auto',minHeight:0,flex:1}}
    if(b==='ctr_filter') return {style:{flexDirection:mode===1?'row':'column',alignItems:mode===1?'center':'flex-start',height:mode===1?56:100,flexShrink:0,flexWrap:'nowrap',gap:10,padding:'10px 16px',background:'var(--background_medium90)'}}
    if(b==='btn_gameplay') return {text:mode===1?'MÉCANIQUES DE CLASSE':'',style:{width:mode===1?250:32,minWidth:32}}
    if(b==='ctr_footer') return {hidden:compact,style:{height:44,minHeight:44}}
    if(b==='checkboxLine_labelRight') return {text: "Afficher tous les niveaux d’obtention",style:{color:'var(--highlight_primary100)',fontSize:16}}
    if(b==='inp_search') return {text:query,placeholder:'Rechercher…',style:{width:260,height:32,minHeight:32,margin:0,flexShrink:0},onInput:e=>setQuery(e.target.value)}
    if(b==='tabs') return {style:{height:'100%',left:'calc(50% - 120px)',width:240}}
    if(b.startsWith('tabs:')) return {className:Number(b.split(':')[1])===tab?'activeTrue':'activeFalse',onClick:()=>setTab(Number(b.split(':')[1])),style:{width:'50%',height:'100%'}}
    if(b==='tab_label') return {text:s?.endsWith(':1')?'Autres':hud?.character.breed_name}
    if(b==='ctr_filters') return {style:{marginLeft:mode===1?'auto':0,marginTop:0,alignItems:'center',gap:1,flexShrink:0}}
    if(b==='chk_showLevel') return {text:"Afficher tous les niveaux d’obtention",checked:levels,onClick:()=>setLevels(!levels)}
    if(b==='ctr_spellContainer') return {style:{maxHeight:'none',padding:compact?'8px 52px':'6px 24px',gap:compact?88:32,overflowY:'visible'}}
    if(b==='ctr_leftSpellContainer'||b==='ctr_rightSpellContainer') return {style:{width:compact?166:mode===0?'100%':'calc(50% - 16px)',flexGrow:0,alignItems:'stretch'},hidden:mode===0&&b==='ctr_rightSpellContainer'}
    if(b==='ctr_verticalDivider')return {hidden:true}
    return undefined
  }
  const visible = tab===0?pairs:[]
  const repeaters:Repeater = {
    ctr_leftSpellContainer:mode===0?visible:visible.slice(0,Math.ceil(visible.length/2)),
    ctr_rightSpellContainer:mode===0?[]:visible.slice(Math.ceil(visible.length/2)),
    ctr_filters:FILTERS.map(([icon,label,needle])=>({key:icon,template:'IconChoice',resolve:b=>b==='choice_icon'?{sprite:icon}:b==='icon_choice'?{checked:filter===needle,onClick:()=>setFilter(filter===needle?'':needle),tooltip:{tree:'TextTooltip',text:label},style:{background:filter===needle?'var(--highlight_secondary50)':'var(--highlight_secondary25)',borderRadius:0,width:mode===2?26:32,height:mode===2?26:32,padding:2}}:undefined})),
  }
  // View buttons are authored in spellBase; their order is the native enum.
  const baseResolve=resolve
  return { repeaters, resolve: ((b,s)=> {
    if(b==='toggle_icon_Vector' && s?.startsWith('tgl_group:')) return {className:`spell-view-icon spell-view-icon--${s.split(':')[1]}`,style:{color:Number(s.split(':')[1])===mode?'var(--highlight_primary100)':'var(--highlight_secondary100)'}}
    if(b.startsWith('tgl_group:')) return {checked:Number(b.split(':')[1])===mode,onClick:()=>setMode(Number(b.split(':')[1]))}
    return baseResolve(b,s)
  }) as BindingResolver }
}

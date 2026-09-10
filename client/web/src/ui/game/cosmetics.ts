import { useEffect, useState } from 'react'
import type { CharacterHud } from '../../giny/types'
import type { GameAction } from '../../giny/actions'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { ItemTooltipBuilder } from './tooltipBuilders'
import { itemIcon } from './catalog'
import { loadEncyclopediaData } from './encyclopedia'

const TYPES: Record<string, string> = { btnHelmet: 'Chapeau', btnCloak: 'Cape', btnShoulder: 'Épaulière', btnWings: 'Aile', btnWeapons: 'Arme', btnShield: 'Bouclier', btnPet: 'Familier', btnPetsMount: 'Montilier', btnSaddle: 'Harnachement', btnCostums: 'Costume', btnLiving: 'Objet vivant', btnMulti: 'Objet divers' }
export function useCosmetics(active: boolean, hud: CharacterHud | null, onSelect?: (command: GameAction) => void, pending = false) {
  const [data,setData] = useState<Awaited<ReturnType<typeof loadEncyclopediaData>>>()
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('')
  const [names,setNames] = useState(true)
  const [unowned,setUnowned] = useState(true)
  const [ascending,setAscending] = useState(false)
  const [section,setSection] = useState('btnCosmetic')
  const [limit,setLimit] = useState(80)
  useEffect(()=>{ if(active && !data) void loadEncyclopediaData().then(setData).catch(console.warn) },[active,data])
  const owned = new Set(hud?.items.map(item=>item.gid))
  const items = (data?.items ?? []).filter(item => data?.types[item.typeId]?.categoryId === 5 && !!data.types[item.typeId]?.isInEncyclopedia && (!category || data.types[item.typeId]?.name?.includes(category)) && (unowned || owned.has(item.id)) && item.name?.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  if (ascending) items.sort((a,b)=>(a.name??'').localeCompare(b.name??'','fr'))
  const resolve: BindingResolver = binding => {
    if(binding === 'parentOrnaments') return {hidden:section!=='btnCosmeticOrnaments'}
    if(binding === 'parentTitles') return {hidden:section!=='btnCosmeticTitles'}
    if(binding === 'parentAuras') return {hidden:section!=='btnCosmeticAuras'}
    if(binding === 'parentItems') return {hidden:section!=='btnCosmetic'}
    if(['btnCosmetic','btnCosmeticTitles','btnCosmeticOrnaments','btnCosmeticAuras'].includes(binding)) return {checked:section===binding,onClick:()=>setSection(binding)}
    if(binding==='InputSearchField') return {text:query,placeholder:'Recherche',onInput:e=>{setQuery(e.target.value);setLimit(80)}}
    if(binding in TYPES) return {checked:category===TYPES[binding],onClick:()=>{setCategory(category===TYPES[binding]?'':TYPES[binding]);setLimit(80)}}
    if(binding==='chk_obtainedFilter') return {text:'Non obtenus',className:'checkboxLine',checked:unowned,onClick:()=>setUnowned(!unowned)}
    if(binding==='chk_displayNames') return {hidden:false,text:'Masquer les noms',className:'checkboxLine',checked:!names,onClick:()=>setNames(!names)}
    if(binding==='btnSort') return {onClick:()=>setAscending(!ascending)}
    if(binding==='elementsCount') return {hidden:false,text:`${items.length} éléments`,tooltip:{tree:'TextTooltip',text:'Afficher davantage d’éléments'},onClick:()=>setLimit(limit+80)}
    if(binding==='parentDisplayNames')return {hidden:false,style:{display:'flex',flexDirection:'row',alignItems:'center',gap:8}}
    if(binding==='lbl_displayNames')return {hidden:true}
    if(['cb_category','cb_categoryLivingObjects','grid','lbl_emptyBox','btnActionSmall'].includes(binding))return {hidden:true}
    if(binding==='lv_items') return {hidden:false,style:{flex:1,minHeight:0,overflowY:'auto'},onScroll:e=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<200)setLimit(n=>Math.min(n+80,items.length))}}
    if(binding==='lbl_title')return {text:'TENUES'}
    if(binding==='btn_action')return {text:'MES TENUES (0)'}
    if(binding==='btn_actionLeft')return {text:'SAUVEGARDER',disabled:true}
    if(binding==='multiSlot_weapon') return {style:{height:68,overflow:'hidden'}}
    if(binding.startsWith('slot_') && ['slot_shovel','slot_hammer','slot_lance','slot_axe','slot_dagger','slot_scythe','slot_stick','slot_bow','slot_wand'].includes(binding)) return {hidden:true}
    return undefined
  }
  const repeaters: Repeater = { lv_items: Array.from({length:Math.ceil(Math.min(limit,items.length)/4)},(_,line)=>({key:String(line),template:'CosmeticItemLine',resolve:(binding,scope)=>{
    const index=Number((binding.match(/^item(\d)$/)??scope?.match(/^item(\d)$/))?.[1]??0)
    const item=items[line*4+index-1]
    if(/^item\d$/.test(binding)) return {hidden:!item}
    if(!item)return undefined
    if(binding==='itemName')return {text:item.name,hidden:!names,style:{whiteSpace:'normal',fontSize:16,textAlign:'center',alignItems:'center',justifyContent:'center'}}
    if(binding==='gradiant')return {hidden:true}
    if(binding==='ItemIcon')return {sprite:itemIcon({gid:item.id,icon_id:item.iconId})}
    if(binding==='bg') return {hidden:false,style:{background:'#141524',border:'1px solid #42435b',borderRadius:8},tooltip:ItemTooltipBuilder.Build({uid:item.id,gid:item.id,name:item.name??'',quantity:1,position:63,equipped:false,appearance_id:0,icon_id:item.iconId,level:item.level,type_id:item.typeId})}
    if(['ico_favorite','ico_tick','ico_link','newTag','ico_colo','bg_favorite'].includes(binding))return {hidden:true}
    return undefined
  } })) }
  if (onSelect) {
    for (const kind of ['titles', 'ornaments'] as const) {
      const state = hud?.[kind]
      const command = kind === 'titles' ? 'title.select' : 'ornament.select'
      const prefix = kind === 'titles' ? 'title' : 'ornament'
      const cols = kind === 'titles' ? 2 : 4
      const rows = [{ id: 0, name: kind === 'titles' ? 'Aucun titre' : 'Aucun ornement' }, ...(state?.known ?? []).map(id =>
        state?.entries?.find(e => e.id === id) ?? { id, name: `${kind === 'titles' ? 'Titre' : 'Ornement'} ${id}` })]
        .filter(row => row.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
      repeaters[`lv_${kind}`] = Array.from({ length: Math.ceil(rows.length / cols) }, (_, line) => ({
        key: `${kind}-${line}`, template: kind === 'titles' ? 'CosmeticTitleLine' : 'CosmeticOrnamentLine',
        resolve: (binding, scope) => {
          const index = Number(binding.match(new RegExp(`^${prefix}(\\d+)$`))?.[1] ?? scope?.match(new RegExp(`^${prefix}(\\d+)$`))?.[1] ?? 0) - 1
          const row = rows[line * cols + index]
          if (new RegExp(`^${prefix}\\d+$`).test(binding)) return !row ? { hidden: true } : {
            disabled: pending || !hud?.capabilities?.includes(command),
            onClick: () => onSelect({ action: command, args: { id: row.id } }),
            style: { background: row.id === state?.active ? '#626181' : '#24263c', borderRadius: 8 },
          }
          if (!row) return undefined
          if (binding === `${prefix}Name`) return { text: row.name }
          if (binding === 'ico_tick') return { hidden: row.id !== state?.active }
          if (binding === 'ico_favorite' || binding === 'ornamentIcon') return { hidden: true }
          return undefined
        },
      }))
    }
  }
  return {resolve,repeaters}
}

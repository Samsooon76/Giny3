import challengeIcons from './challengeIcons.json'
import './challengeSettings.css'
import themes from '../official/themes.json'
import type { CombatDisplayController } from '../../game/combat/CombatDisplayController'
import { useEffect, useState } from 'react'
import type { CombatState, CombatStatistics } from '../../giny/combatState'
import type { GinyClient } from '../../giny/GinyClient'
import type { CharacterHud, HudSpell } from '../../giny/types'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { item, itemIcon, spell, spellIcon } from './catalog'
import { SpellTooltipBuilder } from './tooltipBuilders'

export type LiveCombat = { display?: CombatDisplayController; state: CombatState; client: GinyClient; busy: boolean; selected: HudSpell | null; select: (spell: HudSpell | null) => void; report: (error: unknown) => void }
const format = (v: string | number) => { try { return BigInt(v).toLocaleString('fr-FR') } catch { return String(v) } }
const challengeIcon = (id:number) => (challengeIcons as Record<string,string>)[String(id)] ?? '/ui-data/icons/challenges.png'
const textTip = (text: string) => ({ tree: 'TextTooltip', text })
// The supplied reference uses the official Tribute palette, scoped to this widget.
const challengeTheme = themes.find(theme => theme.id === 'Tribute')!.tokens
const metrics: Array<[keyof CombatStatistics, string, string]> = [
  ['damage','Dommages infligés','lbl_dmgDoneValue'], ['received','Dommages reçus','lbl_dmgTakenValue'],
  ['heal','Soins émis','lbl_healDoneValue'], ['healed','Soins reçus','lbl_healReceivedValue'], ['kills','Ennemis achevés','lbl_enemiesFinishedValue'],
]

/** Runtime bindings only. Geometry, fonts, sprite slices and window chrome
 * come from the official UXML/USS trees produced by the parser. */
export function useLiveCombat(hud: CharacterHud | null, live?: LiveCombat) {
  const [, refreshDisplay] = useState(0)
  useEffect(() => live?.display?.onChange(() => refreshDisplay(n => n + 1)), [live?.display])
  const [now, setNow] = useState(Date.now()), [tab, setTab] = useState(0), [choice, setChoice] = useState<number | null>(null), [page, setPage] = useState(0), [statsPage,setStatsPage] = useState(0)
  const [compactResult,setCompactResult] = useState(false), [lootPage,setLootPage] = useState(0)
  const state = live?.state, s = state?.snapshot, result = state?.result
  const me = s?.fighters.find(f => f.id === s.controlled_id), mine = result?.participants.find(p => p.id === hud?.character.id)
  const prep = s?.phase === 'preparation', canPlay = s?.phase === 'fighting' && s.active_id === s.controlled_id && !live?.busy
  const seconds = Math.max(0, Math.ceil(((state?.deadline ?? 0) - now) / 1000))
  const spells = [...(s?.spells ?? hud?.spells ?? [])].map(e => ({ ...hud?.spells.find(h => h.id === e.id), ...e, icon_id: e.icon_id ?? spell(e.id)?.iconId }))
    .sort((a,b) => (hud?.shortcuts.find(x=>x.spell_id===a.id)?.slot ?? 999) - (hud?.shortcuts.find(x=>x.spell_id===b.id)?.slot ?? 999))
  const cooldown = (id: number) => Number(s?.cooldowns.find(c => Number(c.spellId) === id)?.cooldown ?? 0)
  const available = (e: HudSpell) => !!canPlay && e.available !== false && (e.ap_cost ?? 0) <= (me?.ap ?? 0) && !cooldown(e.id)
  const run = (action: Parameters<GinyClient['combatCommand']>[0], value = 0) => { try { live?.client.combatCommand(action,value) } catch(e) { live?.report(e) } }
  const dismiss = () => live?.client.dismissCombatResult()
  const endTurn = () => {
    if (state?.proposals.length) return
    live?.select(null)
    if (prep && s?.leader && state?.mode === 0 && !state?.challenges.length && !state?.proposals.length) run('challenges', state?.mode ?? 0)
    else if (prep) run('ready', s?.ready ? 0 : 1)
    else if (canPlay) run('pass')
  }
  useEffect(() => { if (!live) return; const id=setInterval(()=>setNow(Date.now()),200); return ()=>clearInterval(id) }, [!!live])
  useEffect(() => { live?.select(null); setPage(0) }, [s?.active_id,s?.phase,s?.fight_key])
  useEffect(() => { setChoice(null) }, [state?.proposals])
  useEffect(() => { setTab(0); setStatsPage(0); setCompactResult(false); setLootPage(0) }, [result?.key])
  useEffect(() => {
    if (!s) return
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable=true]') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      // Shift+digit belongs to the official Option/showGrid binding (Shift+1):
      // plain digits keep selecting spells, shifted digits never do.
      if (e.shiftKey) return
      if(e.code==='Escape'){ live?.select(null);return }
      if(e.code==='Space'){e.preventDefault();endTurn();return}
      const i=/^Digit[1-9]$/.test(e.code)?Number(e.code.slice(-1))-1:e.code==='Digit0'?9:-1, chosen=spells[page*12+i]
      if(i>=0&&chosen&&available(chosen)){e.preventDefault();live?.select(chosen)}
    }
    addEventListener('keydown',key);return ()=>removeEventListener('keydown',key)
  },[s,live?.busy,live?.selected,page])
  const fightResolve: BindingResolver = b => {
    if(b==='background')return {style:{backgroundColor:'var(--background_medium90)'}}
    if(b==='timeline')return {hidden:false,style:{display:'flex',width:'100%',height:'100%',pointerEvents:'none'}}
    if(b==='tg_tacticalMode')return {checked:live?.display?.tactical??false,disabled:!live?.display,onClick:()=>live?.display?.toggleTactical(),tooltip:textTip('Mode tactique · T')}
    if(b==='ctr_toggles')return {style:{width:218,left:'calc(50% - 109px)'}}
    if(b==='challenge_group')return {style:{position:'absolute',left:16,top:190,width:'auto',pointerEvents:'auto'}}
    if(b==='btn_fold'||b==='tx_options')return {hidden:true}
    if(b==='fightTimelineMagneticDragWindow')return {style:{flexDirection:'row'}}
    if(b==='ctr_counters')return {style:{width:24,height:'100%',flexShrink:0}}
    if(b==='ctr_timelineContent')return {style:{flexDirection:'row'}}
    if(b==='sv_fighters')return {style:{display:'flex',flexDirection:'row',height:80,minHeight:80,marginBottom:0,gap:6}}
    if(b==='lbl_currentTurn'||b==='lbl_turn')return {text:String(s?.turn ?? result?.turn ?? 1)}
    if(['ctr_waves','ctr_animation','ctr_requestHelp','ctr_additionalTurn'].includes(b))return {hidden:true}
    if(b==='lbl_seconds')return {text:`${seconds}s`,style:{textAlign:'center',justifyContent:'center',left:'calc(50% - 45px)',color:seconds<=5?'#ec794b':'var(--highlight_primary100)'}}
    if(b==='lbl_turnCount')return {text:String(prep?0:s?.turn??0)}
    if(b==='ctr_timeGauge')return {hidden:false}
    if(b==='ctr_timerBarValue')return {style:{width:`${Math.min(100,seconds/30*100)}%`}}
    if(b==='lbl_endTurn')return {text:prep ? s?.ready?'PAS PRÊT':s?.leader&&state?.mode===0&&!state?.challenges.length?'CHOISIR LES\nCHALLENGES':'PRÊT' : 'FIN DE TOUR',style:{whiteSpace:'pre-line',textAlign:'center',justifyContent:'center',lineHeight:'22px'}}
    if(b==='btn_EndTurn')return {onClick:endTurn,disabled:!!state?.proposals.length||(!prep&&!canPlay),tooltip:textTip(prep?'Préparation du combat':'Terminer le tour · Espace')}
    if(b==='btn_leave')return {onClick:()=>{if(window.confirm('Abandonner le combat ?'))run('leave')},tooltip:textTip('Quitter le combat')}
    if(b==='tg_lockParty')return {hidden:true}
    if(b.startsWith('tg_'))return {disabled:true}
    if(b==='switch_rewards')return {checked:state?.bonus===1,onClick:()=>run('bonus',state?.bonus===1?0:1),tooltip:textTip(state?.bonus===1?'Bonus de butin':'Bonus d’expérience')}
    if(b==='switchLine_iconLeft')return {onClick:event=>{event.stopPropagation();run('bonus',0)},tooltip:textTip('Bonus d’expérience')}
    if(b==='switchLine_iconRight')return {onClick:event=>{event.stopPropagation();run('bonus',1)},tooltip:textTip('Bonus de butin')}
    if(b==='lbl_rewards')return {text:'RÉCOMPENSES'}
    if(b==='lbl_challenges')return {text:'CHALLENGES'}
    if(b==='rb_challengeChoice'||b==='rb_challengeRandom'){const mode=b==='rb_challengeChoice'?0:1;return {text:mode===0?'Au choix':'Aléatoire',checked:state?.mode===mode,disabled:!s?.leader,sprite:'radioOff',onClick:()=>{if(s?.leader)run('challengeMode',mode)},style:{height:24,minHeight:24,width:'100%',paddingLeft:28,backgroundSize:'36px 36px',backgroundPosition:'-8px center','--official-mask-position':'-8px center',textAlign:'left',justifyContent:'flex-start',fontSize:14,color:state?.mode===mode?'var(--highlight_primary100)':'var(--highlight_secondary100)'}}}
    if(b==='challenge_fake')return {hidden:false,sprite:'questionMarkShadowOutline',style:{width:52,height:52,minWidth:52,flexShrink:0,backgroundColor:'var(--qualitative_blue100, #47c3eb)',backgroundSize:'52px 52px',backgroundPosition:'center'}}
    if(b==='lbl_choiceTitle')return {text:'Choisir un challenge'}
    if(b==='lbl_leaderChoosingChallenge')return {hidden:!!s?.leader}
    if(b==='lbl_nbChall')return {text:state?.proposals.length?'1 challenge':''}
    if(b==='btn_ok')return {disabled:!s?.leader||choice==null,onClick:()=>{if(choice!=null)run('challenge',choice)}}
    const ci=b.match(/^challenge_([01])$/)
    if(ci){const c=state?.proposals[Number(ci[1])];return {hidden:!c,sprite:c?challengeIcon(c.id):undefined,checked:c?.id===choice,style:{backgroundColor:'#47c3eb',backgroundClip:'padding-box',border:'4px solid transparent',borderRadius:5,outline:c?.id===choice?'2px solid var(--highlight_primary100)':'none'},onClick:()=>s?.leader&&c&&setChoice(c.id),tooltip:c?textTip(`${c.name}\n${c.description.replace(/<[^>]+>/g,'')}\n+${c.xp}% XP · +${c.drop}% butin`):undefined}}
    const bonus=b.match(/^lbl_bonus_([01])$/)
    if(bonus){const c=state?.proposals[Number(bonus[1])];return {text:c?`${c.name}\n+${state?.bonus===1?c.drop:c.xp}%`:''}}
    return undefined
  }
  const settingsResolve: BindingResolver = (b,scope) => {
    if(b==='window_challengesSettings')return {style:{...challengeTheme,'--challenge-xp-color':state?.bonus===0?'var(--highlight_primary100)':'var(--highlight_secondary65)','--challenge-loot-color':state?.bonus===1?'var(--highlight_primary100)':'var(--highlight_secondary65)',minWidth:200,maxWidth:200,minHeight:192,maxHeight:192}}
    if(b==='background')return {style:{backgroundColor:'var(--background_medium90)'}}
    if(b==='header')return {style:{height:24,minHeight:24,maxHeight:24,flexShrink:0,flexGrow:0,backgroundColor:'var(--header_background)'}}
    if(b==='content')return {style:{flexGrow:1,minHeight:0}}
    if(b==='ctr_settings')return {style:{padding:12,paddingTop:12,alignItems:'flex-start'}}
    if(b==='ctr_challengesSettings')return {style:{width:116,marginLeft:8,gap:4}}
    if(b==='lbl_rewards'||b==='lbl_challenges')return {text:b==='lbl_rewards'?'RÉCOMPENSES':'CHALLENGES',style:{fontSize:14,lineHeight:'18px',whiteSpace:'nowrap'}}
    if(b==='divider')return {style:{height:4,minHeight:4}}
    if(b==='divider_lineLeft'||b==='divider_lineRight')return {style:{minHeight:1,height:1}}
    if(b==='switch_circle')return {style:{left:state?.bonus===1?20:4,backgroundColor:'var(--highlight_primary100)'}}
    if(b==='switch_background'||b==='switch_Rectangle_344')return {style:{borderColor:'var(--highlight_secondary65)'}}
    return fightResolve(b,scope)
  }
  const timelineRepeaters: Repeater = {sv_fighters:(s?(s.timeline.length?s.timeline.map(id=>s.fighters.find(f=>f.id===id)!).filter(Boolean):s.fighters):[]).map(f=>({
    key:String(f.id),template:'timelineFighter',resolve:b=>{
      if(b==='timelineFighter')return {style:{opacity:f.alive?1:.4},tooltip:textTip(`${f.name} · Niv. ${f.level}\n${f.life}/${f.max_life} PV · ${f.ap} PA · ${f.mp} PM${f.ready&&prep?' · Prêt':''}`)}
      if(b==='ctr_fighterTile')return {style:{backgroundColor:f.team===s?.team?'#3b6780':'#754e57'}}
      if(b==='ctr_ed')return {hidden:false,style:{width:80,height:80}}
      if(b==='ed_player')return {hidden:false,look:f.look,lookMode:f.breed?'portrait':'fit',lookStatic:true,style:{left:6,top:0,width:74,height:80}}
      if(b==='gauge_life')return {value:f.life/Math.max(1,f.max_life)*100,style:{width:6,left:0,marginLeft:0}}
      if(b==='tx_regularTurn')return {hidden:f.id!==s?.active_id}
      if(['tx_monster','gauge_shield','gauge_threshold','lbl_order','lbl_monsterWave','ic_invocation','mask_time','ctr_additionalTurn'].includes(b))return {hidden:true}
      return undefined
    }
  }))}
  const stats=mine&&result?.statistics?.[String(mine.id)]
  const metric=(key:keyof CombatStatistics)=>result?.statistics?String(stats?.[key]??0):'—'
  const resultResolve: BindingResolver = (b,scope) => {
    if(b==='header_titleLabel')return {text:'Combat terminé'}
    if(b==='header_buttonRight'||b==='btn_closeUI')return {onClick:dismiss}
    if(b==='header_buttonHelp')return {hidden:false,onClick:()=>setCompactResult(v=>!v),tooltip:textTip(compactResult?'Agrandir les résultats du combat':'Réduire les résultats du combat')}
    if(b==='lbl_time')return {text:`${Math.floor((result?.duration??0)/60000).toString().padStart(2,'0')}:${Math.floor((result?.duration??0)/1000%60).toString().padStart(2,'0')}`}
    if(b==='lbl_turn')return {text:String(result?.turn??1)}
    if(b==='lbl_percent')return {text:'0%'}
    if(b==='ctr_result')return mine?.outcome===2?undefined:{sprite:'/ui-data/styles/images/background_defeat_banner.png'}
    if(b==='icon_result')return {sprite:mine?.outcome===2?'successShadowOutline':'skullShadowOutline'}
    if(b==='lbl_result')return {text:mine?.outcome===2?'VICTOIRE':mine?.outcome===1?'MATCH NUL':'DÉFAITE'}
    if(['lbl_scoreTitle','lbl_scoreValue','ctr_arena','ctr_waves','ctr_limiter','ctr_currentOmega','ctr_nextOmega','carrousel_challenge','tx_breedSymbol'].includes(b))return {hidden:true}
    if(b==='entityDisplayer')return {look:mine?.look??hud?.character.look,lookMode:'fit'}
    if(b==='lbl_charName')return {text:mine?.name??hud?.character.name}
    const stat=metrics.find(m=>m[2]===b);if(stat)return {text:metric(stat[0])}
    if(b==='lbl_dmgBlockedValue'||b==='lbl_shieldAppliedValue')return {text:'—',tooltip:textTip('Statistique non transmise par le serveur.')}
    if(b==='lbl_kamasValue')return {text:format(mine?.kamas??'0')}
    if(b==='lbl_xp')return {text:`+ ${format(mine?.xp??'0')}`}
    if(b==='lbl_currentLevel')return {text:String(hud?.character.level??mine?.level??1)}
    if(b==='lbl_nextLevel')return {hidden:(hud?.character.level??1)>=200,text:String(Math.min(200,(hud?.character.level??1)+1))}
    if(b==='gaugeXp')return {value:hud?100*(hud.experience.current-hud.experience.floor)/Math.max(1,hud.experience.next-hud.experience.floor):0}
    if(b==='lbl_noLoot')return {hidden:!!mine?.loot.length}
    if(b==='ctr_lootValue')return {hidden:true}
    if(b==='list_enemies')return {style:{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:6}}
    if(b==='gd_items')return {style:{position:'relative',height:'auto',minHeight:48,alignContent:'flex-start'}}
    if(b==='tab_label'&&scope==='tab_myCharacter')return {text:'Personnage'}
    if(b==='tab_myCharacter'||b==='tab_resume'||b==='tab_statistics'){const i=['tab_myCharacter','tab_resume','tab_statistics'].indexOf(b);return {className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}}
    return undefined
  }
  const loot: Repeater = {gd_items:(mine?.loot??[]).map(l=>({key:String(l.gid),template:'EncyclopediaLootSlot',resolve:b=>b==='loot_slot'?{sprite:itemIcon({gid:l.gid}),quantity:l.quantity,tooltip:textTip(`${item(l.gid)?.name??`Objet ${l.gid}`} ×${l.quantity}`)}:undefined})),list_enemies:(result?.participants.filter(p=>p.outcome!==mine?.outcome)??[]).map(p=>({key:String(p.id),template:'fightResultMonsterLine',resolve:b=>b==='tile'?{look:p.look,lookMode:'fit',lookStatic:true,tooltip:textTip(`${p.name} · Niv. ${p.level}`)}:b==='lbl_name'||b==='lbl_lvl'?{hidden:true}:undefined}))}
  const compactResolve: BindingResolver = (b,scope) => {
    if(b==='fightResultSimple')return {hidden:false}
    if(b==='FightResultSimple')return {style:{...challengeTheme,overflow:'visible',isolation:'isolate'}}
    if(b==='window_background')return {style:{backgroundColor:'var(--background_dark95)',boxShadow:'none'}}
    if(b==='window_shadow')return {style:{zIndex:-1,boxShadow:'none'}}
    if(b==='window_inner')return {style:{boxShadow:'none'}}
    if(b==='header')return {style:{backgroundColor:'var(--header_background)'}}
    if(b==='header_titleLabel'||b==='header_ornament_left'||b==='header_ornament_right')return {hidden:true}
    // The banner intentionally overhangs the official secondary header.
    if(b==='window_content')return {style:{overflow:'visible',height:'auto'}}
    if(b==='ctr_main')return {style:{height:90}}
    if(b==='tx_fightResultBanner')return {sprite:mine?.outcome===2?'/ui-data/styles/images/background_levelup_banner.png':'/ui-data/styles/images/background_defeat_banner.png',style:{left:'calc(50% - 159px)'}}
    if(b==='lbl_fightResultTitle')return {text:mine?.outcome===2?'VICTOIRE':mine?.outcome===1?'MATCH NUL':'DÉFAITE'}
    if(b==='tx_fightResultTitle')return {sprite:mine?.outcome===2?'successShadowOutline':'skullShadowOutline'}
    if(b==='lbl_xp')return {text:format(mine?.xp??'0')}
    if(b==='lbl_kamas')return {text:format(mine?.kamas??'0')}
    if(b==='sv_drop')return {style:{flexGrow:0,overflow:'hidden'}}
    if(b==='ctr_dropContent')return {style:{height:56,gap:8}}
    if(b==='ctr_dropScroll'||b==='ctr_divider')return {hidden:!mine?.loot.length}
    if(b==='btn_left'||b==='btn_right')return {hidden:(mine?.loot.length??0)<=4,disabled:b==='btn_left'?lootPage===0:(lootPage+1)*4>=(mine?.loot.length??0),onClick:()=>setLootPage(p=>Math.max(0,Math.min(Math.ceil((mine?.loot.length??0)/4)-1,p+(b==='btn_left'?-1:1))))}
    return resultResolve(b,scope)
  }
  const compactRepeaters: Repeater = {ctr_dropContent:(mine?.loot??[]).slice(lootPage*4,(lootPage+1)*4).map(l=>({
    key:String(l.gid),template:'EncyclopediaLootSlot',resolve:b=>{
      if(b==='loot_slot')return {sprite:itemIcon({gid:l.gid}),quantity:l.quantity,style:{width:56,height:56,minWidth:56,flexShrink:0,backgroundColor:'var(--background_medium100)'},tooltip:textTip(`${item(l.gid)?.name??`Objet ${l.gid}`} ×${l.quantity}`)}
      if(b==='itemTile_counter')return {style:{left:4,top:2,right:'auto',bottom:'auto'}}
      return undefined
    },
  }))}
  const statistics: Repeater={gd_stats:metrics.map(([key,label])=>({key,template:'fightResultStatsItemLine',resolve:b=>b==='lbl_statName'?{text:label}:b.startsWith('lbl_statsValuePlayer')?{text:result?.statistics?String(result.statistics[String(result.participants[statsPage*8+Number(b.slice(-1))-1]?.id)]?.[key]??0):'—',hidden:statsPage*8+Number(b.slice(-1))>(result?.participants.length??0)}:undefined}))}
  const summary: Repeater = Object.fromEntries(['section_winner','section_losers'].map((section,i)=>[section,[{
    key:section,template:'fightResultSection',resolve:b=>b==='sectionHeader_titleLabel'?{text:i===0?'Vainqueurs':'Vaincus'}:b==='gd_list'?{style:{height:'auto',minHeight:65}}:undefined,
    repeaters:{gd_list:(result?.participants.filter(p=>i===0?p.outcome===2:p.outcome!==2)??[]).map(p=>({
      key:String(p.id),template:'fighterResultLine',resolve:b=>{
        if(b==='lbl_fighterName')return {text:p.name}
        if(b==='lbl_fighterLevel')return {text:String(p.level)}
        if(b==='lbl_fighterXpEarn')return {text:format(p.xp)}
        if(b==='lbl_fighterKamasEarn')return {text:format(p.kamas)}
        if(b==='tx_fighterHeadSlot')return {look:p.look,lookMode:'portrait',lookStatic:true}
        if(b==='tx_deathPicto')return {hidden:p.alive}
        if(['omega','gauge_fighterLevel','ctr_details','tx_showDetails'].includes(b))return {hidden:true}
        return undefined
      },repeaters:{ctr_loots:p.loot.map(l=>({key:String(l.gid),template:'EncyclopediaLootSlot',resolve:b=>b==='loot_slot'?{sprite:itemIcon({gid:l.gid}),quantity:l.quantity,tooltip:textTip(item(l.gid)?.name??`Objet ${l.gid}`)}:undefined}))}
    }))}
  }]]))
  const repeaters: Repeater={tab_content:result?[{key:String(tab),template:['fightResultCharacterTab','fightResultResumeTab','fightResultStatsTab'][tab],resolve:(b,scope)=>{
    if(tab===2&&b==='btn_prevPlayer')return {disabled:statsPage===0,onClick:()=>setStatsPage(v=>Math.max(0,v-1))}
    if(tab===2&&b==='btn_nextPlayer')return {disabled:(statsPage+1)*8>=result.participants.length,onClick:()=>setStatsPage(v=>Math.min(Math.ceil(result.participants.length/8)-1,v+1))}
    if(tab===2&&b==='lbl_statHeader')return {text:'Statistiques du combat'}
    if(tab===2&&/^fighterIllu\d$/.test(b)){const p=result.participants[statsPage*8+Number(b.slice(-1))-1];return {hidden:!p,tooltip:p?textTip(p.name):undefined}}
    if(tab===2&&b==='tx_fighter'){const i=statsPage*8+Number(scope?.match(/fighterIllu(\d)/)?.[1]??1)-1;return {look:result.participants[i]?.look,lookMode:'portrait',lookStatic:true}}
    return resultResolve(b,scope)
  },repeaters:tab===0?loot:tab===1?summary:statistics}]:[]}
  const resolveHud = (tree:string):BindingResolver => (b,scope) => {
    if(!s||tree!=='actionBar')return undefined
    if(b==='gd_spellitemotes')return {repeat:12,style:{height:48,flexWrap:'nowrap'}}
    if(b==='ctr_pages')return {hidden:spells.length<=12}
    if(b==='lbl_pageIndex')return {text:String(page+1)}
    if(b==='btn_prev')return {disabled:page===0,onClick:()=>setPage(v=>Math.max(0,v-1))}
    if(b==='btn_next')return {disabled:(page+1)*12>=spells.length,onClick:()=>setPage(v=>v+1)}
    const i=Number(scope?.match(/^gd_spellitemotes:(\d+)$/)?.[1]??b.match(/^slot_(\d+)$/)?.[1]??-1),e=spells[page*12+i]
    if(i<0)return undefined
    if(['itemTile_icon','itemTile_icon_Vector','itemTile_container'].includes(b))return {sprite:e?spellIcon(e.icon_id,spell(e.id)?.picto):''}
    if(/^slot_\d+$/.test(b))return {disabled:!e||!available(e),state:e?.id===live?.selected?.id?'selected':undefined,onClick:()=>e&&available(e)&&live?.select(e.id===live.selected?.id?null:e),tooltip:e?SpellTooltipBuilder.Build(e,i<10?String((i+1)%10):undefined):undefined,quantity:e&&cooldown(e.id)?cooldown(e.id):undefined}
    return undefined
  }
  const challengeRepeaters: Repeater = {challenge_list:(state?.challenges??[]).map(c=>({key:String(c.id),template:'challengeGridSlot',resolve:b=>b==='slot_challengeIcon'?{sprite:challengeIcon(c.id),tooltip:textTip(`${c.name} · ${c.state===0?'Réussi':c.state===1?'Échoué':'En cours'}\n${c.description.replace(/<[^>]+>/g,'')}\n+${c.xp}% XP · +${c.drop}% butin`),style:{opacity:c.state===1?.45:1,backgroundColor:'#47c3eb',backgroundClip:'padding-box',border:'4px solid transparent',borderRadius:5}}:b==='tx_challengeResult'?{hidden:c.state===2,sprite:c.state===0?'/ui-data/themes/darkStone/sprites/filter_iconChallenge_check.png':'/ui-data/themes/darkStone/sprites/filter_iconChallenge_cross.png'}:undefined}))}
  const layers=s?[{tree:'FightTimeline',resolve:fightResolve,repeaters:timelineRepeaters},{tree:'EndTurnWidget',resolve:fightResolve},...(state?.challenges.length?[{tree:'challengeGroup',resolve:fightResolve,repeaters:challengeRepeaters}]:[]),...(prep&&!state?.challenges.length?[{tree:state?.proposals.length?'challengeChoiceDisplay':'challengeSettingsDisplay',resolve:state?.proposals.length?fightResolve:settingsResolve}]:[])]:[]
  return {layers,resolveHud,me,result:result&&!live?.busy?result:null,resultResolve,repeaters,compactResult,compactResolve,compactRepeaters,dismiss}
}

/** Module-specific C# menu states, transcribed from the official references.
 * Shared window placement remains in layoutStore; these are display preferences. */
export type ModuleOptions = {
  hp: 'remaining' | 'total' | 'percent'; small: boolean; showInitiative: boolean
  rows: number; combatSpells: boolean; emptyBar: boolean
  gauge: 'character' | 'guild' | 'pods' | 'energy'; gaugeColor: string; limitXp: boolean
  timestamps: boolean; chatFont: number; chatSpacing: number; chatOpacity: number; largeMenuIcons: boolean; largeChatTabs: boolean
}
export const DEFAULT_MODULE_OPTIONS: ModuleOptions = { hp:'total',small:false,showInitiative:false,rows:1,combatSpells:true,emptyBar:false,gauge:'character',gaugeColor:'#eaff4d',limitXp:true,timestamps:true,chatFont:14,chatSpacing:1.2,chatOpacity:0.9,largeMenuIcons:false,largeChatTabs:false }
const KEY='giny.module-options.v1'
let state:Record<string,ModuleOptions>={}
try { const stored=JSON.parse(localStorage.getItem(KEY)??'{}'); if(stored&&typeof stored==='object')state=stored } catch { /* private mode */ }
const listeners=new Set<()=>void>()
const appliedDensityPresets = new Set<string>()
export function sanitizeModuleOptions(value: Partial<ModuleOptions>): ModuleOptions {
  const result = {...DEFAULT_MODULE_OPTIONS}
  for (const key of ['small','showInitiative','combatSpells','emptyBar','limitXp','timestamps','largeMenuIcons','largeChatTabs'] as const) if(typeof value[key] === 'boolean') result[key] = value[key]
  if(['remaining','total','percent'].includes(String(value.hp))) result.hp = value.hp!
  if(['character','guild','pods','energy'].includes(String(value.gauge))) result.gauge = value.gauge!
  if(Number.isInteger(value.rows) && value.rows! >= 1 && value.rows! <= 4) result.rows = value.rows!
  if([14,16,18,20].includes(value.chatFont!)) result.chatFont = value.chatFont!
  if([1,1.2,1.5,2].includes(value.chatSpacing!)) result.chatSpacing = value.chatSpacing!
  if([0.3,0.6,0.9].includes(value.chatOpacity!)) result.chatOpacity = value.chatOpacity!
  if(/^#[0-9a-f]{6}$/i.test(value.gaugeColor ?? '')) result.gaugeColor = value.gaugeColor!
  return result
}
export const moduleOptions={
  applyChatDensityPreset(version:string){
    const key=`${KEY}.density.${version}`
    if(appliedDensityPresets.has(key))return
    try { if(localStorage.getItem(key)){appliedDensityPresets.add(key);return} } catch {/* memory only */}
    const previous=state
    const chat=moduleOptions.get('Chat')
    appliedDensityPresets.add(key)
    if(chat.chatFont===16)moduleOptions.set('Chat',{chatFont:14})
    try { localStorage.setItem(`${key}.backup`,JSON.stringify(previous));localStorage.setItem(key,'1') } catch {/* memory only */}
  },
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
  snapshot:()=>state,
  get(id:string):ModuleOptions{return sanitizeModuleOptions(state[id.toLowerCase()] ?? {})},
  set(id:string,patch:Partial<ModuleOptions>){state={...state,[id.toLowerCase()]:sanitizeModuleOptions({...moduleOptions.get(id),...patch})};try{localStorage.setItem(KEY,JSON.stringify(state))}catch{/* memory only */}for(const fn of listeners)fn()},
}
export type ModuleOptionRow={label:string;key:keyof ModuleOptions;value:string|boolean|number;section?:string;disabled?:boolean}
export function moduleOptionRows(id:string):ModuleOptionRow[]{
  const name=id.toLowerCase()
  if(name.includes('characterinformation'))return [
    {label:'Grand module',key:'small',value:false},{label:'Petit module',key:'small',value:true},{label:'Points d’invocation',key:'showInitiative',value:true},
    {label:'PV restants',key:'hp',value:'remaining',section:'AFFICHAGE DES POINTS DE VIE'},{label:'PV restants et totaux',key:'hp',value:'total'},{label:'Pourcentage de PV restants',key:'hp',value:'percent'},
  ]
  if(name.includes('actionbar'))return [
    ...[1,2,3,4].map(value=>({label:`${value} ligne${value>1?'s':''}`,key:'rows' as const,value,section:value===1?'NOMBRE DE LIGNES':undefined})),
    {label:'Afficher par défaut les sorts en combat',key:'combatSpells',value:true,disabled:true},{label:'Vider la barre',key:'emptyBar',value:true},{label:'Restaurer la barre',key:'emptyBar',value:false},
  ]
  if(name.includes('progressgauge'))return [
    {label:'Limiter le pourcentage d’expérience obtenue (100%)',key:'limitXp',value:true,disabled:true},
    {label:'Expérience de personnage',key:'gauge',value:'character',section:'GESTION DES JAUGES'}, {label:'Expérience de guilde',key:'gauge',value:'guild'}, {label:'Pods',key:'gauge',value:'pods'}, {label:'Points d’énergie',key:'gauge',value:'energy'},
  ]
  if(name.includes('chat'))return [{label:'Afficher l’heure des messages',key:'timestamps',value:true},...[14,16,18,20].map(value=>({label:`Taille du texte : ${value}`,key:'chatFont' as const,value}))]
  return []
}
export function moduleOptionSelected(row:ModuleOptionRow,prefs:ModuleOptions){return prefs[row.key]===row.value}
export function activateModuleOption(id:string,row:ModuleOptionRow){
  const current=moduleOptions.get(id)
  const toggle=['showInitiative','combatSpells','limitXp','timestamps','largeMenuIcons','largeChatTabs'].includes(row.key)
  moduleOptions.set(id,{[row.key]:toggle?!current[row.key]:row.value})
}

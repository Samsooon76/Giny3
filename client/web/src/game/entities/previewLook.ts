import { registerDocumentCache } from '../assets/documentBudgets'
import { cancellable, type LoadOptions } from '../assets/TaskQueue'
import { DocumentCache } from '../assets/DocumentCache'
import { entityManifest } from './clipLoader'
import { gameDataUrl } from '../../data/assetUrl'
import { adaptEntityDocument } from './adapter'
import { parseEntityLook } from './look'
import { normalizeLegacyPlayerScale } from './legacyScale'
import { loadEntityLook } from './loader'
import { parseEntityJson } from './parseEntityJson'
import { DEFAULT_ENTITY_DOCUMENT } from './types'

type Node = Record<string, unknown>
type Document = { parts: Record<string,Node>; animations: Record<string,{frames:Node[][];[key:string]:unknown}>; [key:string]:unknown }
const bases = new DocumentCache<string, Document>(1, 24 * 1024 * 1024, doc => JSON.stringify(doc).length * 2)
registerDocumentCache('portraitBases', bases)
const skins = new DocumentCache<number, Record<string, Node>>(64, 16 * 1024 * 1024, parts => JSON.stringify(parts).length * 2)
registerDocumentCache('portraitSkins', skins)
async function skin(id: number, options: LoadOptions) {
  return skins.get(id, async signal => {
    const response = await fetch(gameDataUrl(`entities/skins/${id}.json`), { signal })
    if (!response.ok) throw new Error(`Skin ${id} : HTTP ${response.status}`)
    return (parseEntityJson(await response.text()) as { parts: Record<string, Node> }).parts
  }, options)
}

/** The current bone-1 exporter can return a transition-only document. UI
 * portraits need the composed standing skeleton, with the requested skins
 * resolved onto its generic slots. Keep this preview pose separate from the
 * gameplay animation loader (which must retain movement/combat clips). */
export async function loadEntityPreviewLook(look:string, options: LoadOptions = {}) {
  const loaded=await loadEntityLook(look, options)
  const parsed=normalizeLegacyPlayerScale(parseEntityLook(look))
  if(parsed?.boneId!==1 || loaded.animations.AnimStatiqueExplo0_1)return loaded
  const source = await bases.get('preview', async signal => {
    const manifest = await cancellable(entityManifest(), signal)
    const response = await fetch(gameDataUrl(manifest?.previews[DEFAULT_ENTITY_DOCUMENT] ?? DEFAULT_ENTITY_DOCUMENT), { signal })
    if (!response.ok) throw new Error('Squelette de prévisualisation indisponible')
    return parseEntityJson(await response.text()) as Document
  }, options)
  const layers = await Promise.all(parsed.skinIds.map(id => skin(id, options)))
  const parts={...source.parts}
  const slots=new Map<string,string>()
  layers.forEach((layer,i)=>Object.entries(layer).forEach(([name,part])=>{
    const ref=`preview-${i}/${name}`
    parts[ref]=part
    slots.set(name.toLowerCase(),ref)
  }))
  const animations=Object.fromEntries(Object.entries(source.animations).filter(([name])=>name.startsWith('AnimStatiqueExplo0_')).map(([name,anim])=>[name,{...anim,frames:anim.frames.map(frame=>frame.map(node=>{
    const ref=slots.get(String(node.slot_name??'').toLowerCase())
    if(!ref || node.superseded)return node
    return {...node,part_ref:ref,visible:true,drawable:true}
  }))}]))
  const result=adaptEntityDocument({...source,parts,animations})
  result.look=parsed
  return result
}

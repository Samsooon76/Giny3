// Package only referenced images. AVIF bytes remain byte-for-byte identical.
import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { J as decode } from '../public/bubble/runtime/data-loader-utils-Btf16hSR.js'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const cache = path.join(root, 'bubble/BubbleGame')
const data = path.join(root, 'client/web/public/bubble/data/map3')
const source = path.join(root, 'client/web/runtime-assets/bubble-source-packs')
await fs.mkdir(source, { recursive: true })
const entries = new Map()
for await (const name of fs.glob('sources/*/manifests/*/objects/*.json', { cwd:cache })) {
  let bytes = await fs.readFile(path.join(cache,name)); if(bytes[0]===31 && bytes[1]===139) bytes=gunzipSync(bytes)
  for(const [key,entry] of Object.entries(JSON.parse(bytes).assets ?? {})) if(key.startsWith('map3/packs/')) entries.set(key,entry)
}
async function original(name) {
  const entry=entries.get('map3/packs/'+name)
  if(!entry) throw new Error('Unknown source pack: '+name)
  const dest=path.join(source,name)
  try { await fs.access(dest) } catch {
    const prepared=path.join(data,'packs',name)
    try { await fs.rename(prepared,dest) } catch(error) {
      if(error.code!=='ENOENT') throw error
      const c=entry.carrier, blob=path.join(cache,`blobs/sha256/${entry.hash.slice(0,2)}/${entry.hash}`)
      let stream
      try {
        const carrier = c?.kind==='pack' ? path.join(cache,`packs/sha256/${c.packHash.slice(0,2)}/${c.packHash}.pack`) : blob
        await fs.access(carrier)
        stream=createReadStream(carrier,c?.kind==='pack'?{start:c.offset,end:c.offset+c.length-1}:undefined)
      } catch {
        const response=await fetch('https://bubble-cdn.net/assets/map3/packs/'+name,{signal:AbortSignal.timeout(120000)})
        if(!response.ok) throw new Error(name+': HTTP '+response.status)
        stream=Readable.fromWeb(response.body)
      }
      const hash=createHash('sha256')
      await pipeline(stream,new Transform({transform(chunk,_,done){hash.update(chunk);done(null,chunk)}}),createWriteStream(dest+'.tmp'))
      if(hash.digest('hex')!==entry.hash) throw new Error('Invalid pack digest: '+name)
      await fs.rename(dest+'.tmp',dest)
    }
  }
  const hash=createHash('sha256'); for await(const chunk of createReadStream(dest)) hash.update(chunk)
  if(hash.digest('hex')!==entry.hash) throw new Error('Invalid source: '+name)
  return dest
}
const index=JSON.parse(await fs.readFile(await original('gfx-index.json'),'utf8'))
const ids=new Set(), maps=[]
for await(const filename of fs.glob('maps/*/map.bin',{cwd:data})) {
  const map=decode(new Uint8Array(await fs.readFile(path.join(data,filename))));maps.push(map.mapId)
  for(const layer of ['background','sortable','foreground']) for(const id of Object.keys(map.materialGroups[layer].atlas.rects)) ids.add(id)
}
const packs=new Map()
for(const id of ids){const entry=index.gfx[id];if(!entry)throw new Error('Missing GFX '+id);if(!packs.has(entry.pack))packs.set(entry.pack,await original(entry.pack))}
const target=path.join(data,'packs');await fs.mkdir(target,{recursive:true})
const output=await fs.open(path.join(target,'giny-selected.avif.pack.tmp'),'w')
const gfx={...index.gfx}, sources={};let offset=0
try {
  for(const id of [...ids].sort((a,b)=>Number(a)-Number(b))){
    const e=index.gfx[id],f=await fs.open(packs.get(e.pack));const bytes=Buffer.alloc(e.length)
    try{const read=await f.read(bytes,0,bytes.length,e.offset);if(read.bytesRead!==bytes.length)throw new Error('Truncated GFX '+id)}finally{await f.close()}
    await output.write(bytes);gfx[id]={pack:'giny-selected.avif.pack',offset,length:bytes.length};offset+=bytes.length
    sources[id]={sourcePack:e.pack,sourceOffset:e.offset,sha256:createHash('sha256').update(bytes).digest('hex')}
  }
}finally{await output.close()}
await fs.rename(path.join(target,'giny-selected.avif.pack.tmp'),path.join(target,'giny-selected.avif.pack'))
await fs.writeFile(path.join(target,'gfx-index.json'),JSON.stringify({version:index.version,format:index.format,mime:index.mime,gfx}))
await fs.writeFile(path.join(data,'../../pack-provenance.json'),JSON.stringify({maps,images:ids.size,bytes:offset,sourcePacks:Object.fromEntries([...packs.keys()].map(n=>[n,entries.get('map3/packs/'+n).hash])),imagesProvenance:sources},null,2))
console.log(JSON.stringify({maps,images:ids.size,bytes:offset,sourcePacks:packs.size}))

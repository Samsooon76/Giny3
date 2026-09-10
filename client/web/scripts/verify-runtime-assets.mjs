import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'runtime-assets/catalog/client/creation_catalog.json',
  'runtime-assets/catalog/data/skinslotsrules.json.gz',
  'runtime-assets/catalog/data/npcs.json',
  'runtime-assets/catalog/data/spells.json',
  'runtime-assets/catalog/pictos/index.json',
  'runtime-assets/ui/manifest.json',
  'public/bubble/data/manifest.json',
]
for (const name of required) {
  const file = path.join(web, name)
  let raw
  try { raw = await fs.readFile(file) } catch (error) {
    if (error.code !== 'ENOENT' || name.endsWith('.gz')) throw error
    raw = await fs.readFile(file + '.gz')
  }
  JSON.parse(raw[0] === 31 && raw[1] === 139 ? gunzipSync(raw).toString() : raw.toString())
}
for (const dir of ['runtime-assets/ui/trees', 'runtime-assets/uitk/trees', 'runtime-assets/catalog/worldmaps', 'runtime-assets/bubble-source-packs']) {
  if (!(await fs.readdir(path.join(web, dir))).length) throw new Error('Empty runtime directory: ' + dir)
}
const provenance = JSON.parse(await fs.readFile(path.join(web, 'public/bubble/runtime-provenance.json'), 'utf8'))
for (const [name, expected] of Object.entries(provenance.output_sha256)) {
  const bytes = await fs.readFile(path.join(web, 'public/bubble/runtime', name))
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Modified native module: ' + name)
}
for (const name of ['vite.config.ts', 'electron/main.mjs', 'src/ui/EntityPreview.tsx']) {
  const code = await fs.readFile(path.join(web, name), 'utf8')
  if (/dofus3\/(?:output|\.cache)|loadEntityPreviewLook|extractorPlugin/.test(code)) throw new Error('Legacy dependency: ' + name)
}
console.log('Runtime catalogs, UI and verified Bubble modules are present; no legacy runtime roots.')

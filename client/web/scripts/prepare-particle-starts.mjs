/** Generate particle startup states offline, with resumable checkpoints. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { build } from 'vite'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] }
if (args.includes('--help')) {
  console.log('node scripts/prepare-particle-starts.mjs --input <game-data or world cache> --output <staging root> [--maps 1,2] [--force]')
  process.exit(0)
}
const input = path.resolve(option('--input', path.join(root, '../dofus3/.cache/dofus3/world')))
const output = path.resolve(option('--output', input))
const digest = value => createHash('sha256').update(value).digest('hex')
const exists = async file => { try { await fs.access(file); return true } catch { return false } }
const read = async file => {
  const actual = await exists(file) ? file : `${file}.gz`
  const bytes = await fs.readFile(actual)
  return JSON.parse((actual.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString())
}
const atomic = async (file, bytes) => {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await fs.writeFile(temporary, bytes); await fs.rename(temporary, file)
}
const manifestPath = path.join(output, 'optimized/particle-starts-manifest.json')
let manifest = { format: 'giny.particle-starts.v1', maps: {} }
if (await exists(manifestPath)) manifest = await read(manifestPath)
if (manifest.format !== 'giny.particle-starts.v1') throw new Error('Unsupported particle manifest')
const bundleDir = path.join(root, 'node_modules/.cache/particle-start-preparer')
await build({ configFile: false, root, publicDir: false, logLevel: 'error', build: {
  ssr: path.join(root, 'scripts/particle-start-runtime.ts'), outDir: bundleDir, emptyOutDir: true,
  rollupOptions: { external: ['pixi.js'], output: { entryFileNames: 'runtime.mjs' } },
} })
const runtimePath = path.join(bundleDir, 'runtime.mjs')
const generatorHash = digest(await fs.readFile(runtimePath))
const { prepareParticleStarts } = await import(pathToFileURL(runtimePath).href)
const prepared = await exists(path.join(input, 'optimized/manifest.json')) || await exists(path.join(input, 'optimized/manifest.json.gz'))
  ? await read(path.join(input, 'optimized/manifest.json')) : null
let maps = option('--maps', '').split(',').filter(Boolean)
if (!maps.length) maps = prepared ? Object.keys(prepared.maps) : (await fs.readdir(path.join(input, 'maps'))).filter(name => /^\d+\.json(?:\.gz)?$/.test(name)).map(name => name.split('.')[0])
maps = [...new Set(maps)].sort((a, b) => Number(a) - Number(b))
let generated = 0, resumed = 0, stateBytes = 0
const checkpoint = async () => {
  const bytes = Buffer.from(JSON.stringify(manifest))
  await atomic(manifestPath, bytes); await atomic(`${manifestPath}.gz`, gzipSync(bytes))
}
for (const [index, id] of maps.entries()) {
  const relative = prepared?.maps[id]?.path ?? `maps/${id}.json`
  if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`Invalid map path: ${relative}`)
  const raw = await read(path.join(input, relative)), inputHash = digest(JSON.stringify(raw.particles ?? []))
  const cached = manifest.maps[id]
  if (!args.includes('--force') && cached?.generatorHash === generatorHash && cached.inputHash === inputHash
    && (await Promise.all(Object.values(cached.variants).map(relative => exists(path.join(output, `${relative}.gz`))))).every(Boolean)) resumed++
  else {
    const result = await prepareParticleStarts(raw), variants = {}
    for (const [variant, state] of Object.entries(result.variants)) {
      const bytes = Buffer.from(JSON.stringify(state)), hash = digest(bytes)
      const relative = `optimized/particle-starts/${id}-${variant.replace(':', '-')}-${hash}.json`
      await atomic(path.join(output, `${relative}.gz`), gzipSync(bytes))
      variants[variant] = relative; stateBytes += bytes.length
    }
    manifest.maps[id] = { sourceHash: result.sourceHash, inputHash, generatorHash, variants }; generated++
  }
  if ((index + 1) % 32 === 0 || index + 1 === maps.length) {
    await checkpoint()
    console.log(JSON.stringify({ completed: index + 1, total: maps.length, generated, resumed, stateBytes }))
  }
}
const preparedOutput = path.join(output, 'optimized/manifest.json')
if (await exists(preparedOutput) || await exists(`${preparedOutput}.gz`)) {
  const main = await read(preparedOutput)
  main.particleStartsManifest = 'optimized/particle-starts-manifest.json'
  const bytes = Buffer.from(JSON.stringify(main))
  await atomic(preparedOutput, bytes); await atomic(`${preparedOutput}.gz`, gzipSync(bytes))
}

/** Local, resumable data preparation. No runtime extraction is involved. */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetPython = path.resolve(root, '../dofus3/.venv-assets/bin/python')
const extractor = path.resolve(root, '../dofus3/scripts/extract-world.py')
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
  })
}
await run(process.env.GINY_EXTRACTOR_PYTHON || 'python3', [extractor])
await run(process.env.GINY_EXTRACTOR_PYTHON || 'python3', ['scripts/prepare-postprocess-textures.py'])
await run(assetPython, ['scripts/prepare-world-textures.py'])
await run(assetPython, ['scripts/prepare-world-props.py'])
// The global atlas experiment was abandoned: keep the published texture layout.
await run(process.execPath, ['scripts/prepare-particle-starts.mjs'])
await run(assetPython, ['scripts/publish-world.py', ...process.argv.slice(2)])

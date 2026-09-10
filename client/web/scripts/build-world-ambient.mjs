/** Offline update of the existing local release. Never called by the game. */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.GINY_EXTRACTOR_PYTHON || 'python3'
for (const [script, ...args] of [
  ['prepare-map-effect-textures.py'], ['recover-map-prop-clips.py'], ['prepare-world-ambient.py', '--publish'],
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(python, [path.join(root, 'scripts', script), ...args], { cwd: root, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script}: exit ${code}`)))
  })
}

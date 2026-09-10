import { _electron as electron, expect, test } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const root = path.resolve(import.meta.dirname, '..')
test('Electron renders native Bubble maps and reads compact packs through app: byte ranges', async () => {
  test.setTimeout(120_000)
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'giny-bubble-e2e-'))
  const app = await electron.launch({ args: [`--user-data-dir=${profile}`, root], env: { ...process.env, GINY_DIST_ROOT: path.join(root, 'dist-benchmark'), GINY_VITE_URL: '', GINY_ALLOW_RUNTIME_EXTRACTION: '0' } })
  try {
    const page = await app.firstWindow()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const textures of ['', '&textures=lossless']) for (const map of [204998153, 154010371, 153358338]) {
      await page.goto(`app://-/index.html?map=${map}&benchmark=1${textures}`)
      await page.waitForFunction(() => {
        const snapshot = (window as unknown as { __ginyPerformance?: () => { loading: boolean; frames: number } }).__ginyPerformance?.()
        return snapshot && !snapshot.loading && snapshot.frames > 3
      }, undefined, { timeout: 45000 })
      const result = await page.evaluate(() => {
        const stats = (window as unknown as { __ginyPerformance: () => { backend: string; mapId: number; nativeActors: { actors: { texturesReady: boolean }[] }; bench: { mapTextureFailures: { total: number }; effectTextureFailures: { total: number } } } }).__ginyPerformance()
        return { backend: stats.backend, map: stats.mapId, ready: stats.nativeActors.actors.every(actor => actor.texturesReady), count: stats.nativeActors.actors.length, missing: stats.bench.mapTextureFailures.total + stats.bench.effectTextureFailures.total }
      })
      expect(result).toEqual({ backend: 'bubble-native', map, ready: true, count: 1, missing: 0 })
    }
    const range = await page.evaluate(async () => {
      const response = await fetch('/bubble/data/map3/packs/giny-selected.avif.pack', { headers: { Range: 'bytes=0-15' } })
      return { status: response.status, range: response.headers.get('content-range'), length: (await response.arrayBuffer()).byteLength }
    })
    expect(range.status).toBe(206); expect(range.length).toBe(16); expect(range.range).toMatch(/^bytes 0-15\//)
    expect(errors).toEqual([])
    await page.screenshot({ path: path.join(root, '../../output/playwright/bubble-electron.png') })
  } finally { await app.close(); await fs.rm(profile, { recursive: true, force: true }) }
})

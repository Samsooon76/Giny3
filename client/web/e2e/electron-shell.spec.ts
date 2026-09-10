import { verifyNativeFocus } from './fixtures/nativeFocus'
import { productionSession } from './fixtures/productionSession'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, expect, test } from '@playwright/test'

/** The Electron shell's local-only policy, checked against the real shell.

    The dev-server tests next door watch what the client asks for; this one
    checks what the shell allows. Both halves matter: a CSP tight enough to
    break Pixi kills the world view (the renderer never paints), and a CSP
    loose enough to reach a remote host would let game data be downloaded.
    Only launching Electron exercises `app://`, the CSP and enforceLocalOnly. */

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')


test('the shell reads assets from app://, keeps Pixi alive and blocks remote hosts', async () => {
  test.skip(!existsSync(path.join(APP_ROOT, 'dist/index.html')), 'run `npm run build` first: the shell serves dist/ over app://')
  test.slow()
  const app = await electron.launch({ args: [APP_ROOT], env: { ...process.env, ...(process.env.E2E_RENDER_BENCHMARK ? { GINY_DIST_ROOT: path.join(APP_ROOT, 'dist-benchmark') } : {}) } })
  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.giny-submit')).toBeVisible({ timeout: 30_000 })

    // Resource Timing omits app:// fetches on this Electron version; record actual fetch responses.
    await page.addInitScript(() => {
      const responses: Array<{ url: string; status: number; contentType: string | null; document: unknown }> = []
      Object.assign(window, { __compiledUiResponses: responses })
      const original = window.fetch.bind(window)
      window.fetch = async (...args) => {
        const response = await original(...args)
        const url = String(args[0])
        if (/\/ui-prepared\/[a-f0-9]{64}\.json$/.test(url)) responses.push({ url: new URL(url, location.href).href,
          status: response.status, contentType: response.headers.get('content-type'), document: await response.clone().json() })
        return response
      }
    })
    await page.reload()
    await expect(page.locator('.giny-submit')).toBeVisible({ timeout: 30_000 })
    const compiledUi = await page.evaluate(() => (window as unknown as { __compiledUiResponses: Array<{ url: string; status: number; contentType: string | null; document: { type?: string } }> }).__compiledUiResponses)
    expect(compiledUi.length).toBeGreaterThan(0)
    for (const asset of compiledUi) {
      expect(asset.url).toMatch(/^app:\/\//)
      expect(asset.status).toBe(200)
      expect(asset.contentType).toContain('application/json')
      expect(asset.document.type).toBeTruthy()
    }
    await test.info().attach('compiled-ui', { body: JSON.stringify(compiledUi.map(({ document, ...asset }) => ({ ...asset, type: document.type })), null, 2), contentType: 'application/json' })

    // The policy the document actually received, straight from the shell.
    const policy = await page.evaluate(async () => (await fetch('/index.html')).headers.get('content-security-policy'))
    expect(policy).toBeTruthy()
    // Pixi builds its shader and uniform-sync code through the Function
    // constructor: drop this token and the world view dies on mount with
    // "Current environment does not allow unsafe-eval" while the login screen
    // still looks perfectly fine. Chromium only enforces eval against real
    // page scripts — `page.evaluate` and `addScriptTag` run through the
    // debugger, which the CSP does not police — so the guarantee is asserted
    // on the header instead of probed from here.
    expect(policy).toContain("'unsafe-eval'")
    // …and no remote origin may ever appear in a source list.
    expect(policy).not.toMatch(/https?:|wss?:|\*/)

    const probe = (url: string) => page.evaluate(async (target) => {
      try {
        const response = await fetch(target)
        return `HTTP ${response.status}`
      } catch {
        return 'blocked'
      }
    }, url)
    // Maps, sprites and UI resolve from the extracted Dofus client on disk…
    expect(await probe('/bubble/data/map3/maps/204998153/map.bin')).toBe('HTTP 200')
    expect(await probe('/game-data/client/creation_catalog.json')).toBe('HTTP 200')
    expect(await probe('/ui-data/manifest.json')).toBe('HTTP 200')
    // …and nothing off this machine is reachable, from the page or from the
    // blob worker Pixi decodes textures in.
    expect(await probe('https://static.ankama.com/dofus/gfx/7945.png')).toBe('blocked')
    expect(await probe('http://example.com/maps/1.json')).toBe('blocked')

    const fromWorker = (url: string) => page.evaluate(async (target) => {
      const code = `self.onmessage = async (event) => {
        try {
          const response = await fetch(event.data)
          const bitmap = await createImageBitmap(await response.blob())
          self.postMessage('decoded ' + bitmap.width + 'x' + bitmap.height)
        } catch { self.postMessage('blocked') }
      }`
      const worker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })))
      const answer = await new Promise<string>((resolve) => {
        worker.onmessage = (event: MessageEvent<string>) => resolve(event.data)
        worker.onerror = () => resolve('worker refused')
        worker.postMessage(target)
        setTimeout(() => resolve('timeout'), 15_000)
      })
      worker.terminate()
      return answer
    }, url)
    expect(await fromWorker('app://bubble/data/b/714/atlas.webp')).toMatch(/^decoded \d+x\d+$/)
    for (const asset of ['dofus3/fight/digits/blue/2.png', 'dofus3/fight/digits/red/2.png', 'dofus3/fight/digits/green/minus.png', 'combat-assets/1.webp']) {
      expect(await fromWorker(`app://${asset}`)).toMatch(/^decoded \d+x\d+$/)
    }
    expect(await fromWorker('https://static.ankama.com/dofus/gfx/7945.png')).toBe('blocked')
    if (process.env.E2E_NATIVE_FOCUS_ONLY) await verifyNativeFocus(app, page, test.info())
    if (process.env.E2E_PRODUCTION_SESSION) await productionSession(app, page, test.info())
    if (!process.env.E2E_RENDER_BENCHMARK) return
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const results = []
    for (const mapId of [204998153, 154010371, 153358338]) {
      await page.goto(`app://-/index.html?map=${mapId}&benchmark=1`)
      await expect(page.locator('.world-identity')).toHaveText(/· [1-9]\d* sprites$/, { timeout: 60_000 })
      const metrics = await page.evaluate(async () => {
        const w = window as unknown as { __ginyPerformance: () => { backend: string; bench: { textureCount: number } } }
        const intervals: number[] = []
        let previous = performance.now()
        await new Promise<void>(resolve => {
          const frame = (now: number) => {
            intervals.push(now - previous); previous = now
            if (intervals.length < 60) requestAnimationFrame(frame); else resolve()
          }; requestAnimationFrame(frame)
        })
        intervals.sort((a, b) => a - b)
        const canvas = document.querySelector('canvas')!
        const gl = canvas.getContext('webgl2')!
        const extension = gl.getExtension('WEBGL_debug_renderer_info')
        return { runtime: w.__ginyPerformance(), p50: intervals[30], p95: intervals[57], gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unknown' }
      })
      expect(metrics.runtime.backend).toBe('bubble-native'); expect(metrics.runtime.bench.textureCount).toBeGreaterThan(0)
      results.push(metrics)
      await fs.mkdir('output/performance', { recursive: true })
      await page.screenshot({ path: `output/performance/electron-${mapId}.png` })
      console.log('Electron renderer:', JSON.stringify(metrics))
      await test.info().attach('electron-performance', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' })
    }
    await fs.writeFile('output/performance/electron.json', JSON.stringify(results, null, 2))
    expect(errors).toEqual([])
  } finally {
    await app.close()
  }
})

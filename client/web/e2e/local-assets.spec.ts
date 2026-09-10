import { installCssCoverage } from './fixtures/cssCoverage'
installCssCoverage()
import { expect, test, type Page } from '@playwright/test'

/** Everything the client paints comes from the Dofus install on this machine.

    Maps, gfx, entity looks and the extracted UI are served by the `/game-data`,
    `/ui-data` and `/uitk` middlewares (vite.config.ts) or by `app://` in the
    Electron shell — never fetched from a remote host. These tests watch the
    whole request log of a real page load: a single off-machine URL fails them,
    and the positive assertions make sure the local prefixes are what actually
    fed the renderer instead of the screen silently staying empty. */

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** `data:` and `blob:` bodies are built in the page; they reach no network. */
function isInline(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:')
}

function isRemote(url: string): boolean {
  try {
    return !LOOPBACK_HOSTS.has(new URL(url).hostname)
  } catch {
    return true
  }
}

/** Every URL the page asks for, split by where it points. */
function watchRequests(page: Page) {
  const paths: string[] = []
  const remote: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (isInline(url)) return
    if (isRemote(url)) remote.push(url)
    else paths.push(new URL(url).pathname)
  })
  const served = (prefix: string) => paths.filter((path) => path.startsWith(prefix))
  return { paths, remote, served }
}

test('a map paints from the local extraction, with no remote request', async ({ page }) => {
  const timeout = Number(process.env.E2E_ASSET_TIMEOUT ?? 60_000)
  test.setTimeout(timeout + 15_000)
  const seen = watchRequests(page)
  await page.goto('/?map=204998153')
  // `map <id> · <ms> ms · <n> sprites`, so a non-zero count means the gfx
  // textures really came back and Bubble built the scene.
  await expect(page.locator('.world-identity')).toHaveText(/· [1-9]\d* sprites$/, { timeout })
  expect(seen.paths).toContain('/bubble/data/map3/maps/204998153/map.bin')
  expect(seen.served('/bubble/data/map3/').length).toBeGreaterThan(0)
  expect(seen.remote).toEqual([])
})

test('a character sprite and the official UI load from the local extraction', async ({ page }) => {
  const seen = watchRequests(page)
  await page.goto('/?ui-preview=characters')
  await expect(page.locator('.entity-preview canvas').first()).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => seen.served('/bubble/data/s/').length + seen.served('/bubble/data/b/').length, { timeout: 30_000 }).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.entity-preview canvas').first().evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let painted = 0
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++
    return painted
  }), { timeout: 30_000 }).toBeGreaterThan(100)
  expect(seen.paths.filter(path => /^\/game-data\/(entities|textures|optimized|maps|gfx|effects)\//.test(path))).toEqual([])
  expect(seen.served('/ui-data/').length).toBeGreaterThan(0)
  expect(seen.remote).toEqual([])
})

test('the HUD asks for no font, icon or tree outside the machine', async ({ page }) => {
  const seen = watchRequests(page)
  await page.goto('/?ui-preview=hud')
  await page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first().waitFor({ state: 'visible' })
  await expect.poll(() => seen.served('/uitk/').length, { timeout: 30_000 }).toBeGreaterThan(0)
  expect(seen.served('/ui-data/').length).toBeGreaterThan(0)
  expect(seen.remote).toEqual([])
})

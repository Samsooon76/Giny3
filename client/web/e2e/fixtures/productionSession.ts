import { verifyNativeFocus } from './nativeFocus'
import { ServerFrameCodec } from '../../src/giny/frameCodec'
import { MESSAGES } from '../../src/giny/messages'
import { expect, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'

/** Real Auth/World session; the caller owns isolated server and database lifecycle. */
export async function productionSession(app: ElectronApplication, page: Page, info: TestInfo): Promise<void> {
  if (process.env.GINY_AUTH_PORT !== '18453') throw new Error('Production session validation requires the isolated Auth port 18453')
  const errors: string[] = []
  const maps: number[] = [], codec = new ServerFrameCodec()
  await page.exposeFunction('__recordSessionFrames', (bytes: number[]) => {
    for (const frame of codec.push(Uint8Array.from(bytes))) {
      if (frame.messageId === MESSAGES.CURRENT_MAP && frame.payload.length >= 8) maps.push(new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength).getFloat64(0, false))
    }
  })
  await page.evaluate(() => {
    const observed = window as unknown as { ginyNative: { onData: (callback: (data: Uint8Array) => void) => () => void }; __recordSessionFrames: (bytes: number[]) => Promise<void> }
    observed.ginyNative.onData(data => { void observed.__recordSessionFrames(Array.from(data)) })
  })
  page.on('pageerror', error => errors.push(error.message))
  try {
    await page.getByLabel('Identifiant', { exact: true }).fill(process.env.GINY_TEST_USERNAME ?? 'admin')
    await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.GINY_TEST_PASSWORD ?? 'test')
    await page.locator('.giny-submit').click()
    await page.locator('[data-tree="ServerSelection"] [data-binding="btn_play"]').click({ timeout: 30_000 })
    await page.locator('[data-tree="characterSelection"] [data-binding="btn_play"]').click({ timeout: 30_000 })
    const canvas = page.locator('.world-viewport canvas')
    await expect(canvas).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.world-screen .loading-screen')).toHaveCount(0, { timeout: 60_000 })
    await expect(page.locator('.world-message')).toHaveCount(0)
    await expect(page.locator('.official-hud')).toBeVisible()
    await info.attach('production-session-world', { body: await page.screenshot(), contentType: 'image/png' })
    await canvas.screenshot({ path: info.outputPath('production-world-canvas.png') })
    const identity = await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))
    if (!process.env.E2E_SKIP_SESSION_FOCUS) {
      await verifyNativeFocus(app, page, info)
    await expect(canvas).toBeVisible()
    expect(await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))).toEqual(identity)
    await expect(page.locator('.official-hud')).toBeVisible()

    }

    if (process.env.E2E_SESSION_MAP_CHANGE) {
      const chat = page.locator('[data-tree="chatview"] [data-binding="ti_chatInput"] input')
      const previous = maps.at(-1)
      expect(previous).toBeTruthy()
      const destination = previous === 153878788 ? 153880835 : 153878788
      const before = maps.length
      await chat.fill(`.go ${destination}`)
      await chat.press('Enter')
      await expect.poll(() => maps.slice(before), { timeout: 30_000 }).toContain(destination)
      await expect(page.locator('.world-viewport')).toHaveAttribute('data-ready-map', String(destination), { timeout: 60_000 })
      await expect(page.locator('.loading-screen')).toHaveCount(0, { timeout: 60_000 })
      await expect(page.locator('.world-message')).toHaveCount(0)
      await canvas.screenshot({ path: info.outputPath('production-destination.png') })
      await info.attach('production-map-transition', { body: JSON.stringify({ previous, destination, receivedMaps: maps }), contentType: 'application/json' })
    }
    await info.attach('production-session-identity', { body: JSON.stringify({ identity, windows: await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), errors }), contentType: 'application/json' })
    expect(errors).toEqual([])
  } catch (error) {
    await info.attach('production-session-failure', { body: await page.screenshot(), contentType: 'image/png' })
    throw error
  }
}

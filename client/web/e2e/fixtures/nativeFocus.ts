import { expect, type ElectronApplication, type Page, type TestInfo } from '@playwright/test'

export async function verifyNativeFocus(app: ElectronApplication, page: Page, info: TestInfo): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false })
  const id = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.hide()
    return window.id
  })
  const observations: unknown[] = []
  observations.push(await app.evaluate(({ BrowserWindow }, windowId) => {
    const window = BrowserWindow.fromId(windowId)!
    return { id: window.id, visible: window.isVisible(), minimized: window.isMinimized(), focused: window.isFocused(), windows: BrowserWindow.getAllWindows().map(w => ({ id: w.id, url: w.webContents.getURL() })) }
  }, id))
  await info.attach('native-focus-before', { body: JSON.stringify(observations), contentType: 'application/json' })
  try {
    await expect.poll(() => page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() }))).toEqual({ hidden: true, focused: false })
    observations.push(await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() })))
  } finally {
    await app.evaluate(({ BrowserWindow, app: electronApp }, windowId) => {
      const window = BrowserWindow.fromId(windowId)
      window?.show(); electronApp.focus({ steal: true }); window?.focus()
    }, id)
  }
  await expect.poll(() => page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() }))).toEqual({ hidden: false, focused: true })
  observations.push(await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() })))
  await info.attach('native-focus', { body: JSON.stringify(observations), contentType: 'application/json' })
  await cdp.detach()
}

import { chromium } from 'playwright'
const OUT = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 160)) })
await page.goto('http://localhost:5199/?map=154644')
await page.waitForSelector('.world-loading', { state: 'detached', timeout: 180_000 })
await page.waitForTimeout(1500)
const box = await page.locator('.world-viewport').boundingBox()
const shots = {
  bottom: [box.x + box.width / 2, box.y + box.height - 12],
  top: [box.x + box.width / 2, box.y + 12],
  left: [box.x + 12, box.y + box.height / 2],
  right: [box.x + box.width - 12, box.y + box.height / 2],
}
for (const [name, [x, y]] of Object.entries(shots)) {
  await page.mouse.move(x, y)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/edge-${name}.png` })
}
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/edge-none.png` })
await browser.close()
console.log('done')

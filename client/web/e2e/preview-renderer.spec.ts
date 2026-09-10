import { test, expect } from '@playwright/test'

test('Bubble portraits share a context and retain independent pixels through release', async ({ page }) => {
  await page.goto('/?ui-preview=login')
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { acquireBubblePreview } = await load('/src/ui/bubblePreviewRenderer.ts')
    const { previewMetrics } = await load('/src/game/assets/previewMetrics.ts')
    const before = previewMetrics().contexts
    const leases = await Promise.all(Array.from({ length: 3 }, () => acquireBubblePreview()))
    const contexts = previewMetrics().contexts - before
    const canvases = leases.map(() => document.createElement('canvas'))
    const looks = ['{1|10,2012|1=#e3ad72,2=#8b452f,3=#db8a35,4=#66512e,5=#302b28|50}', '{4907|||130}', '{1|10,2012|1=#72ade3,2=#452f8b,3=#35db8a,4=#125e66,5=#283b30|50}']
    const entities = await Promise.all(leases.map((lease, i) => lease.create(looks[i], i === 2 ? 3 : 1)))
    const pixels = (i: number) => {
      const data = canvases[i].getContext('2d')!.getImageData(0, 0, canvases[i].width, canvases[i].height).data
      let painted = 0
      for (let offset = 3; offset < data.length; offset += 4) if (data[offset]) painted++
      return painted
    }
    leases.forEach((lease, i) => lease.draw(entities[i], canvases[i], 200, 240, 'fit'))
    const painted = canvases.map((_, i) => pixels(i))
    const firstImage = canvases[0].toDataURL()
    const distinct = firstImage !== canvases[2].toDataURL()
    leases[0].release()
    leases[1].draw(entities[1], canvases[1], 300, 300, 'portrait')
    const survivor = pixels(1)
    const stableCopy = firstImage === canvases[0].toDataURL()
    for (let i = 1; i < leases.length; i++) leases[i].release()
    return { contexts, painted, survivor, distinct, stableCopy, remaining: previewMetrics().contexts - before }
  })
  expect(result.contexts).toBe(1)
  expect(result.remaining).toBe(0)
  expect(result.survivor).toBeGreaterThan(100)
  expect(result.distinct).toBe(true)
  expect(result.stableCopy).toBe(true)
  result.painted.forEach(pixels => expect(pixels).toBeGreaterThan(100))
})

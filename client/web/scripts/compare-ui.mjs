#!/usr/bin/env node
/**
 * Compare each captured Giny screen with its official reference.
 *
 * `capture-ui.mjs` shoots the web client at the same viewport and device scale
 * as the official PNGs, so the two images line up pixel for pixel. This script
 * measures where they do not, and — the part that makes it actionable —
 * attributes every mismatching region to the DOM element that covers it, using
 * the `.boxes.json` the capture dumped alongside the screenshot. The element's
 * `binding` or `id` is the key to correct in `src/ui/official/windowFixups.ts`.
 *
 *   node scripts/compare-ui.mjs                # every screen captured on both sides
 *   node scripts/compare-ui.mjs hud_inventory  # one screen
 *   node scripts/compare-ui.mjs --all hud      # include the 3D scene, not just the UI
 *
 * Decoding happens in Chromium (already a dependency through Playwright), so
 * the script needs no image library.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const SHOTS = path.join(ROOT, 'client/dofus3/output/ui_shots')
const OFFICIAL = path.join(SHOTS, 'official')
const WEB = path.join(SHOTS, 'web')
const OUT = path.join(SHOTS, 'rapport')

/** Per-channel difference below which two pixels count as equal. Antialiasing
    and font rasterisation never match exactly across two engines. */
const TOLERANCE = Number(process.env.UI_TOLERANCE ?? 16)
/** Regions kept in the report, worst first. */
const WORST = 20
/** Mismatches are clustered on this grid before being turned into regions. */
const BLOCK = 8

const args = process.argv.slice(2)
const uiOnly = !args.includes('--all')
const only = args.filter((a) => !a.startsWith('--'))

const officialShots = new Set(
  (await readdir(OFFICIAL)).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)),
)
const names = (await readdir(WEB))
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.slice(0, -4))
  .filter((n) => officialShots.has(n))
  .filter((n) => !only.length || only.includes(n))
  .sort()

if (!names.length) {
  console.error('aucun écran comparable (il faut le même nom dans official/ et web/)')
  process.exit(1)
}

const dataUrl = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent('<canvas id="a"></canvas>')

const summary = []
for (const name of names) {
  let boxes = null
  try {
    boxes = JSON.parse(await readFile(path.join(WEB, `${name}.boxes.json`), 'utf8'))
  } catch {
    /* a screen captured before dumpBoxes existed still gets a pixel score */
  }
  const result = await page.evaluate(compareInPage, {
    officialUrl: await dataUrl(path.join(OFFICIAL, `${name}.png`)),
    clientUrl: await dataUrl(path.join(WEB, `${name}.png`)),
    boxes,
    tolerance: TOLERANCE,
    block: BLOCK,
    worst: WORST,
    uiOnly,
  })
  if (result.error) {
    console.error(`${name}: ${result.error}`)
    continue
  }
  const dir = path.join(OUT, name)
  await mkdir(dir, { recursive: true })
  const report = {
    official: path.relative(ROOT, path.join(OFFICIAL, `${name}.png`)),
    client: path.relative(ROOT, path.join(WEB, `${name}.png`)),
    ...result.report,
  }
  await writeFile(path.join(dir, 'report.json'), `${JSON.stringify(report, null, 1)}\n`)
  await writeFile(path.join(dir, 'mask.png'), Buffer.from(result.mask, 'base64'))
  await writeFile(path.join(dir, 'annotated.png'), Buffer.from(result.annotated, 'base64'))
  summary.push({ name, ratio: report.mismatched_ratio, worst: report.worst })
}

await browser.close()

summary.sort((a, b) => b.ratio - a.ratio)
console.log(`\n${uiOnly ? 'zones d’interface seulement' : 'image entière'}, tolérance ${TOLERANCE}\n`)
for (const { name, ratio, worst } of summary) {
  const top = worst.find((r) => r.element)?.element
  const who = top ? ` — pire zone: ${top.binding || top.id || top.type}` : ''
  console.log(`${(ratio * 100).toFixed(1).padStart(5)} %  ${name}${who}`)
}
console.log(`\nrapports: ${path.relative(ROOT, OUT)}/<écran>/report.json`)

/** Runs inside the page: both PNGs are decoded and diffed on a canvas. */
function compareInPage({ officialUrl, clientUrl, boxes, tolerance, block, worst, uiOnly }) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`image illisible: ${src.slice(0, 32)}…`))
      img.src = src
    })
  const pixels = (img) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  return (async () => {
    const [a, b] = await Promise.all([load(officialUrl), load(clientUrl)])
    if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight) {
      return {
        error: `tailles différentes: officiel ${a.naturalWidth}x${a.naturalHeight}, client ${b.naturalWidth}x${b.naturalHeight}`,
      }
    }
    const width = a.naturalWidth
    const height = a.naturalHeight
    const left = pixels(a).data
    const right = pixels(b).data

    // The scene behind the interface is a different renderer entirely; comparing
    // it would drown the UI signal. Only the boxes small enough to be a widget
    // are kept — a full-screen container tells us nothing about a window.
    let mask = null
    const scale = boxes?.canvas?.width ? width / boxes.canvas.width : 1
    if (uiOnly && boxes?.boxes?.length) {
      mask = new Uint8Array(width * height)
      const limit = width * height * 0.5
      for (const box of boxes.boxes) {
        if (box.depth === 0) continue
        const x0 = Math.max(0, Math.round(box.x * scale))
        const y0 = Math.max(0, Math.round(box.y * scale))
        const x1 = Math.min(width, Math.round((box.x + box.w) * scale))
        const y1 = Math.min(height, Math.round((box.y + box.h) * scale))
        if ((x1 - x0) * (y1 - y0) > limit) continue
        for (let y = y0; y < y1; y += 1) mask.fill(1, y * width + x0, y * width + x1)
      }
    }

    const blocksX = Math.ceil(width / block)
    const blocksY = Math.ceil(height / block)
    const hits = new Int32Array(blocksX * blocksY)
    const diff = new Uint8Array(width * height)
    let compared = 0
    let mismatched = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x
        if (mask && !mask[p]) continue
        compared += 1
        const i = p * 4
        const d = Math.max(
          Math.abs(left[i] - right[i]),
          Math.abs(left[i + 1] - right[i + 1]),
          Math.abs(left[i + 2] - right[i + 2]),
          Math.abs(left[i + 3] - right[i + 3]),
        )
        if (d <= tolerance) continue
        mismatched += 1
        diff[p] = 1
        hits[Math.floor(y / block) * blocksX + Math.floor(x / block)] += 1
      }
    }

    // Blocks that touch become one region, so a broken widget is reported once
    // instead of as a cloud of pixels.
    const seen = new Uint8Array(blocksX * blocksY)
    const regions = []
    for (let start = 0; start < hits.length; start += 1) {
      if (!hits[start] || seen[start]) continue
      const queue = [start]
      seen[start] = 1
      let minX = blocksX
      let minY = blocksY
      let maxX = -1
      let maxY = -1
      let count = 0
      while (queue.length) {
        const cell = queue.pop()
        const cx = cell % blocksX
        const cy = (cell - cx) / blocksX
        count += hits[cell]
        if (cx < minX) minX = cx
        if (cy < minY) minY = cy
        if (cx > maxX) maxX = cx
        if (cy > maxY) maxY = cy
        const neighbours = [
          cx > 0 ? cell - 1 : -1,
          cx < blocksX - 1 ? cell + 1 : -1,
          cy > 0 ? cell - blocksX : -1,
          cy < blocksY - 1 ? cell + blocksX : -1,
        ]
        for (const n of neighbours) {
          if (n >= 0 && hits[n] && !seen[n]) {
            seen[n] = 1
            queue.push(n)
          }
        }
      }
      regions.push({
        x: minX * block,
        y: minY * block,
        w: (maxX - minX + 1) * block,
        h: (maxY - minY + 1) * block,
        pixels: count,
      })
    }
    regions.sort((p, q) => q.pixels - p.pixels)
    const top = regions.slice(0, worst)

    // The element blamed for a region is the deepest box that contains its
    // centre: the innermost one is the node actually painting there.
    const describe = (region) => {
      if (!boxes?.boxes?.length) return null
      const cx = (region.x + region.w / 2) / scale
      const cy = (region.y + region.h / 2) / scale
      let best = null
      for (const box of boxes.boxes) {
        if (box.depth === 0) continue
        if (cx < box.x || cx > box.x + box.w || cy < box.y || cy > box.y + box.h) continue
        if (!best || box.depth > best.depth) best = box
      }
      if (!best) return null
      const { id, binding, type, classes, text, font, color, background, image, depth } = best
      return { id, binding, type, classes, text, font, color, background, image, depth,
        box: [best.x, best.y, best.w, best.h] }
    }

    const png = (paint) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      paint(canvas.getContext('2d'))
      return canvas.toDataURL('image/png').split(',')[1]
    }
    const maskPng = png((ctx) => {
      const out = ctx.createImageData(width, height)
      for (let p = 0; p < diff.length; p += 1) {
        const i = p * 4
        const on = diff[p] ? 255 : 0
        out.data[i] = on
        out.data[i + 1] = on
        out.data[i + 2] = on
        out.data[i + 3] = 255
      }
      ctx.putImageData(out, 0, 0)
    })
    const annotatedPng = png((ctx) => {
      ctx.drawImage(b, 0, 0)
      ctx.lineWidth = 3
      ctx.font = '20px monospace'
      top.forEach((region, index) => {
        ctx.strokeStyle = index === 0 ? '#ff2d55' : '#ffcc00'
        ctx.strokeRect(region.x + 1.5, region.y + 1.5, region.w - 3, region.h - 3)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fillText(String(index + 1), region.x + 5, region.y + 24)
      })
    })

    return {
      report: {
        size: [width, height],
        tolerance,
        ui_only: Boolean(mask),
        compared_pixels: compared,
        mismatched_pixels: mismatched,
        mismatched_ratio: compared ? Number((mismatched / compared).toFixed(5)) : 0,
        regions: regions.length,
        worst: top.map((region) => ({ ...region, element: describe(region) })),
      },
      mask: maskPng,
      annotated: annotatedPng,
    }
  })()
}

#!/usr/bin/env node
/** Capture Giny preview screens at the same points and device scale as the official PNGs. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = path.join(ROOT, 'client/dofus3/output/ui_shots/web')
const referenceFrame = JSON.parse(await readFile(path.join(ROOT, 'client/dofus3/reference_frame.json'), 'utf8'))
const VIEWPORT = { width: referenceFrame.window_points[0], height: referenceFrame.window_points[1] }
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:5173'

const SHOTS = [
  { name: 'server_selection', url: '/?ui-preview=servers', wait: '[data-binding="btn_play"]' },
  { name: 'character_selection', url: '/?ui-preview=characters', wait: '[data-binding="ed_main"], [data-binding="btn_play"]' },
  { name: 'character_creation', url: '/?ui-preview=creation', wait: '[data-binding="leftPart"], [data-binding="plateform"]' },
  { name: 'hud', url: '/?ui-preview=hud', wait: '[data-binding="gd_btnUis"] [data-binding="itemTile_container"]' },
  { name: 'hud_character', url: '/?ui-preview=hud&open=character', wait: '[data-binding="btn_distributeMyPoints"]' },
  { name: 'hud_inventory', url: '/?ui-preview=hud&open=inventory', wait: '.official-hud-window' },
  { name: 'hud_spells', url: '/?ui-preview=hud&open=spells', wait: '.official-hud-window' },
  { name: 'hud_map', url: '/?ui-preview=hud&open=map', wait: '[data-binding="ctr_filters"]' },
  { name: 'hud_quests', url: '/?ui-preview=hud&open=quests', wait: '.official-hud-window' },
  { name: 'hud_friends', url: '/?ui-preview=hud&open=friends', wait: '.official-hud-window' },
  { name: 'hud_guild', url: '/?ui-preview=hud&open=guild', wait: '.official-hud-window' },
  { name: 'hud_achievements', url: '/?ui-preview=hud&open=achievements', wait: '.official-hud-window' },
  { name: 'hud_jobs', url: '/?ui-preview=hud&open=jobs', wait: '.official-hud-window' },
  { name: 'hud_mount', url: '/?ui-preview=hud&open=mount', wait: '.official-hud-window' },
  { name: 'hud_appearance', url: '/?ui-preview=hud&open=appearance', wait: '.official-hud-window' },
  { name: 'hud_appearance_editor', url: '/?ui-preview=hud&open=appearance', wait: '[data-tree="AppearanceUI"] [data-binding="Appearance"]', click: '[data-tree="cosmeticUi"] [data-binding="btnAppearance"]' },
  { name: 'hud_bank', url: '/?ui-preview=hud&open=bank', wait: '[data-binding="BankWindow"]' },
  { name: 'hud_market', url: '/?ui-preview=hud&open=market', wait: '[data-binding="ctr-window"]' },
  { name: 'hud_recipes', url: '/?ui-preview=hud&open=recipes', wait: '.official-hud-window' },
  { name: 'hud_craft', url: '/?ui-preview=hud&open=craft', wait: '[data-binding="CraftStorageWindow"]' },
]

await mkdir(OUT, { recursive: true })
const only = process.argv.slice(2)
const shots = only.length ? SHOTS.filter((shot) => only.includes(shot.name)) : SHOTS
if (!shots.length) {
  console.error('aucun écran à capturer')
  process.exit(1)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: referenceFrame.device_scale })
for (const shot of shots) {
  await page.goto(`${BASE}${shot.url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.official-node', { timeout: 30_000 })
  if (shot.click) {
    await page.waitForSelector(shot.click, { timeout: 30_000 })
    await page.click(shot.click)
  }
  await page.waitForSelector(shot.wait, { timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), type: 'png' })
  const boxes = await page.evaluate(() => window.__dumpClientBoxes?.({ download: false }))
  if (boxes) await writeFile(path.join(OUT, `${shot.name}.boxes.json`), JSON.stringify(boxes))
  console.log(`${shot.name}  ${VIEWPORT.width}×${VIEWPORT.height} @${referenceFrame.device_scale}  boxes=${boxes?.named ?? 0}`)
}
await browser.close()

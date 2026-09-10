import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, expect, it } from 'vitest'
import { item, loadGameCatalog, resetCatalog, spell, spellLevelById } from './catalog'

// Opt-in integration with a real SQL-generated release; no official assets in fixtures.
const root = process.env.GINY_CATALOG_TEST_ROOT
afterEach(resetCatalog)

it.skipIf(!root)('loads the SQL-generated official catalogue through the real client loader', async () => {
  const requests = new Set<string>()
  const fetcher = (async (input: RequestInfo | URL) => {
    const relative = String(input).replace(/^\/game-data\//, '')
    requests.add(relative)
    const file = path.resolve(root!, relative)
    const gz = `${file}.gz`
    if (fs.existsSync(gz)) {
      return new Response(gunzipSync(fs.readFileSync(gz)).toString('utf8'), { status: 200 })
    }
    if (fs.existsSync(file)) return new Response(fs.readFileSync(file).toString('utf8'), { status: 200 })
    return new Response('', { status: 404 })
  }) as typeof fetch
  await loadGameCatalog(fetcher)
  const read = (name: string) => JSON.parse(gunzipSync(fs.readFileSync(path.join(root!, name))).toString('utf8'))
  const items = read('data/items.json.gz')
  const spells = read('data/spells.json.gz')
  const levels = read('data/spelllevels.json.gz')
  const locale = read('client/i18n.json.gz')
  const itemRecord = items['44']
  expect(itemRecord).toBeDefined()
  expect(item(44)).toMatchObject({
    id: 44, name: locale.by_id[String(itemRecord.nameId)],
    possibleEffects: itemRecord.possibleEffects,
  })
  const level = Object.values(levels).find((row: any) => spells[String(row.spellId)] && row.effects?.length) as any
  expect(level).toBeDefined()
  expect(spellLevelById(level.id)).toEqual(level)
  expect(spell(level.spellId)?.name).toBe(locale.by_id[String(spells[String(level.spellId)].nameId)])
  expect(requests).toContain('client/i18n.json')
}, 30_000)

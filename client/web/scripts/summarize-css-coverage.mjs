/** Merge observed rule ranges across scenarios without calling unvisited CSS dead. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const input = path.resolve(process.argv[2] || 'test-results')
const output = path.resolve(process.argv[3] || 'output/css-coverage.json')
const documents = new Map(), scenarios = []
async function scan(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await scan(file); continue }
    if (entry.name === 'css-coverage-error.json') {
      const record = JSON.parse(await fs.readFile(file, 'utf8'))
      scenarios.push({ title: record.title, status: 'coverage-failed', url: record.url, error: record.error })
      continue
    }
    if (entry.name !== 'css-coverage.json') continue
    const record = JSON.parse(await fs.readFile(file, 'utf8'))
    if (!Array.isArray(record.styles)) throw new Error(`Invalid coverage: ${file}`)
    scenarios.push({ title: record.title, status: record.status, url: record.url })
    for (const style of record.styles) {
      const hash = createHash('sha256').update(style.text).digest('hex')
      let document = documents.get(hash)
      if (!document) { document = { hash, urls: new Set(), text: style.text, ranges: [] }; documents.set(hash, document) }
      document.urls.add(style.url || '(inline)')
      document.ranges.push(...style.ranges)
    }
  }
}
await scan(input)
if (!scenarios.length) throw new Error('No CSS coverage scenarios found')
const styles = [...documents.values()].map(document => {
  const ranges = []
  for (const range of document.ranges.sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (range.start < 0 || range.end > document.text.length || range.end < range.start) throw new Error('Invalid CSS range')
    const previous = ranges.at(-1)
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else ranges.push({ ...range })
  }
  const used = ranges.reduce((sum, range) => sum + range.end - range.start, 0)
  return { hash: document.hash, urls: [...document.urls], codeUnits: document.text.length, observedUsedCodeUnits: used,
    observedUnusedCodeUnits: document.text.length - used, ranges }
})
const report = { scenarios, styles, semantics: 'Union of observed rule ranges; UTF-16 code units, not transfer bytes or proof of dead CSS.',
  totalCodeUnits: styles.reduce((sum, style) => sum + style.codeUnits, 0),
  observedUsedCodeUnits: styles.reduce((sum, style) => sum + style.observedUsedCodeUnits, 0) }
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ scenarios: scenarios.length, styles: styles.length, totalCodeUnits: report.totalCodeUnits, observedUsedCodeUnits: report.observedUsedCodeUnits }))
if (scenarios.some(scenario => scenario.status !== 'passed')) process.exitCode = 1

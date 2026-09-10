import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { runtimeCatalogRoot } from './runtimeCatalogRoot.mjs'

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })))
it('rejects a raw official export and accepts only the matching runtime publication', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'giny-runtime-')); dirs.push(root)
  const catalog = path.join(root, 'export'); fs.mkdirSync(catalog)
  fs.writeFileSync(path.join(catalog, 'manifest.json'), JSON.stringify({ format: 'giny.official-catalog.v1', origin: 'sql' }))
  expect(() => runtimeCatalogRoot(root, catalog)).toThrow()
  fs.writeFileSync(path.join(catalog, 'manifest.json'), JSON.stringify({ format: 'giny.runtime-catalog.v1', origin: 'giny-sql', catalogVersion: 'v1' }))
  expect(runtimeCatalogRoot(root, catalog)).toBe(catalog)
  fs.mkdirSync(path.join(root, '.local/catalog'), { recursive: true })
  fs.writeFileSync(path.join(root, '.local/catalog/active-runtime.json'), JSON.stringify({ clientExport: catalog, catalogVersion: 'v2' }))
  expect(() => runtimeCatalogRoot(root, undefined)).toThrow()
})

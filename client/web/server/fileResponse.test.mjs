import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { byteRange, fileResponse } from './fileResponse.mjs'
test('byte ranges handle suffix, open end, clamping and reject invalid/multipart ranges', () => {
  assert.deepEqual(byteRange('bytes=2-4', 10), { start: 2, end: 4 })
  assert.deepEqual(byteRange('bytes=7-', 10), { start: 7, end: 9 })
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 })
  assert.deepEqual(byteRange('bytes=7-99', 10), { start: 7, end: 9 })
  for (const value of [
    'bytes=10-11',
    'bytes=4-2',
    'bytes=-0',
    'bytes=0-1,3-4',
    'bytes=-',
    'bytes=9007199254740992-',
  ])
    assert.equal(byteRange(value, 10), false)
})
test('file responses stream only requested bytes and return correct HEAD/416 metadata', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'giny-range-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const file = path.join(root, 'pack')
  await fs.writeFile(file, '0123456789')
  const request = (range, method = 'GET') =>
    new Request('http://local/', { method, headers: { Range: range } })
  const response = await fileResponse(file, request('bytes=3-6'))
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 3-6/10')
  assert.equal(await response.text(), '3456')
  const head = await fileResponse(file, request('bytes=-2', 'HEAD'))
  assert.equal(head.headers.get('content-length'), '2')
  assert.equal(head.body, null)
  const invalid = await fileResponse(file, request('bytes=99-'))
  assert.equal(invalid.status, 416)
  assert.equal(invalid.headers.get('content-range'), 'bytes */10')
})

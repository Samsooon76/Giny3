import { afterEach, expect, it, vi } from 'vitest'
import { componentStyles } from './stylesheet'
afterEach(() => { componentStyles.invalidate(); vi.unstubAllGlobals() })
const sheet = (direction: string) => new Response(JSON.stringify({ rules: [{ selectors: ['.toggleGroup'], properties: [{ name: 'flex-direction', values: [{ type: 'Enum', value: direction }] }] }] }))
it('retries failed styles explicitly and replaces obsolete properties', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockImplementationOnce(async () => sheet('row')).mockResolvedValueOnce(new Response('{"rules":[]}')))
  await componentStyles.retry()
  await componentStyles.retry()
  expect(componentStyles.snapshot().DofusToggleButtonGroupCustom['flex-direction']).toBe('row')
  await componentStyles.retry()
  expect(componentStyles.snapshot().DofusToggleButtonGroupCustom).toBeUndefined()
})
it('a stale stylesheet cannot replace a successfully retried one', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })).mockImplementationOnce(async () => sheet('row')))
  const previous = componentStyles.retry(); await Promise.resolve()
  await componentStyles.retry()
  finish(sheet('column')); await previous
  expect(componentStyles.snapshot().DofusToggleButtonGroupCustom['flex-direction']).toBe('row')
})

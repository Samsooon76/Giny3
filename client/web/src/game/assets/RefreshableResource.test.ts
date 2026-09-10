import { expect, it, vi } from 'vitest'
import { RefreshableResource } from './RefreshableResource'
it('coalesces reads, delays failures and refreshes successful manifests', async () => {
  let now = 0
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ revision: 'new' })
  const resource = new RefreshableResource(load, 30000, () => now)
  await Promise.all([resource.get(), resource.get()])
  expect(load).toHaveBeenCalledTimes(1)
  now = 4999; expect(await resource.get()).toBeNull()
  now = 5000; expect(await resource.get()).toEqual({ revision: 'new' })
  now = 35000; await resource.get()
  expect(load).toHaveBeenCalledTimes(3)
})
it('an invalidated old request cannot overwrite the new revision', async () => {
  let finish!: (value: string) => void
  const load = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve })).mockResolvedValue('new')
  const resource = new RefreshableResource<string>(load)
  const old = resource.get(); await Promise.resolve()
  resource.invalidate(); expect(await resource.get()).toBe('new')
  finish('old'); expect(await old).toBe('old')
  expect(await resource.get()).toBe('new')
})
it('does not start a read for a caller that already left', async () => {
  const load = vi.fn(async () => 'data')
  const resource = new RefreshableResource(load)
  const controller = new AbortController(); controller.abort()
  await expect(resource.get(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(load).not.toHaveBeenCalled()
})

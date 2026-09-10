import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionBroker } from './actions'
import { packClientFrame } from './frameCodec'

afterEach(() => vi.useRealTimers())
describe('correlation des commandes Giny', () => {
  it('enregistre la requête avant un résultat synchrone et protège le personnage', async () => {
    const broker = new ActionBroker()
    let envelope: { requestId: string; characterId: string } | undefined
    const result = broker.request('42', { action: 'stats.reset', args: {} }, json => {
      envelope = JSON.parse(json)
      broker.receive(JSON.stringify({ ...envelope, schemaVersion: 1, characterId: '43', success: true }))
    }, vi.fn())
    await expect(broker.request('42', { action: 'stats.reset', args: {} }, vi.fn(), vi.fn())).rejects.toThrow('déjà')
    broker.receive(JSON.stringify({ ...envelope, schemaVersion: 1, success: true }))
    await expect(result).resolves.toBeUndefined()
    await expect(broker.request('42', { action: 'stats.reset', args: {} }, json => {
      broker.receive(JSON.stringify({ ...JSON.parse(json), success: true }))
    }, vi.fn())).resolves.toBeUndefined()
  })
  it('ne renvoie jamais une mutation expirée et demande une resynchronisation', async () => {
    vi.useFakeTimers()
    const broker = new ActionBroker(), send = vi.fn(), resync = vi.fn()
    const result = broker.request('42', { action: 'item.use', args: { uid: 4 } }, send, resync)
    const rejected = expect(result).rejects.toThrow('non confirmé')
    broker.receive('{broken')
    await vi.advanceTimersByTimeAsync(8000)
    await rejected
    expect(send).toHaveBeenCalledTimes(1)
    expect(resync).toHaveBeenCalledOnce()
  })
  it('propage le refus et purge les attentes lors de la déconnexion', async () => {
    const broker = new ActionBroker()
    await expect(broker.request('42', { action: 'stats.reset', args: {} }, json => {
      broker.receive(JSON.stringify({ ...JSON.parse(json), success: false, message: 'Combat en cours' }))
    }, vi.fn())).rejects.toThrow('Combat en cours')
    const pending = broker.request('42', { action: 'stats.reset', args: {} }, vi.fn(), vi.fn())
    broker.close()
    await expect(pending).rejects.toThrow('reconnexion')
  })
  it('refuse les identifiants hors des 14 bits de l’en-tête', () => {
    expect(() => packClientFrame(16384, 1, new Uint8Array())).toThrow(RangeError)
    expect(() => packClientFrame(-1, 1, new Uint8Array())).toThrow(RangeError)
    expect(new DataView(packClientFrame(16379, 1, new Uint8Array()).buffer).getUint16(0) >>> 2).toBe(16379)
  })
})

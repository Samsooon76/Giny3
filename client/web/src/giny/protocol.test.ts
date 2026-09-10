import { describe, expect, it } from 'vitest'
import { Reader, Writer } from './binary'
import { packClientFrame, ServerFrameCodec } from './frameCodec'
import { characterNameError, coordToCellId, isHiddenChatLine, MovementRefusedError, parseCharacterHud, parseChatServerMessage, parseTextInformation } from './parsers'
import { CHAT_CHANNEL } from './types'

describe('Dofus coordinates & Movement errors', () => {
  it('converts orthogonal coordinates to cell id', () => {
    expect(coordToCellId(0, 0)).toBe(0)
    expect(coordToCellId(13, 13)).toBe(13)
    expect(coordToCellId(1, 0)).toBe(14)
    expect(coordToCellId(1, -1)).toBe(28)
  })

  it('structures MovementRefusedError with server coordinates', () => {
    const err = new MovementRefusedError('Refusé', 154, 5, 2, 126)
    expect(err.serverCell).toBe(154)
    expect(err.serverX).toBe(5)
    expect(err.serverY).toBe(2)
    expect(err.clientStartCell).toBe(126)
  })
})

describe('Giny binary primitives', () => {
  it('round-trips network values in big endian', () => {
    const bytes = new Writer().u8(7).u16(0xcafe).i32(-42).f64(154010883).utf('fr').varUInt(16383).finish()
    const reader = new Reader(bytes)
    expect(reader.u8()).toBe(7)
    expect(reader.u16()).toBe(0xcafe)
    expect(reader.i32()).toBe(-42)
    expect(reader.f64()).toBe(154010883)
    expect(reader.utf()).toBe('fr')
    expect(reader.varUInt()).toBe(16383)
  })
})

describe('Giny framing', () => {
  it('packs the client sequence between header and length', () => {
    const frame = packClientFrame(9262, 12, Uint8Array.from([1, 2, 3]))
    const view = new DataView(frame.buffer)
    expect(view.getUint16(0, false) >>> 2).toBe(9262)
    expect(view.getUint32(2, false)).toBe(12)
    expect(frame.slice(7)).toEqual(Uint8Array.from([1, 2, 3]))
  })

  it('decodes fragmented server frames', () => {
    const serverFrame = Uint8Array.from([0x57, 0x49, 3, 4, 5, 6])
    const codec = new ServerFrameCodec()
    expect(codec.push(serverFrame.slice(0, 3))).toEqual([])
    const frames = codec.push(serverFrame.slice(3))
    expect(frames[0].messageId).toBe(5586)
    expect(frames[0].payload).toEqual(Uint8Array.from([4, 5, 6]))
  })
})

describe('character name rules', () => {
  it('accepts official-style names and rejects malformed names', () => {
    expect(characterNameError('Hugo')).toBe('')
    expect(characterNameError('Jean-Luc')).toBe('')
    expect(characterNameError('hugo')).not.toBe('')
    expect(characterNameError('Hugooo')).not.toBe('')
  })
})

describe('chat frames', () => {
  it('reads ChatServerMessage as a player line', () => {
    const payload = new Writer()
      .u8(0).utf('salut').i32(1710000000).utf('')
      .f64(9).utf('Hugo').utf('').i32(1)
      .finish()
    const line = parseChatServerMessage(payload, 'c1')
    expect(line).toMatchObject({
      id: 'c1',
      kind: 'message',
      channel: CHAT_CHANNEL.GLOBAL,
      sender: 'Hugo',
      senderId: 9,
      content: 'salut',
      timestamp: 1710000000,
    })
  })

  it('reads a Giny command reply (TextInformation msgId 0)', () => {
    const payload = new Writer().u8(0).varUInt(0).u16(1).utf('<font color="#FF8C00">Available commands:</font>').finish()
    const line = parseTextInformation(payload, 'i1')
    expect(line).toMatchObject({
      id: 'i1',
      kind: 'info',
      channel: CHAT_CHANNEL.INFO,
      content: '<font color="#FF8C00">Available commands:</font>',
    })
  })

  it('drops hidden server sync payloads instead of leaking them into chat', () => {
    expect(isHiddenChatLine('[QUEST_STATE]%7B%22operation%22%3A%22SYNC%22%7D')).toBe(true)
    expect(isHiddenChatLine('[POKEFUS_STATE]%7B%7D')).toBe(true)
    expect(isHiddenChatLine('[GUILD_CAMP_STATE]%7B%7D')).toBe(true)
    expect(isHiddenChatLine('Bienvenue sur le serveur de test.')).toBe(false)
    const payload = new Writer().u8(0).varUInt(0).u16(1).utf('[QUEST_STATE]%7B%22operation%22%3A%22SYNC%22%7D').finish()
    expect(parseTextInformation(payload, 'hidden')).toBeNull()
  })
})

describe('character HUD snapshot', () => {
  it('reads the live JSON projection Giny sends for the web HUD', () => {
    const json = JSON.stringify({
      account: { id: 1, username: 'admin', nickname: 'Hugo' },
      character: { name: 'Hugo', level: 12, look: '{1}', breed_id: 1, breed_name: 'Féca', sex: false, id: 9 },
      map: { id: 1, subarea_id: 1, subarea_name: 'Astrub', area_name: 'Astrub', x: 4, y: -18, level: 20 },
      life: { current: 80, max: 100, shield: 0 },
      energy: { current: 9000, max: 10000 },
      experience: { current: 100, floor: 0, next: 200 },
      points: { stats: 0, spells: 0, ap: 6, mp: 3, range: 0, initiative: 10, prospecting: 100, summons: 1 },
      weight: { current: 0, max: 1000 },
      characteristics: { vitality: {}, strength: {}, intelligence: {}, chance: {}, agility: {}, wisdom: {} },
      combat: { critical_hit: {}, heal: {}, all_damage: {}, earth_resist: {}, fire_resist: {}, water_resist: {}, air_resist: {}, neutral_resist: {} },
    })
    const hud = parseCharacterHud(new Writer().utf(json).finish())
    expect(hud?.character.name).toBe('Hugo')
    expect(hud?.life.current).toBe(80)
    expect(hud?.secondary).toEqual([])
    expect(hud?.items).toEqual([])
  })

  it('rejects an error payload', () => {
    expect(parseCharacterHud(new Writer().utf('{"error":"no_character"}').finish())).toBeNull()
  })

  it('rejects a partial payload before it can break a menu', () => {
    expect(parseCharacterHud(new Writer().utf('{"character":{"name":"Hugo"}}').finish())).toBeNull()
  })
})

it('accepts a lightweight unchanged HUD acknowledgement without a malformed snapshot warning', () => {
  expect(parseCharacterHud(new Writer().utf('{"unchanged":true}').finish())).toBeNull()
})

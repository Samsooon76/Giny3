import { Writer } from './binary'
/** Giny 2.68 ChatClientPrivateMessage (7053), receiver type PlayerSearchCharacterNameInformation (3022). */
export function privateChatPayload(text: string): Uint8Array | undefined {
  if (!/^\/w(?:\s|$)/i.test(text)) return undefined
  const match = text.match(/^\/w\s+(\S+)\s+([\s\S]+)$/i)
  if (!match || !match[2].trim()) throw new Error('Saisissez /w NomDuPersonnage suivi de votre message.')
  return new Writer().utf(match[2].trim()).u16(3022).utf(match[1]).finish()
}

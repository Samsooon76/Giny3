import type { ParsedLook } from './types'

export function parseEntityLook(value: string): ParsedLook | null {
  const text = value.trim()
  if (!text.startsWith('{') || !text.endsWith('}')) {
    return null
  }
  const fields = splitTopLevel(text.slice(1, -1), '|')
  if (fields.length === 0 || fields.length > 5) {
    return null
  }
  while (fields.length < 5) {
    fields.push('')
  }
  const colors: Record<string, string> = {}
  if (fields[2]) {
    for (const item of fields[2].split(',')) {
      if (!item) {
        continue
      }
      const eq = item.indexOf('=')
      if (eq < 0) {
        return null
      }
      const index = String(Number(item.slice(0, eq)))
      let colorText = item.slice(eq + 1)
      if (!colorText.startsWith('#')) {
        colorText = `#${(Number(colorText) & 0xffffff).toString(16).padStart(6, '0')}`
      }
      colors[index] = colorText.toLowerCase()
    }
  }
  const scales = fields[3]
    ? fields[3]
        .split(',')
        .filter(Boolean)
        .map((item) => Number(item))
    : []
  const skinIds = fields[1]
    ? fields[1]
        .split(',')
        .filter(Boolean)
        .map((item) => Number(item))
    : []
  return {
    raw: text,
    boneId: Number(fields[0]) || 0,
    skinIds,
    colors,
    scales,
    scale: scales.length > 0 ? scales[0] / 100 : 1,
  }
}

/** Documents the web client can fetch for a look, most specific first. */
export function entityDocumentCandidates(look: string): string[] {
  const parsed = parseEntityLook(look)
  if (!parsed) {
    return []
  }
  const paths: string[] = []
  if (parsed.skinIds.length > 0) {
    paths.push(`entities/look_${parsed.boneId}_${parsed.skinIds.join('_')}.json`)
  }
  paths.push(`entities/look_${parsed.boneId}_base.json`)
  paths.push(`entities/${parsed.boneId}.json`)
  return paths
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  ]
}

function splitTopLevel(text: string, separator: string): string[] {
  const result: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth < 0) {
        return []
      }
    } else if (character === separator && depth === 0) {
      result.push(text.slice(start, index))
      start = index + 1
    }
  }
  if (depth !== 0) {
    return []
  }
  result.push(text.slice(start))
  return result
}

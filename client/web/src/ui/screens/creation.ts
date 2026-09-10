import type { CreationState } from './types'

export const CREATION_COLOR_FIELDS = [
  'colorPicker_skin',
  'colorPicker_hair',
  'colorPicker_cloth1',
  'colorPicker_cloth2',
  'colorPicker_cloth3',
  'colorPicker_cloth4',
] as const

export function effectiveColors(value: CreationState, defaults: Record<string, string>): string[] {
  return Array.from({ length: CREATION_COLOR_FIELDS.length }, (_, index) => (
    value.colors[index] ?? defaults[String(index + 1)] ?? '#ffffff'
  ))
}

export function hexNumber(value: string): number {
  return Number.parseInt(value.replace('#', ''), 16)
}

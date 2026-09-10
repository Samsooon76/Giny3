export type Zone = { zoneShape: string; zoneSize: number; zoneMinSize: number; zoneStopAtTarget?: number; rawZone: string }
export function parseZone(raw: string): Zone
export function zoneCells(zone: Zone, caster: number, target: number): number[]
export function rangePoints(caster: number, spell: { range: number; minRange: number; castInLine?: boolean; castInDiagonal?: boolean }): number[][]
export function cellPoint(cell: number): { x: number; y: number }
export function pointCell(x: number, y: number): number | undefined
export function lineOfSight(cells: { l: number }[], from: number, to: number, occupied?: Set<number>): boolean

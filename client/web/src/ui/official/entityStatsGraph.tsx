import { OfficialSprite } from './OfficialIcon'
import type { VisualTreeNode } from './types'

const HEX_ICONS = [
  'tx_vitality',
  'tx_strength',
  'tx_intelligence',
  'tx_chance',
  'tx_agility',
  'tx_wisdom',
]

function vertex(index: number, count: number, radius: number, rotation: number): { x: number; y: number } {
  const angle = ((-90 + rotation + (360 / count) * index) * Math.PI) / 180
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

/** C# `EntityStatsGraph` is a 1×1 painter. Stroke the same hex the mesh uses. */
export function EntityStatsGraphPaint({
  node,
  values,
}: {
  node: VisualTreeNode
  values: number[]
}) {
  const radius = Number(node.properties?.radius ?? 80)
  const rotation = Number(node.properties?.offsetRotation ?? node.properties?.['offset-rotation'] ?? 36)
  const thickness = Number(node.properties?.thickness ?? 2)
  const iconOffset = Number(node.properties?.['icon-offset'] ?? node.properties?.iconOffset ?? 20)
  const count = Math.max(values.length, Number(node.properties?.['number_of_sides'] ?? 6))
  const span = (radius + iconOffset) * 2
  const peak = Math.max(1, ...values, 1)
  const ring = Array.from({ length: count }, (_, index) => vertex(index, count, radius, rotation))
  const filled = Array.from({ length: count }, (_, index) => {
    const point = vertex(index, count, radius * (Math.max(0, values[index] ?? 0) / peak), rotation)
    return `${point.x},${point.y}`
  }).join(' ')
  const web = ring.map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <div className="official-stats-graph" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <svg
        viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <polygon points={web} fill="none" stroke="rgba(182,179,229,0.35)" strokeWidth={1} />
        <polygon points={filled} fill="rgba(240,255,79,0.28)" stroke="var(--highlight_primary100, #f0ff4f)" strokeWidth={thickness} />
      </svg>
      {ring.map((_, index) => {
        const icon = HEX_ICONS[index]
        if (!icon) return null
        const place = vertex(index, count, radius + iconOffset, rotation)
        return (
          <div
            key={icon}
            style={{
              position: 'absolute',
              left: `calc(50% + ${place.x}px - 12px)`,
              top: `calc(50% + ${place.y}px - 12px)`,
              width: 24,
              height: 24,
            }}
          >
            <OfficialSprite name={icon} style={{ width: '100%', height: '100%' }} />
          </div>
        )
      })}
    </div>
  )
}

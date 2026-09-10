import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { applyResolvedSprite, iconCandidates } from './uss'

let spriteNames: Promise<Set<string>> | undefined

function knownSpriteNames(): Promise<Set<string>> {
  spriteNames ??= fetch('/ui-data/sprite_meta.json')
    .then((response) => (response.ok ? response.json() : {}))
    .then((meta: Record<string, unknown>) => new Set(Object.keys(meta)))
    .catch(() => new Set<string>())
  return spriteNames
}

export function propertySprite(properties?: Record<string, unknown>): string | undefined {
  const value = [
    properties?.['image-url'], properties?.imageUrl, properties?.['img-url'], properties?.imgUrl,
    properties?.icon, properties?.iconValue, properties?.['icon-value'], properties?.['tile-icon-value'],
  ].find((entry) => typeof entry === 'string' && !/^\d+$/.test(entry))
  return typeof value === 'string' ? value : undefined
}

type SpriteHost = {
  children?: unknown[]
  sprite?: string
  properties?: Record<string, unknown>
  type?: string
  name?: string
  binding?: string
}

const IMAGE_TYPES = new Set(['Image', 'DofusIcon'])

/** Constructor interiors that receive the texture. Overlay-only children
    (achievement ``tx_border``) are not this: C# still paints on the host. */
function childIsInteriorPaintTarget(child: unknown): boolean {
  if (!child || typeof child !== 'object') return false
  const node = child as SpriteHost
  if (IMAGE_TYPES.has(node.type ?? '')) return true
  const name = `${node.binding ?? ''} ${node.name ?? ''}`
  return /itemTile_icon/i.test(name) || /Vector/i.test(name)
}

/** Sprite UITK would paint on this element itself.

    A non-leaf that also names a sprite (a button, ``itemTile_container``) still
    has children: the constructor drew the texture on the interior Image /
    Vector, and covering the host would hide the USS fill. A runtime override
    on a host whose children are overlays (not interiors) stays on the host. */
export function hostSpriteName(
  node: SpriteHost,
  overrideSprite?: string,
): string | undefined {
  if (node.children && node.children.length > 0) {
    if (node.children.some(childIsInteriorPaintTarget)) return undefined
    return overrideSprite
  }
  return overrideSprite ?? node.sprite ?? propertySprite(node.properties)
}

/** UITK sizes an Image from its sprite only when USS left the box unset.

    ``splitCascade`` moves ``width`` into a stylesheet rule when a hover state
    repeats it. Reading the inline style then looks empty, and applying
    ``sprite_size`` inline (64px) beats the official 24px rule. */
export function implicitImageSize(
  type: string | undefined,
  uss: Record<string, unknown> | undefined,
  spriteSize?: [number, number],
): { width: string; height: string } | undefined {
  if (!spriteSize || !IMAGE_TYPES.has(type ?? '')) return undefined
  if (uss?.width != null || uss?.height != null) return undefined
  return { width: `${spriteSize[0]}px`, height: `${spriteSize[1]}px` }
}

/** Probe the folders the extractor writes until the named icon actually loads. */
export function useOfficialSprite(name?: string, shadow = false): string | undefined {
  const candidates = useMemo(() => (name ? iconCandidates(name, shadow) : []), [name, shadow])
  const [source, setSource] = useState<string>()
  useEffect(() => {
    if (!name) {
      setSource(undefined)
      return
    }
    let cancelled = false, index = 0
    const probe = (list: string[]) => {
      if (cancelled || index >= list.length) return
      const next = list[index++], image = new Image()
      image.onload = () => { if (!cancelled) setSource(next) }
      image.onerror = () => probe(list)
      image.src = next
    }
    void knownSpriteNames().then((known) => {
      const listed = known.size ? candidates.filter((url) => known.has(url.split('/').pop() || '')) : candidates
      // sprite_meta is an index, not a whitelist: an icon that exists on disk
      // but is absent from the index still has to load, or HUD/header glyphs
      // vanish with no USS hole to point at.
      probe(listed.length ? listed : candidates)
    })
    return () => { cancelled = true }
  }, [candidates, name])
  return name ? source : undefined
}

/** One USS-sized box that paints a probed sprite on itself.

    Window chrome (title-bar icon) is a C# constructor, not a tree leaf, so it
    still needs a host; that host is the USS rect, not a nested ``official-icon``. */
export function OfficialSprite({
  name,
  shadow = false,
  style,
  className,
}: {
  name: string
  shadow?: boolean
  style?: CSSProperties
  className?: string
}) {
  const source = useOfficialSprite(name, shadow)
  const css: CSSProperties = { ...style }
  if (source) applyResolvedSprite(css, source)
  return <span className={className} style={css} />
}

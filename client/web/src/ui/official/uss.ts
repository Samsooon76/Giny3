import type { CSSProperties } from 'react'

/** Unity TextAnchor, independent of flex-direction.

    UI Toolkit's default axis is column, so ``middle-left`` is vertically
    centred and horizontally start — the opposite of the row mapping that
    treated justify as the horizontal axis. */
const TEXT_ANCHOR: Record<string, { x: 'left' | 'center' | 'right'; y: 'flex-start' | 'center' | 'flex-end' }> = {
  'upper-left': { x: 'left', y: 'flex-start' },
  'middle-left': { x: 'left', y: 'center' },
  'lower-left': { x: 'left', y: 'flex-end' },
  'upper-center': { x: 'center', y: 'flex-start' },
  'middle-center': { x: 'center', y: 'center' },
  'lower-center': { x: 'center', y: 'flex-end' },
  'upper-right': { x: 'right', y: 'flex-start' },
  'middle-right': { x: 'right', y: 'center' },
  'lower-right': { x: 'right', y: 'flex-end' },
}

const AXIS_START: Record<'left' | 'center' | 'right', 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

function textAlignCss(
  align: string,
  flexDirection: unknown,
): { textAlign: CSSProperties['textAlign']; justifyContent: CSSProperties['justifyContent']; alignItems: CSSProperties['alignItems'] } | undefined {
  const anchor = TEXT_ANCHOR[align]
  if (!anchor) return undefined
  const row = String(flexDirection ?? 'column').toLowerCase().includes('row')
  return {
    textAlign: anchor.x,
    justifyContent: row ? AXIS_START[anchor.x] : anchor.y,
    alignItems: row ? anchor.y : AXIS_START[anchor.x],
  }
}

export function uiUrl(reference: unknown): string | undefined {
  if (typeof reference !== 'string' || !reference || ['true', 'false', 'none'].includes(reference.toLowerCase())) return undefined
  if (/^(data:|https?:|\/)/.test(reference)) return reference.replace(/^\/ui\//, '/ui-data/')
  if (/^(styles|textures|icons|themes|fonts)\//.test(reference)) return `/ui-data/${reference}`
  const file = reference.split('/').pop()
  if (/Themes\/Figma\//i.test(reference) && file) return `/ui-data/icons/${file}`
  return `/ui-data/styles/images/${file}`
}

/** ``fonts/Lexend-SemiBold.ttf`` -> ``Lexend-SemiBold``, the @font-face family. */
export function fontFamily(reference: unknown): string | undefined {
  if (typeof reference !== 'string' || !reference.startsWith('fonts/')) return undefined
  const stem = reference.split('/').pop()?.replace(/\.(ttf|otf)$/i, '')
  return stem || undefined
}

/** Figma menuIcons and a few banner names that do not match the icons bundle. */
const ICON_ALIASES: Record<string, string> = {
  spell: 'spells',
  dragoturkey: 'mount',
  paddock: 'mount',
  chest: 'bank',
  iconAura: 'aura',
  iconTitle: 'title',
  iconOrnament: 'ornament',
}

export function iconCandidates(name: string, shadow = false): string[] {
  // Catalog and explicit menu pictos are already the indexed 1x file. Do not probe ui-data/icons/{iconId}.png.
  if (/^(\/game-data\/|\/dofus3\/menuIcons\/|https?:|data:)/.test(name)) return [name]
  const file = name.split('/').pop() || name
  const stem = file.replace(/\.png$/i, '')
  const lower = stem.charAt(0).toLowerCase() + stem.slice(1)
  const alias = ICON_ALIASES[lower] ?? ICON_ALIASES[stem]
  const variants = [...new Set([stem, lower, alias].filter((value): value is string => Boolean(value)))]
  const candidates: string[] = []
  const direct = name.includes('/') ? uiUrl(name) : undefined
  if (direct) candidates.push(direct)
  for (const value of variants) {
    if (shadow) candidates.push(`/ui-data/icons/${value}ShadowOutline.png`)
    candidates.push(`/ui-data/icons/${value}.png`)
    candidates.push(`/ui-data/styles/images/${value}.png`)
    if (!shadow) candidates.push(`/ui-data/icons/${value}ShadowOutline.png`)
  }
  return [...new Set(candidates)]
}

function dim(value: unknown, unit = 'px'): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 10000) return `${value}${unit}`
  if (typeof value === 'string') return value
  // Unity serialises multi-value times as `[0.5s, comma, 0.5s]` (job/achievement
  // switches). A comma token is a separator, not a dimension.
  if (Array.isArray(value)) {
    const parts = value
      .filter((entry) => !(entry && typeof entry === 'object' && (entry as { type?: string }).type === 'comma'))
      .map((entry) => dim(entry, unit))
      .filter((entry): entry is string => Boolean(entry))
    return parts.length ? parts.join(', ') : undefined
  }
  if (typeof value === 'object' && 'value' in value) {
    const record = value as { value: unknown; unit?: string }
    if (typeof record.value !== 'number' || !Number.isFinite(record.value) || Math.abs(record.value) >= 10000) return undefined
    return `${record.value}${record.unit || unit}`
  }
  return undefined
}

function scalar(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value && typeof value === 'object' && 'value' in value && typeof (value as { value: unknown }).value === 'number') return (value as { value: number }).value
  return undefined
}

function cssScalar(value: unknown): string | number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (!normalized || normalized.startsWith('--') || ['null', 'undefined'].includes(normalized)) return undefined
    return normalized
  }
  if (value && typeof value === 'object' && 'value' in value) return cssScalar((value as { value: unknown }).value)
  if (Array.isArray(value)) {
    for (const entry of [...value].reverse()) {
      const resolved = cssScalar(entry)
      if (resolved !== undefined) return resolved
    }
  }
  return undefined
}

function isTintIdentity(tint: string): boolean {
  const norm = tint.trim().toLowerCase()
  if (['#ffffffff', '#ffffff', '#ffff', '#fff', 'white'].includes(norm)) return true
  return /^rgba?\(\s*255(?:\.0+)?\s*,\s*255(?:\.0+)?\s*,\s*255(?:\.0+)?(?:\s*,\s*(?:1(?:\.0+)?|100%))?\s*\)$/.test(norm)
}

/** True when this USS paints a tinted sprite that must not live as a CSS mask
    on the element — that mask would clip every descendant. */
export function hasTintedBackground(style: Record<string, unknown> = {}): boolean {
  const tint = cssColor(style['unity-background-image-tint-color'])
  return Boolean(uiUrl(style['background-image']) && tint && !isTintIdentity(tint))
}

function applyTintedSpriteVars(
  css: Record<string, unknown>,
  image: string,
  tint: string,
  size: string,
  sliced: boolean,
  slices: string[],
) {
  css['--official-tint'] = tint
  css['--official-mask-size'] = size
  if (sliced) {
    // Longhands only: the `-webkit-mask-box-image` shorthand eats the
    // 3rd/4th slice numbers (`0 60 0 60 fill` became `0 60 fill`).
    const nums = slices.map(parseFloat).join(' ')
    css['--official-mask-image'] = 'none'
    css['--official-mask-border'] = `url("${image}")`
    css['--official-mask-slice'] = `${nums} fill`
    css['--official-mask-width'] = slices.join(' ')
  } else {
    css['--official-mask-image'] = `url("${image}")`
    css['--official-mask-border'] = 'none'
  }
}

function applyBackgroundImage(
  css: Record<string, unknown>,
  style: Record<string, unknown>,
  image: string,
) {
  const tint = cssColor(style['unity-background-image-tint-color'])
  const size = backgroundSize(style)
  const keys = ['unity-slice-top', 'unity-slice-right', 'unity-slice-bottom', 'unity-slice-left']
  const slices = keys.map((key) => dim(style[key]) ?? '0px')
  const sliced = slices.some((slice) => slice !== '0px')
  if (tint && !isTintIdentity(tint)) {
    applyTintedSpriteVars(css, image, tint, size, sliced, slices)
    return
  }
  css.backgroundImage = `url("${image}")`
  css.backgroundSize = size
  css.backgroundRepeat = 'no-repeat'
  css.backgroundPosition = css.backgroundPosition ?? 'center'
  if (sliced) {
    css.borderStyle = 'solid'
    css.borderImageSource = `url("${image}")`
    css.borderImageSlice = `${slices.map(parseFloat).join(' ')} fill`
    css.borderImageWidth = slices.join(' ')
    css.borderImageRepeat = 'stretch'
    css.backgroundImage = 'none'
  }
}

/** Paint a resolved sprite on the UITK host, never as a child box.

    Image / Vector nodes carry ``sprite`` without a USS ``background-image``.
    UI Toolkit still draws that texture on the element; the host's USS width
    and height are the layout, not the PNG's intrinsic rect. */
export function applyResolvedSprite(
  css: CSSProperties,
  url: string,
  style: Record<string, unknown> = {},
): void {
  const image = uiUrl(url) ?? url
  if (!image) return
  applyBackgroundImage(css as Record<string, unknown>, style, image)
}

function backgroundSize(style: Record<string, unknown>): string {
  const scale = String(style['unity-background-scale'] ?? '').toLowerCase()
  if (scale.includes('contain') || scale.includes('scale-to-fit')) return 'contain'
  if (scale.includes('cover') || scale.includes('crop')) return 'cover'
  if (scale.includes('stretch')) return '100% 100%'
  const authored = style['background-size']
  if (typeof authored === 'string' && authored) return authored
  if (Array.isArray(authored)) {
    const parts = authored.map((entry) => dim(entry)).filter((entry): entry is string => Boolean(entry))
    if (parts.length) return parts.join(' ')
  }
  return '100% 100%'
}

const NON_COLOR_WORDS = new Set(['none', 'initial', 'inherit', 'auto', 'stretch', 'center', 'solid', 'normal', 'visible', 'hidden'])

function isColorToken(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('--')) return true
  if (NON_COLOR_WORDS.has(trimmed.toLowerCase())) return false
  return /^(#|rgb|hsl|color\(|transparent$|currentcolor$|var\(|[a-z]+$)/i.test(trimmed)
}

function cssColor(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('--')) return `var(${trimmed})`
    return isColorToken(trimmed) ? trimmed : undefined
  }
  if (Array.isArray(value)) {
    for (const entry of [...value].reverse()) {
      const color = cssColor(entry)
      if (color) return color
    }
    return undefined
  }
  if (value && typeof value === 'object' && 'value' in value) return cssColor((value as { value: unknown }).value)
  const resolved = cssScalar(value)
  if (typeof resolved !== 'string') return undefined
  if (resolved.startsWith('--')) return `var(${resolved})`
  return isColorToken(resolved) ? resolved : undefined
}

const camel = (value: string) => value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

/** The CSS property each UI Toolkit default stands for.

    A default emitted inline beats any stylesheet rule, so a default has to be
    withheld for every property the caller is going to declare in a rule
    instead. `position: relative` inline against `position: absolute` in the
    rule is what laid the six PlayButton layers out as stacked 20px bars
    instead of superimposing them. */
const DEFAULTED_BY_USS: Record<string, string | readonly string[]> = {
  display: 'display',
  'flex-direction': 'flexDirection',
  'align-items': 'alignItems',
  'justify-content': 'justifyContent',
  // ``unity-text-align`` compiles to these three. If a state/ancestor rule
  // lifts it into the stylesheet while the UITK defaults stay inline,
  // ``justify-content: flex-start`` beats ``middle-center`` — PlayButton's
  // JOUER sat on top of the hexagon, and 1117 labels shared the same leak.
  'unity-text-align': ['justifyContent', 'alignItems', 'textAlign'],
  position: 'position',
  'flex-grow': 'flexGrow',
  'flex-shrink': 'flexShrink',
  'min-width': 'minWidth',
  'min-height': 'minHeight',
  overflow: 'overflow',
}

export function ussToCss(
  style: Record<string, unknown> = {},
  _text = false,
  withDefaults = true,
  /** USS properties the caller declares in a stylesheet rule: their defaults
      must not be emitted inline, or the rule can never win. */
  declaredElsewhere: ReadonlySet<string> = new Set(),
): CSSProperties {
  const css: Record<string, unknown> = withDefaults ? {
    display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
    position: 'relative', boxSizing: 'border-box', flexGrow: 0, flexShrink: 1, minWidth: 0, minHeight: 0,
  } : {}
  for (const key of declaredElsewhere) {
    const property = DEFAULTED_BY_USS[key]
    if (!property) continue
    for (const name of typeof property === 'string' ? [property] : property) delete css[name]
  }
  const dimensions = new Set([
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'left', 'right', 'top', 'bottom',
    'gap', 'row-gap', 'column-gap', 'font-size', 'letter-spacing', 'border-width', 'border-radius', 'flex-basis',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    // Ankama writes these through `--line-height` / `--gap` tokens; the
    // extractor rewrites them to the standard property.
    'line-height',
    'transition-duration', 'transition-delay',
  ])
  const direct = new Set([
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'align-items', 'align-self', 'align-content',
    'justify-content', 'color', 'background-color', 'opacity', 'white-space', 'text-overflow', 'cursor',
    // `--shadow` and `--text-case`, resolved by the extractor. A panel's inner
    // highlight and every uppercase label live here.
    'box-shadow', 'text-transform',
    'transition-property', 'transition-timing-function',
  ])
  for (const [key, value] of Object.entries(style)) {
    if (dimensions.has(key)) css[camel(key)] = dim(value)
    if (direct.has(key)) css[camel(key)] = key.includes('color') ? cssColor(value) : cssScalar(value)
    if (/^(margin|padding)(-(left|right|top|bottom))?$/.test(key)) css[camel(key)] = dim(value)
    if (/^border-(top|right|bottom|left)-(width|color)$/.test(key)) css[camel(key)] = key.endsWith('width') ? dim(value) : cssColor(value)
  }
  // USS `opacity` is a number Unity clamps to [0, 1]. Values such as 80 and 100
  // (WindowFigma `#window_shadow`) are therefore fully opaque in-game. CSS
  // clamps the same way — dividing by 100 would make those chrome layers
  // translucent (dofus3-ui README §16).
  if ('border-color' in style) css.borderColor = cssColor(style['border-color'])
  if ('display' in style) css.display = ['none', 'false'].includes(String(style.display).toLowerCase()) ? 'none' : 'flex'
  if ('position' in style) css.position = String(style.position).toLowerCase() === 'absolute' ? 'absolute' : 'relative'
  const overflow = String(style.overflow ?? '').toLowerCase()
  if ('overflow' in style || (withDefaults && !declaredElsewhere.has('overflow'))) css.overflow = ['hidden', '1'].includes(overflow) ? 'hidden' : overflow === 'scroll' ? 'auto' : 'visible'
  if (String(style.visibility).toLowerCase() === 'hidden') css.visibility = 'hidden'
  // Unity text-overflow:ellipsis is a single-line clip. CSS ellipsis without
  // nowrap + a clip box wraps instead — two-column stat names became 64px.
  if (String(css.textOverflow ?? style['text-overflow'] ?? '').toLowerCase() === 'ellipsis') {
    if (css.whiteSpace == null || css.whiteSpace === 'normal') css.whiteSpace = 'nowrap'
    if (css.overflow === 'visible' || css.overflow == null) css.overflow = 'hidden'
  }

  const mask = uiUrl(style['mask-image'])
  if (mask) {
    css.WebkitMaskImage = `url("${mask}")`; css.maskImage = `url("${mask}")`
    css.WebkitMaskSize = '100% 100%'; css.maskSize = '100% 100%'
    css.WebkitMaskRepeat = 'no-repeat'; css.maskRepeat = 'no-repeat'
  }

  const image = uiUrl(style['background-image'])
  if (image) applyBackgroundImage(css, style, image)

  // -unity-font-definition wins over the legacy -unity-font when both are set,
  // which is what UI Toolkit does at resolve time.
  const family = fontFamily(style['unity-font-definition']) ?? fontFamily(style['unity-font'])
  if (family) css.fontFamily = `"${family}", Lexend, sans-serif`

  const cursor = uiUrl(style.cursor)
  if (cursor) css.cursor = `url("${cursor}"), auto`

  // `--labelShadow` resolves to a ready CSS shadow list; `text-shadow` proper
  // is Unity's serialized offset/colour tuple.
  if (typeof style['text-shadow'] === 'string') css.textShadow = style['text-shadow']
  const shadow = Array.isArray(style['text-shadow']) ? style['text-shadow'] : undefined
  if (shadow) {
    const offsets = shadow.filter((entry) => typeof entry === 'object' || typeof entry === 'number').slice(0, 3).map((entry) => dim(entry) ?? '0px')
    const shadowColor = shadow.map((entry) => cssColor(entry)).find(Boolean)
    if (offsets.length >= 2) css.textShadow = `${offsets[0]} ${offsets[1]} ${offsets[2] ?? '0px'} ${shadowColor ?? '#000000a6'}`
  }

  const filters = Array.isArray(style.filter) ? style.filter : style.filter != null ? [style.filter] : []
  const filterName = filters.map((entry) => cssScalar(entry)).find((entry) => typeof entry === 'string' && /^[a-z-]+$/.test(entry))
  if (typeof filterName === 'string' && !filterName.startsWith('fn_')) {
    // Unity serializes filter() as [name, argument count, ...arguments]; only
    // the trailing dimension is the actual argument.
    const argument = filters.filter((entry) => entry && typeof entry === 'object').map((entry) => dim(entry)).find(Boolean)
    css.filter = `${filterName}(${argument ?? '100%'})`
  }

  const positionX = cssScalar(style['background-position-x'])
  const positionY = cssScalar(style['background-position-y'])
  if (positionX != null || positionY != null) css.backgroundPosition = `${positionX ?? 'center'} ${positionY ?? 'center'}`

  const align = textAlignCss(String(style['unity-text-align'] ?? '').toLowerCase(), css.flexDirection ?? style['flex-direction'])
  if (align) {
    css.textAlign = align.textAlign
    // Some official controls (notably PlayButton's label) carry text styling on
    // a VisualElement rather than a Label. Honour their Unity alignment too so
    // the visible label stays centred inside its actual clickable surface.
    if (!('justify-content' in style)) css.justifyContent = align.justifyContent
    if (!('align-items' in style)) css.alignItems = align.alignItems
  }
  const font = String(style['unity-font-style'] ?? '').toLowerCase()
  if (font.includes('bold')) css.fontWeight = 700
  if (font.includes('italic')) css.fontStyle = 'italic'
  const outlineWidth = scalar(style['unity-text-outline-width'])
  const outlineColor = cssColor(style['unity-text-outline-color'])
  if (outlineWidth || outlineColor) {
    const width = outlineWidth || 1, color = String(outlineColor ?? '#000000a6')
    css.textShadow = `-${width}px 0 ${color},${width}px 0 ${color},0 -${width}px ${color},0 ${width}px ${color}`
  }

  const transforms: string[] = []
  if (Array.isArray(style.scale) && style.scale.length >= 2) transforms.push(`scale(${scalar(style.scale[0]) ?? 1},${scalar(style.scale[1]) ?? 1})`)
  else if (style.scale != null) transforms.push(`scale(${scalar(style.scale) ?? 1})`)
  if (style.rotate != null) transforms.push(`rotate(${dim(style.rotate, 'deg')})`)
  if (Array.isArray(style.translate)) transforms.push(`translate(${dim(style.translate[0])},${dim(style.translate[1])})`)
  if (transforms.length) css.transform = transforms.join(' ')
  if (style['transform-origin'] != null) css.transformOrigin = Array.isArray(style['transform-origin']) ? style['transform-origin'].map((entry) => dim(entry)).join(' ') : String(style['transform-origin'])
  applyUitkAbsoluteCrossAlign(css, style)
  return css as CSSProperties
}

function insetIsAuthored(style: Record<string, unknown>, key: string): boolean {
  if (!(key in style)) return false
  const value = style[key]
  if (value == null || value === 'auto') return false
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== 'auto'
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'object' && value && 'value' in value) return (value as { value: unknown }).value !== 'auto'
  return Boolean(value)
}

/** UITK `align-self` on an absolutely-positioned element is the flex *cross*
    axis (horizontal under the column default). CSS Box Alignment applies
    `align-self` to the abspos *block* axis, so `center` content-sizes the
    height and ignores `top`+`bottom` — `middlePart` compiled to 209px instead
    of the 1000px the insets describe. Rewrite it to inline-axis insets. */
function applyUitkAbsoluteCrossAlign(css: Record<string, unknown>, style: Record<string, unknown>) {
  if (String(css.position ?? style.position ?? '').toLowerCase() !== 'absolute') return
  const self = String(style['align-self'] ?? '').toLowerCase()
  if (!self || self === 'auto' || self === 'stretch') return
  delete css.alignSelf
  if (insetIsAuthored(style, 'left') || insetIsAuthored(style, 'right')) return
  if (self.includes('center')) {
    css.left = '0px'
    css.right = '0px'
    if (css.marginLeft == null) css.marginLeft = 'auto'
    if (css.marginRight == null) css.marginRight = 'auto'
    if (css.width == null && !insetIsAuthored(style, 'width')) {
      css.width = 'fit-content'
    }
  } else if (self.includes('end')) {
    css.right = '0px'
    if (css.marginLeft == null) css.marginLeft = 'auto'
  } else if (self.includes('start')) {
    css.left = '0px'
  }
}

export function cssText(style: Record<string, unknown>): string {
  return Object.entries(ussToCss(style, false, false)).filter(([, value]) => value != null).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}`).join(';')
}

/** `DofusLabel.SetSingleLine` / `m_isSingleLineVar`.

    The method runs in the C# constructor *after* USS, so an authored
    `isSingleLine="true"` wins over a compiled `white-space: normal`. False or
    unset leaves the sheet alone — `ApplyCommonDofusLabelFeatures` only calls
    `SetSingleLine` when the UXML flag is on. Ellipsis already in the sheet
    needs a clip box, which is what UITK uses to actually elide. */
export function applyAuthoredSingleLine(
  css: CSSProperties,
  properties?: Record<string, unknown>,
): void {
  const raw = properties?.isSingleLine ?? properties?.['is-single-line']
  if (!['true', '1'].includes(String(raw ?? '').toLowerCase())) return
  css.whiteSpace = 'nowrap'
  if (String(css.textOverflow ?? '').toLowerCase() === 'ellipsis') css.overflow = 'hidden'
}

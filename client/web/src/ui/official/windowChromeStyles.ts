/** Official title-bar and context-menu style definitions. */

/** `#header_right` and the `header_buttonRight` inside it: the slot every
    official header keeps on its right, and where a module's "more actions"
    button goes.

    `.header #header_right` is absolute at `right: 0`, which is why the three
    dots land in the module's top-right corner even on a widget whose header
    paints no bar at all. */
export function headerButtonUss(variant: HeaderStyle | 'widget'): Record<string, Record<string, unknown>> {
  const widget = variant === 'widget'
  const height = widget ? undefined : HEADER_VARIANTS[variant].height
  return {
    slot: {
      position: 'absolute', right: 0, top: 0,
      'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'flex-end',
      ...(widget
        ? { padding: { value: 2, unit: 'px' } }
        : {
            width: { value: 74, unit: 'px' }, height: { value: height as number, unit: 'px' },
            'padding-left': { value: 5, unit: 'px' }, 'padding-right': { value: 5, unit: 'px' },
          }),
    },
    button: {
      width: { value: widget ? 20 : 32, unit: 'px' }, height: { value: widget ? 20 : 32, unit: 'px' },
      'justify-content': 'center', 'align-items': 'center', 'background-color': '#00000000',
      ...(widget
        ? { 'border-top-right-radius': { value: 1, unit: 'px' } }
        : { 'border-radius': { value: 4, unit: 'px' } }),
    },
    /** `moreActions` is authored 14x44: the three dots, stacked. */
    icon: {
      width: { value: 14, unit: 'px' }, height: { value: widget ? 16 : 22, unit: 'px' },
      'background-image': 'icons/moreActions.png', 'unity-background-scale': 'scale-to-fit',
    },
  }
}

/** `.contextMenu` and its items — the popup the client opens under a "more
    actions" button. */
export function contextMenuUss(): Record<string, Record<string, unknown>> {
  return {
    menu: {
      position: 'absolute',
      'min-width': { value: 50, unit: 'px' }, 'max-width': { value: 560, unit: 'px' },
      'border-radius': { value: 4, unit: 'px' }, 'background-color': '#000000cc',
      'padding-top': { value: 4, unit: 'px' }, 'padding-bottom': { value: 4, unit: 'px' },
      overflow: 'hidden',
    },
    separator: { height: { value: 1, unit: 'px' }, 'background-color': '#404040ff' },
    item: {
      'flex-direction': 'row', 'align-items': 'center', 'background-color': '#000000e5',
      height: { value: 26, unit: 'px' }, 'padding-right': { value: 8, unit: 'px' },
    },
    label: {
      'flex-grow': 1, 'unity-text-align': 'middle-left',
      'font-size': { value: 16, unit: 'px' }, color: '#b2b3b2ff',
      'margin-right': { value: 4, unit: 'px' }, 'white-space': 'nowrap',
    },
    labelDisabled: {
      'flex-grow': 1, 'unity-text-align': 'middle-left',
      'font-size': { value: 16, unit: 'px' }, color: '#7a7a77ff',
      'margin-right': { value: 4, unit: 'px' }, 'white-space': 'nowrap',
    },
    status: { width: { value: 22, unit: 'px' }, height: { value: 22, unit: 'px' }, 'flex-shrink': 0 },
    statusChecked: {
      width: { value: 22, unit: 'px' }, height: { value: 22, unit: 'px' }, 'flex-shrink': 0,
      'background-image': 'styles/images/tx_puce_selected.png', 'unity-background-scale': 'scale-to-fit',
    },
  }
}

/** `.header.widget.horizontal.small` against `.large`: the two title heights
    the reduce and maximize entries switch a module between. */
export const HEADER_SMALL_PX = 10

/** `.header.primary` and `.header.secondary`, the two variants `header-style`
    selects. The radius is the window's own 12px, so the bar closes the panel's
    top corners instead of covering them.

    Colours and the ornament file are MediumFont_Standard tokens
    (`tokens.json`, the sheet `PanelSettings.themeUss` actually mounts). The
    first transcription used GoldAndSteel tints (`#ff5e3333`,
    `ornamentGoldAndSteel.png`) which MergedUSS never selects. */
export const HEADER_VARIANTS = {
  primary: {
    height: 42,
    /** `--header_background` */
    background: '#b6b3e533',
    /** `--header_gradient` */
    highlightTint: '#b6b3e5cc',
    /** `--highlight_secondary100` */
    ornamentTint: '#b6b3e6ff',
    title: 22, lineHeight: 26, iconBox: 74, icon: 30,
  },
  secondary: {
    height: 38,
    /** `--highlight_secondary35` */
    background: '#b6b3e659',
    highlightTint: '#b6b3e5cc',
    ornamentTint: '#b6b3e6ff',
    title: 18, lineHeight: 22, iconBox: 74, icon: 24,
  },
} as const

export type HeaderStyle = keyof typeof HEADER_VARIANTS

export function titleBarHeight(style: HeaderStyle): number {
  return HEADER_VARIANTS[style].height
}

/** Every part of the bar, in the USS shape the converter already speaks. */
export function titleBarUss(style: HeaderStyle): Record<string, Record<string, unknown>> {
  const variant = HEADER_VARIANTS[style]
  return {
    bar: {
      position: 'relative', left: 0, right: 0, top: { value: 0, unit: 'px' },
      width: { value: 100, unit: '%' },
      height: { value: variant.height, unit: 'px' },
      'flex-shrink': 0,
      'flex-direction': 'row', 'justify-content': 'space-between', 'align-items': 'center',
      // `--background_dark100` under the 20% `--header_background` tint.
      // MergedUSS `.header.primary` is in-flow (`width: 100%; height: 42px`,
      // top radii 12) — the panel's top edge, not a bar hung above it.
      'background-color': '#1b1d32ff',
      'border-top-left-radius': { value: 12, unit: 'px' }, 'border-top-right-radius': { value: 12, unit: 'px' },
      'box-shadow': 'inset 0px 1px 0 rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    /** `--header_background`. */
    tint: {
      position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
      'background-color': variant.background,
    },
    // A `background-image` tinted with `--header_gradient` becomes a mask, and
    // a mask cannot also paint the flat fill underneath, so the gradient gets a
    // layer of its own.
    highlight: {
      position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
      'background-image': 'styles/images/headerHighlight.png',
      'unity-background-image-tint-color': variant.highlightTint,
    },
    ornament: {
      position: 'absolute', right: 0, top: 0,
      width: { value: 280, unit: 'px' }, height: { value: 40, unit: 'px' },
      // `--header_ornament` on `.header.primary > #header_ornament_right`.
      'background-image': 'styles/images/ornamentStandard.png',
      'unity-background-image-tint-color': variant.ornamentTint,
      'border-top-left-radius': { value: 12, unit: 'px' },
      scale: [-1, 1],
    },
    left: {
      width: { value: variant.iconBox, unit: 'px' }, height: { value: variant.height, unit: 'px' },
      'flex-direction': 'row', 'justify-content': 'center', 'align-items': 'center',
      padding: { value: 10, unit: 'px' }, gap: { value: 10, unit: 'px' },
    },
    icon: {
      width: { value: variant.icon, unit: 'px' }, height: { value: variant.icon, unit: 'px' },
      'justify-content': 'center', 'align-items': 'center',
    },
    headline: {
      'flex-grow': 1, 'flex-shrink': 1,
      'unity-text-align': 'middle-center', 'unity-font-style': 'bold',
      'unity-font': 'fonts/Rowdies-Regular.ttf',
      'font-size': { value: variant.title, unit: 'px' }, 'line-height': { value: variant.lineHeight, unit: 'px' },
      color: '#ffffffff',
      'unity-text-outline-color': '#00000059', 'unity-text-outline-width': { value: 1, unit: 'px' },
      'text-overflow': 'ellipsis', overflow: 'hidden', 'white-space': 'nowrap',
    },
    right: {
      width: { value: variant.iconBox, unit: 'px' }, height: { value: variant.height, unit: 'px' },
      'flex-direction': 'row', 'justify-content': 'center', 'align-items': 'center',
    },
    // The only close button the extracted sheets describe, from the window
    // component both families share.
    close: {
      width: { value: 22, unit: 'px' }, height: { value: 22, unit: 'px' },
      'background-image': 'styles/images/btn_close_normal.png', 'background-color': '#58585800',
      'border-width': 0, 'border-radius': 0, 'unity-background-scale': 'scale-to-fit',
    },
  }
}


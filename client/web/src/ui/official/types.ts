import type { ChangeEventHandler, CSSProperties, KeyboardEventHandler, MouseEventHandler, PointerEventHandler, ReactNode, UIEventHandler } from 'react'

export type VisualTreeNode = {
  id?: string | number
  type?: string
  /** UITK C# type. Kept for the inspector and the Giny normalizer; the
      renderer keys off `type`. */
  full_type?: string
  /** VisualTreeAsset name, present on document roots. */
  asset?: string
  /** Extractor: `<Instance template=storage>` body, or a typed host clone. */
  template_expanded?: string
  template_alias?: string
  component_asset?: string
  /** Extractor: VisualTreeAsset C# `Open*Tab` clones into an empty `#ctr-ui` /
      `#uiCtr` host (`guildBase` → `guild`, `allianceBase` → `alliance`). The
      host's `rule_index` stays on the wrapper sheet; descendants use this. */
  tab_body?: string
  name?: string
  binding?: string
  text?: string
  /** Set when the extractor dropped a Unity default / mash caption. */
  placeholder_text?: boolean
  classes?: string[]
  /** Index in the tree's inline USS sheet; matches `uitk-inline-{doc}-{N}` from dofus3-ui. */
  rule_index?: number
  style?: Record<string, unknown>
  /** Keyed by state name; a rule that needs several at once joins them with
      `+` (`focus+hover`) and carries the declarations of each part too. */
  states?: Record<string, Record<string, unknown>>
  /** Rules whose pseudo-class sits on an ancestor, e.g. `.button:hover #label`.
      `depth` counts how many levels up that ancestor is. */
  ancestor_states?: {
    state: string
    depth: number
    style: Record<string, unknown>
    /** Every ancestor state the rule requires, when it names more than one. */
    requires?: { depth: number; state: string }[]
    /** The state the node itself must be in, for `.window:hover #label:disabled`. */
    self_state?: string
  }[]
  properties?: Record<string, unknown>
  sprite?: string
  /** A sprite name the bundles do not back. Kept so it is reportable, never
      painted: the extractor resolves everything it can to a real file. */
  sprite_unresolved?: string
  /** Intrinsic sprite size in pixels, from the Unity Sprite rect. */
  sprite_size?: [number, number]
  children?: VisualTreeNode[]
  canvas?: { width: number; height: number }
}

export type BindingOverride = {
  /** Quantity shown by the shared Slot constructor. */
  quantity?: number
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  selectedOption?: string
  onSelect?: (value: string) => void
  text?: string
  /** `true` removes the node. `false` *reveals* it: many official elements ship
      `display: none` and the client only shows them once it has data to put
      inside, so binding data and mounting the element are the same act. */
  hidden?: boolean
  disabled?: boolean
  className?: string
  /** Hold an official interaction state open, e.g. a menu tile that stays
      pressed while its interface is on screen. */
  state?: 'hover' | 'pressed' | 'focus' | 'disabled' | 'checked' | 'selected'
  /** 0–100 fill for an official progress / gauge constructor. */
  value?: number
  /** Toggle a checkbox, switch or radio from live data. */
  checked?: boolean
  /** Open a dropdown list the way `activatedTrue` does in C#. */
  open?: boolean
  /** EntityLook string for `EntityDisplayer`. */
  look?: string
  /** How the look is framed inside the official host. `portrait` is the
      default the renderer uses when C# would draw the entity itself. */
  lookStatic?: boolean
  lookFacing?: number
  lookMode?: 'fit' | 'hero' | 'portrait' | 'selection'
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLElement>
  onScroll?: UIEventHandler<HTMLElement>
  onDoubleClick?: MouseEventHandler<HTMLElement>
  onContextMenu?: MouseEventHandler<HTMLElement>
  /** Live text for a Figma ``TextInput``; C# writes this onto ``#textInput_userText``. */
  onInput?: ChangeEventHandler<HTMLInputElement>
  /** Enter on the official chat field (`#ti_chatInput`). */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  /** Dragging a window by its official header needs the pointer sequence, not
      a click; the official chrome is the handle. */
  onPointerDown?: PointerEventHandler<HTMLElement>
  onPointerMove?: PointerEventHandler<HTMLElement>
  onPointerUp?: PointerEventHandler<HTMLElement>
  /** Paint an official icon sprite on this node, the way a C# constructor
      assigns `itemTile_icon` at runtime. */
  sprite?: string
  /** Vertices for `EntityStatsGraph` (C# paints a mesh; we stroke the same hex). */
  graph?: number[]
  children?: ReactNode
  replaceChildren?: boolean
  /** Repeat this element's official children, giving each copy the binding
      `<name>:<index>`. A `tile-grid` SlotGrid ships one compiled tile and the
      client decides how many fit, which is what the C# constructor does. */
  repeat?: number
  /** Instantiates an official tooltip tree on hover, the way TooltipManager
      does in C#. `text` fills TextTooltip's `text` binding when `resolve` is
      omitted; `delay` is the hover-intent wait in ms. */
  tooltip?: TooltipBinding
}

export type TooltipBinding = {
  tree: string
  resolve?: BindingResolver
  text?: string
  delay?: number
  /** Official clones inside the tooltip (`ctr_tooltipBlocks` → `ItemTooltipBlock`). */
  repeaters?: import('./repeaters').Repeater
}

export type BindingResolver = (binding: string, scope?: string) => BindingOverride | undefined

/** Any VisualTreeAsset name from the extracted manifest. The screens the app
    drives explicitly are spelled out so they still autocomplete. */
export type OfficialTreeName =
  | 'login' | 'ServerSelection' | 'characterSelection' | 'characterCreation'
  | 'characterHeader' | 'gameMenu' | 'mainMenu'
  | (string & {})

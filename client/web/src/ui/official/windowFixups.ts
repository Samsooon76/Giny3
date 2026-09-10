/**
 * Per-window corrections, applied on top of the extracted UXML.
 *
 * The renderer resolves a node's style from the extracted USS and writes most
 * of it **inline** (`visualNode.tsx`), because a `:hover` rule has to be able
 * to win over the rest position. That is correct, but it means no stylesheet
 * can ever correct a node afterwards: an inline declaration beats every
 * selector. Without a seam, the only way to fix one window is to change the
 * engine — which then moves all 685 others.
 *
 * A fixup is that seam. It is merged at the *authored USS* level, before the
 * cascade is split, so it behaves exactly like a declaration Ankama had
 * written: states, tint, sprite and 9-slice all still see it.
 *
 * Use it for what the generic pipeline cannot know — a class a C# constructor
 * adds, a value the extractor flattened, a container UI Builder left at a rest
 * size the client resizes at runtime. Anything that is wrong on *every* window
 * belongs in the engine instead; a fixup is deliberately local.
 *
 * Keys are USS property names (`background-color`, `flex-direction`), not the
 * CSS camelCase ones, since the merge happens before `ussToCss`.
 *
 * ```ts
 * hud_inventory: {
 *   // Ankama sizes this from C#; UI Builder left the rest pose at 0.
 *   ctr_itemsList: { style: { height: { value: 420, unit: 'px' } } },
 * }
 * ```
 *
 * Find the node to name with `capture-ui` + `compare-ui`: the report attributes
 * each mismatching region to the element that covers it, and its `binding` or
 * `id` is the key to use here.
 */

export type WindowFixup = {
  /** USS declarations merged over the extracted ones. */
  style?: Record<string, unknown>
  /** Replace the resolved sprite, the way a C# constructor assigns one. */
  sprite?: string
}

/** Fixups for one tree, keyed by the node's `name`, then its `binding`. */
export type TreeFixups = Record<string, WindowFixup>

/**
 * `'*'` applies to every tree; a tree name applies to that tree only and is
 * merged over the wildcard.
 */
export const WINDOW_FIXUPS: Record<string, TreeFixups> = {
  challengeSettingsDisplay: {
    rb_challengeChoice: { style: { 'unity-background-image-tint-color': 'var(--highlight_secondary100)', 'background-size': '36px 36px' } },
    rb_challengeRandom: { style: { 'unity-background-image-tint-color': 'var(--highlight_secondary100)', 'background-size': '36px 36px' } },
    switchLine_iconLeft_Vector: { style: { 'unity-background-image-tint-color': 'var(--challenge-xp-color)' } },
    switchLine_iconRight_Vector: { style: { 'unity-background-image-tint-color': 'var(--challenge-loot-color)' } },
  },
  characterSheetUi: {
    // EntityPortrait is authored at top:-22 so it straddles the title bar.
    // The content clipping rectangle otherwise removes the top of the portrait.
    window_content: { style: { overflow: 'visible' } },
  },
}

export function windowFixup(
  tree: string | undefined,
  name: string | undefined,
  binding: string | undefined,
): WindowFixup | undefined {
  const global = lookup(WINDOW_FIXUPS['*'], name, binding)
  const local = tree ? lookup(WINDOW_FIXUPS[tree], name, binding) : undefined
  if (!global) return local
  if (!local) return global
  return {
    style: global.style || local.style ? { ...global.style, ...local.style } : undefined,
    sprite: local.sprite ?? global.sprite,
  }
}

function lookup(
  fixups: TreeFixups | undefined,
  name: string | undefined,
  binding: string | undefined,
): WindowFixup | undefined {
  if (!fixups) return undefined
  // `name` first: it is the authored identity, while a binding can repeat
  // across the clones of a template.
  return (name ? fixups[name] : undefined) ?? (binding ? fixups[binding] : undefined)
}

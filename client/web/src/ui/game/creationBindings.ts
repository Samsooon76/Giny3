import type { BindingOverride } from '../official/types'

/** Official Picto/UI class portraits (`class_assets_1x.bundle` / ``class_heads``). */
export function creationHeadSprite(breedId: number, gender: 'male' | 'female'): string {
  return `Head_${breedId}${gender === 'female' ? 1 : 0}`
}

export function resolveCreationChoiceSlot(
  present: boolean,
  selected: boolean,
  sprite: string | undefined,
  onSelect: () => void,
): BindingOverride {
  if (!present) return { hidden: true }
  return {
    onClick: onSelect,
    state: selected ? 'selected' : undefined,
    sprite,
  }
}

/** Keep the official TextInput interior. UXML has no placeholder-text on the
    name field; inventing «Nom du personnage» was a homemade overlay. */
export function resolveCreationName(
  name: string,
  onChange: (name: string) => void,
): BindingOverride {
  return {
    text: name,
    onInput: (event) => onChange(event.currentTarget.value),
  }
}

/** C# assigns the spell picto on the official Slot; a homemade tile was
    replaceChildren + a letter fallback. Missing Picto stays an empty slot. */
export function resolveCreationSpellSlot(spell?: { icon?: string }): BindingOverride {
  if (!spell) return { hidden: true }
  return spell.icon ? { sprite: `/game-data/client/${spell.icon}` } : {}
}

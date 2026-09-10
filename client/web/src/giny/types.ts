export type Account = { id: number; username: string; nickname: string; tag: string }
export type ServerCharacterPreview = { id: number; name: string; look: string }
export type GameServer = {
  characters?: ServerCharacterPreview[]
  id: number; name: string; status: string; population: string; selectable: boolean
  monoAccount: boolean; type: number; charactersCount: number; characterSlots: number
}
export type Character = {
  id: number; name: string; level: number; look: string; breedId: number
  breedName: string; sex: boolean; prestige: number
}
export type MonsterGroupMember = {
  id: number
  name: string
  level: number
  grade: number
  look: string
  is_boss?: boolean
  is_mini_boss?: boolean
}
export type MonsterGroupInfo = {
  attackable: boolean
  modular: boolean
  members: MonsterGroupMember[]
  xp?: number
  kamas?: number
  drops?: number[]
}
export type WorldActor = {
  npc?: { template_id: number; actions: number[] } | null
  id: number; kind: string; cell_id: number; direction: number; entity_look: string
  name?: string
  guild?: { id: number; name: string; emblem?: { symbol_shape: number; symbol_color: number; background_shape: number; background_color: number } } | null
  group?: MonsterGroupInfo | null
  [key: string]: unknown
}
export type StatBreakdown = {
  base_value: number; additional: number; equipment: number; total: number
}
export type HudSecondaryStat = { key: string; label: string; value: StatBreakdown }
export type HudShortcut = { slot: number; spell_id: number; name: string; icon_id?: number }
export type ItemEffect = {
  effect_id: number; value: number; min: number; max: number
}
export type SpellPreviewEffect = { effectId: number; diceNum?: number; diceSide?: number; value?: number; duration?: number; delay?: number; rawZone?: string; targetMask?: string; triggers?: string; order?: number; random?: number; group?: number }
export type HudSpell = {
  preview_effects?: SpellPreviewEffect[] | null
  preview_critical_effects?: SpellPreviewEffect[] | null
  unavailable_reason?: string | null
  source?: 'giny'
  effect_lines?: string[]
  critical_hit_probability?: number
  initial_cooldown?: number
  global_cooldown?: number
  max_stack?: number
  need_free_cell?: boolean
  need_taken_cell?: boolean
  cast_in_diagonal?: boolean
  description?: string
  minimum_level?: number
  available?: boolean
  obtention_levels?: number[]
  id: number; name: string; grade: number; icon_id?: number
  ap_cost?: number; min_range?: number; range?: number
  cast_in_line?: boolean; cast_test_los?: boolean
  max_cast_per_turn?: number; max_cast_per_target?: number
  min_cast_interval?: number; states_criterion?: string
  preview_zones?: string[]
}
export type HudItem = {
  usable?: boolean
  equip_positions?: number[]
  uid: number; gid: number; name: string; quantity: number
  position: number; equipped: boolean; appearance_id: number; icon_id?: number; level: number
  effects?: ItemEffect[]
  criteria?: string
  criteria_ok?: boolean
  item_set_id?: number
  type_id?: number
  is_weapon?: boolean
  ap_cost?: number
  min_range?: number
  range?: number
  critical_hit_probability?: number
  average_price?: number
}
export type HudQuest = { id: number; name: string; remaining: number; completed?: boolean; objectiveIds?: number[]; rewards?: { kamas:number; experience:number; items:Array<{gid:number;quantity:number}> } }
export type HudJob = {
  id: number; name: string; level: number
  experience: number; experience_floor: number; experience_next: number
}
export type HudGuildMember = { id: number; name: string; level: number; breed_id: number; online: boolean; rank: string; note?: string; achievement_points?: number; guildatons?: number }
export type HudGuild = {
  id: number; name: string; level: number
  experience: number; experience_floor: number; experience_next: number
  motd: string; kamas: number
  members?: HudGuildMember[]
}
export type CharacterHud = {
  catalog_version?: string | null
  capabilities?: string[]
  titles?: { known: number[]; active: number; entries?: { id: number; name: string }[] }
  ornaments?: { known: number[]; active: number; entries?: { id: number; name: string }[] }
  spell_choices?: HudSpell[][]
  /** Client-side marker: true for an emulator snapshot, false for the identity-only fallback. */
  synchronized?: boolean
  account: { id: number; username: string; nickname: string }
  character: {
    id: number; name: string; level: number; look: string
    breed_id: number; breed_name: string; sex: boolean
  }
  map: {
    id: number; world_map_id?: number; subarea_id: number; subarea_name: string; area_name: string
    x: number; y: number; level: number
  }
  life: { current: number; max: number; shield: number }
  energy: { current: number; max: number }
  experience: { current: number; floor: number; next: number }
  points: {
    stats: number; spells: number; ap: number; mp: number
    range: number; initiative: number; prospecting: number; summons: number
  }
  kamas: number
  weight: { current: number; max: number }
  characteristics: {
    vitality: StatBreakdown; strength: StatBreakdown; intelligence: StatBreakdown
    chance: StatBreakdown; agility: StatBreakdown; wisdom: StatBreakdown
  }
  combat: {
    critical_hit: StatBreakdown; heal: StatBreakdown; all_damage: StatBreakdown
    earth_resist: StatBreakdown; fire_resist: StatBreakdown
    water_resist: StatBreakdown; air_resist: StatBreakdown; neutral_resist: StatBreakdown
  }
  secondary: HudSecondaryStat[]
  guild: HudGuild | null
  achievement_points: number
  shortcuts: HudShortcut[]
  spells: HudSpell[]
  items: HudItem[]
  quests: HudQuest[]
  jobs: HudJob[]
}
/** One interactive element of the active map, as the emulator sees it.

    `element_id` is the identifier the server expects in an interactive-use
    request; it matches `interaction_id` in the extracted map document. Exactly
    one of `gfx_id` (mapgfx sprite) and `bones_id` (Animator2D prop) is set, the
    other is -1. `state` is only present for stated elements (job resources):
    0 active, 1 depleted, 2 being harvested. */
export type WorldInteractive = {
  element_id: number; cell_id: number; gfx_id: number; bones_id: number
  element_type_id: number; skill_id: number; skill_name: string | null
  action: string; enabled: boolean; state: number | null
  job_id: number | null; min_level: number | null
}
export type WorldSession = {
  mapId: number; subareaId: number; account: Account; server: SelectedServer
  character: Character; cellId: number; direction: number; actors: WorldActor[]
  interactives: WorldInteractive[]
  hud: CharacterHud | null
}
export type SelectedServer = GameServer & { host: string; ports: number[]; canCreateCharacter: boolean }
export type Movement = { actorId: number; path: number[]; keys: number[]; forcedDirection: number }

/** One row in the official `chatItem` list (`content` + optional `subContent`). */
export type ChatLineKind = 'message' | 'info' | 'error'
export type ChatLine = {
  id: string
  kind: ChatLineKind
  channel: number
  sender?: string
  senderId?: number
  content: string
  timestamp: number
}
export const CHAT_CHANNEL = {
  GLOBAL: 0,
  INFO: 10,
} as const
export type CreationRequest = { name: string; breedId: number; sex: boolean; cosmeticId: number; colors: number[] }
export type CreationCatalog = { classes: CreationClass[] }
export type CreationRole = { id: number; name: string; description: string; value: number; asset_id: number }
export type CreationSpell = {
  id: number; name: string; description: string; icon_id: number; icon: string
  ap_cost: number; min_range: number; range: number; critical_hit: number; effects: string[]
}
export type CreationClass = {
  complexity?: number
  breed_id: number; label: string; slug: string; description: string; gameplay: string; mechanics: string
  roles: CreationRole[]; spells: CreationSpell[]
  variants: Record<string, { base_look: string; colors: Record<string, string>; heads: Array<{ id: number; order: number; look: string }> }>
}

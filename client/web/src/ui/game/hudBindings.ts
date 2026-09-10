import type { BindingOverride, BindingResolver } from '../official/types'
import type { CharacterHud, WorldSession } from '../../giny/types'
import {
  bindAchievements,
  bindActionBar,
  bindAppearance,
  bindBank,
  bindCharacterInformations,
  bindCharacterSheet,
  bindChat,
  bindFriends,
  bindGameMenu,
  bindGuild,
  bindInventory,
  bindMap,
  bindMapInfo,
  bindMinimap,
  bindProgressGauge,
  bindQuestTracker,
  bindQuests,
  bindSpells,
  bindJobs,
} from './hudWidgets'

export { formatInt, ratio } from './hudWidgets'

export type HudView = CharacterHud & { account: CharacterHud['account'] & { tag?: string } }

/** Live chrome the official C# constructors add on the character sheet:
    simple vs detailed right panel, and the left-column breakdown. */
export type CharacterSheetUi = {
  view?: 'simple' | 'detailed'
  detailsOpen?: boolean
  onView?: (view: 'simple' | 'detailed') => void
  onToggleDetails?: () => void
}

/** IL2CPP `CartographyMapUI.WorldMapMenuInfo` + `SwitchToConquestOrAnomalyMode`.
    UXML rest: `btn_worldmap` has no `main-style` (enum 0 = primary); anomaly /
    conquest buttons are `secondary`. Conquest USS is `display: none`; anomaly
    USS is `display: flex` (UI Builder leftover) until C# switches to it. */
export type CartographyMode = 'worldmap' | 'anomaly' | 'conquest'

export type CartographyUi = {
  mode?: CartographyMode
  onMode?: (mode: CartographyMode) => void
}

/** IL2CPP `Core.UILogic.Cartography.CartographyBannerUI` (`UiWidgetMinimap`).
 *  `m_mapView` + `m_playerPos`, `MapViewUpdate` sur changement de map / resize.
 *  La vue est la carte du monde recadrée autour du joueur : la position vient
 *  de `hud.map`, pas de la cellule tactique. Le clic ouvre la grande Carte. */
export type MinimapUi = {
  onOpenMap?: () => void
}

/** IL2CPP `Core.UILogic.Common.GameMenu`. `btn_menu` toggles `mainMenu`. */
export type GameMenuUi = {
  onOptions?: () => void
  open?: boolean
  onToggle?: () => void
}

/** Live chat (`chatview`) : champ `#ti_chatInput`, lignes en `chatRepeaters`,
    boutons officiels câblés (canal, ajout, nouveautés, repli). */
export type ChatUi = {
  draft: string
  onDraft: (value: string) => void
  onSend: () => void
  /** Canal actif et son raccourci (`/s`) peint sur `btn_dialect`. */
  channel: number
  channelShortcut: string
  onCycleChannel: () => void
  onAddChannel: () => void
  /** Lignes arrivées hors épinglage bas : `btn_news` (`0` = masqué). */
  unread: number
  onScrollBottom: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

const ZERO = { base_value: 0, additional: 0, equipment: 0, total: 0 }

export const PREVIEW_HUD: CharacterHud = {
  synchronized: true,
  account: { id: 1, username: 'admin', nickname: 'Hugo' },
  character: {
    id: 1, name: 'Hugo', level: 200,
    look: '{1|10,2012|1=#e59b68,2=#773f29,3=#d8742e,4=#496352,5=#512a15,6=#5b5243|53}',
    breed_id: 1, breed_name: 'Féca', sex: false,
  },
  // Incarnam is world map 2 (`superareas.json`), the frame the official
  // capture `output/ui_shots/official/hud.png` was taken on.
  map: { id: 154010883, world_map_id: 2, subarea_id: 1, subarea_name: 'Pâturages', area_name: 'Incarnam', x: 2, y: -4, level: 5 },
  life: { current: 2487, max: 3915, shield: 0 },
  energy: { current: 10000, max: 10000 },
  experience: { current: 7500000, floor: 7000000, next: 9999999 },
  points: { stats: 12, spells: 0, ap: 6, mp: 3, range: 0, initiative: 1240, prospecting: 100, summons: 1 },
  kamas: 12500,
  weight: { current: 320, max: 1500 },
  characteristics: {
    vitality: { base_value: 100, additional: 0, equipment: 50, total: 150 },
    strength: { base_value: 80, additional: 0, equipment: 20, total: 100 },
    intelligence: { base_value: 200, additional: 0, equipment: 40, total: 240 },
    chance: { base_value: 0, additional: 0, equipment: 0, total: 0 },
    agility: { base_value: 10, additional: 0, equipment: 0, total: 10 },
    wisdom: { base_value: 40, additional: 0, equipment: 10, total: 50 },
  },
  combat: {
    critical_hit: ZERO, heal: ZERO, all_damage: ZERO,
    earth_resist: ZERO, fire_resist: ZERO, water_resist: ZERO, air_resist: ZERO, neutral_resist: ZERO,
  },
  secondary: [
    { key: 'ap_dodge', label: 'Esquive PA', value: { ...ZERO, total: 24 } },
    { key: 'mp_dodge', label: 'Esquive PM', value: { ...ZERO, total: 18 } },
    { key: 'tackle', label: 'Tacle', value: { ...ZERO, total: 12 } },
    { key: 'dodge', label: 'Fuite', value: ZERO },
    { key: 'ap_reduction', label: 'Retrait PA', value: ZERO },
    { key: 'mp_reduction', label: 'Retrait PM', value: ZERO },
    { key: 'reflect', label: 'Renvoi', value: ZERO },
  ],
  guild: null,
  achievement_points: 0,
  shortcuts: [{ slot: 0, spell_id: 12983, name: 'Retour du Bâton', icon_id: 12145 }],
  spells: [{ id: 12983, name: 'Retour du Bâton', grade: 1, icon_id: 12145 }],
  // Dev-only inventory state made exclusively from ItemsDataRoot records. It
  // exercises every official slot path while a live session keeps using the
  // authoritative items sent by Giny.
  items: [
    { uid: 1, gid: 2411, name: 'Coiffe du Bouftou', quantity: 1, position: 6, equipped: true, appearance_id: 0, icon_id: 16041, level: 20 },
    { uid: 2, gid: 677, name: 'Cape du Pirate', quantity: 1, position: 7, equipped: true, appearance_id: 0, icon_id: 17011, level: 1 },
    { uid: 3, gid: 44, name: 'Épée de Boisaille', quantity: 1, position: 1, equipped: true, appearance_id: 0, icon_id: 6007, level: 7 },
    { uid: 4, gid: 70, name: 'Amulette du Hibou', quantity: 1, position: 0, equipped: true, appearance_id: 0, icon_id: 1001, level: 8 },
    { uid: 5, gid: 103, name: 'Anneau de Sagesse', quantity: 1, position: 2, equipped: true, appearance_id: 0, icon_id: 9007, level: 9 },
    { uid: 6, gid: 112, name: 'Anneau de Chance', quantity: 1, position: 4, equipped: true, appearance_id: 0, icon_id: 9009, level: 9 },
    { uid: 7, gid: 255, name: 'Ceinture Vitalesque', quantity: 1, position: 3, equipped: true, appearance_id: 0, icon_id: 10009, level: 9 },
    { uid: 8, gid: 892, name: 'Bottes du Bouftou', quantity: 1, position: 5, equipped: true, appearance_id: 0, icon_id: 11003, level: 4 },
    { uid: 9, gid: 91, name: 'Arc de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 2001, level: 7 },
    { uid: 10, gid: 97, name: 'Dagues de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 5010, level: 7 },
    { uid: 11, gid: 121, name: "Anneau d'Agilité", quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 9001, level: 9 },
    { uid: 12, gid: 134, name: 'Baguette de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 3008, level: 3 },
    { uid: 13, gid: 140, name: 'Bâton de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 4001, level: 9 },
    { uid: 14, gid: 147, name: 'Marteau de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 7001, level: 6 },
    { uid: 15, gid: 153, name: 'Pelle de Boisaille', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 8001, level: 6 },
    { uid: 16, gid: 279, name: 'La Larme du Bouftou', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 1007, level: 5 },
    { uid: 17, gid: 281, name: 'Pomme', quantity: 8, position: 63, equipped: false, appearance_id: 0, icon_id: 42001, level: 1 },
    { uid: 18, gid: 298, name: 'Sandales Tofuesques', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 11004, level: 3 },
    { uid: 19, gid: 468, name: "Pain d'Incarnam", quantity: 12, position: 63, equipped: false, appearance_id: 0, icon_id: 33013, level: 1 },
    { uid: 20, gid: 679, name: 'Parchemin Blanc', quantity: 3, position: 63, equipped: false, appearance_id: 0, icon_id: 13003, level: 1 },
    { uid: 21, gid: 766, name: 'Koliet Aclou', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 1034, level: 1 },
    { uid: 22, gid: 767, name: 'Gantie Royal', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 9008, level: 6 },
    { uid: 23, gid: 768, name: 'Camaïneux', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 9033, level: 4 },
    { uid: 24, gid: 769, name: 'Einekeineux', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 11005, level: 5 },
    { uid: 25, gid: 784, name: 'Bottes du Chat Buté', quantity: 1, position: 63, equipped: false, appearance_id: 0, icon_id: 11003, level: 4 },
  ],
  // Followed-quest tracker (`lv_main`), not the encyclopaedia dump. Same
  // GameData id the quests-window preview uses.
  quests: [{ id: 18, name: "Wogew l'hewmite", remaining: 1 }],
  jobs: [{ id: 2, name: 'Bûcheron', level: 1, experience: 0, experience_floor: 0, experience_next: 50 }],
}

const EMPTY_STATS: CharacterHud['characteristics'] = {
  vitality: ZERO, strength: ZERO, intelligence: ZERO, chance: ZERO, agility: ZERO, wisdom: ZERO,
}

/** When the World snapshot is late or missing, still paint identity from the session. */
export function hudFromSession(session: WorldSession): CharacterHud {
  if (session.hud) return session.hud
  return {
    synchronized: false,
    account: { id: session.account.id, username: session.account.username, nickname: session.account.nickname },
    character: {
      id: session.character.id, name: session.character.name, level: session.character.level,
      look: session.character.look, breed_id: session.character.breedId,
      breed_name: session.character.breedName, sex: session.character.sex,
    },
    map: { id: session.mapId, subarea_id: session.subareaId, subarea_name: '', area_name: '', x: 0, y: 0, level: 0 },
    life: { current: 0, max: 0, shield: 0 },
    energy: { current: 0, max: 0 },
    experience: { current: 0, floor: 0, next: 0 },
    points: { stats: 0, spells: 0, ap: 0, mp: 0, range: 0, initiative: 0, prospecting: 0, summons: 0 },
    kamas: 0,
    weight: { current: 0, max: 0 },
    characteristics: EMPTY_STATS,
    combat: {
      critical_hit: ZERO, heal: ZERO, all_damage: ZERO,
      earth_resist: ZERO, fire_resist: ZERO, water_resist: ZERO, air_resist: ZERO, neutral_resist: ZERO,
    },
    secondary: [],
    guild: null,
    achievement_points: 0,
    shortcuts: [],
    spells: [],
    items: [],
    quests: [],
    jobs: [],
  }
}

/** Apply the authoritative HUD identity to the wider world session. This keeps
    the global authenticated header and renderer aligned after a level, look,
    class or name change instead of updating only the currently open window. */
export function sessionWithHud(session: WorldSession, hud: CharacterHud): WorldSession {
  return {
    ...session,
    character: {
      ...session.character,
      id: hud.character.id,
      name: hud.character.name,
      level: hud.character.level,
      look: hud.character.look,
      breedId: hud.character.breed_id,
      breedName: hud.character.breed_name,
      sex: hud.character.sex,
    },
    hud,
  }
}

/** Bind one official in-game tree to the live character / account snapshot. */
export function createHudResolver(
  tree: string,
  hud: HudView | null | undefined,
  sheet?: CharacterSheetUi,
  onAppearance?: () => void,
  cartography?: CartographyUi,
  gameMenu?: GameMenuUi,
  onClose?: () => void,
  chat?: ChatUi,
  minimap?: MinimapUi,
): BindingResolver {
  return (binding, scope) => resolveHud(tree, binding, scope, hud, sheet, onAppearance, cartography, gameMenu, onClose, chat, minimap)
}

export function resolveHud(
  tree: string,
  binding: string,
  scope: string | undefined,
  hud: HudView | null | undefined,
  sheet?: CharacterSheetUi,
  onAppearance?: () => void,
  cartography?: CartographyUi,
  gameMenu?: GameMenuUi,
  onClose?: () => void,
  chat?: ChatUi,
  minimap?: MinimapUi,
): BindingOverride | undefined {
  if (binding === 'header_buttonRight' && onClose) return { onClick: onClose }
  if (!hud) return undefined
  switch (tree) {
    case 'characterInformations': return bindCharacterInformations(binding, hud)
    case 'mapInfo': return bindMapInfo(binding, hud)
    case 'widgetProgressGauge': return bindProgressGauge(binding, hud)
    case 'actionBar': return bindActionBar(binding, scope, hud)
    case 'characterSheetUi': return bindCharacterSheet(binding, scope, hud, sheet)
    case 'equipmentStorageUi': return bindInventory(binding, scope, hud)
    case 'playerSpell':
    case 'spellBase': return bindSpells(binding, hud, scope)
    case 'chatview': return bindChat(binding, chat)
    case 'questList': return bindQuestTracker(binding, hud)
    case 'quests': return bindQuests(binding, hud)
    case 'friends': return bindFriends(binding, hud)
    case 'guildBase':
    case 'guild': return bindGuild(binding, hud, scope)
    case 'achievements': return bindAchievements(binding, hud)
    case 'jobUI':
    case 'jobProgressTab':
    case 'JobRecipesAndSkills':
    case 'recipesUI': return bindJobs(binding, scope)
    case 'rideParentUI':
    case 'mountPaddock': return undefined
    case 'cosmeticUi':
    case 'AppearanceUI': return bindAppearance(binding, hud, onAppearance, scope)
    case 'CartographyBaseUI':
    case 'CartographyMapUI': return bindMap(binding, hud, cartography)
    case 'CartographyBannerUI': return bindMinimap(binding, hud, minimap)
    case 'storageBank':
    case 'auctionHouse':
    case 'CraftUI': return bindBank(binding, hud)
    case 'gameMenu': return bindGameMenu(binding, gameMenu)
    default: return undefined
  }
}

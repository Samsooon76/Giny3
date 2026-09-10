import type { OfficialTreeName } from '../official/OfficialScreen'
import { HUD_LAYOUT } from './hudLayout'

export type GameWindow = {
  /** Stable id: the open-window key, and the key its placement is stored and
      restored under. */
  id: string
  label: string
  /** VisualTreeAsset name in the extracted cache. */
  tree: OfficialTreeName
  /** Exact colour asset from the official menuIcons bundle. Explicit paths
      avoid collisions with monochrome UI glyphs of the same name. */
  icon: string
  /** Size to open at when the tree's own window declares none. Missing or
      percentage axes (spells, recipes) take this C# host size. Cosmetics is
      520+784; inventory 520+493; spells 1440 from `#ctr_spellList` (not
      `.large` 728). Declared pixel USS wins over this. */
  size: { width: number; height: number }
  /** Default binding of the interface's own `Menu` action, from the client's
      `InputPreset1` InputActionAsset (`menuActions.json`, written by
      `extractor.ui.menu`). `shift+c` is Apparence's only binding — the asset
      ships no bare key for it. An interface the `Menu` map does not name has
      no shortcut at all. */
  shortcut?: string
}

/** Bodies that are not windows: they are hosted by an official wrapper that
    carries the `WindowFigma`, title, icon and geometry. Opening the body
    alone makes the client invent a frame. */
export const TREE_WRAPPERS: Record<string, OfficialTreeName> = {
  spellBase: 'playerSpell',
  guild: 'guildBase',
}

export function officialTreeFor(name: string): OfficialTreeName {
  return TREE_WRAPPERS[name] ?? name
}

/** The 24 tiles in images-references/menu-offi.png, in reading order.
    NPC screens and other interfaces remain available through EXTRA_WINDOWS.
    Each entry opens the official host tree, not a nested body. */
export const GAME_WINDOWS: GameWindow[] = [
  { id: 'character', label: 'Personnage', tree: 'characterSheetUi', icon: '/dofus3/menuIcons/characteristic.png', size: { width: 520, height: 880 }, shortcut: 'c' },
  { id: 'spells', label: 'Sorts', tree: 'playerSpell', icon: '/dofus3/menuIcons/spells.png', size: { width: 1440, height: 940 }, shortcut: 's' },
  { id: 'inventory', label: 'Inventaire', tree: 'equipmentStorageUi', icon: '/dofus3/menuIcons/inventory.png', size: { width: 1013, height: 880 }, shortcut: 'i' },
  { id: 'cosmetics', label: 'Cosmétiques', tree: 'cosmeticUi', icon: '/dofus3/menuIcons/cosmetics.png', size: { width: 1304, height: 880 }, shortcut: 'shift+c' },
  { id: 'quests', label: 'Quêtes', tree: 'quests', icon: '/dofus3/menuIcons/quest.png', size: { width: 1330, height: 930 }, shortcut: 'a' },
  { id: 'map', label: 'Carte', tree: 'CartographyMapUI', icon: '/dofus3/menuIcons/map.png', size: { width: 1100, height: 760 }, shortcut: ';' },
  { id: 'calendar', label: 'Calendrier', tree: 'calendarUI', icon: '/dofus3/menuIcons/calendar.png', size: { width: 1440, height: 930 }, shortcut: 'x' },
  { id: 'ladder', label: 'Classement', tree: 'LadderUI', icon: '/dofus3/menuIcons/ladder.png', size: { width: 1328, height: 794 } },
  { id: 'groupSearch', label: 'Recherche de groupe', tree: 'groupSearch', icon: 'groupSearch', size: { width: 1328, height: 930 }, shortcut: 'shift+f' },
  { id: 'profile', label: 'Mon profil', tree: 'PlayerInfoUi', icon: '/dofus3/menuIcons/character.png', size: { width: 600, height: 1010 }, shortcut: 'shift+p' },
  { id: 'friends', label: 'Amis', tree: 'friends', icon: '/dofus3/menuIcons/social.png', size: { width: 1250, height: 930 }, shortcut: 'f' },
  { id: 'guild', label: 'Guilde', tree: 'guildBase', icon: '/dofus3/menuIcons/guild.png', size: { width: 1250, height: 930 }, shortcut: 'g' },
  { id: 'alliance', label: 'Alliance', tree: 'allianceBase', icon: '/dofus3/menuIcons/alliance.png', size: { width: 1250, height: 930 }, shortcut: 'q' },
  { id: 'achievements', label: 'Succès', tree: 'achievements', icon: '/dofus3/menuIcons/success.png', size: { width: 1330, height: 930 }, shortcut: 'u' },
  { id: 'shop', label: 'Boutique', tree: 'webBase', icon: '/dofus3/menuIcons/webShop.png', size: { width: 1420, height: 930 }, shortcut: 'r' },
  { id: 'encyclopedia', label: 'Encyclopédie', tree: 'encyclopediaBase', icon: '/dofus3/menuIcons/encyclopedia.png', size: { width: 1350, height: 845 }, shortcut: 'b' },
  { id: 'jobs', label: 'Métiers', tree: 'jobUI', icon: '/dofus3/menuIcons/job.png', size: { width: 1200, height: 930 }, shortcut: 'j' },
  { id: 'guide', label: 'Guide', tree: 'guidebookBase', icon: '/dofus3/menuIcons/guide.png', size: { width: 1330, height: 810 } },
  { id: 'builds', label: 'Ensembles', tree: 'CharacterPresetUi', icon: '/dofus3/menuIcons/build.png', size: { width: 1440, height: 930 }, shortcut: 'e' },
  { id: 'dreams', label: 'Songes infinis', tree: 'InfiniteDreamHUB', icon: '/dofus3/menuIcons/breach.png', size: { width: 1328, height: 930 } },
  { id: 'havenbag', label: 'Havre-sac', tree: 'havenbagManager', icon: '/dofus3/menuIcons/havenbag.png', size: { width: 492, height: 838 }, shortcut: 'h' },
  { id: 'kolizeum', label: 'Kolizéum', tree: 'PvpArenaBase', icon: '/dofus3/menuIcons/kolizeum.png', size: { width: 1328, height: 794 }, shortcut: 'k' },
  { id: 'breeding', label: 'Élevage', tree: 'BreedingUi', icon: '/dofus3/menuIcons/paddock.png', size: { width: 1920, height: 960 } },
  { id: 'companions', label: 'Compagnons', tree: 'companionUi', icon: '/dofus3/menuIcons/companions.png', size: { width: 1330, height: 1010 }, shortcut: 'v' },
]

/** NPC / world screens the HUD can still open (query string, interface
    browser) but that the official banner does not put on a tile. */
export const EXTRA_WINDOWS: GameWindow[] = [
  { id: 'collection', label: 'Collection', tree: 'collectionTab', icon: 'styles/images/icon_spiral.png', size: { width: 1125, height: 646 } },
  { id: 'bak', label: 'Bourse aux Kamas', tree: 'bakTab', icon: 'styles/images/bag_reward.png', size: { width: 1314, height: 757 } },
  {id:'fightResult',label:'Combat terminé',tree:'fightResult',icon:'',size:{width:1440,height:1020}},
  { id: 'mount', label: 'Monture', tree: 'rideParentUI', icon: 'styles/images/mount.png', size: { width: 716, height: 700 }, shortcut: 'd' },
  { id: 'alignment', label: 'Alignement', tree: 'alignmentTab', icon: 'alignment', size: { width: 520, height: 530 } },
  { id: 'bank', label: 'Banque', tree: 'storageBank', icon: 'bank', size: { width: 984, height: 880 } },
  { id: 'market', label: 'Hôtel de vente', tree: 'auctionHouse', icon: 'shop', size: { width: 1364, height: 882 } },
  { id: 'craft', label: 'Craft', tree: 'CraftUI', icon: 'hammer', size: { width: 1100, height: 820 } },
  { id: 'recipes', label: 'Recettes', tree: 'recipesUI', icon: 'recipe', size: { width: 542, height: 880 } },
]

export const OPENABLE_WINDOWS: GameWindow[] = [...GAME_WINDOWS, ...EXTRA_WINDOWS]

export type HudLayer = { tree: OfficialTreeName }

/** Widget trees share the official surface. HUD_LAYOUT supplies the opening
 * host geometry; saved window gestures take over after that. */
export const HUD_LAYERS: HudLayer[] = [
  { tree: 'mapInfo' },
  { tree: 'questList' },
  { tree: 'chatview' },
  { tree: 'characterInformations' },
  { tree: 'widgetProgressGauge' },
  { tree: 'CartographyBannerUI' },
  { tree: 'actionBar' },
  { tree: 'bannerMenu' },
]

/** UITK documents that stay above opened WindowFigmas.

    IL2CPP `Core.UILogic.Common.GameMenu` is its own document (`gameMenu.uxml`),
    not a MagneticDragWindow. Official cartography still shows the strip, so
    this is not a widget under the map screen. Inner USS is `align-items:
    flex-end` on a 100% host (`TREE_ROOT_STYLE`); leftover UI Builder
    `left: -315` is neutralized like the other HUD trees. */
export const HUD_CHROME_LAYERS: HudLayer[] = [
  { tree: 'widgetManager' },
  { tree: 'gameMenu' },
]

/** Reference opening geometry, also used when resetting widget positions. */
export const WINDOW_SEEDS: Record<string, { x?: number; y?: number; w?: number; h?: number }> = {
  ...HUD_LAYOUT,
}

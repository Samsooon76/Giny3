import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PREVIEW_HUD, createHudResolver, formatInt, ratio, resolveHud, sessionWithHud } from './hudBindings'
import type { WorldSession } from '../../giny/types'
import { hydrateCatalog, resetCatalog } from './catalog'

describe('HUD live bindings', () => {
  beforeEach(() => {
    resetCatalog()
    hydrateCatalog({
      pictos: {
        items: { '16041': '16041.png', '2001': '2001.png' },
        spells: { sort_12145: 'sort_12145.png', weapon_3: 'weapon_3.png' },
      },
      items: {
        '2411': { id: 2411, iconId: 16041, name: 'Coiffe du Bouftou', picto: 'pictos/items/16041.png' },
        '91': { id: 91, iconId: 2001, name: 'Arc de Boisaille', picto: 'pictos/items/2001.png' },
      },
      uiStrings: {
        'ui.common.recipes': 'Recettes',
        'ui.common.filter': 'Filtrer',
        'ui.common.allCategories': 'Toutes les catégories',
        'ui.common.none': 'Aucun',
        'ui.preset.equipPreset': 'Équiper un ensemble',
        'ui.preset.myPresets': 'Mes ensembles',
        'ui.common.level': 'Niveau',
        'ui.stats.lifePoints': 'Points de vie',
        'ui.stats.actionPoints': "Points d'action (PA)",
        'ui.stats.movementPoints': 'Points de mouvement (PM)',
        'ui.social.ankamaFriends': 'Amis Ankama',
        'ui.social.contactsInGame': 'Contacts en jeu',
        'ui.social.contactInGameBlocked': 'Contacts en jeu bloqués',
        'ui.social.addContact': 'Ajouter un contact',
        'ui.social.noFriends': 'Aucun contact en jeu réciproque',
        'ui.social.noInGameContacts': 'Aucun contact en jeu',
        'ui.social.displayOfflineGuildMembers': 'Afficher les membres de la guilde déconnectés',
        'ui.social.warnWhenGuildMembersComeOnline': "Signaler la connexion d'un membre de la guilde",
        'ui.guild.contribute': 'Contribuer',
        'ui.charcrea.faces': 'Visages',
        'ui.charcrea.body': 'Corps',
        'ui.charcrea.idle': 'Poses',
        'ui.charcrea.colors': 'Couleurs',
        'ui.cosmetic.hideUnavailableFaces': 'Masquer les visages non applicables',
        'ui.cosmetic.notObtained': 'Non obtenus',
        'ui.common.hideNames': 'Masquer les noms',
        'ui.common.search': 'Rechercher',
        'ui.common.cancel': 'Annuler',
        'ui.common.validation': 'Valider',
      },
    })
  })
  it('fills the character orb with stacked life, AP and MP, and hides initiative', () => {
    const text = (binding: string) => resolveHud('characterInformations', binding, undefined, PREVIEW_HUD)?.text
    expect(resolveHud('characterInformations', 'lbl_pdv', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('characterInformations', 'parentTopBottom', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(text('lbl_pdvTop')).toBe(formatInt(PREVIEW_HUD.life.current))
    expect(text('lbl_pdvBottom')).toBe(formatInt(PREVIEW_HUD.life.max))
    expect(text('lbl_pa')).toBe(String(PREVIEW_HUD.points.ap))
    expect(text('lbl_pm')).toBe(String(PREVIEW_HUD.points.mp))
    expect(resolveHud('characterInformations', 'ctr_ip', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('characterInformations', 'CharacterInformations', undefined, PREVIEW_HUD)?.className).toBe('withoutPI')
    expect(resolveHud('characterInformations', 'lbl_shield', undefined, PREVIEW_HUD)?.hidden).toBe(true)
  })

  it('writes the live map area, subarea, coordinates and level', () => {
    expect(resolveHud('mapInfo', 'lbl_mapName', undefined, PREVIEW_HUD)?.text).toBe('Incarnam (Pâturages)')
    expect(resolveHud('mapInfo', 'lbl_mapCoordsAndLevel', undefined, PREVIEW_HUD)?.text).toBe('2, -4 Niveau 5')
    expect(resolveHud('mapInfo', 'lbl_mapCoordsAndLevel', undefined, { ...PREVIEW_HUD, synchronized: false })).toBeUndefined()
  })

  it('hides MapInfoUI contextual widgets until live fight/haven/house context exists', () => {
    for (const binding of [
      'btn_showFightMap', 'btn_spectate',
      'ctr_mapAggresion', 'ctr_mapReward', 'btn_havenBagSettings', 'btn_leave',
    ]) {
      expect(resolveHud('mapInfo', binding, undefined, PREVIEW_HUD)?.hidden).toBe(true)
    }
    expect(resolveHud('mapInfo', 'ctr_alliance', undefined, PREVIEW_HUD)?.hidden).toBe(true)
  })

  it('leaves MapInfo highlight/info/creature at the authored USS rest pose', () => {
    for (const binding of ['btn_highlight', 'btn_info', 'tg_info', 'tg_creature']) {
      expect(resolveHud('mapInfo', binding, undefined, PREVIEW_HUD)).toBeUndefined()
    }
  })

  it('fills the character sheet identity, XP and remaining characteristic points', () => {
    expect(resolveHud('characterSheetUi', 'lbl_name', undefined, PREVIEW_HUD)?.text).toBe('Hugo')
    expect(resolveHud('characterSheetUi', 'lbl_class', undefined, PREVIEW_HUD)?.text).toBe('FÉCA')
    expect(resolveHud('characterSheetUi', 'lbl_levelValue', undefined, PREVIEW_HUD)?.text).toBe('200')
    expect(resolveHud('characterSheetUi', 'lbl_pointsRemaining', undefined, PREVIEW_HUD)?.text).toBe('12')
    expect(resolveHud('characterSheetUi', 'lbl_xpValue', undefined, PREVIEW_HUD)?.text).toBe(formatInt(7500000))
    expect(resolveHud('characterSheetUi', 'lbl_baseVitality', undefined, PREVIEW_HUD)?.text).toBe('100')
    expect(resolveHud('characterSheetUi', 'lbl_equipmentEarth', undefined, PREVIEW_HUD)?.text).toBe('20')
    expect(resolveHud('characterSheetUi', 'btn_detailedView', undefined, PREVIEW_HUD)?.state).toBe('pressed')
    expect(resolveHud('characterSheetUi', 'ctr_detailedStats', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('characterSheetUi', 'ctr_simpleStats', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('characterSheetUi', 'ctr_mainStatsDetails', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('characterSheetUi', 'btn_seeDetails', undefined, PREVIEW_HUD)?.hidden).toBe(true)
  })

  it('switches the character sheet between radar and detailed stats', () => {
    const detailed = resolveHud('characterSheetUi', 'ctr_detailedStats', undefined, PREVIEW_HUD, { view: 'detailed' })
    const simple = resolveHud('characterSheetUi', 'ctr_simpleStats', undefined, PREVIEW_HUD, { view: 'detailed' })
    expect(detailed?.hidden).toBe(false)
    expect(simple?.hidden).toBe(true)
    expect(resolveHud('characterSheetUi', 'btn_detailedView', undefined, PREVIEW_HUD, { view: 'detailed' })?.state).toBe('pressed')
    expect(resolveHud('characterSheetUi', 'ctr_mainStatsDetails', undefined, PREVIEW_HUD, { view: 'simple', detailsOpen: true })?.hidden).toBe(false)
    expect(resolveHud('characterSheetUi', 'ctr_mainStatsDetails', undefined, PREVIEW_HUD, { view: 'detailed', detailsOpen: true })?.hidden).toBe(true)
  })

  it('fills live guild name and achievement points, not constructor titles', () => {
    expect(resolveHud('characterSheetUi', 'lbl_title', 'btn_guild', PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'lbl_content', 'btn_guild', PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'lbl_content', 'btn_achievements', PREVIEW_HUD)?.text).toBe('0')
  })

  it('fills inventory kamas and the friends account tag', () => {
    expect(resolveHud('equipmentStorageUi', 'lbl_kamas', undefined, PREVIEW_HUD)?.text).toBe(formatInt(12500))
    expect(resolveHud('equipmentStorageUi', 'visibleItemsCount', undefined, PREVIEW_HUD)?.text).toBe('17')
    expect(resolveHud('equipmentStorageUi', 'estimatedValueTxt', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('friends', 'lbl_accountName', undefined, { ...PREVIEW_HUD, account: { ...PREVIEW_HUD.account, tag: 'Giny' } })?.text).toBe('Hugo')
    expect(resolveHud('friends', 'lbl_accountTag', undefined, { ...PREVIEW_HUD, account: { ...PREVIEW_HUD.account, tag: 'Giny' } })?.text).toBe('#Giny')
    expect(resolveHud('friends', 'ctr_headerMutualFriends', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('friends', 'gd_inGameMutualFriends', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('friends', 'lbl_noMutualFriends', undefined, PREVIEW_HUD)?.text).toBe(
      'Aucun contact en jeu réciproque',
    )
    expect(resolveHud('friends', 'lbl_noInGameContact', undefined, PREVIEW_HUD)?.text).toBe('Aucun contact en jeu')
    expect(resolveHud('friends', 'SectionHeader_inGameContact', undefined, PREVIEW_HUD)?.text).toBe('Contacts en jeu')
    expect(resolveHud('friends', 'tabs_group:0', undefined, PREVIEW_HUD)?.text).toBe('Amis Ankama')
    expect(resolveHud('friends', 'tabs_group:1', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Contacts en jeu',
      className: 'activeTrue',
    })
    expect(resolveHud('friends', 'tabs_group:2', undefined, PREVIEW_HUD)?.text).toBe('Contacts en jeu bloqués')
    expect(resolveHud('friends', 'btn_addInGameFriend', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Ajouter un contact',
      className: 'primary',
    })
    expect(resolveHud('friends', 'lbl_mutualInGameFriends', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('friends', 'lbl_InGameFriends', undefined, PREVIEW_HUD)?.hidden).toBe(true)
  })

  it('fills the inventory CharacterPresetManager player-state row from i18n', () => {
    expect(resolveHud('equipmentStorageUi', 'lbl_title', undefined, PREVIEW_HUD)?.text).toBe('Équiper un ensemble')
    expect(resolveHud('equipmentStorageUi', 'btn_action', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Mes ensembles (0)',
      hidden: false,
    })
    expect(resolveHud('equipmentStorageUi', 'ctr_list', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('equipmentStorageUi', 'ctr_builds', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('equipmentStorageUi', 'btn_newBuild', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('equipmentStorageUi', 'btn_actionLeft', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('equipmentStorageUi', 'btn_checkCraft', undefined, PREVIEW_HUD)?.text).toBe('RECETTES')
    expect(resolveHud('equipmentStorageUi', 'button_label', undefined, PREVIEW_HUD)).toBeUndefined()
  })

  it('keeps global session identity aligned with the authoritative HUD', () => {
    const session = {
      character: { id: 1, name: 'Ancien', level: 1, look: '{0}', breedId: 2, breedName: 'Osamodas', sex: true, prestige: 0 },
    } as WorldSession
    const merged = sessionWithHud(session, PREVIEW_HUD)
    expect(merged.character.name).toBe('Hugo')
    expect(merged.character.level).toBe(200)
    expect(merged.character.look).toBe(PREVIEW_HUD.character.look)
    expect(merged.hud).toBe(PREVIEW_HUD)
  })

  it('computes bar ratios without overflowing', () => {
    expect(ratio(2487, 3915)).toBeCloseTo(63.5, 0)
    expect(ratio(10, 0)).toBe(0)
    expect(ratio(50, 25)).toBe(100)
  })

  it('declares official tooltips on HUD labels, shortcuts and items', () => {
    expect(resolveHud('characterInformations', 'lbl_pa', undefined, PREVIEW_HUD)?.tooltip).toMatchObject({
      tree: 'TextTooltip', text: "Points d'action (PA)",
    })
    expect(resolveHud('characterInformations', 'tx_ap', undefined, PREVIEW_HUD)?.tooltip?.tree).toBe('TextTooltip')
    expect(resolveHud('mapInfo', 'lbl_mapName', undefined, PREVIEW_HUD)?.tooltip?.text).toBe('Incarnam (Pâturages)')
    const spell = resolveHud('actionBar', 'slot_0', 'gd_spellitemotes:0', PREVIEW_HUD)?.tooltip
    expect(spell?.tree).toBe('SpellTooltip')
    expect(spell?.resolve?.('lbl_spellName')?.text).toBe('Retour du Bâton')
    expect(spell?.resolve?.('lbl_spellRank')?.text).toBe('Rang 1')
    expect(spell?.resolve?.('ctr_spellCastConditions')?.hidden).toBe(false)
    const item = resolveHud('equipmentStorageUi', 'slot_0', 'grid:0', PREVIEW_HUD)?.tooltip
    expect(item?.tree).toBe('ItemTooltip')
    expect(item?.resolve?.('lbl_itemName')?.text).toBe('Arc de Boisaille')
    expect(item?.resolve?.('lbl_level')?.text).toBe('Niveau 7')
    expect(item?.resolve?.('ctr_tooltipFooter')?.hidden).toBe(false)
    expect(resolveHud('characterInformations', 'lbl_shield', undefined, PREVIEW_HUD)?.tooltip).toBeUndefined()
    expect(resolveHud('playerSpell', 'tab_label', undefined, PREVIEW_HUD)?.text).toBe('Féca')
    expect(resolveHud('playerSpell', 'tab_label', 'tabs:0', PREVIEW_HUD)?.text).toBe('Féca')
    expect(resolveHud('playerSpell', 'tab_label', 'tabs:1', PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('guildBase', 'lbl_guildName', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('guildBase', 'btn_guildMembers', undefined, PREVIEW_HUD)?.className).toBe('activeTrue')
    expect(resolveHud('guildBase', 'lbl_membersCount', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('guildBase', 'checkboxLine_labelRight', 'chbx_membersOffline', PREVIEW_HUD)?.text).toBe(
      'Afficher les membres de la guilde déconnectés',
    )
    expect(resolveHud('guildBase', 'checkboxLine_labelRight', 'chbx_warnAboutMemberConnexion', PREVIEW_HUD)?.text).toBe(
      "Signaler la connexion d'un membre de la guilde",
    )
    expect(resolveHud('guildBase', 'checkboxLine_labelRight', 'chbx_membersOffline', PREVIEW_HUD)?.text).not.toMatch(/alliance/)
    expect(resolveHud('guildBase', 'btn_manageRanks', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('guildBase', 'btn_contribute', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Contribuer',
      className: 'primary',
    })
    expect(resolveHud('guildBase', 'lbl_averageMembersLevel', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('rideParentUI', 'header_label', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('rideParentUI', 'lbl_noParents', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('cosmeticUi', 'lbl_emptyBox', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('cosmeticUi', 'parentOrnaments', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('cosmeticUi', 'chk_obtainedFilter', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Non obtenus',
      className: 'checkboxLine',
    })
    expect(resolveHud('cosmeticUi', 'checkboxLine_labelRight', 'chk_obtainedFilter', PREVIEW_HUD)?.text).toBe('Non obtenus')
    expect(resolveHud('cosmeticUi', 'chk_displayNames', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Masquer les noms',
      className: 'checkboxLine',
    })
    expect(resolveHud('cosmeticUi', 'textInput_placeholder', undefined, PREVIEW_HUD)?.text).toBe('Rechercher')
    expect(resolveHud('cosmeticUi', 'elementsCount', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'visibleItems', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'tabFace', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Visages',
      className: 'activeTrue',
    })
    expect(resolveHud('AppearanceUI', 'tabBodies', undefined, PREVIEW_HUD)?.text).toBe('Corps')
    expect(resolveHud('AppearanceUI', 'tabIdles', undefined, PREVIEW_HUD)?.text).toBe('Poses')
    expect(resolveHud('AppearanceUI', 'tabColors', undefined, PREVIEW_HUD)?.text).toBe('Couleurs')
    expect(resolveHud('AppearanceUI', 'bodyParent', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'idleParent', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'colorParent', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'validateInfo', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'colorCount', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('AppearanceUI', 'chk_hideUnavailable', undefined, PREVIEW_HUD)).toMatchObject({
      text: 'Masquer les visages non applicables',
      className: 'checkboxLine',
    })
    expect(resolveHud('AppearanceUI', 'lbl_color1', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('AppearanceUI', 'btnCancel', undefined, PREVIEW_HUD)?.text).toBe('Annuler')
    expect(resolveHud('AppearanceUI', 'btnValidate', undefined, PREVIEW_HUD)?.text).toBe('Valider')
    expect(resolveHud('CartographyMapUI', 'lbl_noResult', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('CartographyBannerUI', 'header_label', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('questList', 'header_label', undefined, PREVIEW_HUD)?.text).toBe('quêtes suivies (1)')
    expect(resolveHud('actionBar', 'header_label', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('chatview', 'header_label', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('chatview', 'btn_news', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('chatview', 'ti_chatInput', undefined, PREVIEW_HUD)?.onInput).toBeUndefined()
    expect(resolveHud('storageBank', 'lbl_kamas', undefined, PREVIEW_HUD)?.text).toBe(formatInt(12500))
    expect(resolveHud('storageBank', 'estimatedValueTxt', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('auctionHouse', 'estimatedValueTxt', undefined, PREVIEW_HUD)?.hidden).toBe(true)
  })

  it('leaves authored UXML captions on the tree instead of inventing chrome', () => {
    expect(resolveHud('characterSheetUi', 'lbl_xpText', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'lbl_energyText', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'lbl_levelText', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'lbl_pointsRemainingTitle', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'btn_distributeMyPoints', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'btn_distributeMyPoints', undefined, PREVIEW_HUD)?.disabled).toBe(false)
    expect(resolveHud('characterSheetUi', 'btn_distributeMyPoints', undefined, PREVIEW_HUD)?.className).toBe('primary')
    expect(resolveHud('playerSpell', 'btn_gameplay', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('quests', 'lbl_description', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('quests', 'lbl_questDescription', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('quests', 'lbl_questTitle', undefined, PREVIEW_HUD)?.text).toBe("Wogew l'hewmite")
    expect(resolveHud('quests', 'lbl_emptyList', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('achievements', 'ctr_noAchievement', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    // `#ctr_filters` est une bande de pictos dans la capture officielle : la
    // ligne de case à cocher et son libellé restent repliés, pas réécrits.
    expect(resolveHud('CartographyMapUI', 'lbl_displayAll', undefined, PREVIEW_HUD)?.text).toBeUndefined()
    expect(resolveHud('CartographyMapUI', 'lbl_displayAll', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('CartographyMapUI', 'chbx_filterDungeon', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('CartographyMapUI', 'tx_filterDungeon', undefined, PREVIEW_HUD)?.sprite).toBe('styles/images/filterDungeon_On.png')
    expect(resolveHud('CartographyMapUI', 'ctr_filterDungeon', undefined, PREVIEW_HUD)?.onClick).toBeDefined()
  })

  it('stamps encyclopaedia quest description and objectives heading from GameData', () => {
    hydrateCatalog({
      questObjectives: {
        '18': {
          id: 18,
          stepId: 55,
          description: "Wogew a besoin que vous préleviez le sang d'un Wabbit un peu particulier à l'aide d'une seringue.",
          objectives: [
            { id: 102, text: 'Découvrir la carte : Laboratoire Wabbit' },
          ],
        },
      },
      uiStrings: {
        'ui.grimoire.quest.objectives': 'Objectifs',
        'ui.grimoire.quest.searchQuest': 'Rechercher une quête',
      },
    })
    expect(resolveHud('quests', 'lbl_questDescription', undefined, PREVIEW_HUD)?.text).toBe(
      "Wogew a besoin que vous préleviez le sang d'un Wabbit un peu particulier à l'aide d'une seringue.",
    )
    expect(resolveHud('quests', 'lbl_questDescription', undefined, PREVIEW_HUD)?.text).not.toMatch(/dieux/i)
    expect(resolveHud('quests', 'lbl_objectives', undefined, PREVIEW_HUD)?.text).toBe('Objectifs')
    expect(resolveHud('quests', 'textInput_placeholder', undefined, PREVIEW_HUD)?.text).toBe('Rechercher une quête')
    expect(resolveHud('quests', 'textInput_placeholder', undefined, PREVIEW_HUD)?.text).not.toMatch(/quete/)
    expect(resolveHud('quests', 'lbl_kamas', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('quests', 'lbl_xp', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('quests', 'ic_limiter', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('quests', 'ctr_kamasXp', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('quests', 'Min', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('quests', 'Max', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('quests', 'lbl_from', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('quests', 'lbl_kamas', undefined, PREVIEW_HUD)?.text).toBeUndefined()
  })

  it('reveals the achievements summary pane and hides the leaf list at rest', () => {
    hydrateCatalog({
      categories: {
        '3': { id: 3, name: 'Donjons', parentId: 0 },
        '11': { id: 11, name: 'Niveaux 1 à 50', parentId: 3, achievementIds: [33] },
      },
      achievements: {
        '33': { id: 33, iconId: 10, name: 'Bouftou', points: 10 },
      },
    })
    expect(resolveHud('achievements', 'ctr_base', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('achievements', 'ctr_achievements', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('achievements', 'ctr_noAchievement', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('achievements', 'lbl_myPoints', undefined, PREVIEW_HUD)?.text).toBe('0')
    expect(resolveHud('achievements', 'lbl_percent', undefined, PREVIEW_HUD)?.text).toBe('0%')
    expect(resolveHud('achievements', 'pb_progress', undefined, PREVIEW_HUD)?.value).toBe(0)
    expect(resolveHud('achievements', 'ctr_limiter', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('achievements', 'lbl_titleProgress', undefined, PREVIEW_HUD)).toBeUndefined()
  })

  it('keeps cartography at WorldMapMenuInfo rest until SwitchToConquestOrAnomalyMode', () => {
    expect(resolveHud('CartographyMapUI', 'ctr_locTreeAnomaly', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('CartographyMapUI', 'ctr_locTreeConquest', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('CartographyMapUI', 'btn_worldmap', undefined, PREVIEW_HUD)?.className).toBe('primary')
    expect(resolveHud('CartographyMapUI', 'btn_anomaly', undefined, PREVIEW_HUD)?.className).toBe('secondary')
    expect(resolveHud('CartographyMapUI', 'btn_conquest', undefined, PREVIEW_HUD)?.className).toBe('secondary')
    expect(resolveHud('CartographyMapUI', 'ctr_locTreeAnomaly', undefined, PREVIEW_HUD, undefined, undefined, { mode: 'anomaly' })?.hidden).toBe(false)
    expect(resolveHud('CartographyMapUI', 'btn_anomaly', undefined, PREVIEW_HUD, undefined, undefined, { mode: 'anomaly' })?.className).toBe('primary')
    expect(resolveHud('CartographyMapUI', 'btn_worldmap', undefined, PREVIEW_HUD, undefined, undefined, { mode: 'anomaly' })?.className).toBe('secondary')
    expect(resolveHud('CartographyMapUI', 'ctr_locTreeConquest', undefined, PREVIEW_HUD, undefined, undefined, { mode: 'conquest' })?.hidden).toBe(false)
    expect(resolveHud('CartographyMapUI', 'ctr_locTreeAnomaly', undefined, PREVIEW_HUD, undefined, undefined, { mode: 'conquest' })?.hidden).toBe(true)
  })

  it('paints the minimap schematic and opens the Carte on click', () => {
    // Sans minimap : schéma quand même (preview), sans clic.
    const bare = resolveHud('CartographyBannerUI', 'mapView', undefined, PREVIEW_HUD)
    expect(bare?.replaceChildren).toBe(true)
    expect(bare?.children).toBeDefined()
    expect(bare?.style).toMatchObject({ cursor: 'pointer' })
    expect(bare?.onClick).toBeUndefined()
    // Seul mapView est câblé : le header reste la poignée de drag.
    expect(resolveHud('CartographyBannerUI', 'header_label', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('CartographyBannerUI', 'content', undefined, PREVIEW_HUD)).toBeUndefined()
    // Avec minimap : le clic ouvre la Carte (libellé officiel I18n).
    hydrateCatalog({ uiStrings: { 'ui.cartography.openworldmap': 'Afficher la carte du monde' } })
    const onOpenMap = () => undefined
    const wired = resolveHud('CartographyBannerUI', 'mapView', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, undefined, { onOpenMap })
    expect(wired?.onClick).toBe(onOpenMap)
    expect(wired?.tooltip).toBeDefined()
    expect(wired?.replaceChildren).toBe(true)
  })

  it('leaves GameMenu bug/abo/options/fps/time on the authored USS rest pose', () => {
    for (const binding of ['btn_bug', 'btn_abo', 'btn_options', 'fps', 'time']) {
      expect(resolveHud('gameMenu', binding, undefined, PREVIEW_HUD)).toBeUndefined()
    }
    const onToggle = () => undefined
    expect(resolveHud('gameMenu', 'btn_menu', undefined, PREVIEW_HUD, undefined, undefined, undefined, { open: true, onToggle })?.state).toBe('pressed')
    expect(resolveHud('gameMenu', 'btn_menu', undefined, PREVIEW_HUD, undefined, undefined, undefined, { open: true, onToggle })?.onClick).toBe(onToggle)
  })

  it('fills official gauges and entity portraits instead of replacing them', () => {
    const xp = resolveHud('characterSheetUi', 'pb_xp', undefined, PREVIEW_HUD)
    expect(xp?.value).toBeCloseTo(ratio(PREVIEW_HUD.experience.current - PREVIEW_HUD.experience.floor, PREVIEW_HUD.experience.next - PREVIEW_HUD.experience.floor), 5)
    expect(xp?.replaceChildren).toBeUndefined()
    const hudXp = resolveHud('widgetProgressGauge', 'gauge', undefined, PREVIEW_HUD)
    expect(hudXp?.value).toBeCloseTo(xp?.value ?? -1, 5)
    expect(hudXp?.className).toBe('primary')
    expect(resolveHud('widgetProgressGauge', 'lbl_value', undefined, PREVIEW_HUD)?.text).toBe('200')
    expect(resolveHud('equipmentStorageUi', 'weightBar', undefined, PREVIEW_HUD)?.value).toBeCloseTo(ratio(PREVIEW_HUD.weight.current, PREVIEW_HUD.weight.max), 5)
    expect(resolveHud('equipmentStorageUi', 'weightBar', undefined, PREVIEW_HUD)?.className).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'ed_player', undefined, PREVIEW_HUD)?.look).toBe(PREVIEW_HUD.character.look)
    expect(resolveHud('characterSheetUi', 'ed_player', undefined, PREVIEW_HUD)?.replaceChildren).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'ed_entity', undefined, PREVIEW_HUD)?.look).toBe(PREVIEW_HUD.character.look)
    expect(resolveHud('characterSheetUi', 'ed_entity', undefined, PREVIEW_HUD)?.lookMode).toBeUndefined()
    const doll = resolveHud('equipmentStorageUi', 'entityDisplayer', undefined, PREVIEW_HUD)
    expect(doll?.look).toBe(PREVIEW_HUD.character.look)
    expect(doll?.lookMode).toBe('fit')
    expect(doll?.replaceChildren).toBeUndefined()
    expect(doll?.children).toBeUndefined()
    const appearance = resolveHud('cosmeticUi', 'entityDisplayer', undefined, PREVIEW_HUD)
    expect(appearance?.look).toBe(PREVIEW_HUD.character.look)
    expect(appearance?.lookMode).toBe('fit')
    const openAppearance = () => undefined
    expect(resolveHud('cosmeticUi', 'btnAppearance', undefined, PREVIEW_HUD, undefined, openAppearance)?.onClick).toBe(openAppearance)
    expect(resolveHud('cosmeticUi', 'btnAppearance', undefined, PREVIEW_HUD)?.onClick).toBeUndefined()
    expect(resolveHud('questList', 'lv_main', undefined, PREVIEW_HUD)?.replaceChildren).toBeUndefined()
  })

  it('paints EntityStatsGraph vertices from live characteristics, and leaves ListView hosts to their repeaters', () => {
    expect(resolveHud('characterSheetUi', 'statsGraph', undefined, PREVIEW_HUD)?.graph).toEqual([150, 100, 240, 0, 10, 50])
    expect(resolveHud('characterSheetUi', 'ctr_graph', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'ctr_statBlocks', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('characterSheetUi', 'ctr_characterStatsDetailed', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('playerSpell', 'ctr_spellListContainer', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('jobUI', 'lv_jobProgress', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('jobUI', 'tab_recipe', undefined, PREVIEW_HUD)?.className).toBe('activeTrue')
    expect(resolveHud('jobUI', 'recipesUI', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('jobUI', 'lbl_ingredientsOwned', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('jobUI', 'lbl_nbRecipes', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('jobUI', 'ctr_checkRecipeItem', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('jobUI', 'inp_lvlFrom', undefined, PREVIEW_HUD)).toBeUndefined()
    expect(resolveHud('jobUI', 'inp_lvlTo', undefined, PREVIEW_HUD)).toBeUndefined()
  })

  it('paints shortcut and item icons on the official tile, not a homemade glyph', () => {
    const emptyShortcut = resolveHud('actionBar', 'itemTile_container', 'gd_spellitemotes:0', { ...PREVIEW_HUD, shortcuts: [] })
    expect(emptyShortcut?.children).toBeUndefined()
    expect(emptyShortcut?.replaceChildren).toBeUndefined()
    expect(emptyShortcut?.sprite).toBeUndefined()
    const withIcon = resolveHud('actionBar', 'itemTile_container', 'gd_spellitemotes:0', PREVIEW_HUD)
    expect(withIcon?.sprite).toBe('/game-data/pictos/spells/sort_12145.png')
    expect(withIcon?.children).toBeUndefined()
    const item = resolveHud('equipmentStorageUi', 'itemTile_container', 'grid:0', PREVIEW_HUD)
    expect(item?.sprite).toBe('/game-data/pictos/items/2001.png')
    expect(item?.children).toBeUndefined()
    expect(item?.replaceChildren).toBeUndefined()
    expect(resolveHud('equipmentStorageUi', 'slot_0', 'grid:0', PREVIEW_HUD)?.children).toBeUndefined()
    expect(resolveHud('equipmentStorageUi', 'slot_0', 'grid:0', PREVIEW_HUD)?.className).toBe('asset acquiredTrue')
    expect(resolveHud('equipmentStorageUi', 'slot_0', 'grid:0', PREVIEW_HUD)?.tooltip?.tree).toBe('ItemTooltip')

    const equipped = resolveHud('equipmentStorageUi', 'slot_6', 'inventory', PREVIEW_HUD)
    expect(equipped?.sprite).toBe('/game-data/pictos/items/16041.png')
    expect(equipped?.className).toBe('asset acquiredTrue')
    expect(equipped?.tooltip?.resolve?.('lbl_itemName')?.text).toBe('Coiffe du Bouftou')
  })

  it('wires WindowFigma header_buttonRight to onClose, not widget more-actions', () => {
    const onClose = () => {}
    const spells = createHudResolver('playerSpell', PREVIEW_HUD, undefined, undefined, undefined, undefined, onClose)
    expect(spells('header_buttonRight')?.onClick).toBe(onClose)
    expect(createHudResolver('playerSpell', PREVIEW_HUD)('header_buttonRight')).toBeUndefined()
    expect(createHudResolver('chatview', PREVIEW_HUD)('header_buttonRight')).toBeUndefined()
  })

  it('wires #ti_chatInput to the live chat draft and Enter', () => {
    const onDraft = vi.fn()
    const onSend = vi.fn()
    const chat = {
      draft: 'salut', onDraft, onSend,
      channel: 0, channelShortcut: '/s', onCycleChannel: vi.fn(), onAddChannel: vi.fn(),
      unread: 0, onScrollBottom: vi.fn(), collapsed: false, onToggleCollapsed: vi.fn(),
    }
    const field = resolveHud('chatview', 'ti_chatInput', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, chat)
    expect(field?.text).toBe('salut')
    field?.onInput?.({ currentTarget: { value: '.help' } } as never)
    expect(onDraft).toHaveBeenCalledWith('.help')
    field?.onKeyDown?.({ key: 'Enter', nativeEvent: { isComposing: false }, preventDefault: vi.fn() } as never)
    expect(onSend).toHaveBeenCalled()
  })

  it('wires the official chat buttons instead of leaving them dead', () => {
    const chat = {
      draft: '', onDraft: vi.fn(), onSend: vi.fn(),
      channel: 2, channelShortcut: '/g', onCycleChannel: vi.fn(), onAddChannel: vi.fn(),
      unread: 0, onScrollBottom: vi.fn(), collapsed: false, onToggleCollapsed: vi.fn(),
    }
    // No chat wired (preview) : la pastille reste masquée comme l'UXML.
    expect(resolveHud('chatview', 'btn_news', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    const dialect = resolveHud('chatview', 'btn_dialect', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, chat)
    expect(dialect?.text).toBe('/g')
    dialect?.onClick?.({} as never)
    expect(chat.onCycleChannel).toHaveBeenCalled()
    const add = resolveHud('chatview', 'btn_addChannel', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, chat)
    add?.onClick?.({} as never)
    expect(chat.onAddChannel).toHaveBeenCalled()
    const expand = resolveHud('chatview', 'header_buttonLeft', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, chat)
    expand?.onClick?.({} as never)
    expect(chat.onToggleCollapsed).toHaveBeenCalled()
    // Replié : historique et onglets masqués, saisie intacte.
    const folded = { ...chat, collapsed: true }
    expect(resolveHud('chatview', 'listChat', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, folded)?.hidden).toBe(true)
    expect(resolveHud('chatview', 'sv_toggles', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, folded)?.hidden).toBe(true)
    expect(resolveHud('chatview', 'ti_chatInput', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, folded)?.text).toBe('')
    // Pastille des manqués : compteur officiel, clic = retour en bas.
    const news = resolveHud('chatview', 'btn_news', undefined, PREVIEW_HUD, undefined, undefined, undefined, undefined, undefined, { ...chat, unread: 3 })
    expect(news?.hidden).toBe(false)
    expect(news?.text).toMatch(/3/)
    news?.onClick?.({} as never)
    expect(chat.onScrollBottom).toHaveBeenCalled()
  })

  it('does not shrink inventory cells below the UXML item-size', () => {
    expect(resolveHud('equipmentStorageUi', 'grid:0', undefined, PREVIEW_HUD)?.style).toBeUndefined()
  })

  it('reveals the ornaments tab when the encyclopaedia has rows', () => {
    hydrateCatalog({
      ornaments: { '13': { id: 13, assetId: 1, name: 'Couronne', order: 1 } },
    })
    expect(resolveHud('cosmeticUi', 'parentOrnaments', undefined, PREVIEW_HUD)?.hidden).toBe(false)
    expect(resolveHud('cosmeticUi', 'btnCosmeticOrnaments', undefined, PREVIEW_HUD)?.checked).toBe(true)
    expect(resolveHud('cosmeticUi', 'lbl_emptyBox', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'estimatedValueTxt', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'podsPreviewTxt', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'iconKama', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'iconPods', undefined, PREVIEW_HUD)?.hidden).toBe(true)
    expect(resolveHud('cosmeticUi', 'entityDisplayer', undefined, PREVIEW_HUD)?.look).toBe(PREVIEW_HUD.character.look)
  })
})

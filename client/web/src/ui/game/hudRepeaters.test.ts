import { describe, expect, it } from 'vitest'
import { hydrateCatalog, resetCatalog } from './catalog'
import { formatInt } from './hudWidgets'
import { PREVIEW_HUD } from './hudBindings'
import { chatRepeaters, LIST_TEMPLATES, stripChatMarkup, windowRepeaters } from './hudRepeaters'

describe('HUD list repeaters', () => {
  it('fills ctr_summaryContent with official achievementSummaryItem cards from root categories', () => {
    resetCatalog()
    hydrateCatalog({
      categories: {
        '15': { id: 15, name: 'Général', parentId: 0, order: 0 },
        '3': { id: 3, name: 'Donjons', parentId: 0, order: 2 },
        '11': { id: 11, name: 'Niveaux 1 à 50', parentId: 3, achievementIds: [33, 34] },
      },
      achievements: {
        '33': { id: 33, iconId: 10, name: 'Bouftou', description: 'Vaincre un Bouftou.', points: 10, picto: 'pictos/achievements/10.png' },
        '34': { id: 34, iconId: 11, name: 'Bouftou Royal', points: 15, picto: 'pictos/achievements/11.png' },
      },
    })
    const repeaters = windowRepeaters('achievements', PREVIEW_HUD)
    expect(repeaters?.lv_achievements).toBeUndefined()
    expect(repeaters?.gd_categories).toBeUndefined()
    expect(repeaters?.ctr_summaryContent).toHaveLength(2)
    expect(repeaters?.ctr_summaryContent.every((row) => row.template === LIST_TEMPLATES.ctr_summaryContent)).toBe(true)
    expect(repeaters?.ctr_summaryContent[0]?.resolve('lbl_name')?.text).toBe('Général')
    expect(repeaters?.ctr_summaryContent[1]?.resolve('lbl_name')?.text).toBe('Donjons')
    expect(repeaters?.ctr_summaryContent[0]?.resolve('lbl_percent')?.text).toBe('0%')
    expect(repeaters?.ctr_summaryContent[0]?.resolve('pb_progress')?.value).toBe(0)
    expect(repeaters?.ctr_summaryContent[0]?.resolve('tx_illu')).toBeUndefined()
  })

  it('fills lv_jobProgress with official jobProgressItem rows', () => {
    resetCatalog()
    hydrateCatalog({
      jobs: {
        '2': { id: 2, iconId: 1, name: 'Bûcheron', picto: 'pictos/jobs/1.png' },
      },
    })
    const repeaters = windowRepeaters('jobUI', PREVIEW_HUD)
    expect(repeaters?.lv_jobProgress).toHaveLength(1)
    expect(repeaters?.lv_jobProgress[0]?.template).toBe(LIST_TEMPLATES.lv_jobProgress)
    expect(repeaters?.lv_jobProgress[0]?.resolve('lbl_jobName')?.text).toBe('Bûcheron')
    expect(repeaters?.lv_jobProgress[0]?.resolve('tx_jobImage')?.sprite).toBe('/game-data/pictos/jobs/1.png')
    expect(repeaters?.lv_jobProgress[0]?.resolve('jobProgressItem')?.className).toBe('selected')
    expect(repeaters?.lv_jobProgress[0]?.resolve('ctr_bottom')?.hidden).toBe(true)
    expect(repeaters?.lv_jobProgress[0]?.resolve('lbl_jobLvl')?.text).toBe('1')
    expect(repeaters?.lv_jobProgress[0]?.resolve('lbl_currentXp')?.text).toBe('0')
  })

  it('fills jobUI lv_recipe from the selected character job, not the 4858-row catalogue', () => {
    resetCatalog()
    hydrateCatalog({
      jobs: {
        '2': { id: 2, iconId: 1, name: 'Bûcheron', picto: 'pictos/jobs/1.png' },
        '16': { id: 16, iconId: 15, name: 'Bijoutier' },
      },
      items: {
        '44': { id: 44, iconId: 16041, name: 'Épée de Boisaille', picto: 'pictos/items/16041.png' },
        '303': { id: 303, iconId: 12, name: 'Fer', picto: 'pictos/items/12.png' },
        '100': { id: 100, iconId: 1, name: 'Anneau', picto: 'pictos/items/1.png' },
      },
      recipes: {
        '44': { resultId: 44, name: 'Épée de Boisaille', resultLevel: 7, jobId: 2, ingredientIds: [303], quantities: [3] },
        '100': { resultId: 100, name: 'Anneau', resultLevel: 1, jobId: 16, ingredientIds: [303] },
      },
    })
    const jobs = windowRepeaters('jobUI', PREVIEW_HUD)
    expect(jobs?.lv_recipe).toHaveLength(1)
    expect(jobs?.lv_recipe[0]?.template).toBe(LIST_TEMPLATES.lv_recipe)
    expect(jobs?.lv_recipe[0]?.resolve('lbl_name')?.text).toBe('Épée de Boisaille')
    expect(jobs?.lv_recipe[0]?.resolve('lbl_craftPossibleQuantity')?.hidden).toBe(true)
    expect(jobs?.lv_recipe[0]?.resolve('lbl_xp')?.hidden).toBe(true)
    expect(jobs?.lv_recipe[0]?.resolve('tile2')?.hidden).toBe(true)
    expect(jobs?.lv_jobProgress).toHaveLength(1)
    const encyclopaedia = windowRepeaters('recipesUI', PREVIEW_HUD)
    expect(encyclopaedia?.lv_recipe).toHaveLength(2)
  })

  it('fills lv_recipe with official jobRecipeItem rows, not ctr_inputs', () => {
    resetCatalog()
    hydrateCatalog({
      items: {
        '44': { id: 44, iconId: 16041, name: 'Épée de Boisaille', picto: 'pictos/items/16041.png' },
        '303': { id: 303, iconId: 12, name: 'Fer', picto: 'pictos/items/12.png' },
      },
      recipes: {
        '44': { resultId: 44, name: 'Épée de Boisaille', resultLevel: 7, ingredientIds: [303], quantities: [3] },
      },
    })
    const repeaters = windowRepeaters('recipesUI', PREVIEW_HUD)
    expect(repeaters?.lv_recipe).toHaveLength(1)
    expect(repeaters?.ctr_inputs).toBeUndefined()
    expect(repeaters?.lv_recipe[0]?.template).toBe(LIST_TEMPLATES.lv_recipe)
    expect(repeaters?.lv_recipe[0]?.resolve('lbl_name')?.text).toBe('Épée de Boisaille')
    expect(repeaters?.lv_recipe[0]?.resolve('itemTile_container', 'craftedItemTile')?.sprite).toBe(
      '/game-data/pictos/items/16041.png',
    )
    expect(repeaters?.lv_recipe[0]?.resolve('itemTile_container', 'tile1')?.sprite).toBe(
      '/game-data/pictos/items/12.png',
    )
    expect(repeaters?.lv_recipe[0]?.resolve('lbl_name')?.replaceChildren).toBeUndefined()
  })

  it('fills lv_questList with official quest.uxml rows', () => {
    resetCatalog()
    hydrateCatalog({
      quests: {
        '18': {
          id: 18,
          name: "Wogew l'hewmite",
          categoryId: 7,
          levelMin: 70,
          levelMax: 70,
          isDungeonQuest: 0,
          isPartyQuest: 0,
          repeatType: 1,
          followable: 1,
        },
        '99': {
          id: 99,
          name: 'Donjon',
          categoryId: 7,
          levelMin: 40,
          isDungeonQuest: 1,
          isPartyQuest: 1,
        },
      },
    })
    const repeaters = windowRepeaters('quests', PREVIEW_HUD)
    expect(repeaters?.lv_questList).toHaveLength(2)
    expect(repeaters?.lv_questList[0]?.template).toBe('quest')
    expect(repeaters?.lv_questList[0]?.template).toBe(LIST_TEMPLATES.lv_questList)
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questName')?.text).toBe("Wogew l'hewmite")
    expect(repeaters?.lv_questList[0]?.resolve('lbl_titleQuest')).toBeUndefined()
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questLevel')?.text).toBe('70')
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questLevel')?.hidden).toBe(false)
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questLevel')?.text).not.toMatch(/Niv/i)
    expect(repeaters?.lv_questList[0]?.resolve('tb_follow')?.checked).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('tb_follow')?.hidden).toBe(false)
    expect(repeaters?.lv_questList[0]?.resolve('sectionHeaderContent')?.className).toBe('quest')
    expect(repeaters?.lv_questList[0]?.resolve('tx_dungeon')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('tx_party')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('tx_repeatable')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('sectionHeader_button1')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('btn_more')).toBeUndefined()
    const dungeon = repeaters?.lv_questList.find((row) => row.key === '99')
    expect(dungeon?.resolve('tb_follow')?.checked).toBe(false)
    expect(dungeon?.resolve('sectionHeaderContent')?.className).toBe('quest dungeon party')
    expect(dungeon?.resolve('tx_dungeon')?.hidden).toBe(false)
    expect(dungeon?.resolve('tx_party')?.hidden).toBe(false)
    expect(repeaters?.lv_main).toBeUndefined()
    expect(repeaters?.gd_objectives).toBeUndefined()
    expect(repeaters?.ctr_objectives).toBeUndefined()
  })

  it('inserts QuestCategoryData headers without inventing a count', () => {
    resetCatalog()
    hydrateCatalog({
      quests: {
        '18': {
          id: 18,
          name: "Wogew l'hewmite",
          categoryId: 7,
          levelMin: 70,
        },
        '99': {
          id: 99,
          name: 'Donjon',
          categoryId: 7,
          levelMin: 40,
          isDungeonQuest: 1,
        },
      },
      questCategories: {
        '9': { id: 9, name: 'Alignement Bonta', order: 4, questIds: [1] },
        '7': { id: 7, name: 'Île des Wabbits', order: 35, questIds: [18, 99] },
      },
    })
    const repeaters = windowRepeaters('quests', PREVIEW_HUD)
    expect(repeaters?.lv_questList).toHaveLength(3)
    expect(repeaters?.lv_questList[0]?.key).toBe('category:7')
    expect(repeaters?.lv_questList[0]?.template).toBe('quest')
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questName')?.text).toBe('Île des Wabbits')
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questName')?.text).not.toMatch(/\(\d+\)/)
    expect(repeaters?.lv_questList[0]?.resolve('sectionHeaderContent')?.className).toBe('category')
    expect(repeaters?.lv_questList[0]?.resolve('tb_follow')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('tb_follow')?.hidden).not.toBe(false)
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questLevel')?.hidden).toBe(true)
    expect(repeaters?.lv_questList[0]?.resolve('lbl_questLevel')?.text).toBeUndefined()
    expect(repeaters?.lv_questList[1]?.key).toBe('18')
    expect(repeaters?.lv_questList[1]?.resolve('sectionHeaderContent')?.className).toBe('quest')
    expect(repeaters?.lv_questList[2]?.key).toBe('99')
  })

  it('clones three DofusTab into tbg_tabs from named grimoire keys', () => {
    resetCatalog()
    hydrateCatalog({
      quests: {
        '18': { id: 18, name: "Wogew l'hewmite", categoryId: 7, levelMin: 70 },
        '99': { id: 99, name: 'Donjon', categoryId: 7, levelMin: 40 },
      },
      uiStrings: {
        'ui.grimoire.pendingQuests': 'En cours ({0})',
        'ui.grimoire.completedQuests': 'Terminées ({0})',
        'ui.grimoire.hiddenQuests': 'Masquées ({0})',
        'ui.grimoire.displayFinishedQuests': 'Voir les quêtes terminées ({0})',
        'ui.common.finished': 'Terminé',
        'ui.grimoire.quest.done': "Quête '{0}' achevée",
      },
    })
    const tabs = windowRepeaters('quests', PREVIEW_HUD)?.tbg_tabs
    expect(tabs).toHaveLength(3)
    expect(tabs?.every((row) => row.template === LIST_TEMPLATES.tbg_tabs)).toBe(true)
    expect(tabs?.every((row) => row.template === 'DofusTab')).toBe(true)
    expect(tabs?.[0]?.key).toBe('pending')
    expect(tabs?.[0]?.resolve('tab_label')?.text).toBe('En cours (2)')
    expect(tabs?.[0]?.resolve('')?.className).toBe('activeTrue')
    expect(tabs?.[1]?.key).toBe('completed')
    expect(tabs?.[1]?.resolve('tab_label')?.text).toBe('Terminées (0)')
    expect(tabs?.[1]?.resolve('')?.className).toBeUndefined()
    expect(tabs?.[2]?.key).toBe('hidden')
    expect(tabs?.[2]?.resolve('tab_label')?.text).toBe('Masquées (0)')
    expect(tabs?.[1]?.resolve('tab_label')?.text).not.toBe('Terminé')
    expect(tabs?.[1]?.resolve('tab_label')?.text).not.toBe('Voir les quêtes terminées (0)')
    expect(tabs?.map((row) => row.resolve('tab_label')?.text).join(' ')).not.toMatch(/Amie Ankama/)
  })

  it('leaves tbg_tabs empty when grimoire keys are missing', () => {
    resetCatalog()
    hydrateCatalog({
      quests: { '18': { id: 18, name: "Wogew l'hewmite" } },
    })
    expect(windowRepeaters('quests', PREVIEW_HUD)?.tbg_tabs).toBeUndefined()
  })

  it('fills HUD lv_main from followed hud.quests, not encyclopaedia previewQuests', () => {
    const empty = windowRepeaters('questList', { ...PREVIEW_HUD, quests: [] })
    expect(empty).toEqual({})
    const repeaters = windowRepeaters('questList', PREVIEW_HUD)
    expect(repeaters?.lv_main).toHaveLength(1)
    expect(repeaters?.lv_questList).toBeUndefined()
    expect(repeaters?.lv_main[0]?.template).toBe(LIST_TEMPLATES.lv_main)
    expect(repeaters?.lv_main[0]?.resolve('lbl_titleQuest')?.text).toBe("Wogew l'hewmite")
    expect(repeaters?.lv_main[0]?.resolve('btn_more')?.hidden).toBe(true)
    expect(repeaters?.lv_main[0]?.resolve('icon_dailyQuest')?.hidden).toBe(true)
    expect(repeaters?.lv_main[0]?.resolve('icon_questType')?.hidden).toBe(true)
  })

  it('clones questList_objective into ctr_objectives from GameData, not the UXML Tournesol dummy', () => {
    resetCatalog()
    hydrateCatalog({
      questObjectives: {
        '18': {
          id: 18,
          stepId: 55,
          objectives: [
            { id: 102, text: 'Découvrir la carte : Laboratoire Wabbit' },
            { id: 115, text: 'Vaincre x1 Wabbit Gm en un seul combat' },
          ],
        },
      },
    })
    const repeaters = windowRepeaters('questList', PREVIEW_HUD)
    const rows = repeaters?.lv_main[0]?.repeaters?.ctr_objectives
    expect(rows).toHaveLength(2)
    expect(rows?.every((row) => row.template === LIST_TEMPLATES.ctr_objectives)).toBe(true)
    expect(rows?.[0]?.resolve('lbl_objective')?.text).toBe('Découvrir la carte : Laboratoire Wabbit')
    expect(rows?.[1]?.resolve('lbl_objective')?.text).toBe('Vaincre x1 Wabbit Gm en un seul combat')
    expect(rows?.[0]?.resolve('lbl_objective')?.text).not.toMatch(/Tournesol/)
    expect(repeaters?.lv_questList).toBeUndefined()
  })

  it('limits the tracker to the active objective IDs, including an explicitly empty list', () => {
    resetCatalog()
    hydrateCatalog({ questObjectives: { '18': { id: 18, stepId: 55, objectives: [
      { id: 102, text: 'First objective' }, { id: 115, text: 'Active objective' },
    ] } } })
    const hud = { ...PREVIEW_HUD, quests: [{ ...PREVIEW_HUD.quests[0], objectiveIds: [115] }] }
    const rows = windowRepeaters('questList', hud)?.lv_main[0]?.repeaters?.ctr_objectives
    expect(rows?.map(row => row.resolve('lbl_objective')?.text)).toEqual(['Active objective'])
    hud.quests[0].objectiveIds = []
    expect(windowRepeaters('questList', hud)?.lv_main[0]?.repeaters).toBeUndefined()
  })

  it('clones quest_objective into encyclopaedia gd_objectives from the selected hud quest', () => {
    resetCatalog()
    hydrateCatalog({
      quests: {
        '18': { id: 18, name: "Wogew l'hewmite", categoryId: 7 },
      },
      questObjectives: {
        '18': {
          id: 18,
          stepId: 55,
          description: "Wogew a besoin que vous préleviez le sang d'un Wabbit un peu particulier à l'aide d'une seringue.",
          objectives: [
            { id: 102, text: 'Découvrir la carte : Laboratoire Wabbit' },
            { id: 115, text: 'Vaincre x1 Wabbit Gm en un seul combat' },
          ],
        },
      },
    })
    const repeaters = windowRepeaters('quests', PREVIEW_HUD)
    expect(repeaters?.lv_questList).toHaveLength(1)
    expect(repeaters?.ctr_objectives).toBeUndefined()
    const rows = repeaters?.gd_objectives
    expect(rows).toHaveLength(2)
    expect(rows?.every((row) => row.template === LIST_TEMPLATES.gd_objectives)).toBe(true)
    expect(rows?.[0]?.resolve('lbl_objective')?.text).toBe('Découvrir la carte : Laboratoire Wabbit')
    expect(rows?.[1]?.resolve('lbl_objective')?.text).toBe('Vaincre x1 Wabbit Gm en un seul combat')
    expect(rows?.[0]?.resolve('lbl_objective')?.text).not.toMatch(/Tournesol/)
    expect(rows?.[0]?.resolve('ctr_questDescription')?.hidden).toBe(true)
    expect(rows?.[0]?.resolve('btn_description')?.hidden).toBe(true)
    expect(rows?.[0]?.template).not.toBe(LIST_TEMPLATES.ctr_objectives)
  })

  it('leaves ctr_objectives empty when the catalogue has no formatted step', () => {
    resetCatalog()
    const repeaters = windowRepeaters('questList', PREVIEW_HUD)
    expect(repeaters?.lv_main[0]?.repeaters?.ctr_objectives).toBeUndefined()
  })

  it('fills left/right spell columns with spellListEntry and nested spellButtonsEntry', () => {
    resetCatalog()
    hydrateCatalog({
      pictos: { spells: { sort_12145: 'sort_12145.png' } },
    })
    const repeaters = windowRepeaters('playerSpell', PREVIEW_HUD)
    expect(repeaters?.ctr_spellListContainer).toBeUndefined()
    expect(repeaters?.ctr_leftSpellContainer).toHaveLength(1)
    expect(repeaters?.ctr_rightSpellContainer).toEqual([])
    expect(repeaters?.ctr_leftSpellContainer[0]?.template).toBe(LIST_TEMPLATES.ctr_spellListContainer)
    const inner = repeaters?.ctr_leftSpellContainer[0]?.repeaters?.gd_spellButtons
    expect(inner).toHaveLength(1)
    expect(inner?.[0]?.template).toBe(LIST_TEMPLATES.gd_spellButtons)
    expect(inner?.[0]?.resolve('lbl_spellName')?.text).toBe('Retour du Bâton')
    expect(inner?.[0]?.resolve('itemTile_container')?.sprite).toBe('/game-data/pictos/spells/sort_12145.png')
    expect(inner?.[0]?.resolve('lbl_spellName')?.replaceChildren).toBeUndefined()
    expect(inner?.[0]?.resolve('tx_bgSpell_activated')?.hidden).toBe(true)
    expect(inner?.[0]?.resolve('tx_greyedOut')?.hidden).toBe(true)
    expect(inner?.[0]?.repeaters?.gd_obtentionLevels).toEqual([])
  })

  it('uses creation-catalogue Féca spells rather than dumping the DataRoot', () => {
    resetCatalog()
    hydrateCatalog({
      breedSpells: {
        '1': [
          { id: 12983, name: 'Retour du Bâton', iconId: 12145, picto: 'pictos/spells/sort_12145.png' },
          { id: 12978, name: 'Langueur', iconId: 12135, picto: 'pictos/spells/sort_12135.png' },
        ],
      },
    })
    const repeaters = windowRepeaters('playerSpell', PREVIEW_HUD)
    expect(repeaters?.ctr_leftSpellContainer).toHaveLength(1)
    expect(repeaters?.ctr_rightSpellContainer).toHaveLength(1)
    expect(repeaters?.ctr_leftSpellContainer[0]?.repeaters?.gd_spellButtons[0]?.resolve('lbl_spellName')?.text).toBe('Retour du Bâton')
    expect(repeaters?.ctr_rightSpellContainer[0]?.repeaters?.gd_spellButtons[0]?.resolve('lbl_spellName')?.text).toBe('Langueur')
  })

  it('puts SpellVariant.spellIds side by side in one spellListEntry', () => {
    resetCatalog()
    hydrateCatalog({
      spells: {
        '13017': { id: 13017, name: 'Tétanie', iconId: 13084, picto: 'pictos/spells/sort_13084.png' },
      },
      breedSpells: {
        '1': [
          { id: 12983, name: 'Retour du Bâton', iconId: 12145, picto: 'pictos/spells/sort_12145.png' },
        ],
      },
      spellVariants: {
        '127': { id: 127, breedId: 1, spellIds: [12983, 13017] },
      },
    })
    const repeaters = windowRepeaters('playerSpell', PREVIEW_HUD)
    expect(repeaters?.ctr_leftSpellContainer).toHaveLength(1)
    const inner = repeaters?.ctr_leftSpellContainer[0]?.repeaters?.gd_spellButtons
    expect(inner).toHaveLength(2)
    expect(inner?.[0]?.resolve('lbl_spellName')?.text).toBe('Retour du Bâton')
    expect(inner?.[1]?.resolve('lbl_spellName')?.text).toBe('Tétanie')
    expect(inner?.[1]?.resolve('itemTile_container')?.sprite).toBe('/game-data/pictos/spells/sort_13084.png')
    expect(repeaters?.ctr_leftSpellContainer[0]?.resolve('tx_spell_bound')?.hidden).toBe(true)
  })

  it('fills gd_obtentionLevels from SpellLevelsDataRoot.minPlayerLevel, not the UXML dummy 111', () => {
    resetCatalog()
    hydrateCatalog({
      breedSpells: {
        '1': [
          { id: 12983, name: 'Retour du Bâton', iconId: 12145, picto: 'pictos/spells/sort_12145.png' },
        ],
      },
      spellObtention: {
        '12983': { id: 12983, minPlayerLevels: [1, 66, 132] },
      },
    })
    const repeaters = windowRepeaters('playerSpell', PREVIEW_HUD)
    const chips = repeaters?.ctr_leftSpellContainer[0]?.repeaters?.gd_spellButtons[0]?.repeaters?.gd_obtentionLevels
    expect(chips).toHaveLength(3)
    expect(chips?.every((row) => row.template === LIST_TEMPLATES.gd_obtentionLevels)).toBe(true)
    expect(chips?.map((row) => row.resolve('lbl_obtentionLevel')?.text)).toEqual(['1', '66', '132'])
  })

  it('fills lv_ornaments with CosmeticOrnamentLine rows of four, not lv_items', () => {
    resetCatalog()
    hydrateCatalog({
      ornaments: {
        '13': { id: 13, assetId: 1, name: 'Couronne', order: 1, picto: 'pictos/ornaments/1.png' },
        '14': { id: 14, assetId: 2, name: 'Ailes', order: 2, picto: 'pictos/ornaments/2.png' },
      },
      titles: {
        '1': { id: 1, name: 'Le Brave' },
      },
    })
    const repeaters = windowRepeaters('cosmeticUi', PREVIEW_HUD)
    expect(repeaters?.lv_items).toBeUndefined()
    expect(repeaters?.lv_ornaments).toHaveLength(1)
    expect(repeaters?.lv_ornaments[0]?.template).toBe(LIST_TEMPLATES.lv_ornaments)
    expect(repeaters?.lv_ornaments[0]?.resolve('ornamentName', 'ornament1')?.text).toBe('Couronne')
    expect(repeaters?.lv_ornaments[0]?.resolve('ornamentIcon', 'ornament1')?.sprite).toBe('/game-data/pictos/ornaments/1.png')
    expect(repeaters?.lv_ornaments[0]?.resolve('ornament3')?.hidden).toBe(true)
    expect(repeaters?.lv_titles).toHaveLength(1)
    expect(repeaters?.lv_titles[0]?.resolve('titleName', 'title1')?.text).toBe('Le Brave')
    expect(repeaters?.lv_titles[0]?.resolve('title2')?.hidden).toBe(true)
  })

  it('fills ctr_statBlocks with official MainStatItem hex tiles and EntityStatsTwoColumns pairs', () => {
    resetCatalog()
    hydrateCatalog({
      uiStrings: {
        'ui.stats.actionPoints': "Points d'action (PA)",
        'ui.stats.movementPoints': 'Points de mouvement (PM)',
        'ui.stats.range': 'Portée',
        'ui.stats.damagesBonusPercent': 'Puissance',
      },
    })
    const repeaters = windowRepeaters('characterSheetUi', PREVIEW_HUD)
    expect(repeaters?.ctr_statBlocks).toHaveLength(6)
    expect(repeaters?.ctr_statBlocks?.every((row) => row.template === LIST_TEMPLATES.ctr_statBlocks)).toBe(true)
    expect(repeaters?.ctr_statBlocks?.[0]?.resolve('tx_stat')?.sprite).toBe('tx_vitality')
    expect(repeaters?.ctr_statBlocks?.[0]?.resolve('lbl_statValue')?.text).toBe(formatInt(PREVIEW_HUD.life.max))
    expect(repeaters?.ctr_characterStatsDetailed?.every((row) => row.key !== 'vitality')).toBe(true)
    const sections = repeaters?.ctr_characterStatsDetailed?.filter(row => row.template === 'CharacterStatsDetailed')
    expect(sections).toHaveLength(3)
    expect(repeaters?.ctr_characterStatsDetailed?.filter(row => row.template === 'DividerOptionElement')).toHaveLength(3)
    const general = sections?.[0]?.repeaters?.ctr_characterStatsDetailed
    const firstPair = general?.[0]?.repeaters?.ctr_statsTwoColumns
    expect(firstPair).toHaveLength(2)
    expect(firstPair?.[0]?.resolve('lbl_statName')?.text).toBe("Points d'action (PA)")
    expect(firstPair?.[0]?.resolve('lbl_statValue')?.text).toBe('6')
    expect(firstPair?.[0]?.resolve('tx_stat')?.sprite).toBe('tx_actionPoints')
    expect(firstPair?.[1]?.resolve('tx_stat')?.sprite).toBe('tx_crit')
    const secondPair = general?.[1]?.repeaters?.ctr_statsTwoColumns
    expect(secondPair?.[0]?.resolve('lbl_statName')?.text).toBe('Points de mouvement (PM)')
    expect(secondPair?.[1]?.resolve('lbl_statName')?.text).toBe('Puissance')
    expect(secondPair?.[0]?.resolve('tx_stat')?.sprite).toBe('tx_movementPoints')
    expect(secondPair?.[1]?.resolve('tx_stat')?.sprite).toBe('tx_damagesPercent')
    const table = repeaters?.ctr_characterStatsDetailed?.find((row) => row.template === 'EntityStatsTable')
    expect(table?.repeaters?.ctr_entityStatsTableItems).toHaveLength(11)
    expect(table?.repeaters?.ctr_entityStatsTableItems?.[0]?.resolve('lbl_statName')?.text).toBe('Neutre')
    expect(table?.repeaters?.ctr_entityStatsTableItems?.[0]?.resolve('tx_stat')?.sprite).toBe('tx_neutral')
  })

  it('keeps flat damage, power, fixed resistance and percentage resistance separate', () => {
    const hud = structuredClone(PREVIEW_HUD)
    hud.combat.all_damage = { ...hud.combat.all_damage, total: 12 }
    hud.combat.earth_resist = { ...hud.combat.earth_resist, total: 17 }
    const secondary = (key: string, total: number) => ({ key, label: key, value: { base_value: 0, additional: 0, equipment: total, total } })
    hud.secondary.push(secondary('power', 150), secondary('earth_damage', 48), secondary('earth_reduction', 7))
    const root = windowRepeaters('characterSheetUi', hud)!.ctr_characterStatsDetailed
    const power = root[0].repeaters!.ctr_characterStatsDetailed[1].repeaters!.ctr_statsTwoColumns[1]
    expect(power.resolve('lbl_statValue')?.text).toBe('150')
    const table = root.find(row => row.template === 'EntityStatsTable')!.repeaters!.ctr_entityStatsTableItems
    const earth = table.find(row => row.key === 'earth')!
    expect(earth.resolve('lbl_damageValue')?.text).toBe('60')
    expect(earth.resolve('lbl_resFixValue')?.text).toBe('7')
    expect(earth.resolve('lbl_resPercentValue')?.text).toBe('17 %')
    expect(table.find(row => row.key === 'spells')!.resolve('lbl_damageValue')?.text).toBe('—')
    expect(table.find(row => row.key === 'critical')!.resolve('lbl_resPercentValue')?.text).toBe('—')
  })

  it('does not invent a repeater for an unproven host', () => {
    expect(windowRepeaters('chatview', PREVIEW_HUD)).toBeUndefined()
    expect(windowRepeaters('guildBase', PREVIEW_HUD)).toBeUndefined()
    expect(windowRepeaters('guild', PREVIEW_HUD)).toBeUndefined()
  })

  it('clones chatItem rows with sender / body and a ChatTooltip bubble', () => {
    expect(stripChatMarkup('<font color="#FF8C00"><b>help</b></font>')).toBe('help')
    const rows = chatRepeaters([
      { id: 'm1', kind: 'message', channel: 0, sender: 'Hugo', content: 'salut', timestamp: 1 },
      { id: 'i1', kind: 'info', channel: 10, content: '<font color="#FF8C00">Available commands:</font>', timestamp: 2 },
    ])
    expect(rows.listChat).toHaveLength(2)
    expect(rows.listChat.every((row) => row.template === LIST_TEMPLATES.listChat)).toBe(true)
    expect(rows.listChat[0]?.resolve('content')?.text).toMatch(/^\[\d{2}:\d{2}\] Hugo : $/)
    expect(rows.listChat[0]?.resolve('subContent')?.text).toBe('salut')
    expect(rows.listChat[0]?.resolve('line')?.tooltip?.tree).toBe('ChatTooltip')
    expect(rows.listChat[0]?.resolve('line')?.tooltip?.resolve?.('lbl_text')?.text).toBe('Hugo : salut')
    expect(rows.listChat[1]?.resolve('content')?.text).toMatch(/Available commands:$/)
    expect(rows.listChat[1]?.resolve('subContent')?.hidden).toBe(true)
    expect(rows.listChat[1]?.resolve('line')?.tooltip?.resolve?.('lbl_text')?.text).toBe('Available commands:')
  })

  it('wraps chat rows so long tokens never overflow the resized window', () => {
    const rows = chatRepeaters([
      { id: 'm1', kind: 'message', channel: 0, sender: 'Hugo', content: 'salut', timestamp: 1 },
    ])
    const content = rows.listChat[0]?.resolve('content')
    expect(content?.style).toMatchObject({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })
    const sub = rows.listChat[0]?.resolve('subContent')
    expect(sub?.style).toMatchObject({ overflowWrap: 'anywhere' })
  })
})

it('updates spell locks and obtention milestones from the current server snapshot', () => {
  resetCatalog()
  const render = (level: number, available: boolean) => {
    const hud = { ...PREVIEW_HUD, character: { ...PREVIEW_HUD.character, level },
      spell_choices: [[{ id: 100, name: 'Sort', grade: level >= 66 ? 2 : 1, available, obtention_levels: [6, 66, 132] }]] }
    return windowRepeaters('playerSpell', hud)?.ctr_leftSpellContainer[0]?.repeaters?.gd_spellButtons[0]
  }
  const locked = render(5, false)
  expect(locked?.resolve('tx_lock')?.hidden).toBe(false)
  const unlocked = render(66, true)
  expect(unlocked?.resolve('tx_lock')?.hidden).toBe(true)
  expect(unlocked?.resolve('tx_greyedOut')?.hidden).toBe(true)
  const chips = unlocked?.repeaters?.gd_obtentionLevels
  expect(chips?.map(chip => chip.resolve('lbl_obtentionLevel')?.text)).toEqual(['6', '66', '132'])
  expect(chips?.map(chip => chip.resolve('obtentionContainer')?.style?.background)).toEqual(['var(--highlight_secondary100)', 'var(--highlight_secondary100)', '#00000080'])
})

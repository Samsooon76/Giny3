import { installCssCoverage } from './fixtures/cssCoverage'
installCssCoverage()
import { expect, test } from '@playwright/test'

/** Official interaction states on the extracted `bannerMenu` tiles.

    Hover/pressed/disabled colours live in CSS next to `:hover` / `:active` /
    `[data-state]`. These tests assert `getComputedStyle` actually changes —
    the regression that made every tile look static. */
test.describe('HUD banner tile cascade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?ui-preview=hud')
    await page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first().waitFor({ state: 'visible' })
  })

  test('hover changes the official tile fill', async ({ page }) => {
    const slot = page.locator('[data-binding="gd_btnUis"] button.official-Slot').first()
    const tile = slot.locator('[data-binding="itemTile_container"]')
    const rest = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    await slot.hover()
    const hover = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(hover).not.toBe(rest)
  })

  test('pressed data-state uses the official pressed fill', async ({ page }) => {
    const slot = page.locator('[data-binding="gd_btnUis"] button.official-Slot').first()
    const tile = slot.locator('[data-binding="itemTile_container"]')
    const rest = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    await slot.evaluate((el) => el.setAttribute('data-state', 'pressed'))
    const pressed = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(pressed).not.toBe(rest)
  })

  test('disabled data-state uses the official disabled fill', async ({ page }) => {
    const slot = page.locator('[data-binding="gd_btnUis"] button.official-Slot').first()
    const tile = slot.locator('[data-binding="itemTile_container"]')
    const rest = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    await slot.evaluate((el) => el.setAttribute('data-disabled', 'true'))
    const disabled = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(disabled).not.toBe(rest)
  })

  test('paints from dofus3-ui Standard tokens, not compiled DarkStone', async ({ page }) => {
    const canvas = page.locator('.official-canvas.uitk-root')
    await expect(canvas).toBeVisible()
    const primary = await canvas.evaluate((el) => getComputedStyle(el).getPropertyValue('--highlight_primary100').trim())
    expect(primary.toLowerCase()).toMatch(/#f0ff4f|240,\s*255,\s*79/)
    const tile = page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first()
    const fill = await tile.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(fill).toMatch(/80,\s*84,\s*126/)
    const banner = page.locator('[data-tree="bannerMenu"] [data-name="background"]')
    const image = await banner.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(image).toMatch(/\/uitk\/assets\//)
  })
})

test('character orb uses stacked HP and hides initiative', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const heart = page.locator('[data-tree="characterInformations"] [data-binding="tx_hp"]')
  await heart.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="characterInformations"] [data-binding="parentTopBottom"]')).toBeVisible()
  await expect(page.locator('[data-tree="characterInformations"] [data-binding="lbl_pdvTop"]')).toHaveText(/2\s*487/)
  await expect(page.locator('[data-tree="characterInformations"] [data-binding="lbl_pdvBottom"]')).toHaveText(/3\s*915/)
  await expect(page.locator('[data-tree="characterInformations"] [data-binding="lbl_pdv"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="characterInformations"] [data-binding="ctr_ip"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="characterInformations"] [data-name="CharacterInformations"]')).toHaveClass(/withoutPI/)
})

test('HUD paints the official XP gauge widget', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const gauge = page.locator('[data-tree="widgetProgressGauge"] [data-binding="gauge"]')
  await gauge.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="widgetProgressGauge"] [data-binding="lbl_value"]')).toHaveText('200')
  await expect(gauge).toHaveClass(/primary/)
  const fill = page.locator('[data-tree="widgetProgressGauge"] [data-binding="extend-progress-bar__progress"]')
  const color = await fill.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(color).toMatch(/234,\s*255,\s*77|#eaff4d/i)
})

test('character orb ornaments tint on the winged host, not its 106px parent', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const wing = page.locator('[data-tree="characterInformations"] .tintColor_highlight_secondary100.uitk-inline-characterInformations-7')
  await wing.waitFor({ state: 'visible' })
  await expect(wing.locator(':scope > .uitk-tint-layer')).toHaveCount(1)
  const position = await wing.evaluate((el) => getComputedStyle(el).position)
  expect(position).toBe('relative')
})

test('Figma window chrome uses official header and button fills', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character&sheet=detailed')
  const header = page.locator('[data-tree="characterSheetUi"] [data-binding="StatSheet"] > [data-name="header"].header.primary')
  await header.waitFor({ state: 'visible' })
  await expect(header.locator('[data-name="header_titleLabel"]')).toContainText(/Caract/i)
  await expect(header.locator('[data-name="header_shortcut"]')).toHaveText('C')
  await expect(header.locator('[data-binding="header_buttonRight"]')).toBeVisible()
  await expect(page.locator('[data-tree="characterSheetUi"] .official-window-options')).toHaveCount(0)
  await expect(header.locator(':scope > .uitk-tint-layer')).toHaveCount(1)
  const button = page.locator('[data-binding="btn_distributeMyPoints"]')
  await button.waitFor({ state: 'visible' })
  await expect(button).toHaveClass(/primary/)
  const host = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(host).toMatch(/0,\s*0,\s*0,\s*0|transparent/)
  const fill = await button.locator('[data-name="button_container"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(fill).not.toMatch(/255,\s*255,\s*255/)
  expect(fill).not.toMatch(/0,\s*0,\s*0,\s*0/)
  const caption = button.locator('[data-name="button_label"]')
  await expect(caption).toBeVisible()
  await expect.poll(async () => caption.evaluate((el) => el.className)).toMatch(/button_medium/)
  const transform = await caption.evaluate((el) => getComputedStyle(el).textTransform)
  expect(transform).toBe('uppercase')
  // The web shadow adaptation explicitly uses opacity 0.8 (visualNode.tsx).
  const shadow = page.locator('[data-tree="characterSheetUi"] [data-name="window_shadow"]').first()
  await expect(shadow).toBeAttached()
  expect(await shadow.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.8')
  await expect(page.locator('[data-tree="characterSheetUi"] .uitk-inline-characterSheetUi-1').first()).toBeAttached()
})

test('character sheet default is the lines list, not the radar', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character')
  await page.locator('[data-binding="btn_distributeMyPoints"]').waitFor({ state: 'visible' })
  await expect(page.locator('[data-binding="ctr_detailedStats"]')).toBeVisible()
  await expect(page.locator('[data-binding="statsGraph"]')).toHaveCount(0)
})

test('character sheet portrait mask clips the 300px entity to the 96px host', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character')
  const portrait = page.locator('[data-tree="characterSheetUi"] [data-binding="ed_player"]')
  await portrait.waitFor({ state: 'visible' })
  const mask = portrait.locator('[data-binding="ed_entity_mask"]')
  const overflow = await mask.evaluate((el) => getComputedStyle(el).overflow)
  expect(overflow).toBe('hidden')
  const host = await portrait.boundingBox()
  const clip = await mask.boundingBox()
  expect(host?.width).toBeGreaterThan(40)
  expect(clip?.width ?? 0).toBeLessThanOrEqual((host?.width ?? 0) + 4)
  expect(clip?.height ?? 0).toBeLessThanOrEqual((host?.height ?? 0) + 4)
})

test('character sheet detailed stats sit in EntityStatsTwoColumns rows', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character')
  const row = page.locator('[data-binding="ctr_characterStatsDetailed"] > [data-uitk-template="EntityStatsTwoColumns"]').first()
  await row.waitFor({ state: 'visible' })
  const direction = await row.evaluate((el) => getComputedStyle(el).flexDirection)
  expect(direction).toBe('row')
  const pair = await row.evaluate((el) => [...el.children].filter((child) => child.getAttribute('data-binding') === 'ctr_stat').length)
  expect(pair).toBe(2)
  const sizes = await row.evaluate((el) => {
    const items = [...el.children].filter((child) => child.getAttribute('data-binding') === 'ctr_stat')
    const rowBox = el.getBoundingClientRect()
    return {
      row: rowBox.width,
      items: items.map((child) => child.getBoundingClientRect().width),
    }
  })
  expect(sizes.row).toBeGreaterThan(200)
  expect(sizes.items).toHaveLength(2)
  // Padding-only collapse was 2px. Yoga's equal split of two flex-grow:1
  // children is half the row minus the 2px gap, not a PNG-sampled width.
  expect(sizes.items[0]).toBeGreaterThan(sizes.row * 0.35)
  expect(sizes.items[1]).toBeGreaterThan(sizes.row * 0.35)
  const heights = await row.evaluate((el) => {
    const items = [...el.children].filter((child) => child.getAttribute('data-binding') === 'ctr_stat')
    return items.map((child) => child.getBoundingClientRect().height)
  })
  // USS padding 2+2 plus 24px icon. Wrapping "Points d'action (PA)" was 64px.
  expect(heights[0]).toBeLessThan(40)
  await expect(row.locator('[data-binding="lbl_statName"]').first()).toHaveText(/Points? d'action \(PA\)/)
  await expect(row.locator('[data-binding="lbl_statValue"]').first()).toHaveText(/^\s*6\s*$/)
  // Digit width is intrinsic (~9px at 16px). boundingBox follows the HUD
  // canvas scale (Desktop Chrome is 1280 wide), so assert USS on computed style.
  const valueWidth = await row.locator('[data-binding="lbl_statValue"]').first().evaluate((el) => (
    parseFloat(getComputedStyle(el).width)
  ))
  expect(valueWidth).toBeGreaterThan(4)
  expect(valueWidth).toBeLessThan(48)
  const iconSize = await row.locator('[data-binding="tx_stat"]').first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return { width: parseFloat(cs.width), height: parseFloat(cs.height) }
  })
  expect(iconSize.width).toBe(24)
  expect(iconSize.height).toBe(24)
})

test('spell book pairs SpellVariant buttons on a row and keeps the Autres tab', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=spells')
  const list = page.locator('[data-tree="playerSpell"] [data-binding="ctr_spellListContainer"]')
  await list.waitFor({ state: 'visible' })
  const tabs = page.locator('[data-tree="playerSpell"] [data-binding="tab_label"]')
  await expect(tabs).toHaveCount(2)
  await expect(tabs.nth(0)).toHaveText('Féca')
  await expect(tabs.nth(1)).toHaveText('Autres')
  await expect(page.locator('[data-tree="playerSpell"] [data-binding="inp_search"]')).toBeVisible()
  await expect(page.locator('[data-tree="playerSpell"] [data-binding="chk_showLevel"]')).toBeVisible()
  const names = page.locator('[data-tree="playerSpell"] [data-binding="lbl_spellName"]')
  await expect(names.first()).toBeVisible()
  await expect.poll(async () => names.count()).toBeGreaterThanOrEqual(2)
  await expect(names.nth(0)).toHaveText('Retour du Bâton')
  await expect(names.nth(1)).toHaveText('Tétanie')
  const first = await names.nth(0).boundingBox()
  const second = await names.nth(1).boundingBox()
  expect(Math.abs((second?.y ?? 0) - (first?.y ?? 0))).toBeLessThan(24)
  expect((second?.x ?? 0) - (first?.x ?? 0)).toBeGreaterThan(80)
  const scroll = page.locator('[data-tree="playerSpell"] [data-binding="gd_spells"]')
  const overflow = await scroll.evaluate((el) => getComputedStyle(el).overflowY)
  expect(overflow).toMatch(/auto|scroll/)
  const hostOverflow = await list.evaluate((el) => getComputedStyle(el).overflowY)
  expect(hostOverflow).not.toMatch(/auto|scroll/)
  const left = page.locator('[data-tree="playerSpell"] [data-binding="ctr_leftSpellContainer"] [data-binding="lbl_spellName"]')
  const right = page.locator('[data-tree="playerSpell"] [data-binding="ctr_rightSpellContainer"] [data-binding="lbl_spellName"]')
  await expect.poll(async () => right.count()).toBeGreaterThan(0)
  const leftBox = await left.first().boundingBox()
  const rightBox = await right.first().boundingBox()
  expect(Math.abs((rightBox?.y ?? 0) - (leftBox?.y ?? 0))).toBeLessThan(24)
  expect((rightBox?.x ?? 0) - (leftBox?.x ?? 0)).toBeGreaterThan(80)
  const layoutToggle = page.locator('[data-tree="playerSpell"] [data-binding="tgl_group"] .official-DofusToggleButtonCustom').first()
  const toggleSize = await layoutToggle.evaluate((el) => {
    const s = getComputedStyle(el)
    return { w: parseFloat(s.width), h: parseFloat(s.height) }
  })
  expect(toggleSize.w).toBeGreaterThanOrEqual(30)
  expect(toggleSize.h).toBeGreaterThanOrEqual(30)
  const chips = page.locator('[data-tree="playerSpell"] [data-binding="ctr_leftSpellContainer"] [data-binding="lbl_obtentionLevel"]')
  await expect.poll(async () => chips.count()).toBeGreaterThanOrEqual(3)
  await expect(chips.nth(0)).toHaveText('1')
  await expect(chips.nth(1)).toHaveText('66')
  await expect(chips.nth(2)).toHaveText('132')
  const searchIcon = page.locator('[data-tree="playerSpell"] [data-binding="inp_search"] [data-binding="textInput_iconLeft"]')
  await expect(searchIcon).toBeVisible()
  const iconBox = await searchIcon.evaluate((el) => {
    const s = getComputedStyle(el)
    return { w: parseFloat(s.width), h: parseFloat(s.height) }
  })
  expect(iconBox.w).toBe(20)
  expect(iconBox.h).toBe(20)
  const vector = page.locator('[data-tree="playerSpell"] [data-binding="inp_search"] [data-binding="textInput_iconLeft_Vector"]')
  await expect(vector).toHaveClass(/official-tinted-bg/)
  const paint = await vector.evaluate((el) => {
    const before = getComputedStyle(el, '::before')
    return `${before.webkitMaskImage} ${before.maskImage} ${getComputedStyle(el).backgroundImage}`
  })
  expect(paint).toMatch(/magnifier/)
})

test('inventory search stays inside the storage pane', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  const storage = page.locator('[data-tree="equipmentStorageUi"] [data-binding="storage"]')
  await storage.waitFor({ state: 'visible' })
  const search = storage.locator('[data-binding="InputSearchField"]')
  await expect(search).toBeVisible()
  const pane = await storage.boundingBox()
  const field = await search.boundingBox()
  expect(field?.x ?? 0).toBeGreaterThanOrEqual((pane?.x ?? 0) - 2)
  expect((field?.x ?? 0) + (field?.width ?? 0)).toBeLessThanOrEqual((pane?.x ?? 0) + (pane?.width ?? 0) + 2)
  expect(field?.y ?? 0).toBeGreaterThanOrEqual((pane?.y ?? 0) - 2)
  const loupe = search.locator('[data-binding="textInput_iconLeft"]')
  await expect(loupe).toBeVisible()
  const loupeSize = await loupe.evaluate((el) => {
    const s = getComputedStyle(el)
    return { w: parseFloat(s.width), h: parseFloat(s.height) }
  })
  expect(loupeSize.w).toBe(20)
  expect(loupeSize.h).toBe(20)
  const vector = search.locator('[data-binding="textInput_iconLeft_Vector"]')
  await expect(vector).toHaveClass(/official-tinted-bg/)
})

test('character sheet paints official MainStatItem hex tiles', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character&sheet=detailed')
  const tile = page.locator('[data-binding="ctr_statBlocks"] [data-binding="tx_backStat"]').first()
  await tile.waitFor({ state: 'visible' })
  const image = await tile.evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(image).toMatch(/statBack1|\/ui-data\/|\/uitk\//)
  await expect(page.locator('[data-binding="ctr_statBlocks"] [data-binding="lbl_statValue"]').first()).toHaveText(/3\s*915/)
})

test('filled inventory tiles drop the GridView dummy-item class', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  const filled = page.locator('[data-official-id="equipmentStorageUi-grid_0-slot_0"]')
  await filled.waitFor({ state: 'visible' })
  await expect(filled).toHaveClass(/acquiredTrue/)
  await expect(filled).not.toHaveClass(/dummy-item/)
  const empty = page.locator('[data-official-id="equipmentStorageUi-grid_17-slot_17"]')
  await expect(empty).toHaveClass(/is-empty/)
})

test('inventory equipment slots paint the equipped item through the official Slot', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  const hat = page.locator('[data-tree="equipmentStorageUi"] [data-uitk-template="EquipmentComponent"][data-binding="slot_6"]')
  await hat.waitFor({ state: 'visible' })
  await expect(hat).toHaveClass(/acquiredTrue/)
  const paintedItem = hat.locator('[data-binding="itemTile_asset_asset"]')
  await expect(paintedItem).toBeVisible()
  const image = await paintedItem.evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(image).toMatch(/\/game-data\/pictos\/items\/16041\.png/)
})

test('inventory footer clones presetsManager in player state', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  const title = page.locator('[data-tree="equipmentStorageUi"] [data-binding="presetManager"] [data-binding="lbl_title"]')
  await title.waitFor({ state: 'visible' })
  await expect(title).toHaveText(/équiper un ensemble/i)
  const action = page.locator('[data-tree="equipmentStorageUi"] [data-binding="presetManager"] [data-binding="btn_action"] [data-name="button_label"]')
  await expect(action).toBeVisible()
  await expect(action).toHaveText(/mes ensembles \(0\)/i)
  await expect(page.locator('[data-tree="equipmentStorageUi"] [data-binding="ctr_builds"]')).toBeAttached()
  await expect(page.locator('[data-tree="equipmentStorageUi"] [data-binding="btn_newBuild"]')).toHaveCount(0)
})

test('guild tab body paints from the guild sheet, not guildBase inlines', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=guild')
  const host = page.locator('[data-tree="guildBase"] [data-name="ctr-ui"]')
  await host.waitFor({ state: 'attached' })
  await expect(host).toHaveClass(/uitk-inline-guildBase-2/)
  const body = page.locator('[data-tree="guildBase"] [data-name="guild"]')
  await expect(body).toHaveClass(/uitk-inline-guild-0/)
  await expect(body).toHaveAttribute('data-uitk-template', 'guild')
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_guildMembers"]')).toHaveClass(/uitk-inline-guild-/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="inp_guildMotd"]')).toHaveClass(/uitk-inline-guild-/)
})

test('guild members tab clones guildMembers into empty ctr_content', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=guild')
  const members = page.locator('[data-tree="guildBase"] [data-binding="ctr_socialMembers"]')
  await members.waitFor({ state: 'visible' })
  await expect(members).toHaveAttribute('data-uitk-template', 'guildMembers')
  await expect(members).toHaveClass(/uitk-inline-guildMembers-/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="inp_search"]')).toBeVisible()
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_manageRanks"]')).toBeVisible()
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_seeApplications"]')).toBeVisible()
  await expect(page.locator('[data-tree="guildBase"] [data-binding="tch_memberName"]')).toBeVisible()
  await expect(page.locator('[data-tree="guildBase"] [data-binding="lv_socialMembers"]')).toBeAttached()
  await expect(page.locator('[data-tree="guildBase"] [data-binding="lbl_memberName"]')).toHaveText('Hugo')
  await expect(page.locator('[data-tree="guildBase"] [data-binding="lbl_membersCount"]')).toHaveText('Membres : 1 / 1')
  const tab = page.locator('[data-tree="guildBase"] [data-binding="btn_guildMembers"]')
  await expect(tab).toHaveClass(/activeTrue/)
  await expect(tab).not.toHaveClass(/activeFalse/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="chbx_membersOffline"] [data-binding="checkboxLine_labelRight"]')).toHaveText(
    'Afficher les membres de la guilde déconnectés',
  )
  await expect(page.locator('[data-tree="guildBase"] [data-binding="chbx_warnAboutMemberConnexion"] [data-binding="checkboxLine_labelRight"]')).toHaveText(
    "Signaler la connexion d'un membre de la guilde",
  )
  await expect(page.locator('[data-tree="guildBase"] [data-binding="chbx_membersOffline"] [data-binding="checkboxLine_labelRight"]')).not.toHaveText(/alliance/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_contribute"]')).toHaveClass(/(?:^|\s)primary(?:\s|$)/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_contribute"]')).not.toHaveClass(/(?:^|\s)secondary(?:\s|$)/)
  await expect(page.locator('[data-tree="guildBase"] [data-binding="btn_manageRanks"]')).toContainText(/voir les rangs/i)
})

test('job craft tab keeps JobRecipesAndSkills inlines', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=jobs')
  const recipes = page.locator('[data-tree="jobUI"] [data-binding="ctr_jobRecipesAndSkills"]')
  await recipes.waitFor({ state: 'attached' })
  await expect(recipes).toHaveClass(/uitk-inline-JobRecipesAndSkills-0/)
  await expect(recipes).toHaveAttribute('data-uitk-template', 'JobRecipesAndSkills')
  await expect(page.locator('[data-tree="jobUI"] [data-binding="jobProgressTab"]')).toHaveClass(/uitk-inline-jobProgressTab-0/)
  await expect(page.locator('[data-tree="jobUI"] [data-binding="lv_jobProgress"]')).toHaveClass(/uitk-inline-jobProgressTab-6/)
})

test('job window reveals recipesUI and clones jobRecipeItem into lv_recipe', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=jobs')
  const pane = page.locator('[data-tree="jobUI"] [data-binding="recipesUI"]').first()
  await pane.waitFor({ state: 'visible' })
  const tab = page.locator('[data-tree="jobUI"] [data-binding="tab_recipe"]')
  await expect(tab).toHaveClass(/activeTrue/)
  await expect(tab).not.toHaveClass(/activeFalse/)
  const row = page.locator('[data-tree="jobUI"] [data-binding="lv_recipe"] [data-uitk-template="jobRecipeItem"]').first()
  await row.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="jobUI"] [data-binding="ctr_bottom"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="jobUI"] [data-binding="lbl_ingredientsOwned"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="jobUI"] [data-binding="ctr_checkRecipeItem"]')).toHaveCount(0)
  const jobs = page.locator('[data-tree="jobUI"] [data-binding="lv_jobProgress"] [data-binding="jobProgressItem"]')
  await expect(jobs.first()).toHaveCSS('border-top-color', 'rgb(228, 241, 91)')
  await jobs.nth(1).click()
  await expect(jobs.nth(1)).toHaveCSS('border-top-color', 'rgb(228, 241, 91)')
  await expect(jobs.first()).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
})

test('appearance NoiseParticle clones keep the NoiseParticle sheet', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=cosmetics')
  const particle = page.locator('[data-tree="cosmeticUi"] [data-type="NoiseParticle"]').first()
  await particle.waitFor({ state: 'attached' })
  await expect(particle.locator('[data-uitk-template="NoiseParticle"]').first()).toBeAttached()
  await expect(particle.locator('.uitk-inline-NoiseParticle-0').first()).toBeAttached()
  await expect(page.locator('[data-tree="cosmeticUi"] [data-uitk-template="AppearanceUI"]')).toHaveCount(0)
})

test('cosmetics chrome uses ui.common.cosmetics, not the Inventory constructor slot', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=cosmetics')
  const title = page.locator('[data-tree="cosmeticUi"] [data-name="header_titleLabel"]')
  await title.waitFor({ state: 'visible' })
  await expect(title).toHaveText('Cosmétiques')
})

test('inventory chrome uses ui.common.inventory', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  await expect(page.locator('[data-tree="equipmentStorageUi"] [data-name="header_titleLabel"]')).toHaveText('Inventaire')
})

test('cosmetics storage sits beside the doll, not over btnAppearance', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=cosmetics')
  const button = page.locator('[data-tree="cosmeticUi"] [data-binding="btnAppearance"]')
  const storage = page.locator('[data-tree="cosmeticUi"] [data-binding="storage"]')
  const window = page.locator('[data-tree="cosmeticUi"] [data-binding="CosmeticUi"]')
  await button.waitFor({ state: 'visible' })
  const doll = await button.boundingBox()
  const pane = await storage.boundingBox()
  expect(pane?.x ?? 0).toBeGreaterThan((doll?.x ?? 0) + (doll?.width ?? 0) - 8)
  expect(parseFloat(await window.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(1200)
})

test('cosmetics appearance button opens the AppearanceUI WindowFigma', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=cosmetics')
  const button = page.locator('[data-tree="cosmeticUi"] [data-binding="btnAppearance"]')
  await button.waitFor({ state: 'visible' })
  await button.click()
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="Appearance"]')).toBeVisible()
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabFace"]')).toBeVisible()
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabFace"]')).toHaveClass(/(?:^|\s)activeTrue(?:\s|$)/)
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabFace"] [data-binding="tab_label"]')).toHaveText('Visages')
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabBodies"] [data-binding="tab_label"]')).toHaveText('Corps')
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabIdles"] [data-binding="tab_label"]')).toHaveText('Poses')
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="tabColors"] [data-binding="tab_label"]')).toHaveText('Couleurs')
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="bodyParent"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="idleParent"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="colorParent"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="validateInfo"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="AppearanceUI"] [data-binding="chk_hideUnavailable"] [data-binding="checkboxLine_labelRight"]')).toHaveText(
    'Masquer les visages non applicables',
  )
})

test('cosmetics footer stamps named-index filter captions, not empty 24px boxes', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=cosmetics')
  await expect(page.locator('[data-tree="cosmeticUi"] [data-binding="chk_obtainedFilter"] [data-binding="checkboxLine_labelRight"]')).toHaveText('Non obtenus')
  await expect(page.locator('[data-tree="cosmeticUi"] [data-binding="chk_displayNames"] [data-binding="checkboxLine_labelRight"]')).toHaveText('Masquer les noms')
  await expect(page.locator('[data-tree="cosmeticUi"] [data-binding="chk_obtainedFilter"]')).toHaveClass(/(?:^|\s)checkboxLine(?:\s|$)/)
  await expect(page.locator('[data-tree="cosmeticUi"] [data-binding="InputSearchField"] [data-binding="textInput_placeholder"]')).toHaveText('Rechercher')
  await expect(page.locator('[data-tree="cosmeticUi"] [data-binding="elementsCount"]')).toHaveText(/\d+ éléments/)
})

test('spell window keeps the C# host width instead of shrinking to a spell icon', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=spells')
  const window = page.locator('[data-tree="playerSpell"] [data-binding="PlayerSpell"]')
  await window.waitFor({ state: 'visible' })
  expect(parseFloat(await window.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(1400)
  expect(parseFloat(await window.evaluate((el) => getComputedStyle(el).height))).toBeGreaterThan(900)
})

test('Figma windows paint header_buttonRight close, not the widget kebab', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=spells')
  const close = page.locator('[data-tree="playerSpell"] [data-binding="header_buttonRight"]')
  await close.waitFor({ state: 'visible' })
  const size = await close.evaluate((el) => {
    const s = getComputedStyle(el)
    return { w: parseFloat(s.width), h: parseFloat(s.height) }
  })
  expect(size.w).toBeGreaterThanOrEqual(30)
  expect(size.w).toBeLessThanOrEqual(34)
  expect(size.h).toBeGreaterThanOrEqual(30)
  expect(size.h).toBeLessThanOrEqual(34)
  await expect(page.locator('[data-tree="playerSpell"] .official-window-options')).toHaveCount(0)
  await expect(page.locator('[data-tree="playerSpell"] [data-binding="header_buttonHelp"]')).toHaveCount(0)
  await close.click()
  await expect(page.locator('[data-tree="playerSpell"] [data-binding="PlayerSpell"]')).toHaveCount(0)
})

test('magnetic widgets paint tree header_buttonRight moreActions, not an overlay kebab', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const kebab = page.locator('[data-tree="chatview"] [data-binding="header_buttonRight"]')
  await kebab.waitFor({ state: 'visible' })
  const size = await kebab.evaluate((el) => {
    const s = getComputedStyle(el)
    return { w: parseFloat(s.width), h: parseFloat(s.height) }
  })
  expect(size.w).toBeGreaterThanOrEqual(18)
  expect(size.w).toBeLessThanOrEqual(22)
  expect(size.h).toBeGreaterThanOrEqual(18)
  expect(size.h).toBeLessThanOrEqual(22)
  await expect(page.locator('[data-tree="chatview"] .official-window-options-button')).toHaveCount(0)
  await expect(page.locator('[data-tree="questList"] [data-binding="header_buttonRight"]')).toBeVisible()
  await expect(page.locator('[data-tree="chatview"] [data-type="DofusButtonCustom"][data-binding="header_buttonLeft"]')).toHaveCount(1)
  const leftParent = await page.locator('[data-tree="chatview"] [data-binding="header_left"]').evaluate((el) => (
    (el.parentElement as HTMLElement | null)?.getAttribute('data-binding')
    ?? (el.parentElement as HTMLElement | null)?.getAttribute('data-name')
  ))
  expect(leftParent).toBe('header')
  await kebab.click()
  await expect(page.locator('[data-tree="chatview"] .official-window-menu')).toBeVisible()
})

test('quest tracker clones questList_quest into lv_main from followed hud.quests', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const title = page.locator('[data-tree="questList"] [data-binding="lv_main"] [data-binding="lbl_titleQuest"]')
  await title.waitFor({ state: 'visible' })
  await expect(title).toHaveText("Les principes d'Archie m'aident")
  await expect(page.locator('[data-tree="questList"] [data-name="header_label"]')).toHaveText(/quêtes suivies \(1\)/i)
  await expect(page.locator('[data-tree="questList"] [data-binding="btn_more"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="questList"] [data-binding="icon_dailyQuest"]')).toHaveCount(0)
  await expect(page.locator('link[href="/uitk/trees/questList_quest.css"]')).toHaveCount(1)
  const objectives = page.locator('[data-tree="questList"] [data-binding="lv_main"] [data-binding="lbl_objective"]')
  await expect(objectives).toHaveCount(1)
  await expect(objectives.nth(0)).toHaveText('Aller voir Envoyée des Douze')
  await expect(page.locator('[data-tree="questList"] [data-binding="icon_loc"]')).toHaveCount(1)
  await expect(page.locator('link[href="/uitk/trees/questList_objective.css"]')).toHaveCount(1)
})

test('chat input sends a line into listChat and opens ChatTooltip on hover', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const input = page.locator('[data-tree="chatview"] [data-binding="ti_chatInput"] input')
  await input.waitFor({ state: 'visible' })
  await input.fill('salut')
  await input.press('Enter')
  const sender = page.locator('[data-tree="chatview"] [data-binding="listChat"] [data-binding="content"]')
  await expect(sender).toHaveText(/^\[\d{2}:\d{2}\] Hugo :\s*$/)
  await expect(page.locator('[data-tree="chatview"] [data-binding="listChat"] [data-binding="subContent"]')).toHaveText('salut')
  await page.locator('[data-tree="chatview"] [data-binding="listChat"] [data-binding="line"]').hover()
  await expect(page.locator('[data-tree="ChatTooltip"] [data-binding="lbl_text"]')).toHaveText('Hugo : salut')
  // `ChatTooltip` has no generated `/uitk/trees/ChatTooltip.css`: its light
  // `dialogueLeft` bubble must come from the compiled JSON 9-slice, or the
  // official black text floats over the dark game, unreadable.
  const bubble = await page.locator('[data-tree="ChatTooltip"] [data-binding="background"]').evaluate((el) => {
    const style = getComputedStyle(el)
    return { borderImage: style.borderImageSource, backgroundImage: style.backgroundImage }
  })
  expect(bubble.borderImage !== 'none' || bubble.backgroundImage !== 'none').toBe(true)
})

test('spell window paints UXML KEY:S as the header_shortcut chip', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=spells')
  const chip = page.locator('[data-tree="playerSpell"] [data-name="header_shortcut"]')
  await chip.waitFor({ state: 'visible' })
  await expect(chip.locator('[data-name="CTAElements_label"]')).toHaveText('S')
  await expect(chip).toHaveClass(/CTAElements/)
  await expect(chip).toHaveClass(/filled/)
  await expect(chip).toHaveClass(/single/)
  const fill = await chip.locator('[data-name="CTAElements_content"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(fill).not.toMatch(/0,\s*0,\s*0,\s*0|transparent/)
  const geometry = await page.evaluate(() => {
    const label = document.querySelector('[data-tree="playerSpell"] [data-name="header_titleLabel"]')
    const key = document.querySelector('[data-tree="playerSpell"] [data-name="header_shortcut"]')
    const title = document.querySelector('[data-tree="playerSpell"] [data-name="header_title"]')
    const window = document.querySelector('[data-tree="playerSpell"] [data-binding="PlayerSpell"]')
    if (!label || !key || !title || !window) return null
    const L = label.getBoundingClientRect(), C = key.getBoundingClientRect(), T = title.getBoundingClientRect(), W = window.getBoundingClientRect()
    const parts = Array.from(title.children).map(child => child.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
    const left = Math.min(...parts.map(rect => rect.left)), right = Math.max(...parts.map(rect => rect.right))
    return { gap: C.left - L.right, labelW: L.width, titleW: T.width, offset: ((left + right) / 2) - (W.left + W.width / 2) }
  })
  expect(geometry).toBeTruthy()
  expect(geometry!.gap).toBeGreaterThan(4)
  expect(geometry!.gap).toBeLessThan(16)
  expect(geometry!.labelW).toBeLessThan(geometry!.titleW * 0.5)
  expect(Math.abs(geometry!.offset)).toBeLessThan(16)
})

test('friends window paints UXML KEY:F as the header_shortcut chip', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=friends')
  const chip = page.locator('[data-tree="friends"] [data-name="header_shortcut"]')
  await chip.waitFor({ state: 'visible' })
  await expect(chip.locator('[data-name="CTAElements_label"]')).toHaveText('F')
})

test('character sheet uses the registered 520px window width', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character')
  const window = page.locator('[data-tree="characterSheetUi"] [data-binding="StatSheet"]')
  await window.waitFor({ state: 'visible' })
  expect(parseFloat(await window.evaluate((el) => getComputedStyle(el).width))).toBe(520)
})

test('inventory storage sits beside the equipment doll', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=inventory')
  const doll = page.locator('[data-tree="equipmentStorageUi"] [data-binding="EquipmentComponent"]')
  const storage = page.locator('[data-tree="equipmentStorageUi"] [data-binding="storage"]')
  await doll.waitFor({ state: 'visible' })
  const left = await doll.boundingBox()
  const pane = await storage.boundingBox()
  expect(pane?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 8)
})

test('bank pair stays in the USS flex row without a synthetic outer frame', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=bank')
  const bank = page.locator('[data-tree="storageBank"] [data-binding="BankWindow"]')
  const storage = page.locator('[data-tree="storageBank"] [data-binding="StorageWindow"]')
  await bank.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="storageBank"] [data-name="giny_window_bank"]')).toHaveCount(0)
  expect(parseFloat(await bank.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(450)
  expect(parseFloat(await storage.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(450)
  const left = await bank.boundingBox()
  const right = await storage.boundingBox()
  expect(right?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 8)
  expect((right?.x ?? 0) - ((left?.x ?? 0) + (left?.width ?? 0))).toBeLessThan(24)
  await expect(page.locator('[data-tree="storageBank"] [data-binding="BankWindow"] [data-name="header_titleLabel"]')).toHaveCount(0)
})

test('auction house pair sits side by side with the UXML title', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=market')
  const house = page.locator('[data-tree="auctionHouse"] [data-binding="ctr-window"]')
  const storage = page.locator('[data-tree="auctionHouse"] [data-binding="storageWindow"]')
  await house.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="auctionHouse"] [data-name="giny_window_market"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="auctionHouse"] [data-binding="ctr-window"] [data-name="header_titleLabel"]')).toHaveText('Hotel de vente')
  const help = page.locator('[data-tree="auctionHouse"] [data-binding="ctr-window"] [data-binding="header_buttonHelp"]')
  await expect(help).toBeVisible()
  expect(parseFloat(await help.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThanOrEqual(30)
  await expect(page.locator('[data-tree="auctionHouse"] [data-binding="ctr-window"] [data-binding="header_buttonRight"]')).toBeVisible()
  expect(parseFloat(await house.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(800)
  expect(parseFloat(await storage.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(450)
  const left = await house.boundingBox()
  const right = await storage.boundingBox()
  expect(right?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 8)
  expect((right?.x ?? 0) - ((left?.x ?? 0) + (left?.width ?? 0))).toBeLessThan(24)
})

test('craft screen keeps USS columns without a synthetic outer frame', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=craft')
  const recipes = page.locator('[data-tree="CraftUI"] [data-binding="ctr_recipe"]')
  const storage = page.locator('[data-tree="CraftUI"] [data-binding="CraftStorageWindow"]')
  const crafter = page.locator('[data-tree="CraftUI"] [data-binding="window_crafter"]')
  await recipes.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="CraftUI"] [data-name="giny_window_craft"]')).toHaveCount(0)
  expect(parseFloat(await recipes.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(500)
  expect(parseFloat(await storage.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(450)
  expect(parseFloat(await crafter.evaluate((el) => getComputedStyle(el).width))).toBeGreaterThan(250)
  const left = await recipes.boundingBox()
  const mid = await crafter.boundingBox()
  const right = await storage.boundingBox()
  expect(right?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 8)
  expect(mid?.x ?? 0).toBeGreaterThan((left?.x ?? 0) + (left?.width ?? 0) - 8)
  await expect(storage).toHaveClass(/is-chrome/)
  await expect(crafter).toHaveClass(/is-chrome/)
})

test('cartography fills the canvas instead of a 1100px host frame', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=map')
  const filters = page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_filters"]')
  const quantities = page.locator('[data-tree="CartographyMapUI"] [data-binding="resourceQuantities"]')
  await filters.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-name="giny_window_map"]')).toHaveCount(0)
  await expect(quantities).toHaveCount(0)
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeConquest"]')).toBeHidden()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeAnomaly"]')).toBeHidden()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_worldmap"]')).toHaveClass(/primary/)
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_anomaly"]')).toHaveClass(/secondary/)
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_anomaly"]').click()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeAnomaly"]')).toBeVisible()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_anomaly"]')).toHaveClass(/primary/)
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_worldmap"]')).toHaveClass(/secondary/)
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_conquest"]').click()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeAnomaly"]')).toBeHidden()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeConquest"]')).toBeVisible()
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_worldmap"]').click()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_locTreeConquest"]')).toBeHidden()
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="resourceQuantities"]')).toHaveCount(0)
})

test('WindowFigma title bar is the panel top edge', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=character')
  const window = page.locator('[data-tree="characterSheetUi"] [data-binding="StatSheet"]')
  const bar = page.locator('[data-tree="characterSheetUi"] [data-binding="StatSheet"] > [data-name="header"]')
  await window.waitFor({ state: 'visible' })
  await bar.waitFor({ state: 'visible' })
  const position = await bar.evaluate((el) => getComputedStyle(el).position)
  expect(position).toBe('relative')
  const delta = await page.evaluate(() => {
    const host = document.querySelector('[data-tree="characterSheetUi"] [data-binding="StatSheet"]')
    const header = document.querySelector('[data-tree="characterSheetUi"] [data-binding="StatSheet"] > [data-name="header"]')
    if (!host || !header) return null
    return Math.abs(host.getBoundingClientRect().top - header.getBoundingClientRect().top)
  })
  expect(delta).not.toBeNull()
  expect(delta!).toBeLessThan(2)
  const content = page.locator('[data-tree="characterSheetUi"] [data-binding="window_content"]')
  const gap = await page.evaluate(() => {
    const host = document.querySelector('[data-tree="characterSheetUi"] [data-binding="StatSheet"]')
    const pane = document.querySelector('[data-tree="characterSheetUi"] [data-binding="window_content"]')
    if (!host || !pane) return null
    return pane.getBoundingClientRect().top - host.getBoundingClientRect().top
  })
  expect(gap).toBeGreaterThan(30)
  await expect(content).toBeVisible()
})

test('bannerMenu opens at the registered HUD placement and size', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  await page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first().waitFor({ state: 'visible' })
  const banner = page.locator('[data-tree="bannerMenu"] [data-binding="BannerMenu"]')
  await banner.waitFor({ state: 'visible' })
  const box = await banner.evaluate((el) => {
    const style = getComputedStyle(el)
    return { top: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) }
  })
  expect(box.top).toBe(183)
  expect(box.width).toBe(292)
  expect(box.height).toBe(124)
})

test('empty HUD canvas does not steal world clicks', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  await page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first().waitFor({ state: 'visible' })
  expect(await page.locator('.official-hud').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
  expect(await page.locator('.game-hud').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')
  const slot = page.locator('[data-tree="bannerMenu"] button.official-Slot').first()
  expect(await slot.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('auto')
})

test('map coords use ui.common.level without invented brackets', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const coords = page.locator('[data-tree="mapInfo"] [data-binding="lbl_mapCoordsAndLevel"]')
  await coords.waitFor({ state: 'visible' })
  await expect(coords).toHaveText('2, -4 Niveau 5')
})

test('mini-map header is ui.widgetMinimap, uppercased by USS', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const label = page.locator('[data-tree="CartographyBannerUI"] [data-name="header_label"]')
  await label.waitFor({ state: 'visible' })
  await expect(label).toHaveText(/mini\s+carte/i)
  const painted = await label.evaluate((el) => getComputedStyle(el).textTransform)
  expect(painted).toBe('uppercase')
})

test('mini-map crops the world map around the player and opens the Carte on click', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const view = page.locator('[data-tree="CartographyBannerUI"] [data-binding="mapView"]')
  await view.waitFor({ state: 'visible' })
  // Le parchemin officiel d'Incarnam (worldmap 2), pas le schéma tactique.
  const parchment = view.locator('.giny-worldmap')
  await parchment.waitFor({ state: 'visible' })
  await expect(parchment).toHaveAttribute('aria-label', /Mini[- ]carte/)
  const tile = parchment.locator('.giny-worldmap__tile').first()
  await expect(tile).toHaveAttribute('src', /\/game-data\/worldmaps\/2\/[\d.]+\/\d+\.jpg$/)
  // Les repères `hints.json` d'Incarnam et le marqueur « Votre position ».
  await expect(parchment.locator('.giny-worldmap__pin').first()).toBeVisible()
  await expect(parchment.locator('.giny-worldmap__player')).toHaveCount(1)
  // Le clic ouvre la grande Carte officielle.
  await view.click()
  await page.locator('[data-tree="CartographyMapUI"][data-binding="cartographyUi"], [data-tree="CartographyMapUI"] [data-binding="mapView"]').first().waitFor({ state: 'visible' })
})

test('Carte opens on the player world map with its pins, frame and zoom buttons', async ({ page }) => {
  // Le sélecteur de cartes clone un VisualTreeAsset dont dofus3-ui n'écrit pas
  // de feuille : la lier coûterait un 404 à chaque rendu (UITK_SHEETLESS_TEMPLATES).
  const misses: string[] = []
  page.on('response', (response) => {
    if (response.status() === 404 && response.url().includes('/uitk/trees/')) misses.push(response.url())
  })
  await page.goto('/?ui-preview=hud&open=map')
  const parchment = page.locator('[data-tree="CartographyMapUI"] [data-binding="mapView"] .giny-worldmap')
  await parchment.waitFor({ state: 'visible' })
  await expect(parchment.locator('.giny-worldmap__tile').first()).toHaveAttribute(
    'src', /\/game-data\/worldmaps\/2\/[\d.]+\/\d+\.jpg$/,
  )
  // `currenMapHighlight` + la pastille [x,y] sur la map du joueur (2, -4).
  await expect(parchment.locator('.giny-worldmap__here')).toHaveCount(1)
  await expect(parchment.locator('.giny-worldmap__coords')).toHaveText('[2,-4]')
  await expect(parchment.locator('.giny-worldmap__pin').first()).toBeVisible()

  // At minimum scale the view clamps to world bounds; the player stays in view.
  const playerOffset = () => parchment.evaluate((el) => {
    const frame = el.querySelector('.giny-worldmap__here')!
    const host = el.getBoundingClientRect(), box = frame.getBoundingClientRect()
    return { dx: box.x + box.width / 2 - (host.x + host.width / 2),
      dy: box.y + box.height / 2 - (host.y + host.height / 2),
      contained: box.left >= host.left - 1 && box.right <= host.right + 1 && box.top >= host.top - 1 && box.bottom <= host.bottom + 1 }
  })
  expect((await playerOffset()).contained).toBe(true)

  // Bande de filtres officielle : pictos seuls, `_On` / `_Off` porte l'état.
  await expect(page.locator('[data-tree="CartographyMapUI"] [data-binding="chbx_filterDungeon"]')).toBeHidden()
  const dungeons = page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_filterDungeon"]')
  const picto = page.locator('[data-tree="CartographyMapUI"] [data-binding="tx_filterDungeon"]')
  const background = () => picto.evaluate((el) => getComputedStyle(el).backgroundImage)
  await expect.poll(background).toContain('filterDungeon_On')
  await dungeons.click()
  await expect.poll(background).toContain('filterDungeon_Off')
  await dungeons.click()
  await expect.poll(background).toContain('filterDungeon_On')

  // `#ctr_worldmapList` est replié au repos ; `btn_worldmap` le déplie et
  // clone une ligne par carte du monde listée.
  const picker = page.locator('[data-tree="CartographyMapUI"] [data-binding="ctr_worldmapList"]')
  await expect(picker).toBeHidden()
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_worldmap"]').click()
  await expect(picker).toBeVisible()
  expect(await picker.locator('[data-binding="lbl_worldmapCatName"]').count()).toBeGreaterThan(20)
  expect(misses).toEqual([])

  // Zoom : le niveau de tuiles suit l'échelle demandée.
  const level = () => parchment.locator('.giny-worldmap__tile').first().getAttribute('src')
  const before = await level()
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_zoomIn"]').click()
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_zoomIn"]').click()
  await expect.poll(level).not.toBe(before)
  await page.locator('[data-tree="CartographyMapUI"] [data-binding="btn_player"]').click()
  await expect.poll(async () => Math.abs((await playerOffset()).dx)).toBeLessThan(2)
  await expect.poll(async () => Math.abs((await playerOffset()).dy)).toBeLessThan(2)
})

test('MapInfo rest keeps USS-visible highlight and info buttons', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  await expect(page.locator('[data-tree="mapInfo"] [data-binding="btn_highlight"]')).toBeVisible()
  await expect(page.locator('[data-tree="mapInfo"] [data-binding="btn_info"]')).toBeVisible()
  await expect(page.locator('[data-tree="mapInfo"] [data-binding="btn_showFightMap"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="mapInfo"] [data-binding="btn_havenBagSettings"]')).toHaveCount(0)
})

test('gameMenu strip pins top-right from USS flex-end', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  const strip = page.locator('[data-tree="gameMenu"] [data-binding="ctr_bg"]')
  await strip.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="btn_bug"]')).toBeVisible()
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="btn_abo"]')).toBeHidden()
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="btn_options"]')).toBeVisible()
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="btn_menu"]')).toBeVisible()
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="fps"]')).toBeHidden()
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="time"]')).toBeHidden()
  const rootLeft = await page.locator('[data-tree="gameMenu"].official-tree-host > [data-binding="gameMenu"]').evaluate((el) => parseFloat(getComputedStyle(el).left))
  expect(rootLeft).toBe(0)
  const box = await page.evaluate(() => {
    const el = document.querySelector('[data-tree="gameMenu"] [data-binding="ctr_bg"]')
    const canvas = document.querySelector('.official-hud .official-canvas')
    if (!(el instanceof HTMLElement) || !(canvas instanceof HTMLElement)) return null
    const a = el.getBoundingClientRect()
    const c = canvas.getBoundingClientRect()
    const scale = canvas.offsetWidth / c.width
    return {
      x: (a.left - c.left) * scale,
      y: (a.top - c.top) * scale,
      w: a.width * scale,
      h: a.height * scale,
    }
  })
  expect(box).not.toBeNull()
  expect(box!.y).toBeLessThan(8)
  expect(box!.x + box!.w).toBeGreaterThan(1910)
  expect(box!.w).toBeGreaterThan(100)
})

test('gameMenu stays above the cartography screen', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=map')
  await page.locator('[data-binding="ctr_filters"]').waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="gameMenu"] [data-binding="ctr_bg"]')).toBeVisible()
})

test('mount banner does not nest mountPaddock inside RideParentUi', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=mount')
  const window = page.locator('[data-tree="rideParentUI"] [data-binding="RideParentUi"]')
  await window.waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="rideParentUI"] [data-uitk-template="mountPaddock"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="rideParentUI"] [data-binding="lbl_noParents"]')).toBeAttached()
})

test('quest journal shows the active objective, rewards and working level filters', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=quests')
  const journal = page.locator('[data-tree="quests"]')
  await expect(journal.locator('[data-binding="lbl_questDescription"]')).toHaveText(/La conseillère Archie devrait vous fournir quelques informations sur Astrub/)
  await expect(journal.locator('[data-binding="lbl_objectives"]')).toHaveCount(0)
  const objectives = journal.locator('[data-binding="gd_objectives"] [data-binding="lbl_objective"]')
  await expect(objectives).toHaveText(['Aller voir Envoyée des Douze'])
  await expect(journal.locator('[data-binding="gd_objectives"] [data-binding="tb_pin"]')).toBeVisible()
  await expect(journal.locator('[data-binding="gd_objectives"] [data-binding="tx_achieve"]')).toBeHidden()
  await expect(journal.locator('[data-binding="lbl_kamas"]')).toHaveText('151')
  await expect(journal.locator('[data-binding="lbl_xp"]')).toHaveText(/6\s*225/)
  const category = journal.locator('[data-binding="sectionHeaderContent"]').filter({ hasText: 'Astrub (1)' })
  const quest = journal.locator('[data-binding="sectionHeaderContent"]').filter({ hasText: "Les principes d'Archie m'aident" })
  await expect(category).toHaveCount(1)
  await expect(quest.locator('[data-binding="lbl_questLevel"]')).toHaveText('Niv.15')
  await category.click()
  await expect(quest).toHaveCount(0)
  await category.click()
  await expect(quest).toHaveCount(1)
  const minimum = journal.locator('[data-binding="Min"] input')
  const maximum = journal.locator('[data-binding="Max"] input')
  await expect(minimum).toHaveValue('1')
  await expect(maximum).toHaveValue('200')
  await maximum.fill('14')
  await expect(journal.locator('[data-binding="lbl_emptyList"]')).toBeVisible()
  await expect(quest).toHaveCount(0)
  await maximum.fill('15')
  await expect(quest).toHaveCount(1)
  await expect(objectives).toHaveText(['Aller voir Envoyée des Douze'])
})

test('achievements show progress cards and filter them by name', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=achievements')
  const window = page.locator('[data-tree="achievements"]')
  const cards = window.locator('[data-binding="ctr_endingAchievementContent"] [data-binding="lbl_cardName"]')
  await cards.first().waitFor({ state: 'visible' })
  await expect(window.locator('[data-binding="ctr_base"]')).toBeVisible()
  await expect(window.locator('[data-binding="ctr_summaryContent"]')).toBeHidden()
  await expect(window.locator('[data-binding="ctr_achievements"]')).toHaveCount(0)
  await expect(window.locator('[data-binding="gd_categories"] [data-binding="filter_title"]').first()).toHaveText('PROGRESSION GÉNÉRALE')
  const query = window.locator('[data-binding="inp_search"] input')
  await query.fill('Apéwicubes')
  await expect(cards).toHaveText([/Apéwicubes/])
  await expect(window.locator('[data-binding="lbl_cardDescription"]')).toHaveText('Ouvrir 5 Apéwicubes.')
  await expect(window.locator('[data-binding="gd_cardObjectives"] [data-binding="lbl_achievement"]').filter({ hasText: 'Niveau 110' })).toBeVisible()
  await query.fill('aucun-succes-correspondant-987654')
  await expect(cards).toHaveCount(0)
  await query.fill('')
  await cards.first().waitFor({ state: 'visible' })
})

test('friends empty overlay does not sit on the column headers', async ({ page }) => {
  await page.goto('/?ui-preview=hud&open=friends')
  await page.locator('[data-tree="friends"] [data-binding="tab_label"]').first().waitFor({ state: 'visible' })
  await expect(page.locator('[data-tree="friends"] [data-binding="tab_label"]').nth(0)).toHaveText('Amis Ankama')
  await expect(page.locator('[data-tree="friends"] [data-binding="tab_label"]').nth(1)).toHaveText('Contacts en jeu')
  await expect(page.locator('[data-tree="friends"] [data-binding="tab_label"]').nth(2)).toHaveText('Contacts en jeu bloqués')
  const tabs = page.locator('[data-tree="friends"] [data-binding="tabs_group"] .official-DofusTab')
  await expect(tabs.nth(1)).toHaveClass(/(?:^|\s)activeTrue(?:\s|$)/)
  await expect(tabs.nth(0)).toHaveClass(/(?:^|\s)activeFalse(?:\s|$)/)
  await expect(page.locator('[data-tree="friends"] [data-binding="SectionHeader_inGameContact"] [data-binding="sectionHeader_titleLabel"]')).toHaveText('Contacts en jeu')
  await expect(page.locator('[data-tree="friends"] [data-binding="SectionHeader_inGameContact"] [data-binding="sectionHeader_titleLabel"]')).not.toHaveText(/Invitations/)
  await expect(page.locator('[data-tree="friends"] [data-binding="lbl_noMutualFriends"]')).toHaveText('Aucun contact en jeu réciproque')
  await expect(page.locator('[data-tree="friends"] [data-binding="btn_addInGameFriend"]')).toHaveClass(/(?:^|\s)primary(?:\s|$)/)
  await expect(page.locator('[data-tree="friends"] [data-binding="ctr_headerMutualFriends"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="friends"] [data-binding="lbl_mutualInGameFriends"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="friends"] [data-binding="lbl_InGameFriends"]')).toHaveCount(0)
  await expect(page.locator('[data-tree="friends"] [data-binding="lbl_noMutualFriends"]')).toHaveCount(1)
})

test('dumps named layout boxes in 1920×1080 canvas pixels', async ({ page }) => {
  await page.goto('/?ui-preview=hud')
  await page.locator('[data-binding="gd_btnUis"] [data-binding="itemTile_container"]').first().waitFor({ state: 'visible' })
  const payload = await page.evaluate(() => window.__dumpClientBoxes?.({ download: false }))
  expect(payload?.canvas).toEqual({ width: 1920, height: 1080 })
  expect(payload?.named).toBeGreaterThan(100)
  expect(payload?.depth).toBeGreaterThan(8)
  expect(payload?.boxes.some((box: { binding?: string | null }) => box.binding === 'itemTile_container')).toBe(true)
  expect(payload?.boxes.some((box: { binding?: string | null }) => box.binding === 'gd_btnUis')).toBe(true)
})

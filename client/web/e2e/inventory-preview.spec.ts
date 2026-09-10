import { installCssCoverage } from './fixtures/cssCoverage'
installCssCoverage()
import { expect, test } from '@playwright/test'

test.describe('inventory workshop', () => {
  test('opens the isolated inventory with equipment and bag tiles', async ({ page }) => {
    await page.goto('/?ui-preview=inventory')
    await expect(page.locator('[data-binding="PlayerInventory"]')).toBeVisible()
    await expect(page.locator('[data-binding="header_titleLabel"]')).toHaveText('Inventaire')
    await expect(page.locator('[data-uitk-template="EquipmentComponent"][data-binding="slot_6"]')).toBeVisible()
    const grid = page.locator('[data-binding="grid"]')
    await expect(grid).toBeVisible()
    await expect(page.locator('[data-binding="lbl_kamas"]')).toContainText('12')
    await page.getByRole('textbox', { name: 'Recherche' }).fill('pomme')
    await expect(grid.locator('button[data-sprite="/game-data/pictos/items/42001.png"]')).toHaveCount(1)
    await expect(grid.locator('button.acquiredTrue:not(.is-empty)')).toHaveCount(1)
  })

  test('double-click equips a bag item and returns it to the bag on unequip', async ({ page }) => {
    await page.goto('/?ui-preview=inventory')
    await expect(page.locator('[data-binding="PlayerInventory"]')).toBeVisible()
    await page.getByRole('textbox', { name: 'Recherche' }).fill('Koliet')
    const bagItem = page.locator('[data-binding="grid"] button.acquiredTrue:not(.is-empty)')
    await expect(bagItem).toHaveCount(1)
    const sprite = await bagItem.getAttribute('data-sprite')
    expect(sprite).toBeTruthy()
    await bagItem.dblclick()
    await expect(page.locator('[data-binding="grid"] button.acquiredTrue:not(.is-empty)')).toHaveCount(0)
    const matchingEquipment = page.locator(`[data-uitk-template="EquipmentComponent"][data-type="Slot"][data-sprite=${JSON.stringify(sprite)}]`)
    await expect(matchingEquipment).toHaveCount(1)
    await expect(matchingEquipment).toBeVisible()
    await matchingEquipment.dblclick()
    await expect(bagItem).toHaveCount(1)
    await expect(bagItem).toHaveAttribute('data-sprite', sprite!)
    await expect(matchingEquipment).toHaveCount(0)
  })
})

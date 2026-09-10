import { test } from '@playwright/test'
import fs from 'node:fs/promises'

/** Opt-in observation of real CSS usage; uncovered rules are not proven dead. */
export function installCssCoverage(): void {
  if (!process.env.E2E_CSS_COVERAGE) return
  test.beforeEach(async ({ page }) => {
    await page.coverage.startCSSCoverage({ resetOnNavigation: false })
  })
  test.afterEach(async ({ page }, info) => {
    let styles: Awaited<ReturnType<typeof page.coverage.stopCSSCoverage>>
    try {
      styles = await page.coverage.stopCSSCoverage()
    } catch (error) {
      // Preserve the missing observation explicitly; never count it as empty CSS.
      await fs.writeFile(info.outputPath('css-coverage-error.json'), JSON.stringify({
        title: info.titlePath, status: info.status, url: page.url(),
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
    await fs.writeFile(info.outputPath('css-coverage.json'), JSON.stringify({
      title: info.titlePath, status: info.status, url: page.url(), styles,
      semantics: 'Used rule ranges in UTF-16 code units; uncovered rules may belong to unvisited states.',
    }))
  })
}

import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 4177)
const host = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: host,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
  webServer: process.env.E2E_ELECTRON_ONLY ? undefined : {
    command: `PORT=${port} npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${host}/?ui-preview=hud`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

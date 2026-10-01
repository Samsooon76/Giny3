import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Protocol tests do not need UI assets, native renderers, or the session log.
 * The log mock is test-only; it never enters the production Vite configuration.
 */
export default defineConfig({
  resolve: {
    alias: [{
      find: /^.*\/debug\/sessionLogger$/,
      replacement: fileURLToPath(new URL('./test-support/sessionLogger.mock.ts', import.meta.url)),
    }],
  },
  test: {
    include: ['src/giny/**/*.test.ts'],
    clearMocks: true,
    maxWorkers: 2,
  },
})

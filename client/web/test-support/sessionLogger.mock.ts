import { vi } from 'vitest'

// Network behavior is real in the I/O suite; only logging is replaced.
export const logEvent = vi.fn()
export const logError = vi.fn()

type EnsureMapResult = { ok: boolean; path?: string; error?: string }

export function createMapEnsurer(options: {
  allowExtraction?: boolean
  roots: string[]
  extractorRoot: string
  outputRoot: string
  clientRoot: string
}): (value: string | number) => Promise<EnsureMapResult>

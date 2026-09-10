import { gameDataUrl } from '../../data/assetUrl'
import { spell } from '../../ui/game/catalog'

export type SpellScriptData = {
  type: number
  rawParams: string
}

let spellScriptsById: Record<string, SpellScriptData> = {}
let loading: Promise<void> | undefined
export function loadSpellScripts(): Promise<void> {
  return loading ??= fetch(gameDataUrl('data/spellscripts.json'), { signal: AbortSignal.timeout(4000) })
    .then(async r => { if (r.ok) hydrateSpellScripts(await r.json()) })
    .catch(() => { loading = undefined })
}

export function hydrateSpellScripts(data: Record<string, SpellScriptData>): void {
  spellScriptsById = data
}

export function resetSpellScripts(): void {
  spellScriptsById = {}
}

export function getSpellScript(scriptId: number): SpellScriptData | undefined {
  return spellScriptsById[String(scriptId)]
}

export function parseScriptAnimId(rawParams: string): number | undefined {
  if (!rawParams) return undefined
  const match = rawParams.match(/animId:(\d+)/)
  return match ? parseInt(match[1], 10) : undefined
}

export function resolveAttackAnimKinds(
  action: { type?: string; spell_id?: number; script_id?: number; critical?: boolean },
  breedId = 1
): string[] {
  if (action.type === 'weapon') {
    return [`AnimAttaque${100 * breedId}`, 'AnimCoup', 'AnimAttaque0', 'AnimHit']
  }

  const definition = spell(action.spell_id ?? -1)
  const bound = action.critical ? definition?.criticalHitBoundScriptUsageData : definition?.boundScriptUsageData
  const scriptIds = [action.script_id, action.critical ? definition?.scriptIdCritical : definition?.scriptId, ...(bound?.map(b => b.scriptId) ?? [])]
  const explicit: string[] = []
  let animId = 1
  for (const id of scriptIds) {
    const script = id ? getSpellScript(id) : undefined
    if (script?.rawParams) {
      // Dofus 3 type-9 scripts store the exact actor clip in a JSON sequence.
      for (const match of script.rawParams.matchAll(/"casterAnimation"\s*:\s*"(Anim[A-Za-z0-9_]+)"/g)) explicit.push(match[1])
      const parsed = parseScriptAnimId(script.rawParams)
      if (parsed !== undefined) {
        animId = parsed
      }
    }
  }

  const kinds: string[] = [...new Set(explicit)]
  if (breedId > 0) {
    kinds.push(`AnimAttaque${100 * breedId + animId}`)
  }
  kinds.push(`AnimAttaque${animId}`)
  kinds.push('AnimAttaque')
  kinds.push('AnimHit')
  return kinds
}

import { useEffect, useMemo, useState } from 'react'
import type { CharacterHud, HudItem } from '../../giny/types'
import { allRecipes, item, itemIcon, job, type CatalogRecipe } from './catalog'
import './inventoryRecipes.css'

export function recipeAvailability(recipe: CatalogRecipe, items: HudItem[]) {
  const owned = new Map<number, number>()
  for (const entry of items) if (!entry.equipped) owned.set(entry.gid, (owned.get(entry.gid) ?? 0) + entry.quantity)
  // Aggregate duplicate ingredients before comparing quantities.
  const required = new Map<number, number>()
  recipe.ingredientIds?.forEach((gid, index) => required.set(gid, (required.get(gid) ?? 0) + (recipe.quantities?.[index] ?? 1)))
  let crafts = Infinity
  let missing = 0
  for (const [gid, quantity] of required) {
    if (quantity <= 0) continue
    const count = owned.get(gid) ?? 0
    if (count < quantity) missing++
    crafts = Math.min(crafts, Math.floor(count / quantity))
  }
  return { missing, crafts: Number.isFinite(crafts) ? crafts : 0, owned }
}

export function InventoryRecipes({ hud, catalogTick }: { hud: CharacterHud | null; catalogTick: number }) {
  const [query, setQuery] = useState('')
  const [minimum, setMinimum] = useState('1'), [maximum, setMaximum] = useState('200')
  const [category, setCategory] = useState(''), [profession, setProfession] = useState('')
  const [sort, setSort] = useState('desc'), [missing, setMissing] = useState('0')
  const [conditioned, setConditioned] = useState(true), [possible, setPossible] = useState(false)
  const [limit, setLimit] = useState(80)
  const [typeNames, setTypeNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    void Promise.all([
      fetch('/game-data/data/itemtypes.json').then(r => r.json()) as Promise<Record<string, { id: number; nameId?: number; name?: string }>>,
      fetch('/game-data/client/i18n.json').then(r => r.json()) as Promise<{ by_id: Record<string, string> }>,
    ]).then(([types, language]) => {
      if (active) setTypeNames(Object.fromEntries(Object.values(types).map(type => [type.id, type.name ?? language.by_id[String(type.nameId)] ?? `Type ${type.id}`])))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  const recipes = useMemo(() => allRecipes(), [catalogTick])
  const categories = [...new Set(recipes.map(r => item(r.resultId)?.typeId).filter(id => id != null))]
  const professions = [...new Set(recipes.map(r => r.jobId).filter(id => id != null))]
  const rows = useMemo(() => recipes.map(recipe => ({ recipe, ...recipeAvailability(recipe, hud?.items ?? []) })).filter(row => {
    const { recipe } = row
    const result = item(recipe.resultId)
    const level = recipe.resultLevel ?? 1
    return (recipe.name ?? result?.name ?? '').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))
      && level >= Number(minimum || 1) && level <= Number(maximum || 200)
      && (!category || String(result?.typeId) === category) && (!profession || String(recipe.jobId) === profession)
      && (conditioned || !result?.criteria) && (!possible || row.crafts > 0)
      && (missing === 'all' || row.missing <= Number(missing))
  }).sort((a, b) => sort === 'name' ? (a.recipe.name ?? '').localeCompare(b.recipe.name ?? '', 'fr')
    : ((a.recipe.resultLevel ?? 1) - (b.recipe.resultLevel ?? 1)) * (sort === 'asc' ? 1 : -1) || a.recipe.resultId - b.recipe.resultId),
  [recipes, hud?.items, query, minimum, maximum, category, profession, conditioned, possible, missing, sort])
  useEffect(() => setLimit(80), [query, minimum, maximum, category, profession, conditioned, possible, missing, sort])
  return <div className="inventory-recipes">
    <div className="inventory-recipes__filters">
      <input aria-label="Rechercher une recette" placeholder="⌕ Rechercher…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="inventory-recipes__levels">Niveau <input aria-label="Niveau minimum" type="number" min="1" max="200" value={minimum} onChange={e => setMinimum(e.target.value)} /> à <input aria-label="Niveau maximum" type="number" min="1" max="200" value={maximum} onChange={e => setMaximum(e.target.value)} /></div>
      <select aria-label="Catégorie" value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes catégories</option>{categories.sort((a,b)=>(typeNames[a]??'').localeCompare(typeNames[b]??'','fr')).map(id => <option key={id} value={id}>{typeNames[id] ?? `Type ${id}`}</option>)}</select>
      <select aria-label="Trier les recettes" value={sort} onChange={e => setSort(e.target.value)}><option value="desc">Niveau le plus élevé</option><option value="asc">Niveau le plus faible</option><option value="name">Nom</option></select>
      <select aria-label="Ingrédients manquants" value={missing} onChange={e => setMissing(e.target.value)}><option value="0">Aucun ingrédient manquant</option><option value="1">Au plus 1 ingrédient manquant</option><option value="2">Au plus 2 ingrédients manquants</option><option value="all">Tous les ingrédients manquants</option></select>
      <select aria-label="Métier" value={profession} onChange={e => setProfession(e.target.value)}><option value="">Tous les métiers</option>{professions.map(id => <option key={id} value={id}>{job(id)?.name ?? `Métier ${id}`}</option>)}</select>
    </div>
    <div className="inventory-recipes__list" onScroll={e => { const node = e.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 200) setLimit(n => n + 80) }}>
      {!rows.length && <p className="inventory-recipes__empty">Aucune recette ne correspond aux filtres.</p>}
      {rows.slice(0, limit).map(({ recipe, crafts, owned }) => <article className="inventory-recipes__recipe" key={recipe.resultId}>
        <div className="inventory-recipes__result"><img src={itemIcon({ gid: recipe.resultId })} alt={recipe.name ?? item(recipe.resultId)?.name ?? ''} /><span>×{crafts}</span></div>
        <div className="inventory-recipes__details"><div className="inventory-recipes__name"><strong>{recipe.name ?? item(recipe.resultId)?.name}</strong><span>Niv. {recipe.resultLevel ?? 1}</span></div>
          <div className="inventory-recipes__ingredients">{recipe.ingredientIds?.map((gid, index) => <div key={`${gid}-${index}`} className={`inventory-recipes__ingredient${(owned.get(gid) ?? 0) < (recipe.quantities?.[index] ?? 1) ? ' is-missing' : ''}`} title={`${item(gid)?.name ?? 'Ingrédient'} : ${owned.get(gid) ?? 0} / ${recipe.quantities?.[index] ?? 1}`}>
            <img src={itemIcon({ gid })} alt={item(gid)?.name ?? 'Ingrédient'} /><span>{recipe.quantities?.[index] ?? 1}</span>
          </div>)}</div>
        </div>
      </article>)}
    </div>
    <footer className="inventory-recipes__footer">
      <label><input type="checkbox" checked={conditioned} onChange={e => setConditioned(e.target.checked)} />Afficher les recettes conditionnées</label>
      <label><input type="checkbox" checked={possible} onChange={e => setPossible(e.target.checked)} />Afficher uniquement les recettes possibles</label>
      <span>{rows.length} Recette{rows.length !== 1 ? 's' : ''}</span>
    </footer>
  </div>
}

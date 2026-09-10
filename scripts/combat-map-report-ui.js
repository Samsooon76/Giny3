// Group-level filters: classification and arena confidence are separate signals.
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const controls = document.createElement('div');
controls.innerHTML = `<label>Recherche <input id="query" placeholder="Zone, donjon ou ID exact…"></label>
<label>Classement <select id="category"><option value="">DJ + Zone + Autre</option><option value="dungeon">DJ</option><option value="zone">Zone</option><option value="other">Autre</option></select></label>
<label>Famille <select id="size"><option value="0">Toutes les tailles</option><option value="5">5 cartes ou plus</option><option value="4">4 cartes ou plus</option><option value="2">Suites (2 ou plus)</option><option value="1">IDs isolés</option></select></label>
<label>État <select id="view"><option value="all">Toutes les candidates</option><option value="retained">Cartes retenues</option><option value="review">À vérifier (carte ou classement)</option><option value="id_filtered">Écartées par filtre ID</option></select></label>
<label>Trier <select id="sort"><option value="priority">Groupes de 5+ en premier</option><option value="name">Nom</option><option value="count">Nombre de cartes visibles</option></select></label>
<button id="reset" type="button">Réinitialiser</button>`;
document.querySelector('#query').before(controls);
// Remove the former controls after inserting the replacement controls.
for (const id of ['query','category','coverage','view']) {
  const old = [...document.querySelectorAll('#'+id)].find(el => !controls.contains(el));
  if (old) old.remove();
}
const keys = ['query','category','size','view','sort'];
const defaults = {query:'',category:'',size:'0',view:'all',sort:'priority'};
const params = new URLSearchParams(location.search);
for (const key of keys) {
  const el = document.getElementById(key);
  const value = params.get(key) ?? defaults[key];
  if (el.tagName === 'INPUT' || [...el.options].some(o => o.value === value)) el.value = value;
}
function selectGroups(z, filters) {
  const q = normalize(filters.query).trim();
  const numeric = /^\d+$/.test(q);
  const matchesZone = numeric ? String(z.subarea_id) === q : normalize(z.name+' '+(z.dungeon_name || '')).includes(q);
  return z.id_groups.flatMap(g => {
    if (filters.category && g.bucket !== filters.category) return [];
    const size = Number(filters.size);
    if (size === 1 ? g.size !== 1 : g.size < size) return [];
    // Searching an ID keeps its family visible for comparison.
    if (q && !matchesZone && !(numeric ? g.map_ids.some(id => String(id) === q) : normalize(g.bucket_dungeon_name).includes(q))) return [];
    const uncertain = ['review','heuristic'].includes(g.bucket_confidence);
    const ids = g.map_ids.filter(id => filters.view === 'retained' ? z.retained_map_ids.includes(id)
      : filters.view === 'id_filtered' ? z.id_filtered_map_ids.includes(id)
      : filters.view === 'review' ? uncertain || z.review_map_ids.includes(id) || z.id_filtered_map_ids.includes(id)
      : true);
    return ids.length ? [{...g, visibleIds:ids}] : [];
  });
}
function renderFiltered() {
  const filters = Object.fromEntries(keys.map(k => [k,document.getElementById(k).value]));
  const result = zones.map(z => ({z,groups:selectGroups(z,filters)})).filter(r => r.groups.length);
  const count = r => r.groups.reduce((n,g) => n+g.visibleIds.length,0);
  const priority = r => Math.max(...r.groups.map(g => g.size));
  result.sort((a,b) => (filters.sort === 'name' ? 0 : filters.sort === 'count' ? count(b)-count(a) : Number(priority(b)>=5)-Number(priority(a)>=5) || priority(b)-priority(a)) || a.z.name.localeCompare(b.z.name,'fr'));
  document.querySelector('#count').textContent = `${result.length} sous-zones · ${result.reduce((n,r)=>n+r.groups.length,0)} groupes · ${result.reduce((n,r)=>n+count(r),0)} cartes affichées`;
  const tbody = document.querySelector('#rows');
  tbody.replaceChildren();
  for (const {z,groups} of result) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = z.name+' · '+z.subarea_id;
    const status = document.createElement('td');
    status.textContent = groups.length+' groupes · '+groups.reduce((n,g)=>n+g.visibleIds.length,0)+' / '+z.candidate_count+' cartes affichées';
    const shown = new Set(groups.flatMap(g=>g.visibleIds));
    const visibleZone = {...z,id_groups:groups};
    tr.append(name,status,...['dungeon','zone','other'].map(b=>groupCell(visibleZone,b,shown)));
    tbody.append(tr);
  }
  if (!result.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan=5; td.textContent='Aucun groupe ne correspond. Élargis la taille ou l’état, ou réinitialise les filtres.';
    tr.append(td); tbody.append(tr);
  }
  const url = new URL(location.href);
  for (const key of keys) filters[key] === defaults[key] ? url.searchParams.delete(key) : url.searchParams.set(key,filters[key]);
  history.replaceState(null,'',url);
}
for (const key of keys) document.getElementById(key).addEventListener('input',renderFiltered);
document.querySelector('#reset').addEventListener('click',()=>{for(const key of keys)document.getElementById(key).value=defaults[key];renderFiltered();});
renderFiltered();

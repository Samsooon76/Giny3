# Client Web Giny

Client Vite + React + PixiJS connecté aux serveurs Auth et World Giny locaux. Il couvre la connexion, le choix du serveur, la création/sélection du personnage, l'entrée sur la carte vivante et les déplacements confirmés par Giny.

Les cartes et acteurs, y compris les portraits de création et de dialogue,
utilisent le moteur et les ressources Bubble sous `/bubble/data/`.
Les catalogues compatibles Giny, pictogrammes, cartes du monde et l'interface
sont conservés dans `runtime-assets/`, servi sous `/game-data/`, `/ui-data/`
et `/uitk/`. Le catalogue SQL publié reste prioritaire lorsqu'il est configuré.
Aucun chemin d'exécution ne dépend de `../dofus3/output` ou de `.cache`.

Voir [la migration et le nettoyage](docs/BUBBLE-MIGRATION.md). Les sections
historiques d'extraction ci-dessous décrivent l'ancien pipeline ; ses commandes
npm portent désormais le préfixe `legacy:`.

## Run

```bash
cd client/web
npm install
npm run dev
```

Lancer d'abord Giny (`../scripts/start.sh --background`), puis ouvrir l'URL Vite. La même commande de développement sert les caches officiels et démarre la passerelle WebSocket → TCP sur `/giny`.

## Controls

- Mouse wheel: zoom toward cursor
- Middle or right drag: pan
- Left click: walk to a cell (path confirmed by Giny)
- Shift+click: set path start
- `C`: reset camera

## Screenshots

Captured during this POC:

```text
client/web/output/playwright/pixi-clean.png
client/web/output/playwright/pixi-path.png
```

## Cartographie

La grande Carte (`CartographyMapUI`) et la MINI-CARTE (`CartographyBannerUI`)
peignent la **même** image : la carte du monde officielle. IL2CPP ne met qu'un
`CartographyService` derrière les deux, avec un `CartographyMapView` et un
`CartographyBannerView` côte à côte, et la capture `output/ui_shots/official/hud.png`
le confirme — le widget montre le parchemin recadré autour du personnage, pas la
grille tactique de la carte où l'on se trouve.

Le parchemin est une pyramide de tuiles de 1024², produite par :

```bash
cd ../dofus3 && python3 -m extractor worldmaps
```

`worldmap_assets_.bundle` ne nomme ses 1 216 sprites que par leur **index** de
tuile ; c'est le catalogue Addressables binaire posé à côté qui les adresse en
`worldmaps/<id>/<zoom>/<index>.jpg` (lecteur : `extractor/addressables.py`). La
sortie garde ce chemin sous `/game-data/worldmaps/`, plus les 158 pictos de
`hints.json` et le cadre `currenMapHighlight`.

Trois repères, tous mesurés sur les captures officielles par corrélation avec le
parchemin reconstruit :

- `origine + (x, y) × mapSize` est le **coin** d'une carte, pas son centre — le
  cadre officiel d'Incarnam `[6,1]` y tombe à 3 px près et couvre exactement une
  cellule ;
- un repère `hints.json` se pose au **milieu** de sa cellule ;
- la MINI-CARTE est centrée sur le milieu de la cellule du joueur et cadre cinq
  cartes en largeur (660 px pour un `mapWidth` de 380 dans la capture).

## Configuration locale

- `GINY_AUTH_HOST` et `GINY_AUTH_PORT` configurent Auth (défaut `127.0.0.1:8443`).
- `GINY_WORLD_PORT` autorise l'unique port World (défaut `5555`).
- `GINY_DOFUS_CLIENT` configure l'installation officielle utilisée pour extraire une carte ou un look absent du cache (défaut `/Applications/Ankama/Dofus-dofus3`).

## Tout vient du disque

Aucune ressource de jeu n'est téléchargée : cartes, gfx, looks d'entités, props,
polices et UI officielle sortent tous de l'installation Dofus locale
(`GINY_DOFUS_CLIENT`), extraits par `client/dofus3/extractor` (Python + UnityPy,
sans réseau) et servis en local sous `/game-data/`, `/ui-data/` et `/uitk/`. Une
carte ou un look absent du cache est extrait à la demande via `/ensure-data`,
jamais récupéré en ligne.

Deux garde-fous tiennent cette promesse :

- `electron/localOnly.mjs` + `enforceLocalOnly()` annulent toute requête du
  renderer qui quitterait la machine, et les réponses `app://` portent une CSP
  qui n'autorise que `app:`, `blob:` et `data:`. Le loopback n'est toléré que
  sous `GINY_VITE_URL`, où le dev server *est* l'application.
- `e2e/local-assets.spec.ts` charge une carte, un personnage et le HUD en
  surveillant le journal complet des requêtes : une seule URL distante fait
  échouer les tests. `e2e/electron-shell.spec.ts` lance la vraie coquille et
  vérifie la CSP livrée, les lectures `app://` et le blocage d'un hôte distant
  (page et worker Pixi).

```bash
npm run build   # electron-shell.spec.ts sert dist/ via app://
npx vitest run electron/localOnly.test.mjs
npx playwright test e2e/local-assets.spec.ts e2e/electron-shell.spec.ts
```

⚠️ La CSP doit garder `'unsafe-eval'` : Pixi construit son code de shaders avec
le constructeur `Function` (il en garde un alias, donc chercher `new Function(`
dans le bundle ne trouve rien) et le monde meurt au montage sur « Current
environment does not allow unsafe-eval » — alors que l'écran de login, lui,
s'affiche parfaitement. Ce token n'ouvre aucun accès réseau ; ce qui garde les
données sur la machine, c'est la liste de schémas et `enforceLocalOnly()`.
Attention aussi en vérifiant : `page.evaluate()` et `addScriptTag()` passent par
le debugger, que la CSP n'applique pas — seul un vrai script de page révèle un
blocage d'eval.

## Application Electron

Le client tourne aussi en application de bureau autonome, sans le serveur Vite :

```bash
npm run app        # build + lance l'app Electron sur dist/
GINY_VITE_URL=http://localhost:5173/ npx electron .   # attache au serveur dev
```

L'application (`electron/main.mjs`) rejoue ce que le serveur Vite fait en dev :
elle sert `/game-data/`, `/ui-data/` et `/uitk/` depuis les caches disque via le
schéma `app://`, lance l'extracteur Python à la demande (mêmes variables
`GINY_DOFUS_CLIENT`, `GINY_AUTH_HOST`…), et ponte la connexion Giny en TCP direct
depuis le process main (plus de WebSocket `/giny`). Le renderer reste identique :
`ensureData()` et le transport Giny basculent tout seuls entre IPC natif et HTTP/WebSocket
selon la présence de `window.ginyNative`.

# Toutes les maps en local — 5 septembre 2026

Le dossier publié représente **6 003 905 452 octets de fichiers (environ 6.00 Go décimaux)**. Il contient 17 353 maps et 670 entrées de personnages/objets préparés. **14 036 maps** ne présentent aucune référence manquante détectée pour les éléments pris en charge ; **3 317** ont au moins une référence de sprite ou d’objet indisponible.

Le client lit désormais en priorité `client/web/game-data`. Le dossier contient un index complet des maps, des documents compressés, les textures communes et les données des objets. La lecture d’une map préparée ne passe pas par Python et ne dépend pas de l’installation Dofus. Seules les ressources actives et quelques voisines entrent dans les caches mémoire.

## Source et périmètre

Source : installation locale Dofus **3.6.10.11**, `/Applications/Ankama/Dofus-dofus3`. Inventaire de 577 bundles de données, dont 569 contenant des maps : **17 353 maps**. Les fichiers de cette installation n’ont pas été modifiés.

- Les 17 353 cartes ont été converties au format v3, avec 560 cellules chacune. Les documents bruts compressés occupent environ 392 Mio.
- 64 273 sprites ont été extraits du catalogue local. 51 647 disposent d’une variante BC7/Zstd ; les petits sprites et ceux dépassant le format accepté conservent le PNG. Le PNG sans perte reste disponible pour tous les autres aussi.
- Les textures partagées ne sont extraites qu’une fois. Les nouvelles maps utilisent leurs textures individuelles compressées ; les atlas des maps déjà préparées sont conservés lorsque leur contenu correspond à l’export frais. Il n’a pas été créé un atlas global gigantesque à charger en mémoire.
- Les 736 bundles d’objets présents sont exportés. 609 donnent des clips préparables pour le moteur actuel ; 127 n’ont pas de clips dessinables avec le décodeur actuel. Leurs documents, textures et bundles source sont conservés pour les travaux de décodage ultérieurs.
- Les documents utilisent gzip ; les textures GPU BC7 utilisent Zstd. La compression massive utilise le profil BC7 `alpha_ultrafast`, avec conservation des sorties plus qualitatives déjà produites. L’échantillon de 49 sprites décodé indépendamment présente un écart moyen maximal par canal de 1,57/255 par rapport aux pixels prémultipliés d’origine. Ce test ne remplace pas une revue visuelle exhaustive.

## Couverture et limites connues

« Toutes les maps extraites » signifie toutes les cartes trouvées dans **cette installation**. Cela ne signifie pas que tous les effets du client officiel sont déjà implémentés.

Le contrôle complet repère 1 127 maps avec au moins une référence de sprite statique absente du catalogue extrait, représentant 1 592 IDs distincts. Parmi ces IDs, 1 378 ne figurent pas non plus comme `gfxId` dans le registre graphique courant. Aucun remplacement arbitraire par un autre sprite n’est effectué.

Les maps réclament aussi 13 objets dont les bundles sont absents de l’installation. Les ressources absentes ou dont les animations ne sont pas exploitables sont signalées dans le manifeste : le client ne relance pas une extraction vouée à l’échec à chaque visite.

La liste exacte des cartes et ressources concernées se trouve dans `client/web/game-data/release-report.json`, avec les champs `missing_drawable_gfx`, `maps_with_unavailable_props`, `unsupported_animation_props` et `absent_props`. `missing_files` concerne les fichiers effectivement référencés par les documents préparés ; il doit être vide avant publication. Les effets animés/particules/réfractions déjà non pris en charge par le rendu restent un travail distinct.

## Organisation et utilisation

- `client/web/game-data/optimized/manifest.json` : ID de map → document immuable.
- `optimized/maps/` : documents gzip dont le nom comprend une empreinte du contenu.
- `gfx/`, `optimized/pages/` : PNG et textures GPU partagées.
- `optimized/entities/`, `optimized/clips/`, `textures/` : objets, personnages déjà préparés et animations.
- `maps/`, `entities/` : exports frais conservés pour compatibilité et diagnostic.
- `unsupported/props/` : sources des animations non prises en charge.

Le dossier est autonome pour les données de maps/objets et les personnages locaux préparés. L’interface conserve ses propres répertoires UI existants. Pour une application empaquetée, placer ce dossier sous `resources/game-data` : Electron le cherche également à cet emplacement. Ce chantier ne produit pas un installateur complet de l’application.

`GINY_DATA_ROOT=/chemin/game-data` impose une seule racine de données de jeu, utile pour vérifier l’autonomie. `GINY_ALLOW_RUNTIME_EXTRACTION=0` désactive explicitement l’extraction à l’exécution.

Les fichiers sont assemblés par liens physiques lorsque le système le permet, pour éviter de dupliquer immédiatement plusieurs Gio sur cette machine. Le dossier ne contient pas de liens symboliques vers l’installation source : une copie ordinaire du dossier produit les fichiers complets. Vite ignore ce corpus dans son observateur de fichiers, et les données générées sont exclues de Git.

## Refaire ou reprendre la préparation

Depuis `client/web`, avec UnityPy disponible dans le Python d’extraction et le venv des assets installé :

```sh
npm run assets:world -- --output game-data-nouvelle-version
```

Le Python d’extraction peut être imposé avec `GINY_EXTRACTOR_PYTHON`. Les scripts utilisent l’installation Dofus locale par défaut. Pour une autre source, lancer explicitement `extract-world.py --client /chemin/client` puis les phases de préparation/publication avec la même zone de staging.

Les étapes sont aussi lançables séparément depuis la racine du dépôt :

```sh
python3 client/dofus3/scripts/extract-world.py --phase inventory
python3 client/dofus3/scripts/extract-world.py --phase gfx
python3 client/dofus3/scripts/extract-world.py --phase maps
python3 client/dofus3/scripts/extract-world.py --phase props
client/dofus3/.venv-assets/bin/python client/web/scripts/prepare-world-textures.py
client/dofus3/.venv-assets/bin/python client/web/scripts/prepare-world-props.py
client/dofus3/.venv-assets/bin/python client/web/scripts/publish-world.py --output client/web/game-data-nouvelle-version
```

Les checkpoints sont dans `client/dofus3/.cache/dofus3/world/extraction-state.json` et `texture-variants.json`. L’extraction s’arrête si l’espace libre passe sous 4 Gio. Un verrou évite deux extracteurs simultanés sur le même staging. Après un arrêt forcé, vérifier qu’aucun extracteur ne tourne avant de retirer `.extract.lock`.

La publication vérifie la présence des dépendances, écrit les manifestes à la fin et renomme le staging. Elle refuse d’écraser une version déjà publiée : préparer un autre dossier permet de conserver une version précédente utilisable. Les anciens assets du chantier précédent n’ont pas été supprimés.

## Vérification dans Electron

Depuis `client/web` :

```sh
npm run build:benchmark
E2E_WORLD_DATA=1 npx playwright test e2e/world-data.spec.ts
npm run build
```

Le test force la racine `game-data`, interdit l’extraction, vérifie l’absence de fichiers de jeu demandés en 404 et ouvre six cartes réparties dans le corpus. Les mesures et captures sont écrites dans `client/web/output/performance/`. Le benchmark utilise `dist-benchmark`, séparé de `dist`, pour éviter qu’une compilation normale concurrente modifie les fichiers du test. Le build normal reste celui lancé par `npm run app`.

## Résultats de validation

- 449 tests du client réussis ; 22 tests Python ciblés réussis, couvrant notamment la réutilisation des bundles, la publication atomique et le contrôle pixel par pixel des atlas.
- Build normal et build benchmark réussis ; lint sans erreur, avec avertissements existants.
- Test Electron avec `GINY_DATA_ROOT` pointant uniquement sur le dossier publié : maps 5, 73400833, 117707793, 159647235, 189793799 et 221251595 affichées, sans demande de fichier de jeu en 404, sans appel à `ensure-data` et sans erreur JavaScript.
- Sur ces six cartes, décor affichable en 142–1 086 ms et décor/personnage/objets prêts en 261–1 284 ms sur Apple M4. Ressources déjà présentes sur disque ; caches système non purgés. Aucune comparaison FPS avant/après n’en est déduite.
- Les trois cartes de référence 154644, 153878788 et 153880836 passent également le test Electron : décor affichable en 160–346 ms, ensemble prêt en 458–502 ms, cadence RAF médiane de 16,7 ms.
- Les atlas des 31 cartes précédemment préparées sont réutilisés après vérification exacte de 5 846 références de sprites, tout en conservant les cellules, matériaux et objets des exports frais.

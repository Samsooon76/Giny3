# Rendu et chargement du client — chantier du 5 septembre 2026

Implémentation dans `client/web`, sur le corpus local déjà extrait. Les ressources préparées résident dans `client/dofus3/.cache/dofus3/runtime/optimized`. Les exports d’origine sont conservés. Aucun téléchargement de ressources de jeu n’a été ajouté.

## Ce qui est en place

- Atlas partagés entre petits groupes de maps voisines, pages de 2048 pixels maximum, coordonnées/pivots conservés. WebP **sans perte** de repli ; BC7 prémultiplié dans KTX2 avec Zstd lorsque WebGL expose BPTC. Les grands voiles restent des textures individuelles sans redimensionnement.
- Décompression Zstd hors du thread de rendu, dans un worker ; transfert des blocs BC7 et upload GPU compressé. Le support KTX2 est volontairement limité au format produit par notre préparateur, pas un chargeur KTX2 universel.
- Chargements de textures partagés, six tâches simultanées, priorité aux demandes actives, annulation des consommateurs obsolètes et préchargement GPU par petits lots.
- Sources de textures gérées par références et cache LRU, cible de **256 Mio**. Les sources affichées restent protégées : ce budget n’est donc pas une limite absolue à la RAM du processus. Les textures recolorées propres à chaque personnage, géométries, buffers GPU et copies conservées par Chromium ne sont pas compris dans ce compteur.
- Cache des documents de maps : 32 entrées / 32 Mio estimés. Caches séparés et bornés pour les entités et animations. Les références utilisées par une scène restent vivantes après leur éviction du cache.
- Documents d’entités découpés en géométrie et clips chargés à la demande. Une pose arrivée tardivement ne remplace pas une demande plus récente. Les clips précédents quittent la référence privée de l’acteur.
- Meshes ordinaires des acteurs compatibles avec le batching Pixi ; conservation du shader spécifique lorsque la recoloration l’impose. Libération des meshes, textures et références de shader lors de la destruction.
- Dessin déclenché quand la scène change, limitation à 60 Hz et 15 Hz hors focus, absence de dessin quand le document est masqué. Les animations actives continuent de rendre leurs frames. Éléments statiques hors champ exclus du rendu ; test de visibilité recalculé seulement lorsque la caméra ou la scène change.
- Résolution du canvas limitée à 1 par défaut, interface DOM inchangée. `?quality=high` autorise 2 pour privilégier la netteté Retina ; `?textures=lossless` force le repli sans perte.
- Voisins préparés chargés après deux secondes d’inactivité, deux tâches au maximum, annulées au changement de map. Cette anticipation ne lance jamais l’extraction Unity.
- Documents préparés lus directement, sans passage par l’extracteur. Extraction des maps de secours sérialisée et validation disque mémorisée. En application empaquetée, l’extraction à l’exécution est désactivée par défaut. `GINY_ALLOW_RUNTIME_EXTRACTION=0` l’interdit aussi en développement, pour maps/looks/props ; `1` l’autorise explicitement.

## Mesures vérifiées

Le corpus préparé contient **31 maps v3**, **66 documents d’entités/props** et **1 499 clips**. Les autres IDs présents dans les exports locaux n’ont pas été arbitrairement déclarés compatibles v3.

Sources nécessaires aux décors éligibles, hors personnages, voisins et buffers :

| Map | Sources avant → après | Mémoire texels avant → BC7 + textures conservées |
|---|---:|---:|
| 154644 | 279 → 4 | 36,0 → 17,4 Mio |
| 153878788 | 216 → 7 | 52,8 → 28,1 Mio |
| 153880836 | 189 → 10 | 79,3 → 40,2 Mio |

Ces nombres proviennent des dimensions et formats des ressources, pas d’une lecture de la mémoire GPU physique. BC7 utilise quatre fois moins de texels en mémoire qu’une page RGBA identique ; le gain global est moindre à cause de l’espace libre des atlas, du partage entre maps et des grandes textures conservées.

L’avatar `look_1_10_2012` demandait environ **264 Mio de JSON décompressé**. Sa géométrie préparée pèse **1 234 595 octets** et sa pose initiale **327 949 octets**, soit environ **1,49 Mio à analyser au démarrage**. Les autres clips sont demandés à leur utilisation. Cette mesure exclut les images des atlas de l’avatar.

- 3 079 découpes de textures contrôlées pixel par pixel contre les sources, sur les 31 maps. Aucune différence en WebP sans perte ; éléments, cellules et métadonnées graphiques inchangés.
- 30 transitions entre les trois maps : le compteur des sources de textures se stabilise à **170 214 992 octets (162,3 Mio)**. Le test vérifie le plateau, les documents bornés et l’arrivée sur la dernière map en cas de demandes concurrentes.
- Tests navigateur : affichage des trois maps, repli sans perte, zoom et présence des interactifs ; ressources locales de la map, de l’écran de personnages et du HUD.
- **444 tests unitaires réussis**, build TypeScript/Vite réussi et lint sans erreur (avertissements existants). Tests couvrant notamment partage/éviction des ressources, annulation sans casser les autres utilisateurs, course déchargement/rechargement, priorité, erreurs de clips et décodeur BC7.

Test complémentaire de la version compilée dans **Electron 38 sur Apple M4 / ANGLE Metal**, résolution du canvas 1, scènes locales sans session multijoueur, 60 intervalles RAF après disponibilité des acteurs et objets :

| Map | Décor affichable | Décor + acteurs + objets prêts | Médiane / p95 des intervalles RAF |
|---|---:|---:|---:|
| 154644 | 186 ms | 542 ms | 16,7 / 18,4 ms |
| 153878788 | 269 ms | 437 ms | 16,7 / 17,8 ms |
| 153880836 | 301 ms | 454 ms | 16,7 / 18,0 ms |

BC7 effectivement utilisé sur les trois maps, sans erreur JavaScript. Il s’agit d’une observation après modification, sur cette machine et avec les ressources locales déjà présentes ; les caches disque du système n’ont pas été purgés. Les frames identiques peuvent être sautées, et ces intervalles RAF ne sont pas le temps CPU de chaque dessin. Les 88 clips / 57 830 nœuds dessinables de l’avatar de référence ont également été comparés aux données source après filtrage des champs de rendu.

Les mesures de cadence dans le Chromium automatisé ne démontrent pas un gain de FPS : le rendu y est lent et les premières captures de référence ne chargeaient pas encore tous les acteurs. Les JSON `before.json` et `after.json` ne constituent donc **pas** une comparaison FPS équivalente. Aucun engagement « zéro lag » ou « 60 FPS sur toute machine » n’est déduit de ces essais.

## Préparer les prochaines ressources

Depuis la racine du dépôt, une seule fois :

```sh
python3 -m venv client/dofus3/.venv-assets
client/dofus3/.venv-assets/bin/pip install -r client/web/scripts/requirements-assets.txt
```

Depuis `client/web` :

```sh
npm run assets:prepare
npm run assets:prepare-entities
npm run assets:verify
```

Ces commandes traitent les exports locaux v3/v2 compatibles. Pour extraire puis préparer des maps supplémentaires, fournir explicitement leurs IDs et le client installé :

```sh
../dofus3/.venv-assets/bin/python scripts/prepare-assets.py --bc7 --extract --maps 154644 --client /Applications/Ankama/Dofus-dofus3
```

Une préparation partielle conserve les autres entrées du manifeste. Les manifestes sont remplacés atomiquement après écriture des fichiers immuables référencés. Les anciens fichiers immuables ne sont pas supprimés automatiquement, car un client ouvert peut encore les référencer ; les versions intermédiaires générées pendant ce chantier restent donc également sur disque. Ne lancer qu’un préparateur à la fois sur un même répertoire de sortie.

Pour distribuer le client, inclure `optimized/` **et** les textures originales encore référencées, les données UI et les autres ressources de jeu. L’empaquetage autonome de tout le corpus n’a pas été ajouté ici. Une map absente de la préparation doit être extraite/préparée avant livraison pour garantir une première visite sans extraction.

## Reproduire les contrôles

Depuis `client/web` :

```sh
npm test
npm run build
npm run lint
npx playwright test e2e/local-assets.spec.ts e2e/electron-shell.spec.ts
npm run test:performance
```

Le test de rendu compilé hors session utilise un mode de compilation explicite :

```sh
npm run build:benchmark
E2E_RENDER_BENCHMARK=1 npx playwright test e2e/electron-shell.spec.ts
npm run build
```

Le mode benchmark est maintenant compilé dans `dist-benchmark`, séparément de `dist` ; les aperçus hors session restent désactivés dans le build normal. En développement ou en build benchmark, `?map=154644&benchmark=1` expose `window.__ginyPerformance()` et les commandes de test des transitions. Les résultats détaillés sont dans `client/web/output/performance/` ; les traces et pièces jointes Playwright sont régénérées dans `client/web/test-results/`.

Il reste à profiler une session représentative avec beaucoup de joueurs/monstres et à valider la qualité BC7 sur les différents GPU ciblés. Les effets de map déjà non pris en charge (certaines animations, particules, réfractions) n’ont pas été implémentés par ce chantier. Le moteur spécialisé WebGL/WASM de Bubble n’a pas été recopié : l’implémentation conserve Pixi et ses interactions existantes.

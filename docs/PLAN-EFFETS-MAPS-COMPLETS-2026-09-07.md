# Plan d’implémentation des effets sur toutes les maps

État du code vérifié le 7 septembre 2026. Ce document décrit le travail à réaliser ; les nouveaux modules proposés ci-dessous ne sont pas encore implémentés.

## 1. Résultat attendu et définition de « complet »

Le client doit reproduire les effets visuels définis dans les maps de la version source installée : décors animés, particules, matériaux animés, vent, vagues, réfraction et événements visuels associés. Un effet ne doit apparaître que là où les données du jeu le prévoient.

La préparation se fait avant livraison. Le jeu lit uniquement des fichiers locaux préparés, avec des caches bornés ; il ne lance ni Unity, ni Python, ni extraction de bundles. Les lectures disque, la décompression des documents et le transfert des textures vers le GPU restent nécessaires. L’objectif est de les anticiper avant l’affichage de la scène.

Trois couvertures doivent être distinguées :

- **Données** : toutes les maps et leurs dépendances visuelles sont inventoriées et exportées, ou leur absence source est explicitement documentée.
- **Fonctionnalités** : chaque famille de paramètres observée possède une implémentation et des tests. Aucun paramètre utile n’est silencieusement jeté.
- **Fidélité** : des captures animées comparables confirment le comportement et la composition des effets. Un export JSON valide ne prouve pas cette fidélité.

Le rapport actuel contient 17 353 maps, 22 235 instances de décors animés et 100 550 définitions de systèmes de particules. Ce sont des quantités exportées, pas une preuve de rendu intégral. Il recense aussi 32 props indisponibles et 50 références de textures manquantes sur 37 maps.

## 2. Points d’entrée existants et problèmes constatés

Les chemins de cette table sont relatifs à la racine du dépôt.

| Fichier existant | Rôle / modification attendue |
| --- | --- |
| `client/dofus3/extractor/maps/export_map.py` | Source principale. `material_table()` ne garde qu’une sélection étroite de paramètres. `build_map_document()` n’exporte pas actuellement `refractionElements` dans ses couches. Exporter aussi les configurations globales et les dépendances. |
| `client/web/scripts/prepare-map-effect-textures.py` | N’exporte que `particles` et `noises`. Étendre aux catégories référencées ; supprimer les résolutions ambiguës par identifiant numérique seul. |
| `client/web/scripts/prepare-world-ambient.py` | Réutilise le cache `ambient-v2` et ne réinjecte que props/particules. Faire évoluer le cache et la fusion pour les nouvelles données. |
| `client/web/scripts/publish-world.py` | Assemblage du pack et publication des manifestes. Ajouter les nouveaux fichiers, versions et contrôles de couverture. |
| `client/web/src/game/maps/types.ts` | Contrat du client : ajouter les configurations, matériaux, références de textures et effets normalisés. |
| `client/web/src/game/maps/adapter.ts` | Conversion du JSON : préserver et valider les nouveaux champs, signaler les versions incompatibles. |
| `client/web/src/game/maps/loader.ts` | Chargement local des maps : intégrer version/diagnostics, conserver annulation et cache borné. |
| `client/web/src/game/renderer/spriteFactory.ts` | Les paramètres vent/vagues produisent actuellement un label et des métadonnées, sans déformation. Diriger ces éléments vers un rendu adapté. |
| `client/web/src/game/renderer/mapScene.ts` | Dépendances de textures, dessin des couches, construction et animation des voisins. `refraction` est encore ignoré. |
| `client/web/src/game/renderer/GameRenderer.ts` | Map principale, ticker, caméra, voisins, chargement, nettoyage, statistiques. Partager le cycle de vie des effets avec les voisins. |
| `client/web/src/game/particles/parameters.ts` | Courbes, couleurs et paramètres : conserver les unités et formaliser les nouveaux modules. |
| `client/web/src/game/particles/MapParticles.ts` | Simulation, émissions, trails et sous-émetteurs. Ajouter les comportements manquants après vérification de leur sémantique source. |
| `client/web/src/game/particles/ParticleBatch.ts` | Rendu groupé dissolution/distorsion. Compléter matériaux, UV, masques et composition. |
| `client/web/src/game/particles/effectTexturePaths.ts` | Table générée avec identifiants aplatis. Remplacer progressivement les recherches ambiguës par les références résolues dans le pack. |
| `client/dofus3/extractor/animations/prop_decoder.py` | Décodage Animator2D des décors. Examiner les extensions, filtres et masques encore ignorés. |
| `client/web/src/game/entities/EntityRenderer.ts` | Application des poses, couleurs et clips : implémenter les propriétés supplémentaires sans modifier implicitement le comportement des personnages. |
| `client/web/src/game/props/AmbientAnimation.ts` | Cycles et pauses des décors. Préserver les indicateurs de lecture et les objets pilotés par le serveur. |

## 3. Lot 0 — Inventaire exhaustif avant les shaders

**Créer** `client/web/scripts/audit-world-effects.py` et `client/dofus3/tests/test_effects_inventory.py`.

Travail :

1. Parcourir les bundles de maps de la version installée en réutilisant l’index de bundles existant. Charger chaque bundle une fois par passage.
2. Recenser les types de matériaux et paramètres, références de textures, couches, configurations globales, modules de particules, extensions Animator2D et séquences de mise en scène.
3. Inspecter notamment `mapWindConfiguration`, `mapWaveConfiguration`, `mapNoiseModifierConfiguration`, `mapPostProcessConfiguration`, `refractionElements` et `stagingSequences`. Leur présence ne suffit pas : distinguer données neutres et effets réellement actifs.
4. Pour chaque occurrence, conserver map ID, couche, élément/système, type source et références nécessaires. Choisir automatiquement quelques maps représentatives de chaque combinaison observée.
5. Distinguer : supporté, export incomplet, rendu absent, ressource source introuvable, données invalides et sémantique non déterminée.
6. Rechercher les 32 props et 50 références manquantes dans les catalogues et bundles appropriés. Vérifier d’abord les espaces de noms et la version des sources ; ne pas remplacer une texture par une image arbitraire.

Produire `game-data/effects-coverage.json`, un rapport lisible dans `docs/` et une liste de maps de test. Enregistrer version source, version exporteur et empreintes des entrées pour rendre l’audit reproductible.

**Validation de sortie :** 17 353 maps examinées ; chaque famille observée apparaît dans le rapport, y compris les familles non implémentées. Aucun élément oublié ne disparaît simplement du dénominateur.

## 4. Lot 1 — Contrat de données et export sans perte utile

**Modifier** `export_map.py`, `maps/types.ts`, `maps/adapter.ts`, `particles/parameters.ts`.

**Créer** `client/dofus3/extractor/maps/effects.py` et `client/web/src/game/effects/types.ts` pour isoler la normalisation des effets.

Contrat proposé, à finaliser après l’inventaire :

```text
map.effectsVersion
map.environment            vent, vagues, bruit, post-traitement
map.materials              matériaux identifiés et paramètres normalisés
map.refraction             instances et ordre de composition
map.effectDependencies     références explicites vers les fichiers préparés
map.effectSequences        déclencheurs et séquences visuelles compris
map.effectCoverage         familles utilisées et problèmes détectés
```

Une référence de texture doit inclure sa catégorie, son identifiant source et son chemin préparé. Deux textures ayant le même numéro dans `mapgfx`, `particles`, `noises` ou `masks` restent deux ressources distinctes. Les noms précis des champs ne deviennent contractuels qu’une fois les sources vérifiées.

Travail :

- Résoudre les références gérées avec `_ref_data_by_rid()` ; conserver le type du bloc de paramètres. Remplacer le filtrage par préfixes `Wind`/`Wave` par des convertisseurs explicites par type.
- Définir unités, axes, espace local/monde/écran, couleur et alpha pour chaque famille. Conserver les données brutes utiles à l’audit hors du pack runtime compact.
- Exporter les couches de réfraction et leur association réelle aux matériaux. Ne pas présumer que leurs indices correspondent à la table foreground.
- Conserver les modes de blend source lorsque `normal/add/multiply/none` ne suffisent pas. Marquer les modes non gérés au lieu de les faire passer pour normaux.
- Exporter les paramètres de collisions s’ils existent dans les données accessibles. S’ils proviennent du runtime source, documenter cette dépendance avant d’inventer une approximation.
- Versionner les schémas et tester les maps actuelles sans effet. Les champs optionnels absents doivent donner un comportement neutre ; une version future inconnue doit être diagnostiquée.

**Tests :** nouveaux `test_map_effects.py`, `effects/types.test.ts` et extensions de `maps/adapter.test.ts` / `maps/materials.test.ts`. Cas réels : références inline/rid, matrices, valeurs nulles, courbes à paliers, alpha, unités et blend non reconnu.

**Validation de sortie :** sur les fixtures, chaque donnée utile présente à la source arrive intacte dans le contrat client, ou produit une erreur explicite.

## 5. Lot 2 — Textures d’effets et génération du pack

**Modifier** `prepare-map-effect-textures.py`, `prepare-world-ambient.py`, `publish-world.py`, `build-world-ambient.mjs` et `package.json`.

- Étendre la recherche aux masques, emissives, modèles de vent et ressources de vagues effectivement référencés. Exporter la fermeture des dépendances, pas systématiquement toutes les images du bundle.
- Remplacer la table numérique aplatie par un catalogue qualifié. Définir une seule résolution de références utilisée par l’export, la collecte des dépendances et le rendu.
- Garder les masques et cartes de bruit dans le bon espace de couleur. Mesurer les pertes de précision avant d’appliquer une compression GPU ; une compression acceptable pour un décor peut dégrader un masque de réfraction.
- Invalider `ambient-v2` : construire une clé de cache avec version source, empreinte des bundles et version de schéma/exporteur. Réutiliser un fichier uniquement parce qu’il existe ne suffit plus.
- Faire réinjecter tous les nouveaux champs par `prepare-world-ambient.py`, en préservant les atlas et variantes BC7 existants.
- Produire les documents et textures immuables d’abord, les manifestes cohérents ensuite. Préparer une release séparée, la valider, puis basculer un pointeur de release atomiquement ; éviter qu’un client lise des manifestes maps/entities de générations différentes.
- Remplacer les fichiers atomiquement : plusieurs assets existants sont liés physiquement entre staging et release. Ne pas modifier leur contenu en place.

**Validation de sortie :** chaque dépendance déclarée existe et son hash correspond. Un pack incomplet peut servir au développement, mais ne doit pas être déclaré « effets complets ». Les absences source restent des exceptions visibles.

## 6. Lot 3 — Cycle de vie commun aux maps et voisines

**Créer** `client/web/src/game/effects/MapEffects.ts`.

Interface indicative : `prepare(...)`, `tick(dt, context)`, `resize(...)`, `snapshot()` et `destroy()`. Le contexte transporte caméra, viewport, visibilité et temps partagé ; il ne donne pas aux effets leur propre boucle d’animation.

**Modifier** `GameRenderer.ts`, `mapScene.ts`, `spriteFactory.ts` et, pour la collecte de dépendances, `maps/loader.ts` si nécessaire.

- Instancier le même contrôleur d’effets pour la map principale et les voisines. Partager préparation et destruction sans déplacer les comportements de combat/I/O dans le gestionnaire d’ambiance.
- Faire inclure toutes les textures d’effets dans `mapTextureUrls()` et les ressources préparées avant la fin de `sceneBuilding`. Préparer aussi les programmes GPU réellement nécessaires pour éviter leur première compilation au milieu de l’affichage.
- Garder un ticker propriétaire dans `GameRenderer`. `tick()` indique si une nouvelle image est nécessaire ; une map sans effet actif ne doit pas être redessinée pour rien.
- Traiter annulation de changement de map, échec partiel de préparation et destruction pendant un chargement. Les références de textures, buffers et render targets doivent être libérées une seule fois.
- Étendre les statistiques : effets actifs/ignorés, textures manquantes, temps CPU des effets, mémoire des render targets, nombre de passes, particules plafonnées.

**Tests :** nouveau `effects/MapEffects.test.ts`, puis tests d’intégration de changement de map rapide et de destruction. Vérifier que le gestionnaire ne possède aucun `setInterval`, RAF indépendant ou chargement Unity.

## 7. Lot 4 — Vent et vagues sur les décors

**Créer** `client/web/src/game/effects/DeformedMapMesh.ts`, `WindState.ts` et `shaders/mapDeformation.ts`.

**Modifier** `spriteFactory.ts`, `MapEffects.ts`, `mapScene.ts` et le calcul de culling dans `GameRenderer.ts`.

- Traduire les paramètres sources vérifiés en déformation : direction, fréquence, amplitude, phase, masque et ancrage. Ne pas appliquer un sinus identique à tous les décors si les données définissent des comportements différents.
- Garder les sprites ordinaires pour les éléments sans déformation. Utiliser un mesh subdivisé uniquement quand la déformation intérieure en a besoin ; un quad à quatre sommets ne suffit pas à toutes les formes.
- Partager le temps et les configurations pour obtenir des phases cohérentes aux frontières des maps. Conserver les décalages par objet définis à la source.
- Respecter pivots, matrices, inversion verticale et transformations des voisins. Définir des UV locaux distincts des UV d’atlas pour éviter de déformer ou échantillonner le sprite voisin dans l’atlas.
- Regrouper seulement les matériaux compatibles sans casser l’ordre de transparence. Agrandir les bounds par l’amplitude maximale pour éviter les disparitions au bord de l’écran.
- Évaluer les vagues selon leurs données propres : animation d’UV, masque/dissolution ou déplacement de géométrie ne sont pas interchangeables.

**Validation :** screenshots à temps contrôlé, ancrages fixes, continuité entre voisins, zoom/pan, amplitude nulle, objets retournés et masque non uniforme. Mesurer le coût sur une map riche en végétation.

## 8. Lot 5 — Réfraction et composition

**Créer** `client/web/src/game/effects/RefractionPass.ts`, `RenderTargetPool.ts` et `shaders/refraction.ts`.

**Modifier** les couches/composition dans `mapScene.ts` et `GameRenderer.ts`, puis brancher dans `MapEffects.ts`.

- Établir avec les sources et captures ce que chaque effet déforme : décor seul, objets triés, acteurs, avant-plan. L’ordre des passes doit découler de cette vérification.
- Capturer les couches nécessaires dans une texture intermédiaire réutilisable ; échantillonner cette texture avec le déplacement, le masque, la force et les UV définis par le matériau.
- Ne jamais lire une texture pendant qu’on écrit dans la même cible. Utiliser des cibles distinctes pour les étapes qui l’exigent.
- Partager une capture entre effets compatibles. Plusieurs étapes peuvent être nécessaires si les effets doivent se réfracter mutuellement ; ne pas imposer arbitrairement une seule passe.
- Composer les voisins visibles et la map courante avec des coordonnées cohérentes, sinon les coutures apparaîtront aux frontières.
- Dimensionner les cibles avec viewport et résolution réelle ; les redimensionner/libérer proprement. Garder le HUD hors des passes du monde.
- Retirer `refraction` du chemin ignoré seulement quand sa prise en charge est effective. Un sprite ordinaire ne constitue pas un fallback fidèle.

**Validation :** aucune passe sur une map sans réfraction ; ordre correct avec acteurs/particules, transparence, superposition, zoom et redimensionnement. Compter la mémoire des render targets en plus du cache textures.

## 9. Lot 6 — Particules, collisions et matériaux manquants

**Modifier** `particles/parameters.ts`, `MapParticles.ts` et `ParticleBatch.ts`.

**Créer** `client/web/src/game/particles/ParticleCollisionWorld.ts` et `ParticleEvents.ts` si l’audit confirme les informations nécessaires.

Ordre de travail :

1. Vérifier les enums et espaces de simulation dans la source. Le code actuel déclenche les événements numériques 0 et 2 ; ne pas conclure automatiquement que le type 1 observé a exactement la sémantique Unity standard.
2. Identifier la géométrie de collision réelle : plans, volumes, terrain ou autre. Les cellules marchables décrivent le déplacement du joueur ; elles ne doivent pas devenir les colliders visuels par défaut.
3. Construire une représentation de collision légère hors ligne lorsque la géométrie est disponible. Utiliser un index spatial et une détection balayée pour les particules rapides si nécessaire.
4. Implémenter les réponses réellement utilisées : rebond, amortissement, perte de durée de vie, destruction, émission à l’impact et héritage des propriétés.
5. Éviter les impacts répétés au même contact ; borner les files d’événements et les chaînes de sous-émetteurs. Tester les cycles dans les références de sous-émetteurs.
6. Compléter les matériaux inventoriés : masques, burn/dissolve, UV animés, blending, couleur et alpha prémultiplié. Partager les calculs de matériaux avec les autres effets lorsque leur sens est identique.
7. Valider simulation locale/monde, bruit, trails après la mort, rafales, délais et préchauffage. Une approximation existante reste déclarée comme telle tant qu’elle n’est pas comparée.

Les plafonds actuels de particules sont utiles pour protéger le client, mais peuvent supprimer des effets. Pour un profil « complet », mesurer les besoins des maps les plus denses, rendre les dépassements observables et adapter les budgets. Ne pas annoncer une fidélité complète avec un écrêtage silencieux.

**Tests :** étendre `parameters.test.ts` et `MapParticles.test.ts`, créer `ParticleCollisionWorld.test.ts`. Couvrir impact, absence de collision, particule rapide, héritage, probabilité, émission différée, seuil de budget et destruction de scène.

**Dépendance bloquante possible :** si les collisions reposent sur des informations absentes du pack source accessible, documenter précisément ce manque. Une collision générique fabriquée ne prouve pas la parité avec le jeu.

## 10. Lot 7 — Animator2D, masques et mises en scène

**Modifier** `client/dofus3/extractor/animations/prop_decoder.py`, `client/dofus3/extractor/entities/export_bone.py`, `client/web/scripts/recover-map-prop-clips.py`, `client/web/scripts/prepare-entities.py`, `client/web/src/game/entities/types.ts`, `client/web/src/game/entities/adapter.ts` et `EntityRenderer.ts`.

- Transformer les extensions et flags aujourd’hui sautés en données explicites quand leur format est compris. Garder des fixtures par variante de record.
- Préserver matrices complètes, ordre de dessin, masques imbriqués, filtres et couleurs par nœud.
- Implémenter les masques/filtres utilisés en maîtrisant les passes intermédiaires. Valider à nouveau le blé et les couleurs signées pour éviter le retour des parties noires.
- Vérifier les 32 props indisponibles individuellement après résolution des namespaces et versions ; distinguer bundle absent et décodeur incomplet.
- Inventorier les séquences de mise en scène. Si elles contribuent aux effets visuels manquants, créer `effects/MapEffectSequence.ts` avec déclencheurs connus et annulation au départ de la map.
- Préserver `requiresServerUpdate`, les états de récolte et `playAnimation`. « Toutes les animations » ne signifie pas forcer une animation inactive dans les données.

**Tests :** fixtures Python, tests d’`EntityRenderer`, cycles `AmbientAnimation`, états I/O, surbrillance et hit-testing. Les sons/localizedSounds sont à inventorier mais restent hors de ce chantier visuel.

## 11. Lot 8 — Performance et transitions sans apparition tardive

**Modifier selon mesures** `assets/ResourcePool.ts`, `assets/DocumentCache.ts`, `assets/textures.ts`, `assets/TaskQueue.ts`, `maps/loader.ts`, `GameRenderer.ts` et `MapEffects.ts`.

- Conserver les caches bornés ; comptabiliser géométrie, textures d’effets et render targets en plus des textures classiques.
- Précharger les dépendances des maps voisines probables avec priorité inférieure à la map demandée. Annuler ce qui devient inutile.
- Révéler une scène lorsque ses couches visibles et effets sont prêts. Si le chargement reste nécessaire, garder une transition cohérente au lieu de faire apparaître des morceaux du décor après coup.
- Mettre en pause les effets hors écran selon leurs besoins : un effet à événements ne peut pas être repris comme une simple animation périodique. Conserver phase/temps ou appliquer un rattrapage borné, selon la sémantique vérifiée.
- Réutiliser buffers, sprites et cibles GPU ; éviter les allocations proportionnelles aux particules à chaque frame.
- Choisir les regroupements de draws sans changer la composition transparente. Aucun filtre plein écran par particule ou brin d’herbe.
- Conserver l’extraction runtime désactivée dans `electron/main.mjs`, `vite.config.ts` et `server/ensureMap.mjs`. Mettre à jour les commentaires devenus trompeurs sur ce sujet.

Objectifs de mesure, à établir sur une machine de référence : temps CPU/GPU des effets p50/p95/p99, frame time, transitions à froid/chaud et mémoire résidente. À 60 Hz, le budget total de frame est 16,7 ms ; il appartient à tout le jeu, pas seulement aux effets. Les mesures historiques d’Incarnam servent de baseline et ne garantissent pas les maps les plus lourdes.

## 12. Lot 9 — Preuve de couverture et livraison

**Créer** `scripts/verify-world-effects.py`, `e2e/map-effects.spec.ts` et `e2e/map-effects-performance.spec.ts` sous `client/web/`.

**Étendre** `e2e/map-ambient.spec.ts`, `e2e/map-local-rendering.spec.ts` et `e2e/world-data.spec.ts`.

Trois niveaux complémentaires :

1. **Toutes les maps, hors rendu** : version, JSON strict, références, hashes, familles reconnues, séquences, dépendances transitives et caps théoriques. Comparer inventaire source et pack final.
2. **Toutes les maps, smoke test de rendu par lots** : construction puis destruction, erreurs JS/GPU, ressources absentes, effets ignorés et fuite manifeste. Exécuter avec reprise/checkpoints pour que le dernier échec ne fasse pas recommencer le monde entier.
3. **Fidélité ciblée** : maps représentatives choisies par couverture des variantes, captures à temps contrôlé et séquences vidéo comparables. Tester aussi les combinaisons vent + particules + réfraction + acteurs et les limites de map. Une image seule ne valide pas un mouvement.

Prévoir une fixture déterministe (seed et temps contrôlés) pour les tests. La comparaison avec le client original doit tenir compte des phases aléatoires ; examiner formes, trajectoires, densité, palette, ordre et déclenchements, sans imposer une égalité de pixels irréaliste à des effets aléatoires.

Scénarios obligatoires : Incarnam 154010371 / [-1,-3], blé/I/O, quatre voisins visibles, changement rapide interrompu, zoom/pan, combat puis retour exploration, fenêtre masquée puis reprise, redimensionnement, longue succession de maps riches en effets.

Critères de livraison :

- Aucun appel à l’extraction runtime, aucune dépendance absente non expliquée et aucun effet inconnu silencieusement ignoré.
- Pour chaque famille utilisée : implémentation, fixtures, maps de référence et statut de fidélité explicite.
- Aucun écrêtage silencieux d’effets en profil complet ; budgets dépassés remontés dans le rapport.
- Pas d’apparition tardive de couche après la déclaration de scène prête.
- Pas de croissance durable non bornée de mémoire après échauffement et éviction des caches ; inclure les render targets dans la mesure.
- Tests de régression I/O, couleurs, combat et navigation réussis.
- Rapport distinguant « complet », « approximatif » et « impossible avec les sources actuelles ». Les exceptions source empêchent de présenter sans réserve le pack comme complet.

Commandes déjà disponibles, depuis la racine :

```sh
npm --prefix client/web test
npm --prefix client/web run lint
npm --prefix client/web run build:benchmark
npm --prefix client/web run assets:ambient
npm --prefix client/web run build
```

Exécuter les nouvelles vérifications et les tests Python avec l’environnement disposant de leurs dépendances. Ne pas lancer la génération mondiale à chaque changement de shader : utiliser d’abord le petit corpus de fixtures. `assets:ambient` devra être modifié comme décrit avant de pouvoir produire les nouvelles fonctionnalités. Les nouvelles commandes de vérification devront être ajoutées explicitement ; elles n’existent pas encore.

Tester `dist-benchmark` avant de recompiler/publier `dist`. Livrer ensemble le client compatible et la génération validée du pack. Le joueur ferme complètement puis rouvre le client pour renouveler les manifestes et se reconnecte ; aucune opération d’extraction ne lui est demandée.

## 13. Ordre d’exécution et jalons

| Ordre | Lots | Preuve attendue avant de continuer |
| --- | --- | --- |
| 1 | Inventaire 0 | Liste exhaustive des familles, manques et maps de référence. |
| 2 | Contrat/export 1 + textures/pack 2 | Un petit corpus traverse toute la chaîne sans perte utile ni référence ambiguë. |
| 3 | Cycle de vie 3 | Même comportement principal/voisins, préparation et annulation fiables. |
| 4 | Vent/vagues 4 | Première famille complète, mesurée et vérifiée aux frontières. |
| 5 | Réfraction 5 | Composition validée avec acteurs et voisins ; mémoire GPU mesurée. |
| 6 | Particules 6 + Animator2D/séquences 7 | Modules réellement utilisés couverts ; manques source isolés. |
| 7 | Performance 8 | Profil complet mesuré sur le corpus dense, caps et mémoire maîtrisés. |
| 8 | Monde entier/livraison 9 | Pack généré, audit exhaustif, smoke tests et fidélité ciblée validés. |

Les tests et mesures accompagnent chaque lot ; le lot final élargit la couverture. Le premier livrable doit être l’inventaire, car il détermine le volume réel de shaders, de variantes et de données à récupérer. Donner une durée ferme avant cet inventaire masquerait les incertitudes sur les collisions et les ressources absentes.

Audit de fidélité du client — 3 septembre 2026
=============================================

**Conclusion : il reste des gains visuels substantiels, surtout dans le mouvement, les effets et la composition des apparences.** La base d'interface est déjà bien extraite. En revanche, une partie importante de ce qui donne vie au client officiel est absente de notre format intermédiaire ou ignorée au rendu. Plusieurs ressources utiles sont directement lisibles ; le déchiffrement des chaînes obfusquées n'est pas le préalable à ces améliorations.

Installation examinée : `/Applications/Ankama/Dofus-dofus3`, version **3.6.10.11**. Code examiné : extracteur Python et client web React/PixiJS de cet espace de travail. Les recommandations concernent ce client web.

**Périmètre et niveau de preuve.** Inventaire exhaustif des fichiers installés, lecture de toutes les cartes, inspection des catalogues visuels principaux, confrontation aux exports et aux consommateurs web. Les animations ont été décodées sur un échantillon explicite, pas sur tous les personnages. Aucune comparaison nouvelle de pixels avec une session officielle en cours n'a été réalisée : ce rapport mesure la couverture et les pertes de données, pas un pourcentage de ressemblance à l'écran. Les nombres reflètent le disque au moment des passes ; le code de cet espace de travail évoluait pendant l'audit. Les [empreintes des fichiers examinés](audit-2026-09-03/source-fingerprints.json) fixent les références finales.

| Ensemble inspecté | Résultat |
| --- | --- |
| Installation | 22 484 fichiers, 13,03 Go décimaux |
| Cartes officielles | 569 bundles, **17 353 cartes**, aucune erreur de lecture de cette passe |
| Bundles et fichiers centraux | 39 conteneurs, dont les **25 bundles StandaloneOSX** et cinq fichiers du player ; 27 935 objets inventoriés |
| Pictogrammes | Les **50 bundles Picto** inspectés |
| Interface exportée | **685 arbres, 40 409 nœuds, 476 feuilles de styles** ; audit d'intégrité propre ; empreinte du catalogue actuelle |
| Tables DataRoot | **204/204** ont un export local ; cinq contiennent encore des références non développées |
| Animations | 76 bundles : 27 bones, 26 skins, 23 props ; **422 clips tentés, 233 lus, 189 en échec** |
| Cache d'entités | 6 700 documents uniques : 6 680 v1 et 20 v2, version relevée dans les 8 192 premiers caractères |
| Cache de cartes | 1 760 cartes uniques : 27 v3, 4 v2, 3 v1 et **1 726 sans version** |

Les 764 erreurs de lecture des MonoBehaviour du player central sont conservées dans [core.json](audit-2026-09-03/core.json). Elles viennent des lectures avec le type tree disponible et empêchent de considérer ces objets comme décodés. Les tables d'objets restent inventoriées. Un rapport sans erreur sur les bundles d'interface ne couvre donc pas automatiquement tout le player.

**Ordre conseillé des chantiers.** L'effort ci-dessous est relatif : « faible » signifie une extraction ou un raccordement local ; « élevé » implique un décodeur ou un moteur de rendu supplémentaire. Il ne s'agit pas d'une estimation calendaire.

| Priorité | Chantier | Bénéfice attendu | Effort |
| --- | --- | --- | --- |
| P1 | Rendre la régénération des caches cohérente | Retrouver la même qualité sur une carte ou une apparence nouvellement chargée | Moyen à élevé |
| P1 | Exporter toutes les configurations de carte et les textures d'effets | Eau, vent, lumière, fumée et ambiance de la scène | Moyen pour les données, élevé pour le rendu |
| P1 | Étendre le décodeur Animator2D | Restaurer des poses, attaques, états et transitions aujourd'hui absents | Élevé |
| P1 | Rejouer couleurs, filtres, masques et événements des animations | Apparences et effets corrects, synchronisation des actions | Élevé |
| P1 | Compléter la composition skins / sous-entités / règles d'équipement | Cheveux, capes, montures et équipements cohérents | Élevé |
| P2 | Exploiter les réglages UI, mouvements et ornements officiels | Finition des fenêtres et de leur comportement | Faible à moyen |
| P2 | Ajouter les familles de pictogrammes et la résolution 2x | Détails des écrans et netteté sur écran dense | Faible à moyen |
| P2 | Construire la chaîne audio à partir de sa bibliothèque | Pas, ambiances, sorts et retours d'interface | Moyen à élevé |
| P3 | Approfondir shaders compilés et MonoBehaviour sans schéma exploitable | Lever les dernières ambiguïtés du rendu | Élevé, exploratoire |

**1. Les cartes contiennent beaucoup plus que les sprites que nous affichons.**

La passe sur toutes les cartes donne les résultats suivants. Un élément sérialisé ou une configuration présente ne signifie pas que son effet est visible en permanence : l'activation, la qualité et l'état de la scène restent à interpréter.

| Donnée officielle | Nombre d'entrées | Cartes portant une liste non vide |
| --- | ---: | ---: |
| `particlesParameters` | 100 550 | **14 199** |
| `animatedElements` | 22 235 | **7 244** |
| `refractionElements` | 1 189 | **774** |
| `stagingSequences` | 6 912 | **1 019** |
| `localizedSounds` | 2 393 | **1 179** |
| `interactiveElements` | 44 072 | 9 381 |

Le [producteur de cartes](../extractor/maps/export_map.py) conserve trois couches statiques et une couche `animated`, ainsi que les props interactifs, mais ne publie pas les particules, la réfraction, les séquences, les sons ni les configurations globales de vent, vagues et post-traitement. Le [rendu web](../../web/src/game/renderer/mapScene.ts) ignore explicitement la couche `animated`. Cela ne signifie pas que tous les props sont immobiles : les props issus de `interactiveElements` ont une autre voie de rendu, déjà implémentée.

Les paramètres de matériau sont en outre aplatis dans un petit dictionnaire : seules certaines clés comme `frequency`, `amplitude`, `speed` et `intensity` survivent. Leur classe d'origine disparaît, des valeurs de classes différentes peuvent se remplacer, et des paramètres déterminants comme `bendCenter`, `flexibility`, `waveTexID`, `maskTexID`, `emissiveTexID` et les courbes sont perdus. Dans [spriteFactory.ts](../../web/src/game/renderer/spriteFactory.ts), les uniformes conservés sont attachés au conteneur et utilisés pour une étiquette ; aucun shader ne les anime.

**Extraction à faire :** conserver les paramètres typés de chaque matériau, résoudre leurs références, publier les quatre configurations globales, les courbes, les séquences et les couches supplémentaires. Ajouter un export des textures référencées par ces paramètres. Le bundle **`mapeffects_assets_all.bundle` contient 4 908 Texture2D** actuellement hors du chemin `_export_sprites`, qui cherche uniquement des Sprite dans `Map/Textures/1x`.

**Preuve concrète :** la carte `154644` contient des configurations de vent et de vagues, des paramètres de distorsion et d'émission lumineuse, et un `PPBloomParameters` avec `threshold=1.4`, `intensity=15`, `scatter≈0.811`. Ce sont des données lues, pas des réglages à inventer. Les 8 702 enregistrements `PPBloomParameters` trouvés donnent un chantier mieux motivé qu'un filtre de saturation global. Le `PostProcess Profile` du prefab central, lui, est vide : il ne permet pas de conclure que les cartes n'ont aucun post-traitement.

Les séquences vont au-delà d'une boucle décorative. Exemple : `ANOMALIE_OFF` sur `152337`, avec plans, délais, durées, groupes exclusifs, courbes d'intensité et cibles. Il faut aussi identifier les déclencheurs avant de les jouer.

Preuves : [inventaire des cartes, champs, types et exemples](audit-2026-09-03/maps.json).

**2. Le décodeur d'animations demeure partiel, même lorsque le Bouftou fonctionne.**

L'échantillon associe, pour chaque famille, 20 bundles choisis de façon déterministe par empreinte du nom, les trois plus gros et les identifiants de référence disponibles. Il est volontairement enrichi en cas complexes ; **189/422 n'est pas un taux d'échec estimé de toute l'installation**.

| Famille | Clips examinés | Échecs du décodeur actuel |
| --- | ---: | ---: |
| Bones | 355 | 156 |
| Props | 67 | 33 |

Le premier tag inconnu rencontré est `0x1f` dans 50 clips, `0x19` et `0x39` dans 14 chacun, `0x04` dans 13, puis notamment `0x90`, `0x37`, `0x51` et `0x9c`. Ce sont des **positions où le parseur perd la lecture**, pas une preuve que chaque valeur correspond à un opcode indépendant : une taille incorrecte en amont peut aussi désaligner la suite.

Le code [export_bone.py](../extractor/entities/export_bone.py) abandonne le clip en cas de `DecodeError`, puis le runtime choisit une animation de repli. De plus, l'extraction par défaut sélectionne surtout statique, marche et course : une animation techniquement décodable peut simplement ne jamais être exportée. L'existence d'un JSON d'entité ne suffit donc pas à prouver sa couverture.

**Cible de rétro-ingénierie recommandée :** le module natif **`Ankama.Animator2D.dll`**, namespace `Ankama.Animations.Rendering`. Les noms de `RenderState.Compute`, `ComputeExtendedFilterAndBlendState`, `ComputeBlurFilterState`, `ComputeGlowFilterState`, `ComputeDropShadowFilterState` et `StepToAlignment` sont lisibles. Les [cibles natives](audit-2026-09-03/native-targets.json) donnent leurs tokens et adresses ARM64 pour ce build. C'est un point d'entrée précis pour relire la grammaire des records, les alignements et les flags, puis étendre les fixtures.

Critère de validation : chaque frame termine exactement à son offset attendu, puis ses transforms, ordre, couleurs et filtres sont confrontés à un rendu de référence. Ajouter seulement des tailles de records pour faire disparaître une exception ne suffit pas.

Preuves : [clips, événements et erreurs](audit-2026-09-03/animations.json), [types et méthodes](audit-2026-09-03/metadata-targets.json).

**3. Certaines informations extraites sont perdues entre l'adaptateur et le GPU.**

Dans [adapter.ts](../../web/src/game/entities/adapter.ts), les couleurs multiplicatives et additives des vertices et des nœuds sont bien lues. Mais [EntityRenderer.ts](../../web/src/game/entities/EntityRenderer.ts) construit sa géométrie avec seulement positions, UV et indices ; il applique une teinte multiplicative globale et l'alpha du nœud. Les couleurs par vertex et la composante additive ne sont pas utilisées. `rgbTint` écrête également les valeurs dépassant 1.

Le `mask_state` publié par les chunks du format v1 n'est pas conservé dans le modèle web. Aucun chemin équivalent aux filtres `BlurFilter`, `GlowFilter`, `DropShadowFilter` et `ColorMatrixFilter` découverts dans les métadonnées n'est implémenté pour ces animations. Leur présence dans le moteur officiel établit des capacités à analyser ; elle ne prouve pas que tous les personnages les emploient. Sur les 145 SkinAsset de l'échantillon, aucun cas multi-texture ne démontre à lui seul l'impact de la limitation à la première texture : ce point reste un risque de couverture, pas un défaut visuel quantifié.

**Travail à faire :** publier puis consommer les couleurs et états étendus, implémenter les opérations correspondantes dans le shader de mesh, conserver les masques et leur ordre. Vérifier la convention des couleurs sur le code officiel avant de changer arbitrairement le diviseur 128.

Deux défauts de normalisation supplémentaires sont visibles : `_element` et `resolve_interactive_props` utilisent `value or 1` pour les diagonales de matrice, ce qui transforme un zéro valide en 1 ; `colorFromU32` rend opaque un alpha nul. Le premier a été reproduit avec une matrice de rotation synthétique. Leur fréquence sur les scènes affichées n'a pas été mesurée ; ils méritent une correction ciblée et une validation visuelle.

**4. Les apparences composées dépendent encore de cas particuliers et de caches préexistants.**

Le [compositeur de looks](../extractor/entities/export_look.py) explique lui-même que le chemin v1 ne sait pas régénérer les frames exploitables du personnage `bone 1`, réparties entre bundles statiques, mouvements et combats. Il préserve donc les documents v2 déjà présents. Le cache contient 20 documents v2 ; leur producteur complet n'a pas été retrouvé dans l'arborescence auditée. La table `boneindex` est extraite, mais sa présence ne suffit pas : aucun consommateur de cette table n'a été trouvé dans le compositeur courant.

Les règles `skinslotsrules` offrent davantage de précision que le masquage actuel par fragments de noms de cheveux ou de capes. L'énumération officielle, relue dans les métadonnées, est : `Default=0`, `Breed=1`, `BreedAndSex=2`, `Face=3`. L'implémentation courante parcourt les règles sans appliquer ces conditions et leur `slotRuleInfo`.

Les sous-entités arrivent déjà dans le look réseau via `readEntityLook`. Le [parseur de look web](../../web/src/game/entities/look.ts) sépare correctement le cinquième champ, mais ne le conserve pas dans le résultat ; le renderer ne compose donc pas ces attachments. Une seconde échelle éventuelle est également perdue au rendu, qui utilise un scalaire commun X/Y.

**Cibles :** `Animator2DCustomisableRenderer.WalkDisplayList`, `SetCustomisation`, `ApplyCustomisationColors`, `TryGetSpecificNamedCustomisedGraphic`, les `exposedNodeNames`, `maskableNodes`, `referencedSymbols` et customisations vides des SkinAsset. Il faut rendre reproductible une composition neuve, puis vérifier plusieurs équipements, sexes, directions et montures ; davantage de PNG seuls ne résoudront pas ce point.

**5. Les marqueurs temporels sont déjà lisibles, mais leur usage manque.**

Les clips décodés de l'échantillon contiennent **222 événements**, dont 69 `SHOT`, 56 `END` et des `Sound(...)` avec identifiants, volumes et distances. L'exporteur les conserve, mais `adaptAnimation` les omet et [AnimationPlayer.ts](../../web/src/game/entities/AnimationPlayer.ts) ne les distribue pas.

Le renderer force les poses à boucler via `applyPose`, y compris la voie d'attaque. Les transitions `AnimState*_to_AnimState*` sont autorisées par le filtre des props, mais `playState` saute directement à `AnimState<n>_0`. Le déplacement emploie des durées constantes par cellule, indépendantes des éventuelles données d'allure du client officiel.

La table de **14 929 `spellscripts`** est disponible. Le module web [spellScripts.ts](../../web/src/game/combat/spellScripts.ts) ne reconnaît que `animId`; aucun appel de production à `hydrateSpellScripts` ni à `playAttack` n'a été trouvé lors de cette passe. Il ne faut donc pas compter les tests unitaires de résolution comme une chaîne de combat visuelle déjà raccordée.

**Travail à faire :** transport des événements, lecture une seule fois des actions qui se terminent, transitions, raccordement des scripts et effets au bon instant. La signification exacte de chaque marqueur et son lien à la confirmation serveur doivent être validés avant usage.

**6. La régénération des données doit être stabilisée avant une grosse extraction supplémentaire.**

Le [batch extract_all.py](../extractor/extract_all.py) et l'exporteur de carte unitaire ne produisent pas le même contrat. Le batch appelle `_element` sans la table des matériaux et écrit un document dépourvu de version, de props, de voisins et de couleur de fond. Cela correspond à la majorité du cache observé. Le loader web demande une nouvelle extraction pour les formats anciens ; les **15 593 cartes non cachées ne sont donc pas nécessairement inaccessibles**, puisqu'il existe une extraction à la demande.

En revanche, relancer le batch en l'état ne constitue pas une migration de fidélité. Il faut un constructeur de document commun et une version contrôlée. Le manifeste global `output/manifest.json` décrit encore 17 fichiers de cartes et 33 fichiers d'entités : ses statistiques sont obsolètes par rapport au disque. L'audit a donc recompté les fichiers au lieu de s'y fier.

Les producteurs complets du cache UI, des pictos et des apparences v2 n'ont pas été retrouvés dans cet espace de travail. Plusieurs commentaires référencent d'anciens modules absents, notamment `extractor.ui.list_templates`. À retrouver ou à réintégrer avant de promettre une reconstruction complète depuis une installation neuve.

Les 204 tables DataRoot existent, mais cinq exports contiennent **9 589 références `{rid}` encore brutes** :

| Table | Références non développées dans le cache |
| --- | ---: |
| `itemsets` | 8 089 |
| `mounts` | 731 |
| `alterations` | 723 |
| `guildrightgroups` | 28 |
| `alliancerightgroups` | 18 |

Une lecture en mémoire de leurs bundles avec `inline_rids` actuel ramène chacun de ces nombres à **zéro**, sans écrire dans le cache. C'est donc un gain disponible par régénération ciblée ; il ne demande pas un nouveau déchiffreur. Les infobulles de panoplies, altérations et montures pourront ensuite exploiter ces détails.

Preuves : [cache et tables](audit-2026-09-03/cache-data.json), [réexpansion sans écriture](audit-2026-09-03/data-rid-probe.json).

**7. De petites ressources centrales permettraient une interface plus exacte.**

Le bundle **`gameassets_assets_all.bundle`** mérite un export dédié aux réglages, en complément des UXML :

- `DofusUISettings` contient des références nommées vers les templates, variantes de taille de police, thèmes, curseurs, cellules de grille et fenêtres. Ces relations réduisent les associations manuelles et les collisions de noms.
- `DofusTooltipsSettings` déclare **73 associations de types d'infobulles + 2 supplémentaires**, `m_defaultCreateDelay=0` et `m_defaultTooltipDuration=2500`. Le store web utilise 400 ms par défaut. Les valeurs du ScriptableObject sont certaines ; la latence finale d'une infobulle particulière peut être modifiée par son appelant. Il faut suivre ce chemin avant de remplacer globalement 400 par 0.
- Les presets d'entrée comprennent d'autres groupes que `Menu`, alors que [menu.py](../extractor/ui/menu.py) n'exporte que celui-ci. Élargir aux actions de combat, chat, raccourcis rapides et navigation permettrait de conserver aussi les combinaisons et variantes officielles.

Les arbres exportés contiennent **8 `DofusTweenerVisualElement`, 6 `GravityTweener`, 40 `NoiseParticle` et 25 `StarParticle`**. Certains templates sont déjà chargés par la passerelle UITK, mais cela ne rejoue pas la logique de mouvement de ces composants. Dans le bundle de titre, **56 composants `TitleScreenTweener`** exposent durée, easing, cible, boucles et délai aléatoire. On peut donc récupérer des animations d'interface précises au lieu de proposer des mouvements arbitraires.

L'adaptation USS couvre déjà beaucoup de propriétés, y compris découpes, teinte, états et une partie des transitions. Les propriétés peu fréquentes encore sans traitement explicite comprennent `aspect-ratio`, `unity-text-overflow-position` et `unity-text-generator`. À vérifier sur les écrans concernés, après les chantiers de rendu plus larges. Les dix polices exportées existent ; le sujet typographique restant est surtout la fidélité des métriques et du rendu des textes, à comparer sur captures communes.

Preuves : [comptage UI](audit-2026-09-03/ui.json), [réglages centraux](audit-2026-09-03/candidate-details.json).

**8. Les ornements, quêtes et transitions ont leurs propres ressources animées.**

Le bundle **`ornaments_assets_all.bundle`**, au pluriel, contient **172 définitions et 1 532 Sprite**. Il est distinct des petites icônes `ornament_assets_all.bundle` utilisées dans le catalogue. Ses champs décrivent les parties haut/bas/gauche/droite, positions, ancres, padding, zones colorables, pictogramme de Kolizéum, délai et durée d'animation. Une icône aplatie ne restitue pas cette composition autour du nom d'un personnage.

**`graphics_assets_all.bundle`** contient les définitions `quest` et `swords`, avec **16 animations de quête à 30 FPS** et l'animation des épées à **12 FPS**. Les clips et leurs TextAsset sont présents ; un export dédié de ces indicateurs constitue un bon chantier limité.

**`worldassets_assets_all.bundle`** décrit `FadeTransition`, `IndoorTransition`, `FightTransition` et `Zaap Transition`, avec matériaux, sprites, prefabs et réglages tels que `transitionSpeed=0.25` pour Fade et `0.5` pour Zaap. Ces valeurs ne doivent pas être annoncées comme des durées avant lecture de leur consommateur.

Enfin, **`mapelements_assets_.bundle`** contient un vrai registre de **86 477 définitions**, dont 85 554 `GfxElement` et 923 `AnimatedElement`. Il expose notamment l'origine, la taille, la symétrie, un `entityLook` et les délais minimum/maximum d'animation. Le producteur de carte cherche une table `m_elementsMap` dans la carte elle-même ; il ne charge pas ce registre séparé. Il faut le relier au format qui référence effectivement ces identifiants, sans confondre `elementId`, `gfxId` et `rid`.

Preuves : [inventaire central](audit-2026-09-03/core.json), [exemples et définitions candidates](audit-2026-09-03/candidate-details.json).

**9. Les familles choisies de pictogrammes sont couvertes ; le choix reste incomplet.**

Pour les dix bundles représentés dans l'index pictos, aucun nom de Sprite source n'est absent de cet index. C'est une vérification positive. Le champ `count` de certains groupes est cependant obsolète : par exemple 38 pour les ornements contre 65 Sprite dans la source, avec les noms présents dans le dictionnaire.

Parmi les ressources absentes de cet index : **2 395 portraits de monstres**, **393 icônes d'états de sorts**, **106 challenges en 1x et 2x**, **751 cosmétiques en 1x et 2x**, ainsi que les montures, compagnons, presets, illustrations et habillages de dialogues PNJ. « Absent de cet index » ne signifie pas nécessairement absent de tous les caches : certains éléments peuvent avoir un doublon UI, et les cartes du monde ont leur propre export. L'inventaire [pictos.json](audit-2026-09-03/pictos.json) sépare ces situations.

Les items utilisés par le catalogue viennent du bundle **1x**, majoritairement **64×64**. Le bundle **2x** offre majoritairement **128×128**, mais compte deux Sprite de moins : prévoir une résolution par identité et un repli 1x, pas une substitution globale par nom de fichier.

Le filtrage mérite également d'être conservé comme métadonnée. Le monde et les entités imposent actuellement `nearest`, alors que les textures officielles inspectées comportent d'autres modes, dont `m_FilterMode=2` sur les textures d'effets. L'énumération relue identifie `2=Trilinear`. La documentation décrit le filtrage [Point, Bilinear et Trilinear](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/FilterMode.html). Le bon critère est une comparaison à même zoom et densité de pixels ; activer des mipmaps partout sans reprendre les réglages source n'est pas une validation.

**10. La bibliothèque audio fournit déjà la carte des associations.**

L'installation contient **7 090 banques**, pour environ **1,98 Go**. `AudioManagerLibrary` expose **7 090 entrées de banques, 30 833 événements, 28 bus et 18 paramètres**, avec leurs relations. La table `soundbones`, déjà exportée, contient **7 182 entrées** et associe des animations à des événements, GUID et frames de départ. Les cartes portent en plus `playlistSet` et leurs sons localisés.

Aucun moteur audio de jeu consommant ces données n'a été trouvé dans le client web. **Le premier travail utile est donc l'index banques ↔ événements ↔ animation/carte**, suivi d'une preuve de lecture d'une banque et de sa conversion ou lecture locale. Cet audit ne déclare pas les échantillons audio décompressés ou déchiffrés. Les paramètres d'une éventuelle protection ne sont pas nécessaires dans le rapport.

**11. Ce qui mérite réellement une lecture du code compilé.**

| Cible | Ce que l'on cherche | Situation vérifiée |
| --- | --- | --- |
| `RenderState.Compute` et états étendus | Grammaire des animations, couleurs, filtres et alignement | Noms et pointeurs natifs accessibles |
| `Animator2DCustomisableRenderer` | Display list, substitutions, masquage, couleurs et attachments | Nombreuses méthodes et structures nommées |
| `Custom/DofusMainShader` | Équations de vent, eau, dissolution, émission, blends et stencil | **191 propriétés lisibles**, dont `_FlashBlendMode`, `_UseColorEffects`, `_UseCustomisationColors` |
| MonoBehaviour du player sans type tree suffisant | Réglages de rendu et composants non couverts | 764 lectures rejetées ; liaison MonoScript → schéma à reconstruire |
| Composants UI et fabriques | Délais, valeurs par défaut, contenus construits par C# | Plusieurs classes et paramètres sont lisibles ; certains membres restent obfusqués |

La tentative réelle `Shader.export()` de UnityPy sur `Custom/DofusMainShader` termine par une erreur de taille de buffer. Les petits shaders sondés donnent un export incomplet sans source Metal identifiée. **Les noms de paramètres sont acquis ; le programme shader complet ne l'est pas.** Voir [shader-probe.json](audit-2026-09-03/shader-probe.json). Il faut examiner le format du blob de sous-programmes et les variantes de ce build, puis porter les opérations nécessaires ; aucune preuve ne justifie ici une promesse de récupération intégrale du HLSL d'origine.

Une hypothèse du code mérite d'être corrigée dans la documentation : `resolve_brighten` affirme que les facteurs `(DstColor, One)` et `(SrcColor, One)` n'ont pas d'équivalent WebGL. L'API expose ces facteurs et `blendFunc` ; le problème relève de leur intégration au renderer et du traitement correct de l'alpha et des shaders. La suppression des plaques lumineuses par seuil reste un compromis local, pas une impossibilité fondamentale de WebGL. Référence : [spécification WebGL 1.0.3, blending](https://registry.khronos.org/webgl/specs/1.0.3/).

Les conclusions historiques disant que le protocole ou les chaînes seraient « impossibles » à lire sont trop absolues pour constituer une preuve générale. L'obfuscation et les difficultés déjà constatées restent réelles. Pour cette demande de fidélité, les ressources graphiques, scripts de rendu et données lisibles offrent cependant des bénéfices plus directs ; une récupération exhaustive du protocole n'est pas nécessaire à ces chantiers.

**Séquence de mise en œuvre proposée.**

1. Unifier l'export unitaire et batch, retrouver les producteurs des caches avancés, puis régénérer les cinq tables aux références brutes. Valider une carte et une apparence depuis un répertoire de sortie vide.
2. Ajouter un format de carte conservant les paramètres typés et références d'effets. Exporter les textures d'effets utilisées et produire un rapport explicite des fonctions non rendues.
3. Porter une scène témoin complète, en commençant par lumière/émission et vent ; traiter ensuite eau/réfraction, particules et séquences. `154644` est un témoin déjà riche et familier au projet.
4. Relire `RenderState` et la composition des looks, puis intégrer événements, actions non bouclées, filtres et sous-entités. Utiliser l'échantillon en échec comme corpus de régression.
5. Finir par les ornements, indicateurs de quête, transitions, réglages d'infobulles, ressources 2x et son.

Pour chaque scène témoin, conserver une capture ou une courte séquence officielle et web à même résolution, zoom, état, apparence et instant d'animation. Les scènes proposées incluent `154644` pour vent/vagues/lumière, `54162245` pour la réfraction, `152337` pour les séquences, un personnage équipé dans plusieurs directions, un prop récoltable et une interface avec infobulle et mouvement. Mesurer les éléments absents, l'alignement, les contours, les couleurs et le timing séparément. Aucun score global de fidélité n'est calculé avant ce contrôle.

**Livrables et reproduction.** Le [collecteur d'audit](../extractor/audit_client.py) n'appelle pas les exporteurs de production et écrit seulement les rapports dans la destination fournie. Depuis `client/dofus3` :

```sh
python3 -m extractor.audit_client inventory --dest docs/audit-2026-09-03
python3 -m extractor.audit_client core --dest docs/audit-2026-09-03
python3 -m extractor.audit_client maps --dest docs/audit-2026-09-03
python3 -m extractor.audit_client ui --dest docs/audit-2026-09-03
python3 -m extractor.audit_client animations --dest docs/audit-2026-09-03
python3 -m extractor.audit_client pictos --dest docs/audit-2026-09-03
```

Les fichiers complémentaires `candidate-details`, `cache-data`, `data-rid-probe`, `metadata-targets`, `native-targets`, `shader-probe` et `source-fingerprints` sont les relevés ciblés de cette séance ; ces six commandes ne les régénèrent pas. Ils contiennent les champs, objets ou méthodes utilisés pour les conclusions correspondantes.

Validation exécutée : **34 tests existants réussis** sur le décodeur d'animations, les looks et les props interactifs. Ce résultat vérifie leur corpus actuel ; les 189 clips en échec lors de l'audit montrent précisément ce que ce corpus ne couvre pas encore. Le rapport et les relevés constituent un audit ; les chantiers du moteur décrits ici restent à implémenter.

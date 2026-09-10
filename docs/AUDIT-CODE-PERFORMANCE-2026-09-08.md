**Audit du code, des performances et de la qualité du client Giny — 8 septembre 2026**

Le potentiel d’amélioration est important. Les premiers gains se trouvent dans le travail effectué pour les cartes voisines, les animations calculées hors écran, le chargement des entités, les reconstructions de l’interface et la fiabilité du réseau. Le nettoyage du code mort améliorera surtout la maintenance ; les modules déjà exclus du bundle ne coûtent pas de FPS.

Cet audit porte sur le client React/PixiJS, Electron, les chargements et caches, les effets, les combats, l’interface, l’extraction/préparation Python, le serveur C#, l’ORM et les modules. Aucun correctif applicatif n’a été appliqué. Les builds, les tests et les preuves de l’audit ont été produits localement.

**Périmètre et niveau de preuve**

L’inventaire couvre **3 273 fichiers de code/styles, environ 248 000 lignes**, tests compris, hors dépendances, binaires, caches et sorties de compilation. La lecture approfondie suit les chemins critiques et les candidats repérés par recherche et analyse d’imports. Ce n’est pas une certification de chaque ligne des 2 825 fichiers C#, dont une partie importante est générée. Les sérialiseurs, handlers et modules enregistrés par réflexion ne peuvent pas être déclarés morts sur la seule absence d’un import.

Le graphe TypeScript part de `src/main.tsx` et suit imports, exports, imports dynamiques et workers référencés par `new URL`. Les branches de prévisualisation sont incluses ; le graphe fournit donc des candidats conservateurs. Les fichiers C#, Python, Electron et scripts ont été inventoriés séparément. Les recommandations de performances distinguent mécanisme prouvé, résultat mesuré dans le banc local, et gain restant à mesurer.

Bubble est étudié à partir de `bubble/BubbleGame`, de sa chaîne locale de ressources et du bundle local `resources/app.asar`, déjà utilisé par les scripts d’import du projet. Les entrées compilées sont identifiées par leur SHA-256 et des extraits ciblés. Je n’ai ni son dépôt source complet, ni un benchmark Bubble comparable : aucune supériorité chiffrée n’est affirmée.

**Résultats exécutés**

| Vérification | Résultat actuel | Portée |
|---|---|---|
| Client : `npm run build` | Réussite | Compilation TypeScript et bundle production |
| Client : `npm test` | 628 réussis, 2 échecs, 1 ignoré | 117 fichiers de tests, dont 114 réussis |
| Client : `npm run lint` | Code de sortie 0, 923 avertissements | 833 dans le worker importé de Bubble ; 90 ailleurs, dont 88 dans `src` |
| C# : `dotnet test … --no-restore -m:1 -nodeReuse:false` | 59 réussis, 7 ignorés | Les 7 tests MariaDB nécessitent leur activation dédiée |
| Python système : `python3 -m pytest client/dofus3/tests -q` | 112 réussis, 2 échecs, 4 ignorés | Un échec de contrat d’effets et une dépendance `pymysql` absente |
| Python `.venv-assets` | Ne peut pas lancer pytest | `pytest` absent de cet environnement |
| Playwright : tests de performance existants | Premier test en timeout à 180 s ; suite arrêtée | Deux scènes chargées, première cadence collectée, pas de validation des 30 transitions |
| Reproduction isolée du parseur TCP C# | Défaut reproduit | Paquet incomplet accepté, voir F01 |

Les échecs TypeScript concernent les couleurs des niveaux d’obtention (`hudRepeaters.test.ts:520`) et la liste des couches du HUD (`windows.test.ts:61`). Ils montrent un désaccord entre tests et comportement ; il faut décider du contrat souhaité avant de changer les assertions. Le test Python sur les uniforms attend `frequency` dans une projection qui ne le fournit plus. L’autre échec arrive à l’import de `pymysql`, avant la validation du nom de base : il ne prouve pas un défaut de MariaDB.

**Mesures récupérées dans la trace**

Chromium headless, Vite en développement, viewport 1 920 × 1 080, résolution Pixi 1. Le backend GPU effectif n’a pas été identifié. Ces observations servent au diagnostic et ne sont pas des FPS représentatifs d’Electron sur le PC du joueur. Les pages ont été rechargées entre les cartes ; ce n’est pas une mesure de transition chaude en session réelle.

| Carte | Construction de base `sceneMs` | Construction complète `readyMs` | Appels `drawElements` comptés | Sources du pool retenues | Estimation du pool |
|---|---:|---:|---:|---:|---:|
| 154644 | 984 ms | 3 358 ms | 153 | 552 | 212,0 Mio |
| 153878788 | 1 040 ms | 3 467 ms | 851 | 380 | 145,4 Mio |

Ces mémoires incluent les ressources partagées de la carte et de ses voisines, mais pas toute la RAM/VRAM. Les ressources du pool sont toutes épinglées à ces instants. Les scènes contiennent respectivement 7 683 et 9 137 objets suivis par le culling, dont 3 366 et 4 287 déclarés visibles. Le compteur d’effets de la carte principale relève respectivement 261 et 274 instances.

La première collecte RAF retourne un p50 de 550 ms et un p95 de 667 ms dans ce banc très dégradé. La collecte suivante n’achève pas ses 120 images avant le timeout global. Ces valeurs justifient d’améliorer le banc et d’examiner le coût des scènes, pas d’affirmer que le jeu tourne à 2 FPS sur une machine normale. Les compteurs internes pris juste après le chargement mélangeaient encore des ticks de chargement et très peu de rendus effectifs.

**Ordre de travail recommandé**

| Ordre | Chantier | Résultat attendu | Effort relatif |
|---|---|---|---|
| 1 | TCP, envois complets, diffusion d’acteurs, sauvegardes concurrentes | Éviter corruption, duplication et pertes d’état | Moyen ; tests de non-régression indispensables |
| 2 | Présenter la carte active sans attendre les voisines, propager priorités et annulation | Réduire le délai avant de pouvoir jouer | Moyen à important |
| 3 | Suspendre les effets hors écran et le décor masqué, mutualiser les calculs | Réduire CPU/GPU et les saccades | Moyen, puis travail moteur plus important |
| 4 | Retirer les mises à jour React inutiles ; indexer inventaire/catalogues | Réduire le travail de l’interface au repos | Faible à moyen |
| 5 | Profils graphiques réellement branchés et métriques complètes | Adapter netteté, fluidité et consommation à la machine | Moyen |
| 6 | Généraliser les atlas, corriger les contrats d’effets et la publication | Réduire I/O et corriger la qualité visuelle | Important |
| 7 | Nettoyage des modules morts et découpage architectural | Réduire le risque des évolutions suivantes | Faible à moyen |

Aucun gain en pourcentage n’est promis : les bénéfices doivent être mesurés séparément. P1 signifie à traiter avant de viser un client robuste et fluide ; P2 désigne une amélioration utile ; P3 un nettoyage ou une piste secondaire.

**Constats détaillés**

**F01 — Le parseur TCP accepte des données qui ne sont pas arrivées — P1**

Reproduit. `Client` construit le lecteur sur les 8 192 octets du tampon, sans limiter sa longueur à `BufferPosition`. Un message annonçant 4 octets de payload, dont 2 seulement sont reçus, est accepté avec `AA-BB-00-00` : les deux derniers octets viennent du tampon. La reproduction consomme 11 octets alors que 9 sont arrivés. En outre, la réception suivante repart à l’offset 0, ce qui écrase les restes d’une trame incomplète. Cela peut expliquer des états incorrects, blocages ou déconnexions sans lien avec le GPU. Il faut un accumulateur de réception distinct, des curseurs lecture/écriture, une longueur disponible exacte et un plafond de trame explicite. Tester tous les points de fragmentation, la concaténation de messages et les gros payloads. Ne pas simplement agrandir le tampon.

Preuves : [Client.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/Client.cs:49) · [TcpClient.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/TcpClient.cs:105) · [MessagePart.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/Messages/MessagePart.cs:88).

**F02 — Les envois TCP ne vérifient pas les octets effectivement envoyés — P1**

Constaté dans les chemins Auth/World/IPC. `BeginSend` est lancé et les callbacks se contentent de journaliser ; aucun `EndSend` n’est appelé dans le code inspecté. Les envois partiels et les erreurs asynchrones ne sont donc pas traités. Introduire une file d’envoi par connexion, un buffer conservé jusqu’à la fin et une boucle qui termine chaque trame avant la suivante, avec backpressure. La fréquence du problème doit être mesurée sous charge ; le contrat d’envoi incomplet est déjà visible dans le code.

Preuves : [Client.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/Client.cs:39) · [WorldClient.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Network/WorldClient.cs:143) · [AuthClient.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.Auth/Network/AuthClient.cs:112).

**F03 — L’apparition d’un acteur provoque N² envois — P1**

Constaté. `ShowActor` parcourt chaque personnage, calcule sa vue de l’acteur, puis appelle `Send`, qui rediffuse à tous les personnages. Avec 20 personnages déjà présents, cela produit 400 envois au lieu de 20. Le coût CPU, la sérialisation et le trafic croissent inutilement ; une vue spécifique à un destinataire est aussi envoyée aux autres. Envoyer directement via `character.Client.Send` dans cette boucle. Vérifier le nombre de messages reçus et la personnalisation de leurs données.

Preuves : [MapInstance.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Maps/Instances/MapInstance.cs:142) · [MapInstance.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Maps/Instances/MapInstance.cs:327).

**F04 — La présentation de la carte attend ses quatre voisines — P1**

Constaté et écart de durée mesuré. Le verrou `sceneBuilding` interdit le rendu pendant le chargement. Il n’est levé qu’après personnages, objets animés et `await neighboursReady`. La carte déjà construite reste donc derrière le chargement pendant du travail optionnel. Les mesures locales donnent environ 1 s pour la base et 3,4 s pour la construction complète, sans permettre d’attribuer tout l’écart aux seules voisines. Séparer « carte active prête », « joueur prêt », puis enrichissement périphérique. Construire les voisines hors du chemin bloquant, en les attachant par générations valides. Préserver les tests empêchant de dévoiler l’ancien framebuffer ou une destination partielle.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:659) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:681) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:303).

**F05 — La priorité de chargement se perd dans les entités et les props — P1**

Constaté. Les acteurs distants sont chargés un par un, et les instances de props aussi. Les textures d’un voisin commencent avec la priorité `background`, mais `EntityRenderer.loadTextures` redemande les siennes sans priorité, donc en `active`. Des props périphériques peuvent concurrencer le personnage visible. `createMapScene` attend aussi `loadPropData` sans enveloppe d’annulation, ce qui peut retarder une nouvelle transition qui attend la fin de la précédente. Transmettre un contexte de chargement complet jusqu’aux clips, documents, textures et uploads ; charger les documents distincts avec un petit parallélisme borné, puis préparer les instances selon le temps disponible. Éviter un `Promise.all` illimité de toutes les entités.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:873) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:795) · [mapScene.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/mapScene.ts:321) · [EntityRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/EntityRenderer.ts:414).

**F06 — Les effets hors écran continuent à travailler — P1**

Constaté. Le culling du décor bascule `renderable`, mais `DeformedMapMesh.tick` ne consulte pas cet état. Les props voisins sont animés sans test individuel de visibilité ; les racines de scènes voisines restent généralement actives. On économise certains dessins sans économiser leurs simulations et uploads. Calculer la visibilité des scènes puis des effets, avec une marge conservatrice ; suspendre le calcul des objets hors écran et reconstruire leur pose à partir du temps global à leur retour. Conserver les événements de gameplay indépendants de cette suspension visuelle.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:296) · [mapScene.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/mapScene.ts:312) · [MapEffects.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/MapEffects.ts:82) · [DeformedMapMesh.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/DeformedMapMesh.ts:93).

**F07 — Le vent transforme les sommets sur le CPU à chaque tick — P1**

Mécanisme constaté ; bénéfice GPU à mesurer. Chaque objet possède son maillage, évalue les paramètres et transformations pour chaque sommet, puis met à jour son buffer de positions. Une grille peut atteindre 117 sommets ; la carte principale des deux échantillons comporte plusieurs centaines d’effets actifs. Première étape : précompiler les paramètres, les matrices inverses et les termes communs par objet/image, réutiliser les objets temporaires, et appliquer F06. Ensuite porter les déformations compatibles dans un vertex shader ou des lots de maillages partageant le matériau. Garder les transformations officielles, les pivots et les couleurs comme référence de tests visuels.

Preuves : [DeformedMapMesh.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/DeformedMapMesh.ts:7) · [DeformedMapMesh.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/DeformedMapMesh.ts:100) · [WindState.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/WindState.ts:99).

**F08 — Le préchauffage des particules peut bloquer le chargement — P2**

Constaté. Le constructeur simule jusqu’à 30 secondes de particules de façon synchrone avant de rendre la main. Les limites de particules et de traînées s’appliquent par carte ; elles se multiplient quand les voisines sont actives. Les particules et leurs traînées créent encore des objets, tableaux et sprites, même si une partie est recyclée. Préparer des états de départ hors ligne ou répartir ce préchauffage sur plusieurs tours, ajouter un budget global de scène et un niveau de détail pour les effets lointains. Un mode économique doit réduire les effets sans ralentir la simulation du jeu.

Preuves : [MapParticles.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/particles/MapParticles.ts:90) · [MapParticles.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/particles/MapParticles.ts:331) · [MapParticles.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/particles/MapParticles.ts:288).

**F09 — La réfraction déclenche une capture même sans effet visible — P2**

Constaté. La décision repose sur le nombre d’instances, pas leur intersection avec le viewport. Une réfraction située dans une voisine hors écran suffit donc à demander une capture du monde. Cette capture est bien partagée entre les cartes, ce qui est à conserver, mais les filtres par instance ajoutent leurs propres traitements. Limiter le travail aux effets visibles et mesurer le coût de la capture et des filtres. Permettre une capture de résolution réduite selon le profil. Une texture RGBA de 1 920 × 1 080 coûte à elle seule environ 7,9 Mio à résolution 1, et 31,6 Mio à résolution 2, hors autres buffers.

Preuves : [RefractionPass.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/RefractionPass.ts:137) · [RefractionPass.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/RefractionPass.ts:146) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:306).

**F10 — Le budget de 256 Mio ne représente pas la mémoire de l’application — P1**

Constaté. Le pool compte les sources de textures et n’évince pas celles utilisées. Il ne couvre pas les textures recolorées, les géométries, les render targets, les copies GPU dans plusieurs contextes, les images décodées, les documents retenus par les scènes, ni les caches de skins/bindings non bornés. Plusieurs caches de documents ont en outre leurs propres budgets. Les 212 Mio observés ne sont donc pas une mesure de RAM totale. Définir des propriétaires et compteurs par catégorie, compter les contextes actifs, intégrer les caches secondaires et réduire les ressources périphériques quand les ressources épinglées dépassent le profil. Mesurer les processus Electron renderer/main/GPU et la mémoire JS séparément.

Preuves : [ResourcePool.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/ResourcePool.ts:20) · [textures.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/textures.ts:35) · [EntityRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/EntityRenderer.ts:48) · [previewLook.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/previewLook.ts:13) · [combatAssets.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/combat/combatAssets.ts:28).

**F11 — La recoloration duplique des textures sur le CPU — P2**

Constaté, avec un risque conditionnel de propriété mémoire. Pour chaque entité et couleur indexée, le code dessine une image sur canvas, appelle `getImageData`, modifie tous les pixels, puis crée une nouvelle texture. Les résultats ne sont pas partagés entre entités identiques et échappent au budget principal. Favoriser un matériau de recoloration compatible avec les lots, ou un cache borné par source/palette. Cas à protéger : `bakeIndexed` peut retourner la texture source si le canvas ou `drawImage` échoue ; `destroy()` la traite ensuite comme une texture privée et peut détruire une source partagée. Séparer explicitement ressources empruntées et ressources possédées avant d’étendre les formats compressés aux entités.

Preuves : [EntityRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/EntityRenderer.ts:425) · [EntityRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/EntityRenderer.ts:627) · [EntityRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/EntityRenderer.ts:312).

**F12 — Le cache et la file créent du travail évitable — P2**

Constaté. `trim()` construit, filtre et trie les entrées même si le budget n’est pas dépassé ; il est appelé à chaque chargement et libération. Ajouter le retour rapide sous budget et maintenir un LRU plutôt que retrier. La file trie à chaque insertion, n’a pas de plafond de backlog et ne promeut pas une entrée déjà créée en arrière-plan lorsqu’un utilisateur actif la réclame. Enfin `mapId:background` et `mapId:active` dupliquent le document d’une même carte préparée, et `cancellable` annule l’attente sans annuler son fetch partagé. Coalescer par identité/version du document, préserver séparément la politique d’extraction, et annuler l’opération lorsque son dernier propriétaire disparaît.

Preuves : [ResourcePool.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/ResourcePool.ts:75) · [TaskQueue.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/TaskQueue.ts:29) · [loader.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/maps/loader.ts:21) · [clipLoader.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/clipLoader.ts:30).

**F13 — Les atlas ne couvrent pas uniformément le monde — P1**

Confirmé sur un échantillon de documents actuels. Le pipeline mondial compresse principalement un sprite par ressource. La publication réutilise les atlas des cartes déjà préparées. Les cartes habituelles du benchmark ont 6–12 textures dans leur table gfx, mais des cartes réparties dans le manifeste ont encore 71/71, 123/123, 100/100 ou 89/89 sprites/textures distinctes. Cela ne signifie pas que toutes sont chargées ou dessinées, mais révèle la fragmentation des ressources. Étendre les atlas par zone/co-visibilité, avec limites de taille, marges entre sprites, variantes compressées et index partagé. Ne pas faire un atlas géant mondial qui chargerait trop de pixels inutiles. Élargir le corpus de performance au-delà des cartes déjà favorisées.

Preuves : [prepare-world-textures.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/scripts/prepare-world-textures.py:11) · [publish-world.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/scripts/publish-world.py:45) · [mapScene.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/mapScene.ts:106).

**F14 — Le catalogue du HUD recharge un ensemble massif sans coalescence — P1**

Constaté. Chaque montage du HUD relance 28 requêtes puis reconstruit index et noms, sans promesse partagée au niveau de `loadGameCatalog`. Le mode strict de développement accentue les doubles appels, et une nouvelle connexion refait ce travail. L’encyclopédie charge à son tour items, territoires et i18n par un autre chemin. Mutualiser le catalogue par version, charger un noyau pour le HUD et différer recettes/succès/bestiaire jusqu’à leur ouverture. Conserver les index locaux plutôt que recopier les mêmes tables. Mesurer parsing, hydratation et mémoire retenue, pas seulement les octets transférés.

Preuves : [catalog.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/catalog.ts:680) · [GameHud.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/GameHud.tsx:149) · [encyclopedia.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/encyclopedia.ts:23).

**F15 — Des statistiques non affichées font rerendre le HUD au repos — P1**

Constaté ; correction à faible effort. Le moteur appelle `setStats` toutes les 500 ms alors que la valeur est ignorée par `WorldView`. Chaque objet reçu déclenche un rendu React, réévalue `hudFromSession` et recrée les props/callbacks du HUD. Déplacer les statistiques dans une référence ou dans un panneau de diagnostic abonné uniquement quand il est visible. Stabiliser ensuite les props des sous-arbres coûteux. Vérifier au profiler que le HUD stable cesse de committer sans événement utile.

Preuves : [WorldView.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/WorldView.tsx:31) · [WorldView.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/WorldView.tsx:92) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:323).

**F16 — Les bindings d’inventaire recalculent la même sélection pour chaque nœud — P2**

Constaté. Le resolver d’inventaire filtre tout le sac à chaque binding et recherche l’équipement pour les slots ; le coût se multiplie par les nœuds rendus. L’encyclopédie reconstruit des index et trie des collections dans son calcul de présentation. La recherche d’un niveau de sort aplatie toutes les listes. Préparer une vue immuable par snapshot : sac filtré, équipement par position, objets et niveaux de sorts par ID, noms normalisés pour la recherche. Conserver les filtrages interactifs par clé de critères. Priorité à ces répétitions avant de remplacer l’A* des seules 560 cases.

Preuves : [hudWidgets.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/hudWidgets.ts:282) · [encyclopedia.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/encyclopedia.ts:75) · [catalog.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/catalog.ts:463).

**F17 — Les arbres UI sont reparsés et les stores de fenêtres sont trop globaux — P2**

Constaté. `loadTree` ne possède ni cache de documents parsés ni coalescence ; les fenêtres chargeant le même template le redemandent et le reparsent. Chaque `OfficialWindowNode` lit les snapshots globaux de layout, empilement et tailles : une modification d’une fenêtre réveille les autres abonnés. Ajouter un cache versionné de templates immuables, cloner seulement ce qui est modifié, et des abonnements avec sélection par fenêtre. Mutualiser aussi la mesure du viewport. Vérifier les ouvertures répétées, le drag avec plusieurs fenêtres et les arbres volumineux au profiler.

Preuves : [treeLoader.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/official/treeLoader.ts:52) · [OfficialWindow.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/official/OfficialWindow.tsx:537) · [treeLoader.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/official/treeLoader.ts:42).

**F18 — Les portraits animés multiplient les contextes WebGL — P2**

Constaté. Chaque aperçu visible crée une application Pixi et son contexte ; plusieurs portraits peuvent donc dupliquer les uploads GPU d’une source pourtant partagée en JS. Les miniatures statiques utilisent aussi temporairement un contexte, puis une conversion synchrone `toDataURL`. L’IntersectionObserver et la file des miniatures sont déjà de bons garde-fous. Utiliser un renderer de vignettes partagé, privilégier les previews préparées sans charger d’abord le document complet, et borner les variantes par octets. Pour les aperçus animés, limiter le nombre simultané et leur cadence. Mesurer la mémoire lorsque l’inventaire, la création et des portraits sont ouverts ensemble.

Preuves : [EntityPreview.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/EntityPreview.tsx:31) · [EntityPreview.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/EntityPreview.tsx:79) · [previewLook.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/previewLook.ts:24).

**F19 — Le combat force des rendus continus et conserve du travail masqué — P2**

Constaté. La présence d’un combat remet `dirty=true` à chaque tick. Les contrôleurs du joueur et des acteurs de l’exploration continuent à être avancés avant le contrôle de visibilité, même quand leurs représentations sont cachées. Plusieurs animations de combat possèdent en plus des intervalles à 16 ms. Le mode tactique masque le décor mais ne suspend pas automatiquement ses calculs d’effets. Faire remonter un booléen « visuel changé » depuis le combat, centraliser ses animations sur une horloge commune et suspendre les représentations masquées. Maintenir séparément les confirmations réseau et la résolution des séquences quand la fenêtre est cachée.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:298) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:283) · [CombatScene.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/combat/CombatScene.ts:240).

**F20 — Des effets déclarés supportés ne sont pas appliqués visuellement — P1**

Constaté par les consommateurs réels. La table Python marque notamment postprocess, séquences et wave comme supportés. Pourtant les paramètres `postProcess` sont adaptés sans consommateur de rendu ; `MapEffectSequence` stocke des événements dont `drain()` n’est jamais appelé par le moteur ; `needsWaveMaterial` et les fichiers de shaders correspondants sont inutilisés. Un uniform attaché à un Sprite standard ne devient pas un shader exécuté. Distinguer dans la couverture « extrait », « interprété », « appliqué », « validé visuellement ». Compléter les branches effectivement manquantes, en commençant par des cartes témoins. Le vent, certaines particules, la réfraction et les animations existantes ne doivent pas être remis à zéro pour autant.

Preuves : [effects.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/dofus3/extractor/maps/effects.py:65) · [MapEffectSequence.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/MapEffectSequence.ts:63) · [MapEffects.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/MapEffects.ts:86) · [adapter.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/maps/adapter.ts:275) · [WindState.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/WindState.ts:188).

**F21 — Les réglages graphiques ne pilotent pas encore le moteur — P1**

Constaté. Le monde démarre avec antialiasing désactivé, résolution 1 par défaut et 2 seulement via `?quality=high`. Les textures sont systématiquement en nearest, sans mipmaps. C’est économique mais peut produire du crénelage et du scintillement au zoom ; le choix ne convient pas uniformément au décor et à l’UI. Les options générales sont surtout mémorisées localement et la section Affichage n’expose pas un profil moteur complet. Introduire des profils Économie/Équilibré/Qualité réellement branchés : plafond FPS, arrière-plan, résolution du monde, effets, distance de détail, filtres et budgets. Pour les atlas, ne pas activer des mipmaps sans préparer les bordures. Préserver les textes de l’interface lorsque la résolution du monde baisse.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:236) · [textures.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/textures.ts:37) · [OptionsWindow.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/OptionsWindow.tsx:34) · [OptionsWindow.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/OptionsWindow.tsx:117).

**F22 — Les échecs temporaires de chargement peuvent rester mémorisés — P2**

Constaté. Une carte ayant échoué reste dans `failedMapIds` et les rafraîchissements ordinaires de session ne la réessaient pas. Les manifestes préparés convertissent une erreur initiale en `null` conservé pour la session, et les styles de composants ne réessaient pas après leur premier échec. La réparation des fichiers sur disque n’est donc pas toujours visible. Ajouter une invalidation par version, des tentatives bornées avec délai, un retry explicite et une distinction entre absence définitive connue et erreur temporaire. Un retry doit rester annulable quand l’utilisateur quitte la carte.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:359) · [prepared.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/assets/prepared.ts:6) · [clipLoader.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/entities/clipLoader.ts:13) · [stylesheet.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/official/stylesheet.ts:106).

**F23 — Les logs réécrivent tout l’historique pendant les interactions — P2**

Constaté. Chaque clic, événement réseau ou erreur sérialise et écrit jusqu’à 2 000 entrées dans `localStorage`, une opération synchrone sur le thread de l’interface. Le journal borné reste utile, mais sa persistance ne doit pas ralentir une transition ou une rafale d’événements. Regrouper les écritures avec un délai court, puis vider le tampon lors d’un événement de fermeture approprié ; garder une écriture rapide ciblée pour les erreurs critiques. Mesurer les longues tâches avec un historique rempli.

Preuves : [sessionLogger.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/debug/sessionLogger.ts:28) · [sessionLogger.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/debug/sessionLogger.ts:26) · [main.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/main.tsx:8).

**F24 — Electron sonde les fichiers synchroniquement et met tout en cache immutable — P2**

Constaté. Le cache de résolution conserve tous les chemins, mais refait un `statSync` même sur un hit. Les racines de secours amplifient les sondes. Les réponses lisent les fichiers entiers et décompressent les JSON en mémoire dans le processus main. Surtout, tous les fichiers reçoivent un cache d’un an immutable, y compris ceux dont le nom est mutable ; le serveur Vite est plus sélectif. Construire un index de release, limiter les sondes bloquantes, diffuser les gros fichiers par flux et réserver immutable aux noms à contenu hashé. Mettre une politique cohérente sur manifestes, arbres UI et données de combat. Les caches de chemins doivent être bornés ou invalidés par génération de release.

Preuves : [main.mjs](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/electron/main.mjs:62) · [main.mjs](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/electron/main.mjs:72) · [main.mjs](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/electron/main.mjs:183) · [main.mjs](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/electron/main.mjs:185).

**F25 — Les métriques et tests de performance peuvent annoncer un faux succès — P1**

Constaté, corroboré par la trace. `loadMs` s’arrête avant les acteurs/props/voisines, et `readyMs` précède encore la première présentation réelle. Le compteur FPS du ticker et son historique ne sont pas un décompte de frames présentées ; ils mélangent chargement et rendu. L’interception ne compte que `drawElements`, pas toutes les familles de draw calls. Le test nommé « render targets bounded across map changes » ne change pas de carte et vérifie seulement une valeur ≥ 0, ce qui accepte aussi un effet absent. Le test de cadence capture le snapshot avant sa période d’échantillonnage. Mesurer temps avant première image, temps avant interaction, temps CPU/GPU, p95/p99 après chauffe, octets uploadés et mémoire totale. Ajouter de vrais seuils par corpus et des transitions observées. Conserver les résultats même en cas de timeout.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:657) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:683) · [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:1627) · [map-effects-performance.spec.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/e2e/map-effects-performance.spec.ts:26) · [performance.spec.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/e2e/performance.spec.ts:15).

**F26 — Le SQL partage une connexion et un verrou global — P2**

Constaté ; contention à quantifier sous charge. Chaque accès au provider fait un `Ping`, et les écritures utilisent une connexion commune protégée par un verrou global. Une sauvegarde ou une opération de module peut retarder toutes les autres. Mesurer attentes de verrou, nombre de requêtes et durée des snapshots avant refonte. Ensuite utiliser des connexions du pool par opération/transaction et un ordonnanceur cohérent pour les mutations du jeu. Retirer le verrou sans changer le partage de connexion et les garanties transactionnelles introduirait des erreurs.

Preuves : [DatabaseManager.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/DatabaseManager.cs:48) · [DatabaseManager.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/DatabaseManager.cs:52) · [DatabaseWriter.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/IO/DatabaseWriter.cs:67).

**F27 — La sauvegarde périodique peut acquitter une modification plus récente — P1**

Risque de concurrence démontré par le chemin de code, non reproduit sous MariaDB. La sauvegarde copie les listes de références, écrit en SQL, puis retire les éléments acquittés. Si le même record est modifié entre l’écriture et ce retrait, `UpdateElement` constate qu’il est déjà présent et n’ajoute pas de nouvelle entrée. Le retrait final peut donc effacer la nouvelle demande de sauvegarde. Le verrou `SaveLock` sérialise les sauvegardes entre elles, pas les producteurs d’updates. Utiliser une version de saleté ou échanger atomiquement la file avant de persister, avec snapshots cohérents et réinsertion des échecs. Ajouter un test qui bloque l’écriture puis modifie le record avant l’acquittement. Préserver la rétention actuelle des lots en échec.

Preuves : [CyclicSaveTask.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/Cyclic/CyclicSaveTask.cs:112) · [CyclicSaveTask.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/Cyclic/CyclicSaveTask.cs:47) · [CyclicSaveTask.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/Cyclic/CyclicSaveTask.cs:169).

**F28 — Les lots ORM et certains index produisent des coûts quadratiques — P2**

Constaté. Les commandes UPDATE concatènent des chaînes successives ; les DELETE font une commande par élément ; les files de sauvegarde dédupliquent et retirent dans des listes ; certaines recherches par personnage scannent tous les objets. Construire les commandes une fois avec un StringBuilder, limiter les lots, grouper les suppressions dans le cadre transactionnel approprié, utiliser des ensembles/index par clé stable et maintenir un index des objets par propriétaire. Pour les modules GuildCamp/Pokefus/Quests, commencer par les requêtes et l’ORM commun : ne pas sacrifier les transactions et verrous métier existants pour paralléliser à l’aveugle.

Preuves : [DatabaseWriter.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/IO/DatabaseWriter.cs:149) · [DatabaseWriter.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/IO/DatabaseWriter.cs:165) · [CyclicSaveTask.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/Cyclic/CyclicSaveTask.cs:61) · [CharacterItemRecord.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Records/Items/CharacterItemRecord.cs:86).

**F29 — Le dispatch des messages ignore l’accès direct du dictionnaire — P2**

Constaté. Chaque message parcourt le dictionnaire avec `FirstOrDefault`, puis passe par `DynamicInvoke`. Employer `TryGetValue` et préparer un délégué/adaptateur typé à l’enregistrement supprime ce travail répétitif. Les constructeurs de messages sont déjà précompilés : conserver ce principe. C’est une optimisation ciblée après la correction de framing ; elle ne changera pas directement les FPS d’un client isolé.

Preuves : [ProtocolMessageManager.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/Messages/ProtocolMessageManager.cs:182) · [ProtocolMessageManager.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Network/Messages/ProtocolMessageManager.cs:189).

**F30 — Le rechargement d’une map peut laisser son ancien timer actif — P2**

Constaté pour le chemin Reload. `Reload` remplace `m_monsterSpawner` sans arrêter/détruire l’ancien timer. Si celui-ci tournait, il peut continuer à appeler l’instance et conserver ses références. Mettre en place un cycle de vie idempotent et détruire l’ancien timer avant remplacement. `ActionTimer.Dispose` suppose aussi un stopwatch déjà créé ; sa robustesse doit couvrir un timer jamais démarré. Tester un reload répété d’une carte occupée. Les timers des cartes vides sont déjà mis en pause : il ne faut pas conclure que tout le monde simule continuellement.

Preuves : [MapInstance.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Maps/Instances/MapInstance.cs:121) · [MapInstance.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Maps/Instances/MapInstance.cs:76) · [ActionTimer.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.Core/Time/ActionTimer.cs:82).

**F31 — La réconciliation périodique renvoie des snapshots complets — P2**

Constaté. Le HUD est redemandé toutes les 2 secondes et les acteurs toutes les 4 secondes, en plus des événements poussés. Le snapshot de personnage reconstruit notamment inventaire, sorts, effets, métiers et guilde. À grande population cela augmente CPU, allocations, trafic et rerenders. Conserver une réconciliation de secours, mais ajouter version/hash d’état et réponses inchangées légères, compléter les pushes manquants puis espacer le polling. Le polling du HUD tient déjà compte de la visibilité ; celui des acteurs mérite le même traitement. Vérifier surtout équipements, combat, portes et reconnexions avant d’enlever ce filet.

Preuves : [GinyClient.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/giny/GinyClient.ts:489) · [WorldView.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/WorldView.tsx:121) · [ModernCharacterSnapshot.cs](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Modern/ModernCharacterSnapshot.cs:47).

**F32 — Une extraction après mise à jour peut garder les anciens pixels — P1**

Constaté dans le pipeline incrémental. La phase gfx détecte qu’un bundle a changé, relit ses sprites et actualise le catalogue, mais n’écrit le PNG que si la destination n’existe pas. Un sprite modifié gardant le même ID peut donc conserver ses anciens pixels alors que les métadonnées et la signature du bundle deviennent nouvelles. Régénérer les sorties dépendantes lorsqu’une signature change, ou utiliser des noms hashés et une provenance par sortie. Tester deux versions d’un même sprite avec le même ID. Les écritures atomiques et checkpoints existants sont utiles et doivent rester.

Preuves : [extract-world.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/dofus3/scripts/extract-world.py:41) · [extract-world.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/dofus3/scripts/extract-world.py:65).

**F33 — Les rapports de publication ne prouvent pas la couverture visuelle actuelle — P1**

Constaté. Le manifeste actuel compte 17 353 cartes et 786 entités ; le rapport de release existant parle encore de 670 entités et de 31 cartes avec atlas réutilisé. Ses listes de manques ne sont donc pas une validation fraîche. `verify-world-effects.py --limit` peut retourner 0 même si son rapport contient des erreurs ; sa validation porte surtout sur présence/version des fichiers, pas sur l’effet réellement rendu. Regénérer un rapport cohérent avec la même révision que les manifestes, vérifier les dépendances et hashes avant publication, faire échouer tout lot contenant une erreur, et intégrer les préparations complémentaires dans une commande de release claire. Revalider les données sans annoncer les anciens nombres de manques comme l’état visuel actuel.

Preuves : [publish-world.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/scripts/publish-world.py:101) · [verify-world-effects.py](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/scripts/verify-world-effects.py:87) · [build-world.mjs](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/scripts/build-world.mjs:15).

**F34 — Le code mort et les doublons doivent être séparés des outils de test — P2**

11 modules non atteignables confirmés par graphe et recherches. Les 11 modules listés plus bas représentent 918 lignes. Le nouvel aperçu d’inventaire utilise l’arbre officiel, laissant l’ancien ensemble de composants sans entrée. Le deuxième store de thème est remplacé par `ui/official/themeStore`. Les shaders non importés et la file d’événements de particules doivent être retirés ou raccordés selon le chantier F20. Le worker de dégâts, la géométrie Bubble importée, les fixtures et les hooks réservés aux tests ne sont pas à supprimer parce qu’ils sont générés ou non appelés en production. Le composant mort `VirtualItemGrid` rend d’ailleurs toutes les cellules : son nom ne prouve pas une virtualisation actuelle.

Preuves : [InventoryView.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/windows/inventory/InventoryView.tsx:12) · [InventoryPreview.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/windows/inventory/InventoryPreview.tsx:21) · [themeStore.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/themeStore.ts:49) · [ParticleEvents.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/particles/ParticleEvents.ts:14).

**F35 — La structure du code complique les optimisations sûres — P2**

Constaté. `GameRenderer` atteint 1 666 lignes, `windowChrome` 1 226, `GinyClient` 835 ; rendu, chargement, entrée utilisateur et état réseau sont fortement imbriqués. `App` importe statiquement les écrans et plusieurs outils de prévisualisation. Le bundle principal produit 1 298 kB de JS et 794 kB de CSS minifiés ; le JS gzip fait 371 kB. Découper par responsabilités et écrans chargés à la demande, compiler les adaptations UI stables hors du runtime, et auditer les CSS avec couverture d’usage sur plusieurs écrans avant suppression. TypeScript active les checks d’inutilisés mais pas `strict` dans sa configuration actuelle ; l’introduire progressivement sur les frontières réseau/assets. Le manifeste `package.json` racine est celui de Bubble, sans scripts Giny : clarifier les points d’entrée du projet et les manifestes de référence.

Preuves : [GameRenderer.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/renderer/GameRenderer.ts:89) · [windowChrome.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/official/windowChrome.ts:1) · [GinyClient.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/giny/GinyClient.ts:67) · [App.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/App.tsx:1) · [tsconfig.app.json](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/tsconfig.app.json:20).

**F36 — La base de validation doit couvrir le jeu réel et les ressources réelles — P1**

Résultats exécutés et lacunes observées. Rétablir les contrats des 4 tests en échec sans masquer les comportements, rendre les environnements Python reproductibles et séparer le lint du worker importé. Le banc général lance Vite en développement ; le benchmark Electron d’effets dépend d’un mode et d’un corpus particuliers. Il faut un parcours production Electron instrumenté qui démarre, change de carte, ouvre le HUD, combat, perd le focus puis revient, sans serveur fictif pour les validations finales de session. Publier les artefacts en cas d’échec, vérifier les ressources requises au départ et définir des seuils réalistes par machine. Les tests unitaires réussis ne valident pas la VRAM, les timers de longue durée ni la fidélité de tous les effets.

Preuves : [playwright.config.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/playwright.config.ts:19) · [performance.spec.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/e2e/performance.spec.ts:11) · [map-effects-performance.spec.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/e2e/map-effects-performance.spec.ts:7) · [requirements.txt](/Users/hugo/Downloads/Giny.NETCore-2.68/client/dofus3/requirements.txt:1) · [tsconfig.app.json](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/tsconfig.app.json:1).

**Inventaire du code mort et des éléments à nettoyer**

Les chemins suivants ne sont pas atteignables depuis l’entrée du client, y compris les imports statiques des previews et le worker BC7. Il s’agit de code conservé sur disque, pas de 918 lignes nécessairement présentes dans le bundle final.

| Module | Lignes | Décision proposée |
|---|---:|---|
| [src/game/effects/shaders/mapDeformation.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/shaders/mapDeformation.ts:1) | 38 | Raccorder avec preuve visuelle ou retirer |
| [src/game/effects/shaders/refraction.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/effects/shaders/refraction.ts:1) | 17 | Raccorder avec preuve visuelle ou retirer |
| [src/game/particles/ParticleEvents.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/game/particles/ParticleEvents.ts:1) | 36 | Conserver comme expérimentation explicite ou raccorder ; utilisé seulement par les tests |
| [src/ui/themeStore.ts](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/themeStore.ts:1) | 70 | Conserver un seul store de thème |
| [src/ui/bubble/components/controls.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/components/controls.tsx:1) | 161 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/components/GameWindow.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/components/GameWindow.tsx:1) | 142 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/components/ItemTile.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/components/ItemTile.tsx:1) | 92 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/components/VirtualItemGrid.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/components/VirtualItemGrid.tsx:1) | 46 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/windows/inventory/EquipmentPanel.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/windows/inventory/EquipmentPanel.tsx:1) | 80 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/windows/inventory/StoragePanel.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/windows/inventory/StoragePanel.tsx:1) | 118 | Retirer le sous-ensemble historique de l’inventaire |
| [src/ui/bubble/windows/inventory/InventoryView.tsx](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/bubble/windows/inventory/InventoryView.tsx:1) | 118 | Retirer le sous-ensemble historique de l’inventaire |

Autres candidats vérifiés par recherche : `resolveDataRoot` dans Electron ; l’alias `loadTextures` de `mapScene` ; `markNearest` ; `effectTextureUrl` ; `effectTexturePathQualified` ; `needsWaveMaterial` ; `mapEffectsSourceHasTimers`. Pour `needsWaveMaterial`, la bonne décision dépend de la mise en œuvre du shader manquant. Les exports sans consommateurs externes mais encore appelés dans leur propre fichier peuvent simplement devenir privés.

Le graphe produit 26 déclarations exportées sans référence de symbole détectée, interne ou externe, tests compris ; plusieurs appartiennent aux 11 modules déjà listés. Ce nombre est une liste de candidats, pas un second total de suppressions. Le JSON complet conserve aussi les exports utilisés uniquement par les tests, qui doivent rester distingués. En C#, `HighPrecisionTimer` n’a pas d’utilisation trouvée : son SpinWait est un candidat de nettoyage, **pas une explication démontrée de la consommation actuelle**. Les handlers et records découverts par réflexion sont exclus de toute suppression automatique.

Ne pas supprimer des ressources dans `public`, les arbres UI, les packs ou les CSS par simple recherche textuelle : beaucoup de noms sont calculés depuis les catalogues. Ne pas confondre outils de migration/import ponctuels et code mort de l’application. La racine n’est pas un dépôt Git ; `client/dofus3` contient un dépôt imbriqué avec de nombreuses modifications préexistantes. Établir une sauvegarde/version de référence avant une future opération de nettoyage massive.

**Ce qui fonctionne déjà et mérite d’être conservé**

- Le contexte du monde et le personnage principal survivent aux changements de carte ; les protections par génération évitent plusieurs races de chargement.
- Le pool à leases empêche d’évincer une texture encore utilisée ; les tests sur les propriétaires et la destruction sont utiles.
- La décompression des blocs BC7 passe par un worker, avec transfert du buffer et un repli lossless.
- Les clips d’animation sont chargés à la demande et plusieurs caches de documents sont bornés.
- Le moteur évite certains rendus lorsque la scène est stable, limite la cadence sans focus et possède déjà du culling statique.
- Les particules recyclent des sprites et bornent le nombre de particules/traînées par carte ; la réfraction partage sa capture.
- Le login compose ses bandes sur des surfaces bornées et nettoie ses images ; la minimap utilise les tuiles du monde avec sélection du viewport.
- La préparation Python dispose de signatures, checkpoints, écritures atomiques et workers bornés. L’extraction runtime est désactivée par défaut.
- Les modules possèdent des protections transactionnelles et le cycle de sauvegarde retient les lots SQL en échec. Ces garanties ne sont pas des optimisations à retirer.

**Ce qu’il est utile de reprendre de Bubble**

| Observation vérifiée dans le bundle local | Application à Giny | Précaution |
|---|---|---|
| Profils low/medium/high avec FPS, échelle de rendu, antialiasing, effets et densité d’acteurs | Un store graphique unique qui pilote effectivement Pixi et les previews | Les budgets Bubble ne sont pas automatiquement adaptés à Pixi |
| Budgets de textures d’entités par profil, pages d’atlas limitées et compteurs par catégorie | F10, F13, F21 : gestion mémoire du moteur entier | Distinguer octets JS, sources et allocations de chaque contexte GPU |
| Ressources détenues/libérées/archivées avec compteurs d’upload et d’éviction | Caches à propriétaire explicite et réutilisation entre transitions | Mesurer le coût des reuploads et éviter les thrashs de cache |
| Scheduler critical/interactive/preload, backlog et statistiques d’attente | F05/F12 : priorité jusqu’au bout et promotion d’une demande devenue visible | Une file prioritaire sans budget de temps CPU ne suffit pas |
| Préparation de carte puis commit associé à une session | F04 : préparation annulable et présentation maîtrisée | Garder la carte centrale indépendante de la finition des voisines |
| Lots de rendu et chemin `drawElementsInstanced` | Réduire les dessins d’entités et effets compatibles | Réécrire le moteur complet serait un chantier distinct, sans gain garanti |
| Diagnostics de timing, textures, ressources retirées et mémoire renderer | F25/F36 : budgets et preuves consultables | Comparer des parcours et appareils identiques |

Giny a déjà repris des éléments utiles de Bubble, notamment géométrie tactique, prévisualisation de sorts et worker de dégâts. L’étape suivante la plus rentable concerne la gestion des chargements et des ressources, pas une copie supplémentaire de composants d’interface.

**Plan de validation pour les futurs correctifs**

1. Établir un point de référence sur Electron production et sur la machine cible : matériel, backend GPU, résolution physique/CSS, DPR, profil, corpus et version d’assets.
2. Capturer séparément login, entrée initiale, transition froide, transition chaude, retour sur une carte visitée, voisin manquant, acteur absent et deux changements rapides. Définir première image, contrôle rendu à l’utilisateur et finition des voisins.
3. Étendre le corpus : les trois cartes du test existant, plusieurs cartes sans atlas regroupés, intérieur, réfraction, nombreuses particules, foule et combat. Réutiliser les cartes témoins des tests d’effets.
4. Mesurer après chauffe le p50/p95/p99 et les longues frames, CPU par processus, mémoire JS, sources décodées, textures/render targets, uploads, tailles du backlog et nombre de contextes. Ne pas déduire la VRAM à partir du seul heap JS.
5. Réaliser 100 transitions et une session de 30–60 minutes, avec ouverture/fermeture répétée d’inventaire et de portraits. Chercher un plateau après chauffe, puis vérifier les ressources libérées après déconnexion. Ces essais n’ont pas été exécutés dans cet audit.
6. Comparer les images et animations à temps déterministe : pivots, couleurs, transparence, zoom, bords de carte, vent, refraction, particules, placement tactique et mouvements. La présence d’une texture ne prouve pas la fidélité du shader.
7. Ajouter côté serveur fragmentation/coalescence TCP, backpressure d’envoi, nombre de diffusions par acteur, sauvegarde concurrente et reload de timer. Activer les tests SQL dans une base isolée avant toute refonte de l’ORM.

Pour une cible à 60 FPS, 16,7 ms est le budget théorique d’une image. Les seuils de chargement et de mémoire doivent ensuite être fixés avec le corpus et les profils matériels ; les chiffres du banc headless de cet audit ne conviennent pas comme seuils de production.

**Preuves livrées**

- [Inventaire des fichiers et tailles](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/inventory.json)

- [Graphe et candidats inutilisés](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/import-graph.json)

- [Analyseur TypeScript reproductible](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/analyze-imports.cjs)

- [Mesures décodées de la trace Playwright](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/runtime-samples.json)

- [Échantillon de cartes hors corpus habituel](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/map-document-sample.json)

- [État des manifestes et décalage du rapport de release](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/asset-summary.json)

- [Extraits du bundle Bubble avec SHA-256 et offsets](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/bubble-evidence.json)

- [Reproduction isolée du parseur TCP](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/TcpProbe.cs)

- [Résultat de la reproduction TCP](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/tcp-reproduction.log)

- [Build client](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/build.log)

- [Tests client](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/vitest.log)

- [Lint client](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/lint.log)

- [Tests C#](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/dotnet.log)

- [Tests Python](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/pytest-system.log)

- [Lancement du benchmark](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/code-2026-09-08/e2e.log)

La trace Playwright complète et sa capture restent dans le répertoire `client/web/test-results/performance-records-local-map-loading-and-frame-cadence-chromium`. Les résultats historiques sous `output/performance` n’ont pas été utilisés comme mesures nouvelles.

# Rendu des maps : Bubble/Stasis et Giny

Audit du 5 septembre 2026. Client Giny actif : `client/web` (React, PixiJS, Electron). Référence Bubble : archive locale `resources/app.asar`, version 0.1.328, et ressources de `bubble/BubbleGame`. L'archive contient les fonctions Stasis ; aucune seconde implémentation indépendante de Stasis n'a été identifiée.

**Recommandation : conserver PixiJS à ce stade et adopter une chaîne de ressources préparées à l'avance, des caches bornés, des atlas et des textures compressées côté GPU.** Le build Bubble montre une infrastructure beaucoup plus spécialisée. Son intérêt vient de cet ensemble, pas simplement du choix d'un moteur ou d'une compression de fichiers.

Les constats viennent du code livré et de fichiers réels. Pas de benchmark comparatif en jeu : les gains en FPS, temps de transition et consommation totale restent à mesurer. Aucun changement au moteur n'est effectué dans cet audit. Les tailles et extraits probants sont conservés dans [le relevé JSON](AUDIT-RENDU-MAPS-BUBBLE-GINY-2026-09-05.json).

## Comparaison

| Sujet | Bubble livré | Giny actuel | Conséquence |
| --- | --- | --- | --- |
| Moteur des maps modernes | Map3, rendu WebGL2 spécialisé, buffers statiques/dynamiques, plans de matériaux | PixiJS WebGL ; un Container et un Sprite par élément | Pixi sait déjà regrouper les sprites, mais notre structure et nos textures séparées ajoutent du travail |
| Données de maps | Binaire MessagePack ; variantes `.bin.br` et `.bin.gz` ; adaptation en structures de scène | JSON, adaptation JS ; lecture/extraction avant chargement | Préparer les données évite la conversion coûteuse lors d'une découverte de map |
| Textures | Profil KTX2/BC7 ; blocs assemblés en atlas background/sortable/foreground | PNG individuels par GFX, chargement par `Assets.load` | Beaucoup de ressources distinctes ; pas de compression GPU explicite dans notre pipeline |
| Compatibilité | Détection BC7 ; repli sur packs et atlas d'images ; plusieurs cibles de transcodage dans libktx | PNG | BC7 doit rester conditionnel au GPU ; prévoir un repli |
| Compression des textures | Supercompression Zstd des KTX2 ; worker natif BC7 au sens « blocs BC7 directs », pas programme natif séparé | PNG ; support gzip de certains documents disque | Compression sur disque et compression en VRAM répondent à deux problèmes différents |
| Distribution | Manifeste adressé par SHA-256, packs avec offsets/longueurs, lectures par plages, plans d'installation | Fichiers locaux extraits de l'installation officielle | On peut préparer nos packs localement, sans ajouter de téléchargement en jeu |
| Préchargement | Voisins après 2 s d'inactivité, au plus 2 tâches, annulation ; seuil de contrôle mémoire | Deux constructions de voisins en parallèle ; préchargement au bord ; gardes de génération | Giny a déjà une base, mais les traitements abandonnés ne sont pas systématiquement annulés |
| Mémoire | Caches avec comptage en octets, libération explicite, profils de qualité | Cache de documents maps sans limite ; sources `Assets` conservées lors des changements | Définir une durée de vie et un budget, au-delà du ramasse-miettes Pixi |
| Personnages/props | Batcher acteur WASM, buffers persistants et chemins de dessin regroupés | Meshes explicitement `no-batch` | Les maps peuplées peuvent être coûteuses même si le décor est optimisé |

## La compression réellement observée

Le manifeste indique `raw-concat-v1` pour les packs de distribution : ils concatènent des ressources. Un `.pack` ne constitue donc pas, en soi, un algorithme de compression.

Le GFX Bubble `map3/textures-ktx-bc7/mapgfx/20109.ktx2` a été lu depuis son pack et son SHA-256 vérifié. Son en-tête indique :

- format Vulkan 145 : BC7 UNORM ;
- dimensions 1 024 × 1 012, un niveau ;
- supercompression 2 : Zstandard ;
- fichier de 79 453 octets.

Le PNG Giny portant le même identifiant fait 150 411 octets pour 1 022 × 1 010. Les dimensions diffèrent : ce rapprochement illustre les formats, il ne démontre ni l'identité des pixels ni un ratio universel de compression.

Le chemin Map3 assemble les blocs compressés des GFX dans les atlas de couches, puis appelle `compressedTexImage2D`. Il peut donc éviter de développer ces textures en RGBA avant leur envoi au GPU. Zstd est retiré au chargement ; BC7 reste le format GPU. Le build inclut aussi un worker de décodage KTX2/BC7 et libktx/WASM.

**À dimensions égales, sans mipmaps : RGBA8 = 4 octets/pixel ; BC7 = 16 octets par bloc de 4 × 4.** Une texture 2 048² représente donc 16 Mio en RGBA8 contre 4 Mio en BC7. Ce facteur 4 concerne les données de cette texture, pas la RAM totale d'Electron. Le remplissage des atlas, les copies temporaires et les rendertargets comptent aussi.

Pour les maps, le manifeste contient notamment `map3/maps/154644/map.bin.br` (174 229 octets) et `map.bin.gz` (256 902 octets). Le protocole Electron sait exposer `map.bin` après décompression Brotli ; le chargeur binaire décode MessagePack et sait traiter gzip. Les documents Bubble et Giny n'ont pas le même schéma ni forcément la même richesse : leur taille ne suffit pas à comparer l'efficacité de leurs codecs.

Références de format : [spécification KTX2](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html), [guide Khronos de déploiement KTX](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXDeveloperGuide.md).

## Ce que les fichiers Giny montrent

Mesures sur les textures demandées par les filtres de `mapTextureUrls`, dédupliquées par URL. Le calcul RGBA8 utilise les dimensions des PNG ; il ne mesure pas la VRAM du processus. Il exclut personnages, props animés, voisins, UI et buffers de rendu.

| Map | Éléments du document | Textures demandées | PNG sur disque | RGBA8 théorique sans mipmaps |
| --- | ---: | ---: | ---: | ---: |
| 154644 | 1 771 | 279 | 3,61 Mio | 36,00 Mio |
| 153878788 | 2 198 | 216 | 6,12 Mio | 52,83 Mio |
| 153880836 | 938 | 189 | 7,99 Mio | 79,32 Mio |

Une petite taille de fichier PNG ne signifie donc pas une faible empreinte graphique. Plusieurs voisins peuvent ajouter du coût, avec partage des GFX communs : il ne faut pas multiplier aveuglément ces chiffres par cinq.

Le JSON actuel de la map 154644 fait 647 074 octets ; un gzip niveau 6 calculé hors jeu donne 34 523 octets, soit environ 18,7 fois moins sur disque. Le JSON brut coexiste avec une version gzip et est prioritaire dans la résolution actuelle. La compression est intéressante, mais n'élimine ni l'adaptation JS ni le coût des images.

Sur 1 765 identifiants de documents présents dans `client/dofus3/output/maps`, en donnant priorité au `.json` sur le `.json.gz` comme le serveur : **31 sont au format v3**, 4 en v2, 2 en v1 et 1 728 sans champ `format`. Ce dernier groupe ne doit pas être considéré comme prêt pour le client actuel. L'ensurer exige v3 et peut lancer Python pour les autres. Ce relevé décrit le cache présent, pas la couverture de toutes les maps du jeu.

Points précis du code :

- `server/ensureMap.mjs` : validation synchrone du document, puis `execFile('python3', ...)` si absent/ancien. Deux maps distinctes peuvent déclencher deux extractions ; il n'y a pas de file globale bornée ici.
- `src/game/maps/loader.ts` : `mapCache` conserve toutes les promesses réussies ; pas d'éviction. `ensureData` puis lecture `no-store` ajoutent aussi des lectures/parses.
- `src/game/renderer/mapScene.ts` : toutes les textures d'une map sont demandées via `Promise.all` ; pas de budget explicite de décodage/upload GPU. `Assets.load` terminé ne démontre pas que tous les uploads GPU sont terminés.
- `GameRenderer.ts` : le contexte Pixi et le joueur survivent aux transitions, l'ancienne map reste visible pendant le chargement, les voisins arrivent ensuite. Ce sont de bonnes bases. En revanche, les changements détruisent les sprites avec `texture:false`, et aucun gestionnaire de résidence applicatif ne borne les sources de maps conservées par `Assets`.
- `EntityRenderer.ts:425` : `geometry.batchMode = 'no-batch'`. Il faut examiner les shaders, la coloration et le tri avant de modifier cette ligne : la retirer seule ne garantit ni un regroupement réel ni la fidélité.
- `GameRenderer.ts` : ticker continu ; résolution pouvant atteindre DPR 2, soit quatre fois les pixels de DPR 1 à taille CSS identique. Pas de culling explicite trouvé dans ce chemin.

Pixi possède une gestion automatique de ressources : ces observations ne prouvent pas une fuite VRAM illimitée. Elles montrent l'absence d'un budget applicatif vérifiable. Voir [documentation des textures Pixi](https://pixijs.com/8.x/guides/components/textures).

## Budgets et rendu au repos chez Bubble : nuances

Le préchargeur comporte une limite de deux tâches, une attente de deux secondes d'inactivité et un contrôle à 256 Mio de mémoire déclarée par la source. Cette valeur ne constitue pas un plafond de mémoire totale du client. Le cache de blocs KTX dispose séparément d'une cible de 64 Mio, avec éviction des entrées terminées ; les opérations en cours peuvent dépasser temporairement la cible.

Les profils low/medium/high prévoient respectivement 192/384/768 Mo pour le budget de textures d'entités, des nombres de pages d'atlas et des effets ajustés. Cela montre qu'ils maîtrisent les budgets, pas qu'ils ne consomment presque rien.

Le moteur possède des limites de FPS et un chemin `_shouldSkipStableFrame`. **Dans le build inspecté, la branche Map3 passe avant ce dernier et appelle son propre rendu.** On ne peut donc pas attribuer automatiquement à leurs maps modernes un arrêt du rendu dès que l'image est immobile.

## Ordre de travail recommandé

1. **Établir la référence mesurée.** Build de production, mêmes maps, résolution, effets et population ; tester lancement à froid, transitions chaudes, parcours de 100 maps avec retour au départ, zone peuplée et arrière-plan. Relever p50/p95/p99 des frames, pauses de plus de 50 ms, durée jusqu'au décor puis jusqu'aux acteurs/interactions utilisables, RSS par processus, heap JS, textures/buffers estimés et uploads. Les statistiques actuelles de Giny ne couvrent pas tout : `loadMs` est enregistré avant la fin des acteurs/props et la heap JS n'est pas la mémoire totale.
2. **Préparer les ressources avant le jeu.** Exporter et valider les maps v3 et leurs dépendances lors d'une étape d'installation/préparation, ou par zones annoncées comme prêtes. Garder Python comme outil de préparation. Éviter les extractions UnityPy sur le chemin d'une transition. Introduire un manifeste de version afin de remplacer les revalidations/parses systématiques.
3. **Borner les caches et les tâches.** Cache LRU des documents et résidence des textures comptée en octets, références partagées entre map active, voisins et previews. Protéger les ressources visibles ; évincer les anciennes progressivement. Préchargement annulable, actif prioritaire sur les voisins, décodage et upload étalés sur plusieurs frames. Éviter de libérer/recharger à chaque frontière les textures communes.
4. **Passer aux atlas puis à KTX2.** Générer des pages raisonnables par zone/couche, avec métadonnées de rectangles, pivots et matériaux. Tester BC7 direct sur les GPU compatibles, repli PNG/WebP ou autre cible réellement supportée. Préférer la préparation hors jeu à un transcodage lourd lors d'une transition. Vérifier alpha prémultiplié, espaces de couleur, bordures, zoom et colorisation. Les textures d'index/palettes requièrent un traitement particulier si leurs valeurs doivent rester exactes.
5. **Réduire le travail de rendu.** Sortir les voisins hors champ du rendu, conserver la géométrie statique, regrouper les éléments compatibles sans changer leur ordre. Tester le cache des couches réellement statiques ; ne pas aplatir les décors triés avec les personnages, les interactions ou les effets dépendant du fond. `cacheAsTexture` coûte une texture supplémentaire et peut augmenter la VRAM : mesurer avant de généraliser.
6. **Optimiser les maps peuplées et le repos.** Regrouper les meshes d'acteurs compatibles, mutualiser géométrie et textures, puis tester un batcher spécialisé si les profils le justifient. Ajouter plafond de FPS, qualité/résolution ajustables et suspension du travail graphique inutile en arrière-plan, en conservant réseau et temps de simulation corrects.

Critères de validation : transitions préchargées sans longue tâche visible, mémoire qui atteint un plateau sur le parcours, coût au repos nettement inférieur au coût en animation, et aucune régression d'occlusion, de matériaux ou d'interaction. Les seuils en millisecondes et Mo doivent être fixés sur une machine cible ; annoncer maintenant un nombre de FPS ou une consommation garantie serait prématuré.

La priorité pratique est **préparation hors jeu → budgets/annulation → atlas et compression GPU → batching des acteurs et rendu adaptatif**. Un passage WebGPU ou une réécriture native pourra être évalué après ces mesures ; il ne corrige pas à lui seul les extractions en jeu, les caches sans limite ou les centaines de ressources à préparer.

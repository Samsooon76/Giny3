# Animations d’ambiance — 7 septembre 2026

Le client normal est recompilé pour lire les décors animés et les particules du paquet local `client/web/game-data`. Fermer puis rouvrir complètement le client recharge aussi les manifestes de ressources ; une simple déconnexion dans une fenêtre déjà ouverte conserve certains caches.

## Ce qui est livré

- Les 17 353 maps ont été enrichies hors du jeu : 22 235 instances de décors animés et 100 550 définitions de systèmes de particules.
- Les objets de `animatedElements` passent par Animator2D et conservent leurs pauses `minDelay`/`maxDelay`, leurs clips statiques et leurs indicateurs de lecture. Les objets pilotés par le serveur ne sont pas forcés à jouer.
- Les clips du cycle sont préparés avant de révéler la map. Les voisins visibles attendent également la préparation de leurs décors et particules.
- Export séparé de 386 textures de particules/bruit. Ces identifiants ne sont pas confondus avec les images de décor `mapgfx`.
- Émission continue et rafales, formes 3D projetées, durée de vie, vitesse, gravité, couleurs/alpha, taille, rotation, spritesheets, bruit, traînées et sous-émetteurs à la naissance/fin de vie. Dissolution et distorsion utilisent un maillage par matériau plutôt qu’un filtre par particule.
- Nouveau décodeur de flags des props, sans changer le décodeur des personnages : 725 props préparés, contre 609 avant le chantier. Les clips précédemment validés sont conservés ; les clips récupérés sont ajoutés.
- Les tangentes infinies des courbes sont sérialisées comme marqueurs de palier, jamais comme des nombres JSON invalides.
- Mise à jour des particules à 30 Hz, plafonds par système et par map, recyclage des sprites/traînées, arrêt des mises à jour quand le document est masqué, absence de rendu supplémentaire pendant les périodes sans particules actives. Libération des ressources à chaque changement de scène.
- Le correctif des couleurs du blé, les états d’I/O, leur surbrillance et leur hit-testing sont conservés. La flèche de changement de map manquante a également été préparée localement.

Les maps et les clips restent compressés sur disque et chargés à la demande dans des caches bornés. « Local » ne signifie pas que toutes les textures du monde sont simultanément en RAM/GPU : les lectures locales et le décodage d’images restent nécessaires. Aucun appel à Unity/Python n’est nécessaire pendant le jeu.

## Validation

- 17 353 documents validés comme JSON strict, version d’ambiance 2, avec leurs textures de particules référencées présentes : zéro erreur.
- 501 tests client réussis, un test ignoré. Tests Python ciblés : 25 réussis sur props/cartes et 21 sur décodeurs/couleurs/courbes (ensembles partiellement communs).
- Quatre tests Electron réussis : animation d’Incarnam, blé et quatre voisins prêts ensemble, 30 transitions complètes, six maps supplémentaires du monde. Zéro requête d’extraction et zéro ressource 404 dans ces tests.
- Incarnam 154010371 : 18 systèmes, particules vivantes et frames d’animations qui avancent ; scène complète prête en environ 1 s dans cette mesure.
- Après échauffement, cache textures identique au début et à la fin des 30 transitions : 259 064 424 octets, environ 247 Mio. Cadence de l’échantillon natif : médiane et p95 à 16,7 ms. Cela ne constitue pas une garantie universelle de FPS sur toutes les maps/machines.

Artefacts : `client/web/output/performance/incarnam-ambient.png`, `incarnam-ambient.json`, `native-local-transitions.json`, `world-release.json`.

## Limites constatées

Ce chantier rétablit les animations d’ambiance ; il ne reproduit pas intégralement tous les shaders et comportements du moteur Unity. Les collisions de sous-émetteurs, la réfraction complète, les déformations de vent/vagues des sprites statiques et certains filtres/masques Animator2D restent partiels ou non implémentés. Le bruit et les traînées sont une adaptation 2D, pas une simulation Unity identique pixel pour pixel.

32 identifiants de décors animés référencés n’ont pas de prop préparé exploitable. Ils sont déclarés indisponibles dans le manifeste afin d’éviter des tentatives d’extraction en jeu. 50 références de textures de matériaux de particules restent absentes des catalogues exportés, sur 37 maps ; elles sont recensées dans `game-data/ambient-report.json`. Les erreurs historiques d’assets sources ne sont pas maquillées par des images arbitraires.

## Repréparation

`npm --prefix client/web run assets:ambient` exporte les textures d’effets, récupère les clips de props et met à jour le monde local. `npm --prefix client/web run build` recompile ensuite le client normal. Les scripts sont exclusivement hors ligne ; ils ne sont jamais appelés par le moteur de jeu.

Les documents optimisés sont immuables et les manifestes sont publiés en dernier. Les anciens documents hachés sont conservés pour ne pas casser une fenêtre du client encore ouverte sur l’ancien manifeste.

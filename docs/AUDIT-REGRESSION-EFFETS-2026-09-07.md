# Audit du rendu après l’implémentation des effets

Analyse du 7 septembre 2026, à partir de la capture utilisateur d’Incarnam [2,-5] à 11:33, du code actuel et de la version locale de Pixi. Aucun correctif moteur appliqué pendant cet audit. Le client n’a pas été relancé pour reproduire exactement cette capture : les défauts de code ci-dessous sont confirmés, leur attribution à chaque zone de l’image reste à vérifier par comparaison avant/après.

## P1 — Coordonnées d’atlas appliquées deux fois

`client/web/src/game/effects/DeformedMapMesh.ts:60` construit les UV directement dans l’atlas puis passe la texture cadrée au `Mesh` standard de Pixi (ligne 77). Or Pixi transforme déjà ces UV avec `texture.textureMatrix.mapCoord`, dans `scene/mesh/gl/GlMeshAdaptor.mjs` ; le chemin batch applique également cette matrice dans `BatchableMesh.mjs`.

Vérification exécutée avec Pixi installé : pour une texture 1024×1024 cadrée en [256,512,128,256], les UV attendus vont de [0.25,0.5] à [0.375,0.75]. Le code actuel finit avec [0.28125,0.625] à [0.296875,0.6875]. Il étire donc une petite portion de texture sur le décor entier. Ce défaut est fortement compatible avec les gros blocs pixellisés de la capture.

Correction : fournir des UV locaux 0..1 au Mesh standard, ou utiliser un shader qui attend explicitement des UV d’atlas, mais pas les deux transformations. Tester les textures isolées ET les sous-textures d’atlas. Comparer un mesh sans déformation au sprite d’origine : ils doivent afficher le même contenu.

## P1 — Réfraction incorrecte et différente chez les voisins

`client/web/src/game/effects/RefractionPass.ts` :

- Ligne 104 : recherche par `info.texture` au lieu de la clé résolue employée par le chargeur (URL + frame d’atlas). `Object.keys(textures)` ne récupère pas les entrées d’un `Map`. Une texture manquante est remplacée par `Texture.WHITE`.
- Lignes 43–46 : le fragment recopie `uScene` à partir d’UV locaux au filtre sans conversion de sa zone vers la capture écran ; il ne lit ni masque ni alpha de la texture d’entrée. Cela ne reproduit pas la silhouette de l’effet.
- Lignes 94–95 : direction, force, échelle et vitesse sont fixées par défaut. Les paramètres source ne les alimentent pas.
- Lignes 125–126 : toutes les instances partagent le même filtre mutable ; la dernière texture de bruit affecte les autres instances.
- `GameRenderer.ts:282` effectue la capture pour la map courante. `mapScene.ts:298` anime les contrôleurs des voisins sans leur fournir de capture : leur `uScene` reste initialement blanc.

Correction : un pipeline de capture explicite partagé, coordonnées écran correctes, masque/alpha respectés, paramètres par matériau et mêmes règles pour les voisins. Ne pas activer une instance sans dépendances ou capture valide. La cause des grandes bandes de la capture ne peut pas être attribuée exclusivement à ce module sans isolation visuelle.

## P1 — Ordre de profondeur perdu lors du remplacement par un mesh

`spriteFactory.ts:createElementSprite()` attribue un `zIndex` d’après cellule/ordre. `DeformedMapMesh` ne le fait pas et `mapScene.ts:236` ajoute directement son root aux couches. Les décors déformés gardent donc l’ordre par défaut, ce qui peut les faire passer devant ou derrière des objets incorrectement.

Correction : partager le calcul de profondeur entre sprites et meshes ; vérifier un décor animé avec personnage passant devant et derrière, et vérifier également l’ordre background/foreground.

## P2 — Fonctionnalités annoncées mais non raccordées

- `WindState.ts:needsWaveMaterial()` et `effects/shaders/mapDeformation.ts` ne sont pas utilisés par le rendu. Les vagues ne sont pas implémentées simplement parce que leurs snippets GLSL existent.
- Le vent actif est une approximation CPU : `DeformedMapMesh.tick()` recalcule chaque sommet et envoie le buffer à chaque tick. Le shader de vent proposé n’est pas branché.
- `MapEffectSequence` produit des événements, mais `drain()` n’est consommé que dans un test. Les événements ne déclenchent pas d’action visuelle dans le jeu.
- `RenderTargetPool` conserve les anciennes dimensions jusqu’à destruction ; des redimensionnements successifs peuvent accumuler des cibles GPU. `MapEffects.resize()` est vide.

Le statut « supporté » du document de livraison est donc trop large. Distinguer export, raccordement runtime, approximation et validation visuelle.

## P1 — Les tests ne démontrent pas la validité du rendu

`client/web/e2e/map-effects.spec.ts:32` utilise une map unique. Les assertions vérifient seulement que la scène est prête, sans extraction et sans erreur JavaScript. Elles ne comparent aucune image, n’assertent pas d’effet actif et n’observent pas son mouvement. Ce test peut réussir avec des rectangles affichés à la place des décors.

## Ordre de correction recommandé

1. Reproduire la map [2,-5] et enregistrer une capture avec les mêmes caméra et temps ; distinguer meshes, particules et réfraction par activation isolée dans le diagnostic.
2. Corriger les UV et la profondeur des meshes. Ajouter un test d’équivalence sprite/mesh sur atlas et une régression visuelle de cette map.
3. Corriger la réfraction complète, notamment la capture des voisins, avant de la déclarer utilisable.
4. Raccorder les vagues et les séquences uniquement avec les tests de rendu correspondants ; rectifier entre-temps les statuts de couverture.
5. Mesurer transitions, redimensionnements et mémoire, puis construire le client de production après validation visuelle de la version benchmark.

Il n’y a pas lieu de commencer par réextraire tout le monde : le premier défaut démontré est dans l’interprétation des textures déjà préparées par le moteur.

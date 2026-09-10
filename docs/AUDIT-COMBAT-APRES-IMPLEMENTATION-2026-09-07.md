# Combat : audit après implémentation — 7 septembre 2026

## Conclusion

Le socle serveur et les contrôleurs ont progressé, mais la présentation officielle reste partielle. Des composants existent sans être reliés au parcours réel. Le mode tactique, l’animation de tacle et l’aperçu des pertes liées au déplacement ne sont pas livrés visuellement. Plusieurs effets restent dessinés à la main, contrairement à la contrainte « UI et animations officielles ».

Ce document est un audit du code actuel, comparé au plan du 7 septembre et au client Bubble local. Aucun combat connecté ni comparaison vidéo actuelle n’a été exécuté pendant cet audit. La capture initiale fournie par l’utilisateur ne constitue pas une capture de cette version. Aucun code de jeu n’a été modifié.

## Ce qui est effectivement présent

- Le serveur distingue les variations PA/PM avec les métadonnées `resource`, `reason`, `metaVersion`. Le client n’a plus à déduire une ressource à partir du seul `actionId = 0`.
- Le tacle total appelle désormais `OnTackled` avant de retourner un trajet vide ; les pertes sont bornées aux ressources disponibles. Source : `server/Servers/Giny.World/Managers/Fights/Fighters/Fighter.cs:372`, `:397`, `:635` et `Managers/Modern/ModernCombatEvents.cs`.
- Le reducer gère les variations signées, les esquives sans double débit, le journal de tacle et une pile des séquences. Les marques visibles sont réconciliées à partir des snapshots.
- Le calcul de voisinage est partagé et mis en cache ; l’accessibilité respecte les PM, les cases occupées et les cases interdites en combat. Les dimensions des cellules sont partagées avec `CellGrid`.
- L’annulation des déplacements est mieux protégée : elle annule le mouvement sans imposer l’ancienne destination. Une synchronisation évite de recaler immédiatement un acteur déjà en déplacement.
- La timeline, le widget de fin de tour, les challenges et les résultats utilisent les arbres officiels extraits. Ce travail est réutilisable.

Ces éléments établissent des progrès dans le code ; ils ne prouvent pas une parité visuelle ou une validation serveur/client en situation réelle.

## Écarts et défauts constatés

### 1. Mode tactique sans effet sur le décor — priorité haute

`CombatDisplayController.ts:51` expose `registerTacticalLayers`, mais aucune invocation n’existe dans le code de production. Les seules invocations trouvées sont dans les tests. La liste des couches reste donc vide. `GameRenderer.ts:462` appelle bien `applyTactical`, mais celle-ci n’a rien à masquer.

Le clavier et la préférence persistée fonctionnent ; le rendu tactique ne fonctionne pas. La séparation du conteneur de combat est une préparation utile, pas une implémentation du fond tactique et des obstacles. Le manifeste reconnaît d’ailleurs explicitement cette lacune.

**Correction attendue :** résoudre les données et ressources tactiques de la carte, construire la présentation officielle correspondante, brancher son cycle de vie au renderer et restaurer le décor au retour carte. Il faut gérer le chargement asynchrone, une bascule pendant le chargement et un changement de carte. Masquer une couche arbitraire ne suffirait pas à reproduire le mode officiel.

### 2. La grille est effacée au deuxième dessin identique — priorité haute

Dans `CombatScene.ts:83`, `paintGridBase` appelle `clear()` avant de comparer la clé de cache. Au deuxième appel pour le même combat et la même carte, la grille est effacée, puis la méthode retourne sans la redessiner. `sync()` rappelle cette méthode à la ligne 139.

**Reproduction réalisée :** exécution du corps actuel de cette méthode, extrait sans modification, avec une cellule et un objet Graphics instrumenté. Premier appel : 1 cellule dessinée. Deuxième appel : 0. Il s’agit d’une reproduction de la logique de dessin, pas d’un test GPU dans le client.

**Correction attendue :** vérifier le cache avant de vider le dessin ; invalider explicitement sur visibilité, carte et données pertinentes. Ajouter un test d’intégration de deux synchronisations successives, puis des bascules de grille et de carte.

### 3. Le HUD reçoit l’état avant la fin des animations — priorité haute

`GinyClient.ts:76` réduit immédiatement l’événement et remplace `combatState`. À la ligne 92, il notifie l’UI avant de mettre la présentation en file. `WorldView.tsx:43` transmet directement cet état au HUD.

`presentedRevision` est mis à jour après présentation, mais il ne sélectionne aucun snapshot affiché et n’est pas lu par le HUD. Le commentaire qui affirme que le HUD suit l’état présenté ne correspond donc pas au comportement du code. Les PA/PM, le tour actif ou les informations de timeline peuvent précéder leur animation. La fenêtre de résultat, elle, dispose déjà d’un garde `!busy` : ce garde ne corrige pas les autres bindings.

La pile des séquences reste dans le reducer. Le séquenceur de présentation est une file FIFO par événement ; il ne consomme pas cette pile pour construire des groupes de présentation.

**Correction attendue :** conserver l’état autoritaire pour valider les commandes et une projection réellement présentée pour l’UI. Publier les changements visuels aux étapes appropriées de la séquence ; conserver les ACK après achèvement et les protections d’annulation. Tester un paquet d’événements reçu avant que le premier déplacement ne soit terminé.

### 4. Accessibilité calculée, mais aperçu complet non branché

`CombatScene.ts:52` expose `previewTo`, qui calcule chemin, coût et ensemble accessible. Aucun appelant de cette méthode n’existe en production. Le survol appelle `paint`, qui ne dessine que le chemin vers la cellule survolée.

`CombatGrid.ts` exclut volontairement le tacle du calcul. L’aperçu ne distingue donc pas les cases accessibles, inaccessibles, les portions affectées par le tacle, ni les pertes PA/PM prévues. La prévisualisation de sorts reste également simplifiée : elle ne remplace pas la validation complète des effets et conditions par le serveur.

**Correction attendue :** produire un modèle de prévisualisation complet à partir des informations connues du joueur, le raccorder au survol réel, aux changements de PM/états/occupation et à la sélection des sorts. Une prévision ne débite jamais les ressources. Les informations absentes ou cachées doivent rester inconnues. Porter les règles pertinentes de Bubble en les confrontant aux règles Giny.

### 5. Tacle reçu mais sans animation

La branche `GameActionFightTackledMessage` de `CombatScene.ts:218` est vide. Les nombres PA/PM qui suivent peuvent s’afficher, mais aucune réaction de tacle n’est jouée.

Bubble fournit désormais une piste précise : son handler récupère l’acteur par `sourceId`, joue **`AnimTacle`** et appelle le callback de fin. Cela établit un branchement à reprendre ; cela ne prouve pas que chaque look actuellement exporté pour Giny possède déjà ce clip.

**Correction attendue :** remonter du nom `AnimTacle` à sa résolution dans les animations/squelettes Bubble et les ressources officielles ; vérifier direction, composition et disponibilité sur les looks utilisés ; étendre le parseur/export si nécessaire ; brancher le lecteur existant et attendre sa fin dans la séquence. Ne pas renommer un `AnimHit` en tacle ni inventer un effet de remplacement.

### 6. Plusieurs effets sont encore des substituts graphiques

Dans `CombatScene.ts` :

- `floating`, ligne 152 : texte Pixi de taille 28, gras, contour 3, mouvement de 48 unités et durée fixe de 550 ms. La police, la courbe et le regroupement officiels ne sont pas établis par ce code.
- Impact de sort, ligne 187 : ellipse jaune dessinée et animée pendant 240 ms. Cette ellipse est exécutée dans la branche de cast sans vérification locale de disponibilité d’un effet officiel spécifique.
- Téléportation et glissade, ligne 226 : même interpolation linéaire de 220 ms pour deux comportements différents.
- Marques et socles : ellipses vectorielles ; portée, survol et chemin : teintes et opacités en dur. Les couleurs de placement prélevées sur la légende officielle ne prouvent pas le rendu de l’overlay monde.
- `MovementController.ts:5` : vitesses fixes de 0,22 et 0,14 seconde par cellule, sans correspondance mesurée avec les cycles officiels.

**Correction attendue :** relier chaque famille à sa ressource ou à son algorithme officiel extrait, avec paramètres et provenance. Les ressources introuvables restent des lacunes explicites. Les commandes glissade, téléportation, échange et tacle doivent conserver leurs comportements distincts.

### 7. Arbres UI officiels, mais bindings encore partiels et géométriques

`liveCombat.ts:19` annonce des bindings de données seulement. Pourtant `fightResolve` et les repeaters imposent notamment une timeline de 80 px, des espacements de 6 px, des positions de portraits, des couleurs d’équipe et une jauge de vie de 6 px. La jauge de temps suppose une durée de 30 secondes. Ces choix doivent être justifiés par les ressources et contrôleurs officiels, pas seulement par leur ressemblance avec une capture.

Plusieurs éléments sont masqués : vagues, tours additionnels, bouclier de timeline, ordre, marque d’invocation. Les `tg_*` sont désactivés. Ces toggles ne doivent pas être requalifiés arbitrairement en boutons tactique/grille : leur rôle doit être conservé. Les challenges utilisent une icône commune au lieu d’une résolution par challenge.

L’écran de résultat possède ses trois onglets et les bindings XP/kamas/butin. Il reste partiel : statistiques de blocage/bouclier non transmises, valeur estimée du butin masquée, certains détails de ligne masqués. Les tirets pour une donnée absente sont préférables à un faux zéro, mais cela ne constitue pas une parité complète.

**Correction attendue :** comparer chaque override aux UXML/USS et au contrôleur officiel. Corriger le parseur/runtime quand une contrainte de mise en page manque ; conserver dans les bindings les seules adaptations nécessaires aux données. Valider les mêmes résolution, thème, échelle UI, état de combat et looks que la référence.

## Ce que Bubble permet de reprendre concrètement

Sources locales consultées : index `bubble/BubbleGame/sources.json` et modules du client packagé dans `resources/app.asar`. Les emplacements ci-dessous sont des offsets en caractères dans les modules décodés, pas des numéros de ligne.

| Sujet | Source Bubble | Apport vérifié |
|---|---|---|
| Tacle | `dist/assets/game-entry-D5YuSIvZ.js`, offset 1900333 | Handler sur `sourceId`, `AnimTacle`, callback de fin |
| Aperçu déplacement | même module, vers 1890208 | `reachableCells`, `unreachableCells`, `pathCells`, `tackledPathCells`, `unreachablePathCells`, `endCellId`, `mpLost`, `apLost` envoyés au renderer |
| Séquences | même module, offset 39050 ; `app-CgRsD63L.js`, vers 641847 | Buffer de messages, séquences imbriquées et étapes spécialisées |
| Déplacement confirmé | `game-entry-D5YuSIvZ.js`, vers 1044719 | File de commandes par acteur et acquittement de fin de mouvement |
| Mode tactique | `index-BP60ZkRz.js`, offset 186852 | Invalidation de grille, chargement des templates par carte, thème, token de chargement, libération des textures |
| Overlays | `app-CgRsD63L.js`, vers 630552 | Groupes de cellules distincts et ordre de dessin du chemin/accessibilité/tacle |

SHA-256 vérifiés :

- `game-entry-D5YuSIvZ.js` : `ec9d48006e3827f38dd34a43cbcc14c40805eccf32fc9279bf65604ba8692c3b`.
- `app-CgRsD63L.js` : `684380ea5f44337fb233a78ac87d188e21bc122246afb6a9ba8a6942083f4387`.

Bubble sert à retrouver les branchements, algorithmes et chemins de ressources. Sa présence ne certifie pas automatiquement une fidélité officielle de toutes ses constantes ou de ses fallbacks. La validation reste faite contre les ressources officielles et les références utilisateur. En particulier, la piste `AnimTacle` remplace une recherche à l’aveugle ; elle n’autorise pas à déclarer le clip déjà exporté.

## Ordre de correction proposé

1. Corriger la disparition de grille et séparer l’état autoritaire de l’état présenté. Ce sont des défauts fonctionnels indépendants du style.
2. Reprendre le chargement des templates tactiques par carte et les couches de rendu. Vérifier bascule, retour carte, changement de carte et absence de masquage des combattants.
3. Raccorder le vrai aperçu de déplacement, puis les états de tacle et les pertes prévues. Valider les règles avec Giny et les données visibles au joueur.
4. Résoudre et jouer `AnimTacle`, puis porter l’orchestration des réactions et variations PA/PM. Vérifier tacle partiel, total et perte esquivée.
5. Remplacer les textes, impacts, glissades/téléportations et marques provisoires par leur présentation officielle extraite ; calibrer la locomotion.
6. Supprimer les écarts UI non justifiés, brancher les contrôles manquants et compléter les données de résultats disponibles.
7. Effectuer une recette connectée avec traces et captures : placement, déplacement libre, tacle, sorts, mort, résultat, reconnexion pendant une animation. Comparer au même thème et à la même échelle officielle.

Chaque lot visuel doit montrer un avant/après dans le client. Un helper testé ou un élément présent dans un manifeste ne suffit pas à le déclarer terminé.

## Vérification exécutée pendant cet audit

Commande depuis `client/web` :

```sh
npm test -- src/giny/combatState.test.ts src/game/combat/CombatSequencer.test.ts src/game/combat/CombatGrid.test.ts src/game/combat/CombatDisplayController.test.ts
```

Résultat : **4 fichiers, 33 tests réussis**. Les tests de `CombatDisplayController` enregistrent eux-mêmes une couche factice ; ils ne vérifient pas le branchement réel dans `GameRenderer`. Ces suites ne couvrent pas le dessin de `CombatScene`, la fidélité UI ou un combat connecté. La reproduction isolée du cache de grille échoue fonctionnellement malgré ces tests verts.

Les chiffres de suites globales présents dans `combat-presentation-manifest.json` proviennent de travaux antérieurs ; ils n’ont pas été réexécutés ni présentés ici comme des résultats de cet audit.

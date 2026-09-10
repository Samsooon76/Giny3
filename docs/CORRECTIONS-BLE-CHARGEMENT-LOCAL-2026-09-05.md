# Blé sombre et décor tardif — Incarnam [-1, -3]

Map identifiée : **154010371**, objet blé : **prop 660**. Les fichiers étaient présents localement. Les deux problèmes provenaient du code du client et de l’interprétation des données préparées.

## Blé

Le tag Animator2D `0x19` porte une couleur **additive**. Le pipeline traitait sa valeur `0x00000606` comme un multiplicateur presque noir. Il mélangeait également les canaux de couleur et l’opacité : les couleurs des nœuds sont des octets RGBA signés, alors que l’opacité est un octet séparé du header.

Correction du décodeur des couleurs des props : multiplicateur, couleur additive et alpha se mettent à jour indépendamment. La réparation des exports existants relit leurs payloads conservés, plutôt que de confondre un champ de couleur hérité avec une nouvelle valeur. Elle est idempotente (`signed-rgba-flags-v2`). Les couleurs ajoutées sont appliquées par le shader en respectant l’alpha prémultiplié. Les meshes sans ajout de couleur conservent le rendu groupé ordinaire ; les anciens exports d’acteurs ne changent pas d’interprétation.

**609 types de props préparés ont été réparés hors du jeu**, puis leurs nouveaux clips publiés sous des chemins calculés depuis leur contenu. Les données de préparation sont synchronisées pour éviter qu’une publication ultérieure ne remette les anciens clips. Les marqueurs des 140 ressources indisponibles sont conservés. Aucun fichier dépendant des nouveaux clips ne manque. Les 127 types d’animations encore inexploitables ne sont pas réparés par ce changement.

Commande reproductible : `python3 client/web/scripts/repair-prop-colors.py` ; `--prop 660` permet de cibler le blé. Elle travaille sur les exports locaux, sans lancer le jeu ni extraire de bundles Unity.

## Décor en haut de la map

L’optimisation précédente attendait **deux secondes sans interaction** avant de charger les maps voisines, puis leur appliquait un fondu. Le délai était visible dans les marges de l’écran et pouvait être repoussé par les mouvements du pointeur.

Les voisins sont maintenant préparés immédiatement, avec deux chargements simultanés. Le rendu de la nouvelle scène attend les props et les voisins ; le canvas conserve sa dernière image pendant cette préparation. Le délai artificiel et le fondu sont retirés. L’opacité existante des voisins (0,85) reste identique.

Les maps demeurent sur disque : lecture, décompression des données et transfert des textures au GPU restent nécessaires. Charger les 17 353 maps simultanément en RAM/VRAM irait à l’encontre du budget mémoire. Le cache conserve les ressources récemment utilisées et limite la mémoire retenue.

## Aucune décompilation automatique

Electron non empaqueté et Vite autorisaient encore les extractions par défaut. Ce défaut est supprimé dans les deux serveurs et dans `createMapEnsurer`. Une ressource absente produit une erreur de préparation ; elle ne lance pas Python. `GINY_ALLOW_RUNTIME_EXTRACTION=1` reste un opt-in explicite pour les outils de développement.

## Validation

- Capture réelle après correction : `client/web/output/performance/incarnam-wheat.png`. Le blé ne présente plus les épis presque noirs montrés dans le signalement.
- **1 440 couleurs de nœuds** des cinq clips du blé comparées à une nouvelle extraction hors jeu : correspondance exacte.
- Test Electron sur la map signalée : quatre voisins prêts ensemble, aucun appel à `ensure-data`, aucun 404 et aucune erreur JavaScript. Premier lancement mesuré : scène complète prête en **918 ms**.
- Stress natif de **30 changements de map**, annulation des requêtes dépassées et mémoire bornée : réussite. Textures stabilisées à **222 126 028 octets** (~212 Mio), identiques après échauffement et au trentième changement. Cadence RAF médiane **16,7 ms**, P95 **18,5 ms**, sur l’Apple M4 de cette machine.
- Suite client : **480 tests réussis**, un test ignoré. Tests Python ciblés : **22 réussis**. Build TypeScript/Vite de production et lint ciblé réussis.
- Série complémentaire Chromium/Electron : le test visuel, les transitions avec cache borné, le fallback de textures et les six maps de la release passent. Le benchmark de cadence **Chromium sans fenêtre** dépasse son délai de 180 secondes ; aucune mesure de cadence issue de ce test n’est utilisée. La mesure de cadence ci-dessus provient du test Electron natif réussi.

Le client ouvert conserve son manifeste et ses clips en mémoire. **Redémarrer le client** pour prendre le nouveau build et le catalogue corrigé.

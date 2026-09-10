# Correctif du rendu des maps — 7 septembre 2026

La map de la capture utilisateur est 153879813 (Incarnam [2,-5]). Les arbres et feuillages sont à nouveau lisibles dans le rendu Electron de test ; les gros blocs étaient dus aux UV de l’atlas appliqués deux fois aux meshes.

## Changements livrés

- UV locaux 0..1 pour le Mesh standard de Pixi ; calcul de profondeur partagé avec les sprites.
- Réfraction : lookup des textures cadrées, masque alpha, coordonnées écran distinctes des UV du filtre, paramètres par instance, compilation du shader compatible avec Pixi, conservation de la matrice source.
- Une capture locale partagée entre la map et ses voisines, sans auto-capture des effets ni texture blanche affichée en attendant. Pas de capture sur les scènes sans réfraction utilisable. Les couches d’avant-plan sont exclues puis restaurées, y compris chez les voisins.
- Cibles GPU réutilisées, anciennes dimensions évincées au redimensionnement, résolution Retina prise en compte.
- Réparation hors ligne de 235 documents de maps dont les métadonnées des textures de réfraction avaient été oubliées. 17 353 maps examinées et 1 189 instances de réfraction recensées : aucune ressource introuvable dans cette réparation. Les PNG étaient déjà disponibles localement ; aucune extraction n’a été nécessaire.
- Le générateur d’ambiance conserve désormais ces références et le vérificateur détecte leur absence. Les documents hachés sont remplacés atomiquement, manifeste publié en dernier, anciennes générations conservées.

## Validation

- Suite client : 532 tests réussis, un ignoré ; test supplémentaire du pool GPU réussi.
- Comparaisons de pixels WebGL en résolution 1 et 2, avec caméra déplacée/zoomée : sprite et mesh d’atlas identiques ; force de réfraction nulle sans changement d’image ; force non nulle visible uniquement dans le masque ; capture utilisable par les voisins. Contrôle des erreurs console/GPU en plus des exceptions JS.
- Six tests d’intégration réussis : comparaison graphique initiale, trois maps Electron, blé/voisins et 30 transitions complètes. Les deux variantes de résolution ont été vérifiées ensuite.
- Après réparation du pack, nouvelle vérification Electron de la map 54162245 : passe de réfraction réellement active, zéro texture manquante dans ce contrôleur, aucune erreur ni extraction. Capture GPU mesurée à 4 892 160 octets pour ce viewport.
- Audit global indépendant des 17 353 maps : aucune version inconnue, mais 3 591 occurrences de dépendances d’effets absentes subsistent (ce ne sont pas 3 591 fichiers distincts). Le contrôle global échoue donc ; ce résultat ne doit pas être présenté comme une validation complète du monde. Rapport : `client/web/game-data/effects-verification-after-render-fix.json`.
- Client de production recompilé. Lint sans erreur, avertissements React existants.

Captures : `client/web/output/performance/effects-fixed-153879813.png`, `effects-fixed-154010371.png`, `effects-fixed-54162245.png`.

## Limites

Ce correctif répare les régressions de rendu identifiées ; il ne termine pas le plan complet de parité Unity. Les vagues et séquences non raccordées, certains matériaux et la fidélité exacte du vent restent à traiter. Les statuts du document de livraison ont été corrigés pour ne pas les présenter comme achevés.

Fermer complètement puis rouvrir le client recharge le nouveau programme et le nouveau manifeste local.

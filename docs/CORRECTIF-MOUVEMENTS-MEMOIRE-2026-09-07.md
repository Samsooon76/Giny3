# Mouvements des décors et mémoire de composition — 7 septembre 2026

## Diagnostic

La vidéo utilisateur dure 3,595 secondes et montre Incarnam [3,-4], map 153880324. Les deux extrémités de la vidéo ont été décodées localement. La priorité confirmée par l’utilisateur est le mouvement anormal des arbres/décors.

Les paramètres de rotation utilisent des degrés ; le code les utilisait directement comme radians. Il utilisait aussi l’amplitude comme excursion maximale au lieu de la plage crête-à-crête, et multipliait les animations liées au vent par un multiplicateur d’amplitude global au lieu de la puissance du vent. Enfin, les pivots source, en coordonnées monde, n’étaient pas appliqués.

L’alerte Chromium `tile memory limits exceeded` a été reproduite séparément sur la connexion : 12 messages capturés dans le scénario connexion/HUD avant correction. Les grandes bandes DOM du fond en parallaxe, promues en couches Retina, constituent une pression de composition indépendante de la taille du fichier JavaScript.

## Modifications

- `WindState.ts` : degrés convertis en radians, amplitude crête-à-crête, phases et modes fixes respectés, puissance du vent utilisée pour les animations liées ; prise en compte des multiplicateurs de bruit/amplitude omis dans l’approximation de flexion.
- `DeformedMapMesh.ts` : transformations animées autour des pivots monde source, retour en coordonnées locales par inversion de la matrice affine ; ancrage de flexion basé sur le point de départ monde.
- `LoginBackground.tsx` et `login-parallax.css` : fond en parallaxe composé dans un seul canvas visible, bandes précalculées hors DOM, résolution bornée, cadence maximale 30 Hz, pause document masqué et libération au démontage. Les ressources restent locales.
- `worldmap.css` : suppression de la promotion forcée de la grande surface cartographique via `will-change`.

## Validation

- 538 tests client réussis, un ignoré au moment du contrôle. Tests spécifiques sur la rotation d’Incarnam, les offsets fixes, le vent nul et les matrices.
- Sept tests graphiques/Electron réussis sur une compilation stable : connexion/HUD, quatre maps dont 153880324, comparaisons de pixels d’atlas/réfraction aux résolutions 1 et 2.
- Alertes de tuiles dans le scénario testé : 12 avant, zéro après.
- Grandes couches avec contenu relevées par CDP : connexion 12 → 3 ; HUD 5 → 1. La somme de leurs surfaces est une indication de pression de composition, pas une mesure exacte de mémoire GPU résidente.
- Lint sans erreur, avertissements React préexistants.

Artefacts : `client/web/output/performance/compositor-memory-before.json`, `compositor-memory.json`, `compositor-login-fixed.png`, `incarnam-motion-fixed.webm`.

## Limites

La flexion du vent reste une adaptation, pas une reproduction complète des shaders Unity et de leurs modèles de bruit. Le correctif traite les erreurs d’unités et d’ancrage responsables de mouvements excessifs. La disparition des messages mémoire est vérifiée dans le scénario reproduit, pas garantie pour chaque machine ou combinaison de fenêtres.

L’avertissement de bundle JavaScript supérieur à 500 kB est distinct : la compilation réussit, et son seuil n’a pas été artificiellement augmenté pour masquer le message.

# Interfaces des dix références — 5 septembre 2026

## Architecture conservée

Les fenêtres restent rendues depuis les arbres officiels extraits, leurs feuilles UITK et leurs assets. Les contrôleurs React alimentent les bindings et instancient les modèles de lignes officiels. Aucun écran de référence n’est remplacé par une fenêtre JSX dessinée à la main.

Le parseur ne peut pas déduire les actions du contrôleur C# ni les données reçues du serveur. Une liste vide dans le fichier UXML doit donc recevoir un repeater et des données. Les variantes de composants, icônes, ombres, champs et règles de dimensions doivent en revanche être corrigées dans le moteur commun lorsqu’elles affectent plusieurs écrans.

## Couverture des captures

| Références | Écran / aperçu | Corrections |
|---|---|---|
| 1, 3 | `?ui-preview=hud&open=quests` | Onglets et sélection, recherche/niveaux, catégories, jointure étapes/objectifs/PNJ, description, récompenses et objet. Ajouter `&quest-state=completed` pour l’état terminé de la fixture. |
| 2 | `?ui-preview=hud&open=guild` | Bandeau, six onglets, roster officiel, colonnes, portrait/statut, compteurs et recherche. |
| 4 | `?ui-preview=hud&open=map` | Parchemin couvrant la fenêtre, repères plus petits, panoramique à l’échelle de la surface, zoom initial ajusté, recherche depuis CartographySearchUI. |
| 5 | `?ui-preview=hud&open=spells` | Paires de variantes réparties sur quatre colonnes, niveaux, sélection, recherche, filtres, modes et infobulles. |
| 6 | `?ui-preview=creation` | Cadrage du personnage, vrais symboles de classe, grille de visages, recoloration des skins, descriptions et palette. |
| 7 | `?ui-preview=characters` | Sélection de ligne, portrait cadré dans sa case, titre, symbole de classe et acteur sur son socle. |
| 8 | `?ui-preview=servers` | Carrousel officiel, illustration, catégorie, compte de personnages et bordure de sélection. |
| 9 | `?ui-preview=hud&open=breeding` | Composition BreedingUi/PaddockUi/storage, filtres, quatre modes, titres, jauges, zones vides et grille carrée. |
| 10 | `?ui-preview=hud&open=appearance` | Catalogue cosmétique, quatre colonnes, icônes de types, recherche, cases du pied de fenêtre, noms, infobulles et chargement progressif au défilement. |

## Corrections communes

- Chargement du thème UITK aussi pour les écrans hors jeu ; mise à jour du texte indépendante de requestAnimationFrame des onglets masqués.
- Priorité à `icon-type=Icon` / `icon-value` sur l’image de secours sérialisée par l’éditeur.
- Une révélation explicite de binding empêche la suppression d’un conteneur dont les enfants sont cachés.
- Ombre des fenêtres sans étirer une image de coin sur toute la surface.
- Modèles de choix de visage/icône et icône optionnelle des onglets ; injection d’une sous-fenêtre officielle dans le flux.
- Miniatures d’entités calculées en série puis conservées en image ; libération du contexte graphique.
- Lecture des anciens exports JSON contenant des nombres non finis, et export de nouvelles bornes valides.
- Skins v2 : transmission de l’index de couleur à travers les symboles imbriqués ; extraction des symboles de classe via `extractor/entities/export_class_ui.py`.

## Données et limites

`referencePreview.ts` contient les données de démonstration utilisées pour comparer les fenêtres, séparées des données du serveur. Les montants, noms, équipements et personnages du compte officiel photographié ne sont pas des données Giny.

La partie visuelle et les interactions locales sont couvertes. Les mutations serveur, les autres pages de guilde, les contenus de titres/ornements/auras et les opérations d’élevage nécessitent leurs données/commandes Giny. Les filtres de sorts utilisent les descriptions/effets disponibles ; ils ne remplacent pas encore toute la classification C# officielle. Le carrousel montre les serveurs réellement fournis, sans inventer plusieurs serveurs ni des portraits que la réponse serveur ne contient pas.

Le fond noir des aperçus HUD isolés est normal : ils ne montent pas la scène de jeu. En jeu, la carte de terrain reste derrière les fenêtres.

## Processus pour une nouvelle différence

1. Reproduire la même fenêtre, taille, sélection et état de données que la référence.
2. Trouver le binding officiel correspondant, puis comparer ses dimensions calculées, ses classes et son sprite avec l’arbre extrait.
3. Corriger l’extraction si l’information manque dans l’arbre ; le moteur commun si elle est mal interprétée ; le contrôleur si le C# doit créer une liste ou alimenter une valeur.
4. Garder les modèles officiels pour les éléments répétés. Éviter les positions calculées uniquement pour une capture.
5. Vérifier visuellement après chargement du catalogue, puis tester recherche, sélection, défilement et état vide. Ajouter un test de non-régression pour les erreurs communes.

## Validation

Compilation TypeScript/Vite et suite Vitest complètes ; tests Python ciblés export look/animation. Vérification dans le navigateur des neuf vues uniques, avec recherche de sort « Nimbus », recherche cosmétique « Mégacape » et bascule de quêtes vers un onglet vide.

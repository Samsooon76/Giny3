# Les 15 nouvelles références du 5 septembre 2026

Références : `images-references/1.png` à `15.png`. La série précédente reste dans `images-references/old/`.

## Architecture conservée

Les fenêtres viennent des VisualTreeAsset extraits. Les contrôleurs TypeScript alimentent leurs bindings et instancient leurs modèles de lignes officiels avec les repeaters du parseur. Aucune capture de référence n'est utilisée comme fond d'interface.

Correctifs partagés : les EntityDisplayer peuvent conserver leurs enfants décoratifs, les dimensions explicites des statistiques sont respectées, les images acceptent un cadrage de fond explicite, les Tile affichent les quantités et les menus des modules sans titre sont accessibles. Le cadre externe utilise `overflow: clip` pour éviter que le focus d'un menu fasse défiler tout le HUD.

## Couverture de cette passe

| Capture | Vue / modèle officiel | Travail réalisé | Données encore nécessaires |
| --- | --- | --- | --- |
| 1 | companionUi / companionElement / commonSpell | Liste à 3 colonnes avec personnages, sélection, portrait, lore, statistiques calculées par niveau, résistances, sort initial et sorts actifs | Possession et équipement des compagnons |
| 2 | guidebookBase / DofusProgressUi / DofusTile | Grille à 8 colonnes, cartes bordées, niveaux, recherche, filtre, tri, détail et pied de page | Progression officielle des étapes ; le masquage se base actuellement sur les objets détenus |
| 3 | jobUI / jobProgressItem / jobRecipeItem | Liste des métiers, sélection, XP, recherche et niveaux, recettes, quantités et ingrédients manquants | Calcul serveur de l'XP par craft, détail complet des ressources récoltables |
| 4 | webBase / Shop / ArticleTile | Navigation et catégories, recherche, zone de campagne, grille à 4 colonnes | Catalogue commercial, vraies campagnes, prix, achat ; les compagnons affichés en atelier sont des exemples de cartes |
| 5 | achievements / endingAchievementsItem | Catégories, recherche, score, cartes à 2 colonnes, vrais objectifs du catalogue | Avancement des objectifs et progression compte/personnage |
| 6 | PlayerInfoUi / PlayerInfoMain | Personnage entier, socle, cartes sociales, identité et métiers | Profil public distant, partage, relations non fournies par le HUD |
| 7 | LadderUI / ExperienceAndAchievementLadderTab | Onglets, podium, recherche, ligne et position du personnage | Classements serveur ; seul un personnage d'aperçu est présenté |
| 8 | calendarUI / calendarDayCard / calendarCard | Semaine, navigation, filtres, événements, récompenses, zodiac et protecteur | Dates et bonus synchronisés ; les dates de l'atelier sont une fixture explicite |
| 9 | chatview / chatItem | Horodatage configurable, couleurs des canaux, texte continu, raccourcis de canaux, taille du texte | Éditeur complet des groupes de canaux personnalisés |
| 10 | actionBar / menu commun | 1 à 4 lignes avec vraie modification de taille et du nombre de cases, vider/restaurer, options communes | Création de barres supplémentaires, éditeur des raccourcis ; préférence de sorts en combat désactivée en attente du protocole |
| 11 | characterInformations / menu commun | Grand/petit module, points d'invocation, PV restants, restants/totaux ou pourcentage | Aucun branchement supplémentaire pour ces affichages |
| 12 | widgetProgressGauge / menu commun | Menu sans en-tête, expérience personnage/guilde, pods, énergie, couleur persistante | XP des métiers, honneur, calcul du pourcentage d'XP gagnée ; option de limitation désactivée |
| 13 | FightTimeline / timelineFighter | Module compact avec deux combattants et affichage des portraits | Timeline réelle du protocole de combat |
| 14 | EndTurnWidget | Compteur, jauge de temps, bouton de préparation et états des toggles | Effets réseau des commandes de combat |
| 15 | fightResult / fightResultCharacterTab | Victoire, durée, statistiques, personnage, kamas, butin, ennemis, XP et fermeture | Résultat réel du serveur ; onglets résumé/statistiques désactivés plutôt que remplis de valeurs d'édition |

La fidélité des données et des campagnes commerciales n'est donc pas une parité complète avec l'officiel. Les filtres et contrôles qui nécessitent des services absents restent à compléter. Les fenêtres secondaires non montrées dans cette série (par exemple tous les onglets du guide ou du profil) ne sont pas couvertes intégralement par cette passe.

## Combat

Préparer l'affichage est utile dès maintenant : `combatPresentation.ts` expose un contrat `FightPresentation`, qui sera alimenté par l'adaptateur du futur protocole. L'aperçu ne démarre aucun combat, n'exécute pas de règles, ne crédite ni XP ni objets. Les données de référence ne sont injectées que dans l'atelier UI de développement.

- HUD et préparation : `http://127.0.0.1:5173/?ui-preview=hud&combat-preview=preparation`
- Résultat : `http://127.0.0.1:5173/?ui-preview=hud&open=fightResult`
- Autres vues : même URL avec `open=companions`, `guide`, `jobs`, `shop`, `achievements`, `profile`, `ladder`, `calendar`.

## Ressources

Les illustrations réutilisables ont été exportées depuis les bundles locaux vers `output/client/illustrations/{companions,calendar,guide}`. Pour reproduire l'export depuis `client/dofus3` :

```sh
python -m extractor.entities.export_reference_ui --client /Applications/Ankama/Dofus-dofus3 --out output
```

Le catalogue complémentaire charge les compagnons, leurs caractéristiques et sorts, les progressions des Dofus, les événements et les objectifs de succès, avec les traductions locales. Les données personnelles viennent du HUD ; les exemples restent dans les contrôleurs d'atelier et `referencePreview.ts`.

## Vérification

Contrôles visuels dans le navigateur des huit fenêtres principales et des trois modules de combat, ainsi que des menus de barre, personnage et jauge. Vérification interactive du passage à 36 cases puis retour à 12, des PV en pourcentage et du changement de jauge vers les pods. Les options de test ont été remises à leur affichage initial.

Suite web : 421 tests. Couverture ajoutée pour les paliers de statistiques des compagnons, les semaines chevauchant deux années, les préférences invalides et l'indépendance des modules, ainsi que les dimensions des modèles de statistiques partagés.

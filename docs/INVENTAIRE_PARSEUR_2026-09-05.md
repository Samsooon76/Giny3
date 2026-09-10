# Inventaire : rapprochement du rendu officiel — 5 septembre 2026

## Chemin retenu

`?ui-preview=inventory` utilise désormais `OfficialInterfacePreview` → `OfficialHud` → `OfficialTree(equipmentStorageUi)` → `VisualNode`.

L’ancien écran Bubble en JSX ne pilote plus cet aperçu. Son contrôleur local (`InventoryPreview.tsx`) conserve les données de test, recherche, filtres, tri, sélection et équipement. Il ne dessine plus la fenêtre. Les tailles des colonnes, le décor, le socle, les emplacements, la grille, les filtres et les ensembles viennent des arbres extraits et de leurs feuilles UITK.

## Corrections partagées

- Les nœuds synthétiques utilisent leur binding comme `data-name`, pour recevoir les règles des composants extraits.
- Le composant Slot crée sa branche image quand un objet est présent et retrouve sa branche icône quand il est retiré. Le compteur de pile est ancré en bas à droite.
- La teinte UITK multiplie les couleurs de l’image au lieu de la transformer en silhouette monochrome : les détails de pierre et des ornements restent visibles.
- Les doubles espacements `gap` + demi-marges sont normalisés uniquement lorsque les valeurs correspondent exactement.
- Les icônes de titre sont regroupées avec le libellé, y compris sur les en-têtes déjà compilés. Les raccourcis peuvent être fournis par le contrôleur de fenêtre.
- Les listes déroulantes conservent leur intérieur extrait ; un select natif transparent reçoit le clavier et les choix fournis par le contrôleur.
- Le canevas d’un aperçu isolé est ajusté à l’interface ; les coordonnées des infobulles tiennent compte de ce canevas.
- Le fallback des toggles `secondary.xLarge` passe à 40 px (48 px à l’échelle de comparaison 120 %). C’est une correction de compatibilité fondée sur la référence, à remplacer par une valeur extraite si le constructeur correspondant devient disponible.

## Validation

- Compilation TypeScript et Vite réussie.
- 242 tests ciblés réussis : moteur officiel, bindings HUD et inventaire local.
- Navigateur : recherche, filtrage, tri des quantités, remplacement d’une arme équipée, déséquipement et retour à l’icône vide vérifiés.
- Contrôle visuel à 1276 × 1114, comparaison à la capture fournie et contrôle de la fenêtre Caractéristiques. Aucune erreur console relevée.

## Limites et suite

Le rendu n’est pas certifié identique pixel par pixel. Les données, le personnage et ses apparences restent celles du jeu de test ; équiper localement ne recalcule pas encore son EntityLook. Les recettes, favoris et ensembles n’ont pas été implémentés par ce chantier. Les estimations de prix et accès aux inventaires distants restent masqués faute de données/commandes prises en charge. Les catégories proposées dans l’aperçu sont les grandes familles locales, pas encore la liste complète des types d’objets du client officiel.

La suite consiste à compléter les comportements des composants partagés puis à brancher les commandes/données Giny. Il n’est pas nécessaire de reconstruire chaque disposition en JSX. Une adaptation par interface reste nécessaire pour les bindings métier (objets, textes, filtres, commandes), comme dans le client de référence.

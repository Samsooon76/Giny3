# Caractéristiques : rapprochement de la référence officielle

La fenêtre conserve `characterSheetUi` et les composants extraits `MainStatItem`, `CharacterStatsDetailed`, `EntityStatsTwoColumns`, `statTwoColumnsItem`, `DividerOptionElement`, `EntityStatsTable` et `EntityStatsTableItem`.

## Causes corrigées

- La largeur fournie par le catalogue Giny était de 900 px ; la composition de référence correspond à 520 × 880 px logiques. Les dimensions fixes sont réappliquées aux fenêtres déjà déplacées, sans effacer leur position.
- Les catégories Dofus 2.68 étaient concaténées et regroupées par paires. Le contrôleur compose maintenant trois groupes dans l’ordre de la référence, avec des séparateurs issus du composant Divider. Le parseur ne peut pas déduire cet ordre métier depuis les templates vides.
- Le tableau passe de 5 à 11 lignes : éléments, critiques, poussée, sorts, armes, distance et mêlée.
- La puissance utilise `secondary.power`, les dommages fixes cumulent `combat.all_damage` et le bonus élémentaire, les résistances fixes viennent des réductions élémentaires, les pourcentages des champs `combat.*_resist`. Le médaillon cœur affiche les PV maximum.
- EntityPortrait cumulait une surface Unity de 300 px et un second cadrage web. Le peintre utilise désormais la taille réelle du masque, ancre le haut du personnage et recalcule son cadrage au redimensionnement. Le portrait peut dépasser du contenu à sa position négative extraite, jusque dans l’en-tête.
- Le constructeur partagé Divider rétablit le conteneur du petit losange et masque son libellé vide.

## Limites

Les valeurs et l’apparence sont celles du personnage Giny, pas celles du personnage de la capture. Les multiplicateurs de dégâts/résistances sorts, armes, distance et mêlée ne sont pas transmis par le bridge actuel : ils sont affichés avec « — ». Les champs additifs de puissance ne sont pas substitués à ces multiplicateurs. L’ordre des groupes et la largeur sont fondés sur la référence fournie ; ils pourront être remplacés par les métadonnées correspondantes si une extraction du constructeur les expose.

La disposition n’a pas été reconstruite en JSX. Les changements concernent les bindings métier, la taille de fenêtre et les composants partagés. Aperçu : `http://127.0.0.1:5173/?ui-preview=hud&open=character`.

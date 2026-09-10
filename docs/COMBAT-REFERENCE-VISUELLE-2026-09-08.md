# Combat — captures officielles du 7 septembre, 23 h 26

Le rendu utilise les arbres UXML/USS extraits et les ressources présentes dans le client local. Aucun dessin de remplacement n'a été ajouté.

## Changements

- `BubbleRangeTiles` transpose le triangle fan de Bubble `U7/j7` : géométrie arrondie et interpolation du centre vers les bords, avec les couleurs `x7/A7`, `R7/E7`, `C7/w7`. Les contextes Pixi sont partagés et construits au premier affichage. Le déploiement radial conserve ses 90 ms et son décalage de 60 ms.
- Repère de cellule issu de `fight/targetCell.png`, projeté avec les UV isométriques de Bubble. L'icône réelle du sort accompagne le curseur, à l'échelle du HUD ; annulation/sortie de grille/destruction la masquent.
- Une copie de `PlayerFighterTooltip` par combattant affecté, avec jauge de PV et lignes `DamageElement`. L'adaptateur du worker Bubble conserve chaque élément, le soin et les jets critiques au lieu de les additionner indistinctement. Le calcul reste celui du worker existant et refuse toujours les états incomplets/effets complexes non pris en charge.
- `FighterInfoTooltip` et `FighterInfoStat` alimentent le panneau inférieur de la cible réellement survolée. Il suit la position enregistrée de la barre de sorts. Icônes de caractéristiques extraites, valeurs issues du snapshot ; données absentes affichées par un tiret.
- Timeline centrée en haut par défaut. Fin de tour à côté des sorts, compteur du tour courant et timer orange en fin de délai. Les widgets déplacés manuellement conservent leurs coordonnées enregistrées.
- Palette officielle Tribute appliquée pendant le combat. Quêtes et mini-carte conservées. Les réglages des challenges du tour précédent restent actifs.
- Le fond de carte et les cartes voisines restent visibles autour du terrain tactique ; les décors occultants sont masqués/restaurés. La grille de debug du monde ne se superpose plus à la grille de combat et retrouve sa visibilité après le combat.

## Vérification

- Compilation TypeScript et Vite réussie.
- 51 tests ciblés réussis (combat, transitions de carte, tooltips, contrôles).
- Suite complète : 628 réussis, 1 ignoré, 2 échecs dans des fichiers non modifiés par cette correction : `hudRepeaters.test.ts` (couleurs des paliers d'obtention) et `windows.test.ts` (ajout de widgetManager dans le chrome).
- Aperçu déconnecté `?ui-preview=hud&combat-preview=aoe` : trois fiches empilées, jets normaux/critiques, zone rouge, portée bleue/grisée, icône au curseur et panneau inférieur vérifiés dans le navigateur. Échap masque l'icône et retire les lignes de dégâts.

La carte de l'aperçu est Incarnam/Pâturages ; ses textures tactiques sont choisies par le catalogue Bubble de cette carte. Les captures fournies montrent une autre carte. Cette vérification visuelle ne remplace pas un combat connecté ; aucun serveur Giny n'a été redémarré. Les animations de sorts et les règles serveur ne sont pas modifiées par cette passe visuelle.

# Effets de maps — livraison

Le client lit uniquement des fichiers locaux préparés. Unity, Python et l’extraction de bundles restent hors du jeu.

## Couvertures

- **Données** : inventaire de toutes les familles observées (`npm --prefix client/web run assets:effects-audit`). Les absences source (32 props, références de textures) restent visibles.
- **Fonctionnalités** : contrat `effectsVersion`, vent/vagues, réfraction, particules, séquences visuelles, masques/filtres Animator2D exportés. Les collisions de particules n’existent pas dans les 17 353 documents exportés ; les cellules marchables ne sont pas utilisées comme colliders.
- **Fidélité** : un JSON valide ne suffit pas. Les tests unitaires couvrent le contrat, le cycle de vie et les formules de vent. Les e2e Electron (`map-effects.spec.ts`) confirment l’absence d’extraction runtime.

## Statuts

| Famille | Statut |
| --- | --- |
| Vent | Déformation CPU approximative ; UV d’atlas et profondeur corrigés le 7 septembre. |
| Réfraction | Capture partagée, coordonnées écran, masque et paramètres corrigés ; parité Unity complète non démontrée. |
| Dissolve/distorsion | Adaptation du rendu des particules ; fidélité à vérifier par matériau. |
| Vagues / émissif / séquences visuelles | Données exportées ; les snippets ou événements présents ne constituent pas une implémentation complète raccordée au rendu. |
| Bloom / aberration chromatique / grain | exportés, passe plein écran pas encore branchée |
| Particules existantes | supporté |
| Collisions de particules | impossible avec les sources actuelles |
| Sons localisés | hors chantier visuel |

Un pack incomplet peut servir au développement. Il n’est déclaré `effects_complete` que si l’inventaire et les dépendances collent.

## Commandes

```sh
npm --prefix client/web test
npm --prefix client/web run lint
cd client/dofus3 && python3 -m pytest tests/test_map_effects.py tests/test_effects_inventory.py
npm --prefix client/web run assets:effects-audit
npm --prefix client/web run assets:effects-verify
```

Le joueur ferme complètement puis rouvre le client pour renouveler les manifestes.

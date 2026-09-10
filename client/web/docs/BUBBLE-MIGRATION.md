# Migration du rendu et nettoyage — 10 septembre 2026

Le monde et tous les portraits utilisent désormais les ressources Bubble :
cartes, joueurs, PNJ, monstres, création de personnage, sélection de personnage
et portraits de dialogue. Les états de jeu et les looks restent fournis par Giny.

`EntityPreview` utilise le `BubbleLookRenderer` original, isolé depuis l'archive
locale avec les autres modules natifs. Un contexte GPU est partagé entre les
portraits visibles ; chaque portrait conserve sa propre copie 2D. Les vignettes
statiques gardent leur cache limité. L'import est reproductible avec
`npm run assets:import-bubble` et ses empreintes sont enregistrées dans
`public/bubble/runtime-provenance.json`.

## Données conservées

- `public/bubble/` : moteur natif et ressources Bubble déjà préparées.
- `runtime-assets/bubble-source-packs/` : packs sources nécessaires au résolveur
  Bubble, auparavant rangés dans `game-data`.
- `runtime-assets/catalog/` : catalogues compatibles Giny, traductions, icônes,
  pictogrammes et tuiles de la carte du monde. Ce sont des ressources encore
  utilisées, conservées depuis les exports existants ; elles ne sont pas
  présentées comme une nouvelle conversion des catalogues Bubble.
- `runtime-assets/ui/` et `runtime-assets/uitk/` : ressources de l'interface
  actuelle, autonomes et utilisées aussi pendant la compilation.
- `../dofus3/references/` : captures et rapports visuels de référence conservés.

Les fichiers conservés ont été liés physiquement avant le retrait des anciennes
copies ; ils restent de vrais fichiers une fois ces copies supprimées.
Le catalogue SQL publié configuré par `GINY_RUNTIME_CATALOG_ROOT` reste prioritaire.
Le serveur World lit désormais les règles d'apparence dans
`client/web/runtime-assets/catalog/data/skinslotsrules.json.gz`.

## Anciens exports retirés

- `client/dofus3/output/` (captures de référence mises à part)
- `client/dofus3/.cache/`
- `client/web/game-data/` (packs Bubble et catalogues conservés séparément)

Vite et Electron n'utilisent plus ces chemins ni l'extraction Python à la demande.
Les anciens outils d'extraction restent disponibles pour référence ; leurs
commandes npm portent désormais le préfixe `legacy:` et peuvent recréer des
exports si elles sont volontairement lancées. Le code source de l'extracteur,
son historique Git et ses tests n'ont pas été supprimés.

## Vérification

`npm run assets:verify` contrôle les données requises, les empreintes des modules
natifs et l'absence des anciens chemins dans les points d'entrée.
Les tests de portraits vérifient des pixels réellement peints, des apparences
distinctes, le partage d'un seul contexte et sa libération. Le test local refuse
les requêtes de portraits vers les anciennes textures et entités.
Le parcours Electron contrôle trois cartes en BC7 et en mode lossless, les
textures des acteurs et les lectures partielles des packs.
Ces contrôles portent sur des parcours représentatifs ; ils ne constituent pas
un parcours exhaustif de toutes les cartes, classes et quêtes du jeu.

## Résultat du nettoyage

Les trois dossiers ont été définitivement supprimés après mise à l'écart et
contrôle des ressources conservées. Le rapport [bubble-cleanup-report.json](bubble-cleanup-report.json)
comptabilise 418 649 fichiers et 20 897 488 896 octets récupérables, soit 19,462 Gio,
en excluant les inodes encore conservés par d'autres liens physiques.
Le dossier `client` passe d'environ 23 Gio à 3,1 Gio.

Validation : compilation production du client réussie ; compilation de World
réussie avec zéro erreur (avertissements existants) ; 10 tests natifs réussis ;
4 tests navigateur réussis après suppression, sur un serveur isolé. La carte
s'est chargée en 13,2 secondes lors de ce dernier parcours. Les passages
précédents sous charge avaient dépassé leur délai ; les fichiers reçus étaient
valides et aucun ancien chemin n'était demandé. Le parcours Electron sur trois
cartes, en BC7 et lossless, a également réussi avec les anciennes racines absentes.
Le lint exclut les bibliothèques tierces générées de ses règles React.

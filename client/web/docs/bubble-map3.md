# Rendu Bubble dans le client Giny

Le client principal utilise le moteur de scène, les entités, les animations et le déplacement natifs de Bubble 0.1.328. L'ancienne page POC et le pont hybride Pixi ont été retirés. `/?map=204998153&benchmark=1` ouvre désormais ce même renderer dans l'aperçu du client.

Giny reste responsable de la connexion, des personnages, de la population des maps, des interactions et des règles du combat. Les identifiants, looks, directions et cellules proviennent de `WorldSession`/`CombatSnapshot`. Le seul personnage de démonstration est réservé à l'aperçu sans session ; aucun PNJ ou monstre fictif n'est ajouté à une session de jeu.

## Organisation

- `src/game/renderer/GameRenderer.ts` relie les callbacks existants du client à Bubble.
- `src/game/bubble/` contient les adaptateurs Giny, le combat, les marqueurs, les bulles et les surcouches.
- `public/bubble/runtime/` contient les déclarations et shaders originaux extraits, ainsi que le WASM.
- `public/bubble/native-actors.js` assemble les looks natifs, conserve les leases, synchronise les snapshots et fournit la géométrie à la scène.
- Les règles de portée, tacle, dégâts et messages restent dans les modules Giny existants. Les séquences de sorts utilisent les groupes FX natifs ; les atlas de chiffres et de mode tactique restent ceux déjà extraits.

Le monde ne dépend plus du renderer Pixi. Pixi et les documents d'entités Giny restent nécessaires aux aperçus de l'interface, notamment équipement et sélection de personnage. Ils ne doivent pas être supprimés avec les anciennes maps.

## Fichiers et I/O

Le navigateur utilise uniquement `/bubble/data/…`. Vite, son mode preview et Electron partagent `server/bubbleMap3Assets.mjs`. Le résolveur cherche les fichiers préparés, puis les ressources du cache fourni `bubble/BubbleGame`. Une ressource absente peut être récupérée sur le CDN public, uniquement avec l'empreinte attendue dans le manifest.

Les lectures de packs, téléchargements et décompressions se font en flux. Chaque publication est précédée d'une vérification SHA-256 et utilise un fichier temporaire puis un renommage atomique. La préparation est limitée à quatre tâches simultanées ; plusieurs demandes du même fichier partagent une tâche. Les réponses HTTP et `app:` prennent en charge Range, HEAD et l'annulation du flux. La préparation partagée peut terminer la mise en cache même si son premier consommateur a quitté la map.

Electron écrit ses nouvelles ressources dans son dossier utilisateur `bubble/0.1.328/data`, et lit aussi les ressources distribuées. Aucun téléchargement du compte, de l'authentification ou du client réseau Bubble n'est intégré.

Les packs AVIF sources déjà vérifiés restent hors du dossier public. L'index conserve toutes les images, avec des références vers le petit pack local pour les images déjà compactées. BC7 est utilisé lorsqu'il est disponible ; une texture BC7 absente déclenche la reprise de la map avec les packs originaux. Le cache permet de rejouer hors ligne les ressources présentes ; une map jamais préparée nécessite ses ressources locales ou un accès au CDN.

Les animations ne relisent pas les fichiers à chaque frame. Les entités partagent leurs groupes et textures ; leurs références sont libérées au retrait d'un acteur ou à la destruction de la scène. Les réponses et snapshots obsolètes sont écartés. Un mouvement local ne démarre qu'après la réponse Giny et n'est confirmé qu'à son arrivée ; les événements identiques ne rejouent pas ce trajet.

## Import et validation

```sh
python3 client/web/scripts/import-bubble-map3.py
npm --prefix client/web run build
npm --prefix client/web run test:all
npm --prefix client/web run build:benchmark
E2E_ELECTRON_ONLY=1 npm --prefix client/web run test:e2e -- e2e/bubble-world.spec.ts
```

L'import vérifie l'archive `resources/app.asar` et chaque module. Il conserve les corps originaux des fonctions et shaders et limite explicitement les déclarations issues du module d'application. `public/bubble/runtime-provenance.json` enregistre la version et les empreintes. Un changement d'archive demande une nouvelle revue de cette extraction.

Les tests natifs utilisent de vrais templates préparés. Les tests du pont Giny contrôlent la validation avant animation, les changements de map, les ACK périmés, les déplacements dupliqués et la libération des leases. Les captures `output/playwright/bubble-main-*.png` montrent le client principal, les acteurs, le combat et le FX 8224 du script 16440.

Les essais de présentation utilisent des snapshots Giny rejoués. Ils ne constituent pas une validation en session serveur réelle, un benchmark de foule, ni une garantie que chaque sort et chaque map du jeu ont été comparés pixel par pixel.

## Nettoyage

Les anciens modules de rendu du monde et leurs tests spécifiques ont été retirés après analyse des dépendances depuis le point d'entrée du client. Les maps JSON Giny, leur manifest compilé et leurs états de particules préparés ont également quitté `game-data`. Les ressources communes aux aperçus UI, le catalogue de jeu et la carte du monde sont conservés.

Une copie temporaire des fichiers retirés se trouve dans `/tmp/giny-renderer-migration/retired` pour cette migration locale. Elle n'est ni référencée ni distribuée par le client.

Validation Electron effectuée : maps 204998153, 154010371 et 153358338, chacune avec le choix de textures par défaut et les packs AVIF ; aucune texture manquante ni erreur JavaScript. Une lecture `Range: bytes=0-15` via le protocole `app:` renvoie 206 et exactement 16 octets.

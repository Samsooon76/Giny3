# Giny - A Dofus Server Emulator

Giny is a comprehensive and modular server emulator for the popular MMORPG, Dofus, written entirely in C# .NET. It provides a robust foundation for recreating the server-side logic of the game, allowing developers to host their own Dofus worlds. The emulator is designed with a clear separation of concerns, broken down into several distinct projects that work together to deliver a complete and extensible Dofus experience.

This emulator is not Stump.

## Chantier client Giny

Le [plan d’intégration](docs/PLAN-INTEGRATION-DONNEES-GINY-CLIENT.md), le
[journal de chantier](docs/chantier/JOURNAL.md) et le
[suivi de chaque interface](docs/chantier/INTERFACES.md) décrivent les travaux,
les vérifications et les prochaines étapes. Lire le journal et le suivi avant
de reprendre l’implémentation.

L'[extraction officielle vers SQL](docs/CATALOGUE-OFFICIEL-SQL.md) est disponible
avec `./scripts/sync-official-catalog.sh` : archivage versionné des catalogues
Dofus installés et régénération des JSON client, avec audit de compatibilité Giny.

## Commandes du client

Les dépendances et le lockfile du client Giny sont dans `client/web` :

```sh
npm --prefix client/web ci
npm run dev
npm run build
npm test
```

Les commandes à la racine délèguent au même projet `client/web`. `npm run app`
compile puis ouvre le client Electron ; `npm run test:e2e` lance ses parcours
Playwright. Les scripts serveur restent dans `scripts/` et ne sont pas exécutés
par ces commandes client.

L’ancien manifeste racine était une copie du `package.json` de
`resources/app.asar` (Bubble 0.1.328), vérifiée identique. Il est conservé dans
[docs/references/bubble-package.json](docs/references/bubble-package.json) pour
l’étude de référence. Ses dépendances et son point d’entrée ne sont pas ceux de
Giny. L’archive Bubble et les scripts qui la lisent restent à leur emplacement.

## Repository layout

```
server/            Émulateur C# .NET (Giny.Core, Giny.IO, Giny.ORM, Giny.Protocol, Servers/, Modules/)
server/Ressources  Données du serveur : dumps SQL, patches, configs Auth/World, données de jeu
client/web         Client web/Electron (Vite + passerelle WebSocket → TCP)
client/dofus3      Extracteur des assets Dofus 3 pour le client web
scripts/           Scripts macOS : start.sh, stop.sh, smoke-test.pl, tests de smoke SQL
.local/            Données locales runtime (MariaDB, dotnet, logs) — non versionné
```

**I am no longer maintaining this project and I am not actively working on it anymore. Please do not contact me for help, unfortunately I don’t have the time, sorry!**

## Components

Giny's architecture is divided into the following key components:

### Core & I/O

- **Giny.Core**: This foundational project contains a collection of C# utilities that are not directly related to Dofus but provide essential functionalities. These include robust systems for serialization and cryptography, as well as networking tools that form the backbone of the server's communication.
- **Giny.IO**: This component serves as a serialization wrapper specifically designed to handle Dofus's proprietary client files. It allows the server to read and interpret the various data files used by the Dofus client, a crucial step in accurately recreating the game world.



### Database & Protocol

- **Giny.ORM**: A custom-built Object-Relational Mapper (ORM) is included to manage all interactions with the server's database. This tailored ORM is designed to handle the specific data structures and relationships found within the Dofus game.
- **Giny.Protocol**: The communication between the Dofus client and server is facilitated by a specific network protocol. Giny.Protocol is an auto-generated library that precisely mirrors the protocol used by the Dofus client sources. This ensures seamless communication and compatibility between the client and the Giny emulator. It is utilized by both the authentication and world servers.



### Game Servers

- **Giny.World**: This is the heart of the emulator, containing the core logic for the Dofus world server. It manages everything from player movement and interaction to NPC behavior, combat mechanics, and all other gameplay-related features.
- **Giny.Auth**: The authentication server is a separate component responsible for handling player logins and authentication requests. It validates user credentials and, upon successful authentication, directs the player to the world server.

ClickUp : [https://app.clickup.com/9003026450/v/s/90030432232](https://app.clickup.com/9003026450/v/s/90030432232)

## macOS (Apple Silicon)

Les serveurs Auth et World fonctionnent nativement sur macOS.

Installation des dépendances :

```bash
brew install dotnet@6 mariadb@11.4
```

Depuis la racine du dépôt, lance les deux serveurs et la base locale avec :

```bash
./scripts/start.sh
```

Le parcours transactionnel Forge niveau 1 → niveau 2 peut être vérifié avec :

```bash
./scripts/test-guild-camp.sh
```

Le script utilise une MariaDB isolée sur le port `3307`, importe les dumps SQL fournis au premier démarrage et démarre :

- Auth : `127.0.0.1:8443`
- World : `127.0.0.1:5555`
- IPC : `127.0.0.1:18000`

Pour vérifier automatiquement le protocole, l'authentification, le passage vers le
serveur World et la liste des personnages sans ouvrir le client :

```bash
./scripts/smoke-test.pl
```

Laisse ce terminal ouvert pendant la partie. Pour arrêter proprement :

```bash
./scripts/stop.sh
```

Dans le launcher/client, ajoute un serveur avec l’hôte `127.0.0.1`, le port Auth `8443` et le port API `9001`. Le compte de test fourni est `admin` avec le mot de passe `test`.

# Reprise du client depuis GitHub — 1er octobre 2026

Le client reste partiel. L'état du dépôt `Samsooon76/Giny3` au commit
`d2a9695ff69d7cb76cd489305f312dd92cb2753b` ne permet pas de reconstruire
l'application complète. Les validations locales documentées en septembre
portaient sur une copie contenant des fichiers absents de GitHub.

## Fichiers manquants constatés

| Chemin | Usage | Cause ou constat |
|---|---|---|
| `client/web/src/game/bubble/` | Moteur de rendu, grille, combat, labels et options | Exclu par la règle globale `bubble/` |
| `client/web/src/ui/bubble/` | Aperçu d'inventaire importé par `App.tsx` | Même règle globale |
| `client/web/src/debug/` | Journal de session, lecteur du journal, statistiques, revue PNJ | Exclu par `[Dd]ebug/` |
| `client/web/public/bubble/` | Modules natifs, WASM et données préparées | Même règle globale ; absent du clone |
| `client/web/runtime-assets/` | Catalogues, interface, arbres UITK et packs sources | Exclu explicitement par `client/web/.gitignore` ; données locales |
| `resources/app.asar` | Archive source de l'import Bubble reproductible | Exclue explicitement ; pas de copie dans cet environnement |

La seule branche distante disponible est `main`. Le commit précédent ne
contient pas ces sources du client. Aucun autre dépôt Giny accessible ni copie
complète dans cet espace de travail n'a été trouvé.

Les règles d'exclusion sont corrigées pour les sources `src/debug`, les
dossiers Bubble du client et ses modules publics. Le cache local `/bubble/`
et les données locales `runtime-assets` restent ignorés. Cette modification
ne recrée pas les fichiers déjà absents : il faut récupérer la copie originale.

## Corrections du transport et de la session

- Les attentes de réponse sont installées avant l'envoi des requêtes, y compris
  les transitions de carte et l'entrée en jeu. Un envoi qui échoue supprime son
  attente et son délai, sans affecter les autres requêtes.
- Les demandes concurrentes d'un même snapshot de carte partagent la même
  réponse. Une demande pour une nouvelle carte attend la fin de l'ancienne ;
  les réponses sont vérifiées contre la carte attendue.
- Un chargement conserve l'identité de sa carte et de sa session. Un ancien
  chargement ne publie plus après une téléportation, une déconnexion ou une
  nouvelle connexion. Une passerelle ouverte tardivement après fermeture est
  fermée immédiatement ; le compte est effacé à la fermeture.
- Seule la fermeture attendue d'Auth après réception des données du serveur
  sélectionné est tolérée pendant le passage vers World. Une rupture inattendue
  d'Auth/World ou une erreur de passerelle rejette les attentes en cours.
- L'ouverture WebSocket a une limite de cinq secondes. Une fermeture ou une
  erreur avant l'ouverture provoque un refus immédiat, sans attente infinie.
- Les notifications d'inventaire, d'acteurs et les acquittements ordinaires ne
  restent plus dans la file des futures réponses. Les réponses nécessaires aux
  étapes suivantes du protocole restent disponibles.

Ces changements ne modifient pas les IDs ni les formats des messages serveur.

## Vérifications exécutées

Commandes depuis `client/web` :

```sh
npm run test:io
node --test server/bubbleMap3Assets.test.mjs server/fileResponse.test.mjs
npx oxlint src/giny vitest.io.config.ts test-support
```

- Suite I/O : **103 tests réussis, 20 fichiers**, aucun échec.
- Serveur local de ressources et plages HTTP : **8 tests réussis**.
- Les six premiers tests de régression échouaient avant les corrections :
  délai orphelin du HUD, demandes de snapshot dupliquées, ouverture tardive après
  fermeture, réponse de carte reçue pendant l'envoi, téléportations concurrentes
  et publication après déconnexion.
- Deux tests WebSocket échouaient aussi avant correction, en dépassant leur
  délai sans résolution de la promesse.
- Le test de notifications retenait **3 000 trames** avant correction et zéro
  après correction.
- Contrôle TypeScript ciblé des sources/tests I/O réussi, avec une déclaration
  temporaire pour le module de journalisation absent. Lint ciblé et contrôle
  des espaces du diff réussis.
- Le test Auth → World attend désormais l'ID de la requête correspondante
  avant d'émettre sa réponse ; il ne simule plus une acceptation du ticket
  avant l'envoi du ticket.

La suite I/O simule seulement la journalisation, via une configuration de test
séparée. Elle exerce les véritables classes `GinyClient`, `FrameReplies`, codecs
et transport. Elle n'exécute pas l'application graphique ni un serveur Giny réel.

### Vérifications bloquées

- `npm run build` : sources Bubble et debug introuvables ; erreurs TypeScript
  `TS2307` et erreurs de types qui en découlent.
- `npm test` : le plugin d'interface préparée tente de lire
  `runtime-assets/ui/trees`, absent du dépôt, et s'arrête avant les tests.
- Recette navigateur/Electron et des fenêtres : impossible tant que les sources
  et données manquantes ne sont pas rétablies. Le binaire Electron n'a pas été
  téléchargé dans cet environnement ; l'installation des dépendances pour les
  contrôles I/O utilise `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`.

## Prochaine reprise

Récupérer les trois dossiers de sources originaux, les modules publics Bubble
et les données locales nécessaires depuis la copie complète. L'importeur
`scripts/import-bubble-map3.py` peut recréer les modules natifs depuis l'archive
Bubble attendue si elle est disponible ; il ne recrée pas les sources TypeScript
du moteur Giny ou les fenêtres absentes.

Après récupération : lancer compilation, tests complets et vérification des
assets, puis exécuter les parcours connexion, création/sélection, changement de
personnage, cartes, téléportations et reconnexion dans le client. La recette des
fenêtres restantes doit se poursuivre à partir d'[INTERFACES.md](INTERFACES.md).
Les 29 interfaces ne sont pas déclarées terminées par cette correction I/O.

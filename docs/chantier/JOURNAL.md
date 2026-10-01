# Journal du chantier Giny → client

## Reprise GitHub — 1er octobre 2026 — transport et chargements de session

- Le clone GitHub est incomplet : sources `src/game/bubble`, `src/ui/bubble`,
  `src/debug`, modules publics Bubble et données locales runtime absents.
  Les exclusions globales de dossiers ont masqué les sources lors de la livraison.
  `.gitignore` corrigé pour permettre leur récupération et leur versionnement.
- Corrections du client : attente avant envoi, annulation des délais après un
  échec d'envoi, partage des snapshots de carte, rejet des chargements d'une
  ancienne carte/session, compte effacé à la fermeture et passerelle tardive
  refermée, distinction fermeture attendue d'Auth / rupture inattendue de World,
  erreur de passerelle propagée et ouverture WebSocket limitée à cinq secondes.
- Les notifications ordinaires ne remplissent plus la file de réponses pendant
  toute la session. Le test reproduisait une accumulation de 3 000 trames.
- Validation isolée : **103 tests I/O dans 20 fichiers**, **8 tests de ressources
  locales/plages HTTP**, contrôle TypeScript et lint ciblés réussis. Les tests
  I/O utilisent un journal simulé, sans remplacement dans le code de production.
- Compilation globale et `npm test` bloqués par les fichiers absents ; aucune
  recette graphique ni livraison d'un binaire client déclarée. Rapport de
  récupération et périmètre : [REPRISE-CLIENT-2026-10-01.md](REPRISE-CLIENT-2026-10-01.md).


## Rendu des entités — 7 septembre 2026 — Feu de Joie

- Cause confirmée sur le monstre 3271, modèle 3254 : les animations préparées contiennent des couleurs additives décodées, mais aucun marqueur `color_encoding`. Le rendu appliquait leur multiplicateur sombre et ignorait leur addition lumineuse.
- `EntityRenderer` applique désormais les couleurs additives normalisées des acteurs comme celles des décors. Les parties neutres gardent le shader Pixi standard. Le retrait d'une recoloration d'acteur réapplique la couleur de la pose courante, y compris à l'arrêt.
- Trois tests de régression reproduisaient les défauts avant correction : documents sans marqueur, legacy, et encodage canonique ; transmission au shader, isolation des parties, transparence, retrait de recoloration et retour à une frame neutre.
- Validation : 38 tests ciblés réussis, lint ciblé et build TypeScript/Vite réussis. Avertissements du build sur les ressources UI résolues au runtime et la taille des bundles.
- Vérification WebGL avec les vrais fichiers préparés de `AnimStatique_1` (46 frames, comparaison de la pose initiale) : 73 484 canaux RGB modifiés, gain lumineux positif, aucun changement d'alpha, aucune couleur sur les pixels totalement transparents, aucune erreur JavaScript. Comparaison avant/après inspectée : `output/playwright/feu-de-joie-colors.png` ; contrôle rejouable avec `node output/playwright/check-fire-colors.mjs` et Vite sur 5173.
- Client compilé dans `client/web/dist`. Le client Electron déjà ouvert doit être relancé pour charger cette version. Aucun changement SQL ni redémarrage serveur. Ce correctif traite les couleurs additives ; les autres pistes de skins de secours et d'index de couleurs serveur restent distinctes.

Ce journal conserve les décisions, modifications, tests et limites de chaque incrément. Le [suivi par interface](INTERFACES.md) décrit l’état courant et le travail restant. Le [plan d’ensemble](../PLAN-INTEGRATION-DONNEES-GINY-CLIENT.md) reste la référence de périmètre ; ses constats décrivent l’audit initial, avant les corrections.

## Incrément 001 — 5 septembre 2026 — socle de persistance

**Demande :** commencer l’implémentation et tenir à jour ce journal et les interfaces.

**État : premier incrément terminé et validé techniquement.** Aucun raccordement UI ajouté dans cet incrément. Le chantier global et le lot 0 restent ouverts.

### Réalisé

1. Relu les lecteurs/écrivains de l’ORM, le démarrage World/Auth, les records de guilde et la suite de tests existante.
2. Remplacé les `SELECT *` et INSERT sans liste de colonnes par des colonnes explicites, provenant des propriétés persistées des Records, y compris héritées.
3. Ajouté `[Column("nom_sql")]` pour mapper une propriété sur un champ historique. La lecture, l’insertion, la mise à jour, la suppression par record et la génération de table utilisent le mapping.
4. Mappé `AccountRecord.CharacterSlots` sur `accounts.CharactersSlots`. **Décision par rapport au plan : conserver le nom SQL existant**, ce qui évite une migration de renommage et préserve les installations actuelles.
5. Paramétré les filtres des méthodes génériques `ReadFirst` et `Select`. Une valeur contenant une apostrophe est traitée comme donnée ; un champ inexistant est rejeté. Les surcharges de condition SQL brute demeurent réservées aux appels internes de confiance.
6. Corrigé `DatabaseReader.Read(connection, condition)` : sa condition était ignorée.
7. Remplacé la proposition interactive de DROP/CREATE lors d’un échec de lecture par une erreur explicite. « Enregistrement absent » reste distinct de « schéma illisible ».
8. Fermé systématiquement les readers et les commandes modifiés ; préparé les enregistrements avant de les ajouter au conteneur, afin de ne pas publier une lecture partielle en cas d’erreur de conversion.
9. Écarté les lots d’écriture vides ; les UPDATE/DELETE par record utilisent la vraie propriété de clé primaire et des paramètres.
10. Ajouté `[Update]` à `GuildRecord.Experience`, pour que le chemin de sauvegarde ORM persiste l’XP de guilde.
11. Créé un exécuteur de migrations avec `schema_migrations`, namespace module/version, SHA-256 du script et verrou MariaDB. Une migration réussie n’est pas rejouée ; un script modifié sous la même version est refusé ; un échec n’est pas enregistré comme réussi. Les DDL restent non transactionnels : les scripts doivent tolérer une reprise partielle.
12. Ajouté la migration World `001-guild-columns` avant le chargement des Records : création des quatre BLOB manquants et valeurs de remplacement sérialisées avec Protobuf Giny. Les valeurs non nulles existantes sont conservées.
13. Ajouté un contrôle des anciennes guildes sans rangs : elles provoquent un diagnostic explicite avant migration, au lieu de leur attribuer des droits devinés. L’audit local avait trouvé zéro guilde ; cette branche protège d’autres bases héritées.
14. Créé cinq tests d’intégration MariaDB avec une base dédiée à nom aléatoire par test, supprimée ensuite. Ils n’écrivent jamais dans les bases du jeu.
15. Créé ce journal et les fiches des 29 fenêtres + 6 parcours transversaux.

### Vérifications

- Première compilation : correction d’un import de namespace dans le nouveau test (`GuildMotdRecord` est déclaré dans `Managers.Guilds`).
- Première tentative de test dans le sandbox : compilation réussie, mais le runner .NET ne pouvait pas ouvrir son socket local ; reprise avec l’autorisation d’exécution adaptée.
- Suite .NET avec `GINY_ORM_INTEGRATION=1` : **7 tests réussis, 0 échec, 0 ignoré**, dont 5 nouveaux tests d’intégration et les 2 tests existants.
- Parcours testé : INSERT avec colonnes physiquement réordonnées et colonne supplémentaire à valeur par défaut ; lecture/UPDATE/DELETE avec alias et clé héritée ; BLOB avec valeur puis NULL ; apostrophe et tentative de filtre injecté ; condition de lecture effectivement appliquée.
- Échec de schéma testé : exception explicite, conservation des lignes et connexion encore utilisable.
- Migrations testées : exécution unique, checksum divergent refusé, échec non enregistré puis reprise ; migration de guilde et relecture de l’XP sauvegardée ; refus sans modification d’une guilde historique sans rangs.
- Compilation Debug : **World/tests, Auth, Giny.Quests, Giny.Pokefus et Giny.GuildCamp réussis**. Auth et Pokéfus émettent encore des avertissements de nullabilité ; aucun échec de compilation.
- Compte rendu de tests et résumés de build conservés dans [validations/001-resultats.txt](validations/001-resultats.txt).

### État du serveur de jeu

- Les serveurs en cours n’ont pas été redémarrés.
- Les bases `giny_auth` / `giny_world` du jeu n’ont pas été migrées pendant ces tests.
- La migration de guilde sera exécutée au prochain démarrage de **la version reconstruite** de World. Le script `scripts/start.sh` reconstruit Release avant le lancement ; les compilations de vérification de cet incrément utilisent Debug.
- Aucune conversion MyISAM → InnoDB n’est incluse dans cet incrément. Aucune promesse d’atomicité des récompenses actuelles : ce travail reste prioritaire.
- Aucun bouton client n’est annoncé fonctionnel grâce à ces seules corrections de persistance.

### Fichiers de code concernés

- `server/Giny.ORM/Attributes/ColumnAttribute.cs` — nouveau mapping de colonnes.
- `server/Giny.ORM/SqlColumns.cs` — résolution et échappement des noms de colonnes.
- `server/Giny.ORM/QueryConstants.cs` — requêtes à colonnes explicites.
- `server/Giny.ORM/IO/DatabaseReader.cs` — lectures et erreurs.
- `server/Giny.ORM/IO/DatabaseWriter.cs` — écritures, clés et mapping.
- `server/Giny.ORM/DatabaseManager.cs` — génération de table compatible avec le mapping.
- `server/Giny.ORM/SchemaMigrations.cs` — nouvel historique et exécuteur.
- `server/Servers/Giny.Auth/Records/AccountRecord.cs` — alias des slots.
- `server/Servers/Giny.World/Records/Guilds/GuildRecord.cs` — persistance XP.
- `server/Servers/Giny.World/Records/Guilds/GuildSchemaMigration.cs` — nouvelle migration de compatibilité.
- `server/Servers/Giny.World/Records/Database.cs` — migration avant lecture des Records.
- `server/Tests/Giny.World.Tests/OrmPersistenceTests.cs` — tests isolés.

### Travail restant au socle

- [x] SELECT et INSERT explicites ; compatibilité du nom des slots Auth.
- [x] Arrêt de la reconstruction destructive proposée sur erreur de lecture.
- [x] Exécuteur de nouvelles migrations avec checksum.
- [x] Migration des champs de guilde testée sur base isolée.
- [x] Test réel de persistance de l’XP de guilde.
- [ ] Sauvegarde/restauration complète et préflight des types, index, orphelins et BLOB de la base du jeu.
- [ ] Faire passer les anciens patches des trois modules dans l’historique sans les réexécuter aveuglément.
- [ ] Préparer puis tester les conversions InnoDB avec reprise ; ne pas convertir pendant des écritures de jeu.
- [ ] Livraison atomique ou durable des récompenses en objets ; cohérence cache mémoire ↔ transaction.
- [ ] Vérifier tous les champs modifiables non annotés `[Update]` selon leur usage réel.
- [ ] Reprise de démarrage et smoke Auth → World avec la version reconstruite.
- [ ] Export du catalogue Giny puis premier raccordement UI inventaire/stats/sorts.

### Rejouer les tests

Depuis la racine, avec .NET 6 disponible et MariaDB local sur 3307 :

```sh
GINY_ORM_INTEGRATION=1 dotnet test server/Tests/Giny.World.Tests/Giny.World.Tests.csproj --no-restore -m:1 -p:UseSharedCompilation=false
```

Options : `GINY_ORM_TEST_PORT`, `GINY_ORM_TEST_USER`, `GINY_ORM_TEST_PASSWORD`. Le serveur est limité à `127.0.0.1`. Le compte de test doit pouvoir créer/supprimer les bases isolées `giny_orm_test_<identifiant>`. Sans `GINY_ORM_INTEGRATION=1`, les tests nécessitant MariaDB sont explicitement ignorés ; ils ne sont pas comptés comme validés.

## Convention pour les prochains incréments

Numéro/date → objectif → modifications → commandes/tests et résultats → état réellement déployé → limites → prochaine action. Mettre à jour les fiches d’interfaces touchées et cocher uniquement les parcours vérifiés. Conserver les tentatives ayant révélé un problème utile, ainsi que sa résolution.


## Incrément 002 — 5 septembre 2026 — transactions des récompenses

**État : code et test de transaction validés ; pas encore déployé sur les bases du jeu.**

### Réalisé

- Migration `world/002-transactional-player-storage` : conversion de `characters` et `character_items` en InnoDB, enregistrée et rejouable après interruption.
- `scripts/start.sh` sauvegarde les deux bases avec verrou global avant la première migration de stockage, une fois l’absence des serveurs vérifiée. Archive gzip vérifiée ; restauration réelle encore à tester. Un lancement direct du DLL ne passe pas par cette sauvegarde.
- Ajout d’une insertion ORM participant à une transaction existante, sans mutation des conteneurs ni de la file de sauvegarde.
- Quêtes et Battle Pass : préparation de nouveaux stacks, insertion des objets dans la transaction du claim, puis attachement aux conteneurs après commit. Quantités et identifiants invalides sont rejetés ; additions contrôlées contre le débordement.
- Crédit SQL basé sur les valeurs courantes du personnage, avec verrou partagé par l’ORM couvrant commit et publication mémoire. Le cumul SQL à partir d’une sauvegarde potentiellement ancienne est supprimé.
- Les récompenses ne fusionnent pas les stacks dans cet incrément : choix volontaire pour ne pas modifier des objets vivants avant le commit.

### Vérifications et limites

- Test MariaDB isolé : conversion et relecture de lignes MyISAM, replay de migration, rollback simultané claim/objet/crédit, puis commit réussi. Suite après ce bloc : **8/8**.
- Ce test vérifie la primitive transactionnelle, pas encore le parcours complet `Character` → module → client ni une interruption du processus après commit.
- Compilation du module Quests réussie après modifications.
- Reste : restauration d’archive, migration locale réelle, validation d’un claim avec objet en jeu/reconnexion, cohérence des stats dérivées d’un gain de niveau après crash, borne d’XP Omega maximale.

## Incrément 003 — 5 septembre 2026 — premières interfaces actives

**État : en cours ; tests techniques passés sur le bloc inventaire/stats/sorts, recette en jeu restante.**

### Réalisé

- Enveloppe de commandes versionnée : UUID, personnage, action et paramètres validés côté serveur. Liste explicite d’actions, refus en combat/interaction, contrôle des objets possédés et des emplacements. Cache des 128 derniers résultats par connexion pour éviter le double effet d’un renvoi identique.
- Client : attente corrélée, une mutation en cours, timeout sans réémission automatique, resynchronisation, purge à la déconnexion, messages d’erreur visibles. Pas de mise à jour optimiste des possessions.
- Inventaire : sélection d’objet avec boutons équiper/déséquiper/utiliser une unité ; double-clic pour action par défaut ; choix d’un emplacement libre fourni par Giny.
- Personnage : formulaire de distribution et réinitialisation des points, limites et retour serveur.
- Sorts : activation de variante, état actif provenant du snapshot ; paires, noms, niveaux et disponibilité issus de Giny. Le catalogue client ne sert plus à inventer les paires lorsque le serveur les fournit.
- Apparence : titres et ornements débloqués, noms Giny, sélection et retrait. Les tenues/objets vivants restent ouverts.
- Guilde : vrais membres, présence, niveau, rang, note et contribution XP ; suppression du faux solde de guilde à zéro.
- Correction d’un identifiant de message combat à 16384, impossible à encoder sur les 14 bits du protocole : remplacé par 16379. Validation explicite des limites côté client.
- Extension explicite des commandes par les modules installés. Quêtes : ajout de sync/claim et claim Battle Pass au circuit corrélé.
- Projection dédiée des états de module (16376), version et personnage ; réception/validation côté client. Les anciens marqueurs chat restent masqués et sont consommés au lieu de remplir la file de trames.
- Panneau quêtes récurrentes/Battle Pass depuis la fenêtre Quêtes : périodes, progression, récompenses, états récupéré/verrouillé, boutons de claim et actualisation.

### Vérifications en cours

- Après inventaire/stats/sorts/apparence : **425 tests client réussis**, build TypeScript/Vite réussi ; **16 tests .NET réussis, aucun ignoré**, dont tests de paramètres malformés, identifiants longs, règles d’emplacement, IDs de messages et 6 tests MariaDB.
- Build Quests réussi. Avertissements historiques de nullabilité serveur et taille de bundle client conservés.
- Le raccordement récurrent/Battle Pass vient d’être ajouté : validation spécifique en cours.
- Aucun redémarrage du serveur de jeu effectué à ce point. Un bouton compilé n’est pas déclaré validé en jeu.
- Les confirmations des actions ordinaires portent sur l’état Giny en mémoire ; persistance périodique existante. Le cache de déduplication n’est pas durable après reconnexion. Les claims ont leur protection persistée en base.


## Incrément 004 — 5 septembre 2026 — restauration et reprise de sauvegarde

### Réalisé et vérifié

- Archive privée `.local/backups/chantier-20260905-before-migrations.sql.gz` créée avec verrou global MyISAM et permissions 0600 (environ 12 Mo). Les fichiers de données ne sont pas publiés dans la documentation.
- Restauration dans `giny_restore_auth_20260905` et `giny_restore_world_20260905`, exclusivement pour la recette. Comparaison **79/79 checksums de tables identiques**, trace [002-restauration.json](validations/002-restauration.json).
- Auth et World démarrés sur ports dédiés 18443/15555, IPC 28000, API 19001/19000. Les quatre colonnes de guilde et les conversions InnoDB ont été appliquées par le véritable démarrage World sur cette copie ; historique confirmé par SQL.
- Les trois modules chargent correctement (195 templates et 390 récompenses de quêtes). Connexion Auth → sélection serveur → sélection personnage → arrivée en jeu vérifiée dans le navigateur de recette.
- SIGTERM a arrêté l’API Auth sans fermer ses listeners TCP : l’instance de recette a nécessité un arrêt ciblé. À corriger dans un futur incrément de gestion de processus ; aucun processus du serveur courant n’a été arrêté.
- La recette en mode dev a été interrompue par des changements concurrents et redémarrages Vite. Reprise sur le client compilé, port 4189.
- Découvert et corrigé : `CyclicSaveTask.Save()` supprimait les lots ayant échoué. Seuls les lots réussis sont désormais acquittés ; les échecs restent dans la file et une exception agrégée remonte au gestionnaire World. Sauvegardes concurrentes sérialisées.
- Test d’intégration : disparition de table pendant INSERT, UPDATE puis DELETE, retour de la table, sauvegarde de reprise et relecture. **Suite .NET : 17 réussis, 0 échec, 0 ignoré**, dont 7 tests MariaDB.
- Ajout d’un refus explicite de claim quand le solde dépasserait la limite Giny de 2 milliards de kamas.

### Limites et vérifications restantes

- La file périodique n’est pas une file durable ; une panne du processus avant une sauvegarde réussie reste un risque. Les modifications simultanées d’un même record pendant une sauvegarde et les INSERT partiels sur les autres tables MyISAM restent à traiter.
- Après modifications de fichiers de carte en parallèle, une suite client a donné 423 réussis / 5 échecs (loader et ensureMap), contre 425/425 avant ce changement. Les tests nouveaux du circuit de commandes et du parseur de quêtes sont passés ; diagnostic et validation finale de la suite globale à reprendre sur état stable.
- Base de jeu courante toujours intacte et non migrée ; les mutations de recette portent uniquement sur la copie.


### Complément de recette — 12:17

- Suite client globale sur l’état stabilisé : **67 fichiers / 441 tests réussis**. Les échecs transitoires des tests d’extraction de carte ont disparu après leurs changements concurrents.
- Fiche personnage : 995 points → distribution de 10 en Force → 985 points et confirmation ; reset → 995 points et confirmation.
- Inventaire : pile de deux anneaux → équipement d’une unité, unité restante conservée ; l’anneau est affiché dans le slot 2 et le panneau propose alors « Déséquiper ». Preuve visuelle dans `output/playwright/003-inventaire-equipe.png`.


## Incrément 005 — 5 septembre 2026 — recette des claims et fidélité des infobulles

- Déséquipement confirmé ; après sauvegarde, SQL retrouve les 2 anneaux dans le sac, sans perte ni duplication.
- Variante Inertie (13026) activée depuis la grille ; message `SpellVariantActivationMessage` reçu et surbrillance active déplacée depuis Bouclier Féca (12982).
- La recette a révélé des champs statiques dans `SpellTooltip` (état Saoul, limites globales, cooldowns). Les bindings réels `...Value` sont maintenant alimentés ; les contrôles sans données sont masqués. Noms, description, effets et limites des sorts identifiés comme Giny n’empruntent plus de valeurs au catalogue Dofus 3.
- Le transport UTF historique tronquait silencieusement une chaîne dépassant 65535 octets. Les projections modernes utilisent désormais une longueur étendue après le marqueur réservé `0xffff`, avec limite de 4 Mio et validation des longueurs/UTF-8. Les petites projections conservent leur encodage historique. Client et serveur mis à jour ensemble pour les grandes projections.
- Sur le personnage **2 de la copie uniquement**, ajout d’une récompense de recette de 3 anneaux sur la quête 22 et préparation de 1000 XP Battle Pass ; rechargement puis complétion de cette quête via les commandes de développement existantes.
- Bouton Récupérer : confirmation, état récupéré et bouton désactivé. SQL confirme `RewardClaimed=1`, 3400 kamas, 5 anneaux au total (2 précédents + 3 reçus), 1120 XP Battle Pass.
- Le panneau affiche le palier gratuit disponible, VIP verrouillé et paliers suivants verrouillés.
- Validation après corrections : **448 tests client / 69 fichiers**, **22 tests serveur**, aucun échec ni test ignoré côté serveur ; builds client et Quests réussis. Les tests couvrent aussi la limite UTF exacte et les textes d’exemple des infobulles.


## Incrément 006 — 5 septembre 2026 — lancement sur le serveur local courant

- Préflight : aucun client connecté aux ports Auth/World ; dernières sauvegardes World réussies. Archivage des logs précédents.
- Reconstruction Release Auth, World, Pokéfus, GuildCamp et Quests par `scripts/start.sh` : réussie.
- Nouvelle sauvegarde automatique avant migration : `.local/backups/before-storage-20260905T103443Z-74754.sql.gz`.
- Auth démarré sur 8443, World sur 5555 ; modules chargés. Historique confirmé sur **giny_world** : `001-guild-columns` et `002-transactional-player-storage`.
- Tables `characters` et `character_items` désormais InnoDB sur la base courante. Checksums étendus après conversion **3830786824** et **1893546379**, identiques à ceux de la sauvegarde avant chantier : données conservées.
- `perl scripts/smoke-test.pl` : protocole, authentification, monde 50 et liste de personnages réussis.
- Les modifications de recette (niveau 200, points, anneaux, titre/ornement et claims) restent dans les bases `giny_restore_*`. Elles n’ont pas été importées dans la base courante.
- Palier gratuit Battle Pass testé sur copie : 5000 kamas ajoutés, solde 8400, un seul claim. Seconde tentative de quête refusée, quantité d’anneaux maintenue à 5.
- Les instances de copie ont été interrompues pendant la fin de recette ; la session client est revenue à la connexion. Relance des copies avec les DLL Release pour vérifier apparence et reconnexion. Aucune validation d’apparence n’est déduite de cette interruption.

## Catalogue officiel — 5 septembre 2026 — extraction, SQL et export client

- Client installé identifié : Dofus **3.6.10.11**. Extraction de **204 catalogues DataRoot / 284 920 entrées**, plus les cinq langues complètes par identifiant et hash.
- Correction de l'expansion des références Unity partagées entre effets ; tests de partage et de cycles ajoutés. Aucun pointeur Unity non résolu dans l'extraction réelle.
- Base dédiée **`giny_catalog`** créée : releases, domaines, records JSON et documents bruts/traductions. Import transactionnel et relecture avec comparaison des empreintes ; les tables actives Giny ne sont pas remplacées.
- JSON client régénérés depuis SQL sous `output/catalogs/releases/`. La release validée est référencée par `latest-prepared.json`. Commande réutilisable : `scripts/sync-official-catalog.sh`.
- Tests Python ciblés : partage de références, extraction stricte, corruption, aller-retour SQL, rollback sur erreur injectée, export atomique et relance idempotente. Test d'intégration du chargeur client sur les vrais fichiers SQL réussi.
- Audit statique : 111 IDs d'effets utilisés dans les sorts officiels sans gestionnaire repéré, dont 40 absents de l'enum. Formats de flags, critères, zones et sérialisation à adapter avant import dans les Records du serveur.
- **Pas de bascule des règles actives ni de remplacement de la racine d'assets client.** Données et fichiers préparés ; adaptation du moteur 2.68 à Dofus 3 à poursuivre. Aucune interface supplémentaire déclarée terminée sur la seule présence du catalogue.
- Documentation et périmètre exact : [CATALOGUE-OFFICIEL-SQL.md](../CATALOGUE-OFFICIEL-SQL.md).

## Catalogue officiel — 5 septembre 2026 — adaptation et publication des Records

- Adaptateur C# ajouté pour 24 tables : flags établis depuis les getters ARM64, traductions, critères, grades, effets et BLOB protobuf. Relecture SQL et comparaison de toutes les propriétés adaptées avant export.
- `catalog_runtime_status` bloque les incompatibilités et leurs dépendances ; contrôles en mémoire pour sorts, équipements/utilisation, recettes et groupes de monstres. Le catalogue ne fournit pas les mécaniques privées du serveur officiel.
- Préparation sur `giny_catalog_stage_d3_v4_20260905`. Démarrage complet de la copie avec les trois modules, puis test Auth → personnage → HUD/version → carte. Combat créé contre un Piou Violet niveau 12, 56 PV / 3 PA / 3 PM, conforme au grade extrait.
- 47 tests .NET passent ; tests des flags Python, bascule/rollback MariaDB et chargeur client réussis. Compilation Release des cinq projets et build du client réussis.
- Préflight : aucune connexion joueur sur les instances concernées. Auth/World ne répondant pas à SIGTERM, arrêt ciblé des quatre PID après vérification ; MariaDB reste démarrée. Sauvegarde complète `.local/backups/before-runtime-publish-20260905T145121Z.sql.gz` avant bascule.
- Publication par un `RENAME TABLE` des 26 tables autorisées vers **giny_world**. Empreintes inchangées pour les **53 autres tables**, comprenant les données joueur et les modules. Aucun personnage de recette ni inventaire de validation importé.
- Anciens catalogues conservés dans **giny_catalog_rollback_20260905_145132** ; reçu `.local/catalog/giny_catalog_rollback_20260905_145132.json`. Script réutilisable `scripts/runtime-catalog.py prepare|publish|rollback`.
- Release client active : `output/catalogs/runtime-d3-v4`, version **974666cfbc0a54c0fc69cacbd495da35cd3be12438c3d0e38273b3879f39af04**. Pointeur `.local/catalog/active-runtime.json` ; Vite rechargé. Les racines graphiques restent accessibles en complément.
- Redémarrage actif Auth 8443 / World 5555 réussi. Connexion et personnage vérifiés avec la version attendue ; objets, sorts, niveaux de sorts et monstres servis en HTTP comparés octet par octet aux fichiers décompressés de la release.
- 20 076 objets adaptés. Hors disponibilité : 1 672 objets, 6 498 sorts, 14 859 niveaux de sorts, 3 359 monstres, 399 recettes, 395 PNJ et 3 récompenses d'étapes. La conversion et l'absence de gestionnaire inconnu ne garantissent pas une équivalence exhaustive aux règles officielles.
- Documentation : [CATALOGUE-OFFICIEL-SQL.md](../CATALOGUE-OFFICIEL-SQL.md).

## Options des modules — 7 septembre 2026 — références de 23:11 à 23:22

- Menus contextuels des sept modules des nouvelles captures : personnage, barre, chat, mini-carte, menus, attitudes/émoticônes et jauges. Titres, groupes, séparateurs, cases, boutons radio et sous-menus reproduits dans `ModuleContextMenu` ; les autres fenêtres gardent leur menu existant.
- Branchement des boutons des modules dont le pictogramme extrait ne s’appelle pas exactement `moreActions`. Menu ouvert placé devant les autres modules ; placement contraint par le canevas du HUD, sous-menus inversés près du bord droit.
- Réglages reliés au client : affichage des PV/invocations, petit module, une à trois lignes, masquage/restauration de la barre existante, jauge/couleur, filtres de carte, taille des icônes, texte/interligne/opacité du chat, taille des onglets et choix d’onglet de combat. Accès direct aux pages Raccourcis et Discussion ; copie des messages avec retour d’erreur si le presse-papiers refuse.
- Les fonctions sans implémentation restent visibles et désactivées : ajout de barre, sélection automatique des sorts en combat, grille depuis ce menu, limitation XP, honneur, jauges métier, langue/aide du chat et repli des effets de sorts. Les jauges existantes restent exclusives ; aucun système multijauge ajouté.
- Validation : build TypeScript/Vite réussi ; 42 tests ciblés dans six fichiers réussis. Recette navigateur sur `?ui-preview=hud` : PV à 64 %, trois lignes/36 cases, opacité finale à 0,3, filtres « Tout masquer »/« Tout afficher », 20 métiers dans trois groupes, icônes à 125 %, ouverture du menu Smiley. Captures dans `output/playwright/module-options-*.png`. Aucun parcours serveur déclaré validé par cette recette du HUD.

### Clic droit sur la carte — capture de 23:43

- Menu au pointeur dans WorldView et MapPreview, avec Zoom +/−/100 % et sous-menu Options générales. Placement inversé aux bords, fermeture par clic extérieur/Échap et navigation clavier.
- Zoom relié à la caméra (limites et retour au cadrage initial), grille réelle, calque de premier plan pour les entités hors combat et visibilité des coordonnées du HUD. Préférences locales persistées ; grille également raccordée au menu de mini-carte. Raccourcis Shift+1/Shift+2 hors saisie ; raccourci de grille de combat existant conservé.
- Mode créature et noms permanents restent visibles mais désactivés, faute d’implémentation correspondante.
- Build client et 32 tests caméra/bindings réussis. Recette sur la carte 154010371 : clic droit, sous-menu et grille visibles (`output/playwright/world-context-menu.png`). Pas de validation serveur ou de session multi-personnages déduite de cette recette locale.

## Menu d’un autre personnage — 8 septembre 2026

- Clic gauche sur un autre acteur `Character` : ouverture du menu au pointeur avant toute tentative de déplacement. Exclusion du personnage local, des PNJ et des monstres ; interactions de combat conservées.
- Présentation de la capture du 7 septembre 23:30 : nom, liste des actions, pictogrammes, séparateurs et sous-menu Informations. Nom/guilde issus de l’acteur sélectionné ; zoom, préparation du MP et ignorance locale pour la session raccordés.
- `/w Nom message` utilise `ChatClientPrivateMessage` 7053 avec `PlayerSearchCharacterNameInformation` 3022, conformément aux serializers C# locaux. Une commande privée incomplète est refusée avant tout envoi public. Aucun message envoyé pendant la recette.
- Ignorer retire et filtre les messages de cet identifiant, et filtre ses prochaines bulles ; réinitialisation à la prochaine session. Défi, rejoindre, profil, échanges, invitations, contacts, blocage persistant et signalement restent désactivés faute de parcours client complet.
- Validation : build réussi ; 9 tests sélection/protocole privé/chat réussis. Présentation, sous-menu et bascule d’ignorance vérifiés avec acteur de recette dans une page temporaire retirée ensuite. Capture `output/playwright/character-context-menu.png`. Pas de recette multi-joueurs en session réelle déclarée.

### 8 septembre — densité des menus contextuels

À la demande utilisateur, réduction commune de la police, des lignes, des marges et des pictogrammes : menus carte/personnage en 11 px, menus de modules en 14 px avant mise à l’échelle du HUD. Largeurs minimales réduites (carte 140 px, personnage 210 px, modules 180 px), mini-carte compactée aussi. Comportements et préférences conservés.

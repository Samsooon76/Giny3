# Extraction officielle → SQL → catalogues client

Exécution vérifiée le 5 septembre 2026 sur le client local **Dofus 3.6.10.11**, build du 24 août 2026, installé dans `/Applications/Ankama/Dofus-dofus3`.

## Résultat livré

**Adaptation publiée le 5 septembre 2026 dans `giny_world`.** Les 24 tables de catalogue et leurs deux tables de métadonnées sont actives. Les fichiers adaptés sont dans `output/catalogs/runtime-d3-v4/`, version `974666cfbc0a54c0fc69cacbd495da35cd3be12438c3d0e38273b3879f39af04`. Vite sert cette release ; Electron la sélectionne à son prochain démarrage via `.local/catalog/active-runtime.json`.

Sauvegarde complète immédiatement avant publication : `.local/backups/before-runtime-publish-20260905T145121Z.sql.gz`. Reçu de retour arrière : `.local/catalog/giny_catalog_rollback_20260905_145132.json`. Auth/World ont été reconstruits et redémarrés ; le test réel de personnage et la comparaison HTTP des quatre principaux catalogues ont réussi après publication.

Les **204 bundles DataRoot présents dans le dossier Data** ont été extraits : **284 920 entrées**. Les cinq tables de traduction sont également extraites : allemand, anglais, espagnol, français et portugais. Chaque langue contient 339 342 identifiants numériques et 7 346 clés hachées. Les noms de clés d'interface récupérables sont conservés en complément des hashes.

| Domaine | Entrées |
|---|---:|
| Objets, armes incluses | 21 748 |
| Monstres | 5 135 |
| Sorts | 17 067 |
| Niveaux de sorts | 34 697 |
| États de sorts | 6 375 |
| Définitions d'effets | 872 |
| Panoplies | 929 |
| Recettes | 4 858 |
| Quêtes | 1 976 |
| Étapes de quêtes | 2 225 |
| Objectifs de quêtes | 15 547 |
| Récompenses d'étapes | 6 707 |
| PNJ | 6 467 |
| Succès | 2 780 |
| Scripts de sorts présents dans le catalogue client | 14 929 |

L'inventaire complet et les empreintes par domaine figurent dans le manifeste d'extraction. Le catalogue contient aussi métiers, classes, montures, zones, donjons, coordonnées/références de cartes, dialogues, guildes, alliances, événements, etc.

**Périmètre exact : données DataRoot et traductions disponibles dans le client installé.** Les modèles, textures, sons, animations et cellules/layers de cartes utilisent les autres extracteurs existants ; ils ne sont pas réextraits par cette commande. Le bundle MonoScripts du dossier Data n'est pas un catalogue DataRoot. Les scripts de catalogue ne constituent pas le code du serveur officiel. IA, spawns réellement gérés côté serveur, déclencheurs privés et règles absentes du client ne peuvent pas être déduits d'un import de ces fichiers.

## Emplacements

- Base SQL locale créée : **`giny_catalog`**, MariaDB existante sur le port 3307.
- Release validée : `fc49306176c2138a93dc705aed1257883efe36df72bf6d119f7b8c448c0659ab`.
- Archive complète : `.local/catalog/snapshots/<snapshot>/`.
- Fichiers client régénérés depuis SQL : `output/catalogs/releases/<snapshot>/`.
- [Dernière préparation](../output/catalogs/releases/latest-prepared.json) : chemins absolus et identifiant de release.
- [Audit de compatibilité](audits/official-catalog-compatibility-2026-09-05.json).
- Logs : `.local/logs/official-catalog-{extract,import,export,sync,compatibility}.log`.

Un premier snapshot de validation est également conservé en SQL. Il précède l'ajout de quelques clés nommées d'interface à l'extraction finale. Les releases sont immuables ; les versions précédentes ne sont pas écrasées.

## Relancer après une mise à jour officielle

Depuis la racine du projet, MariaDB locale démarrée :

```bash
./scripts/sync-official-catalog.sh
```

La commande extrait le client installé, calcule l'identité du catalogue, importe une nouvelle release SQL si nécessaire, vérifie sa relecture, puis produit les fichiers client et `latest-prepared.json`. Une nouvelle exécution sur les mêmes données conserve la release existante et en vérifie l'intégrité. Elle ne remplace pas les tables de jeu Giny et n'active pas les fichiers dans la session de jeu.

Autre installation :

```bash
./scripts/sync-official-catalog.sh --client /chemin/vers/Dofus
```

Installation des dépendances sur une autre machine :

```bash
python3 -m venv .local/catalog-venv
.local/catalog-venv/bin/pip install -r client/dofus3/requirements.txt -r client/dofus3/requirements-catalog.txt
```

La machine de validation utilisait déjà UnityPy et pytest ; son environnement dédié hérite de ces paquets et ajoute PyMySQL. `GINY_CATALOG_PYTHON` permet de sélectionner un autre Python. Le mot de passe SQL éventuel se transmet par `GINY_CATALOG_DB_PASSWORD`, sans argument de ligne de commande.

Les étapes indépendantes restent disponibles :

```bash
export PYTHONPATH="$PWD/client/dofus3"
.local/catalog-venv/bin/python -m extractor.official_catalog --help
.local/catalog-venv/bin/python -m extractor.official_catalog extract --help
.local/catalog-venv/bin/python -m extractor.official_catalog import --help
.local/catalog-venv/bin/python -m extractor.official_catalog export --help
.local/catalog-venv/bin/python -m extractor.official_catalog verify --help
```

## Organisation SQL

| Table | Contenu |
|---|---|
| `catalog_builds` | Manifeste, version officielle, empreinte de release et statut |
| `catalog_datasets` | Domaine, nombre d'entrées et SHA-256 |
| `catalog_records` | Une ligne par `(snapshot, domain, record_id)`, données JSON complètes |
| `catalog_documents` | Arbres Unity bruts, types managés et traductions, JSON compressé |

Les champs inconnus, flags, effets, grades et données imbriquées restent conservés. Les arbres bruts gardent également les informations de type et les références Unity, en complément de la projection développée. Ce modèle est une **archive SQL de préparation**, pas un remplacement transparent des Records C# de Giny.

Exemple de lecture SQL des statistiques d'un monstre :

```sql
SET @snapshot = 'fc49306176c2138a93dc705aed1257883efe36df72bf6d119f7b8c448c0659ab';

SELECT record_id,
       JSON_EXTRACT(payload, '$.grades[0].level') AS level,
       JSON_EXTRACT(payload, '$.grades[0].lifePoints') AS life_points,
       JSON_EXTRACT(payload, '$.grades[0].actionPoints') AS action_points
FROM giny_catalog.catalog_records
WHERE snapshot = @snapshot AND domain = 'monsters'
LIMIT 10;
```

Il ne faut pas modifier directement une release importée : son empreinte ne correspondrait plus au contenu et l'export la refuserait. Un futur éditeur métier devra créer une révision de travail, valider les modifications puis publier une nouvelle release.

## Garanties vérifiées

- Correction de `inline_rids` : une référence partagée par plusieurs effets est développée à chaque occurrence ; les cycles restent bornés à la branche courante.
- Aucun pointeur Unity non résolu dans les 204 catalogues extraits. Cela ne garantit pas que toutes les références métier entre catalogues sont valides.
- Empreintes des bundles vérifiées avant/après leur lecture et à la fin de l'extraction.
- Comptage et SHA-256 de chaque catalogue, archive brute et traduction avant import et après relecture SQL.
- Import transactionnel InnoDB ; une erreur annule les entrées de la nouvelle release. Un test MariaDB injecte une erreur après insertion des records et vérifie le rollback complet.
- Pas de suppression de versions précédentes ; les noms `giny_world` et `giny_auth` sont refusés comme destination d'import.
- Export écrit dans un répertoire temporaire puis renommé après validation. Une altération SQL ne publie pas de dossier incomplet.
- Le JSON public est généré à partir de SQL. Les arbres Unity et métadonnées de types privés à l'archive ne sont pas copiés dans ce dossier public.
- Le chargeur réel `loadGameCatalog` du client a lu les fichiers de la release SQL ; noms français, objet, effets et niveau de sort vérifiés. Ce test ne constitue pas une recette de tous les écrans ou de tous les sorts.

Les fichiers gardent les chemins attendus (`data/items.json.gz`, `data/spells.json.gz`, etc.). `client/i18n.json.gz` sélectionne le français par défaut ; les cinq langues sont disponibles sous `i18n/`. Le catalogue produit ne contient pas les ressources graphiques : les racines d'assets existantes restent nécessaires. Ne pas remplacer toute la racine `GINY_DATA_ROOT` par ce dossier seul, ce qui masquerait les assets et cartes.

## Adaptation au moteur Giny

L'adaptateur `server/Servers/Giny.World/Catalog/` construit les véritables Records Giny à partir de l'archive SQL. Il conserve les champs propres au serveur et les lignes historiques/custom absentes de la source, puis sérialise les collections avec le protobuf du serveur. Chaque propriété sérialisée est relue depuis MariaDB et comparée avant de valider l'export.

Conversions effectuées :

- Flags décodés à partir des getters ARM64 du binaire installé, avec adresses, instructions et empreintes conservées dans le manifeste. Les constantes d'enum IL2CPP ne sont pas utilisées pour deviner les bits.
- Noms français, critères, booléens stricts et conversions numériques vérifiées ; aucun identifiant `short` ne doit déborder silencieusement.
- Grades de monstres : niveau, PV, PA/PM, résistances, esquives et référence de niveau de sort initial. `startingSpellId` référence ici un **niveau de sort**, malgré son nom.
- Effets : dés, valeur, durée, délai, cibles, déclencheurs, zones et prise en compte des entités portées. Les effets réservés à l'affichage client ne sont pas exécutés côté serveur.
- `EffectRecord.OppositeId` corrigé en entier ; paramètres de décroissance des zones corrigés. Les collections utilisent des colonnes LONGBLOB dans la copie préparée.
- Les armes sont aussi mises à jour dans `items`, pour conserver des recherches cohérentes si un identifiant change de catégorie entre versions.

La release adaptée contient 24 tables de catalogue et deux tables de métadonnées : `catalog_runtime_status` (disponibilité et motifs) et `catalog_runtime_release` (snapshot et version publique). Les tables de personnages, objets possédés, spawns, cartes et modules ne sont pas remplacées.

### Disponibilité de la release Dofus 3.6.10.11

| Domaine officiel | Adaptés en Records | Hors disponibilité |
|---|---:|---:|
| Objets, armes incluses | 20 076 | 1 672 |
| Sorts | 17 030 | 6 498 |
| Niveaux de sorts | 34 645 | 14 859 |
| Monstres | 5 076 | 3 359 |
| Recettes | 4 673 | 399 |
| PNJ | 6 072 | 395 |
| États de sorts | 6 375 | 0 |

Les colonnes ne s'additionnent pas : une ligne peut être convertie pour consultation mais rester indisponible à l'exécution. Le manifeste contient le détail des autres domaines et le motif de chaque exclusion.

Les exclusions comprennent les dépassements des IDs 16 bits du protocole actuel, les apparences invalides, le genre neutre des PNJ non représentable par le booléen actuel, les effets sans gestionnaire, les déclencheurs/cibles/zones non reconnus et les contraintes de lancement non implémentées. L'indisponibilité se propage aux sorts déclenchés, invocations, sorts des monstres et ingrédients/résultats des recettes. Un sort rejeté ne doit pas appliquer seulement une partie de ses effets.

Cette vérification ne prouve pas l'équivalence de chaque gestionnaire existant au serveur officiel. Les comportements privés, l'IA officielle et les règles absentes du catalogue restent hors périmètre. Les grades explicites sont utilisés ; les règles de génération de niveaux et de drops globaux conditionnels ne sont pas inventées.

### Performance

SQL porte les définitions persistantes et les versions. Au démarrage, Giny charge les Records et la disponibilité en mémoire. Les lectures de catalogue pendant le combat ou l'équipement restent en mémoire ; il n'y a pas d'aller-retour SQL par calcul de stats. L'état courant du combat reste côté serveur ; la persistance des personnages utilise le mécanisme transactionnel existant.

Le client lit les JSON compressés générés depuis SQL. Vite et Electron chargent le catalogue publié avant les racines graphiques existantes, qui continuent de fournir cartes, textures et animations. Le HUD et les snapshots de combat annoncent `catalog_version`. Le serveur contrôle la disponibilité même si un client envoie une action directement.

## Préparer, valider et publier une mise à jour

Depuis la racine, après `scripts/sync-official-catalog.sh` :

```bash
.local/catalog-venv/bin/python scripts/runtime-catalog.py prepare
```

Cette commande décode les flags, compile l'adaptateur, sauvegarde `giny_world`, restaure une copie `giny_catalog_stage_*`, adapte les 24 catalogues et écrit une nouvelle release sous `output/catalogs/runtime-*`. Les empreintes des tables actives sont conservées dans `baseline.json` : une modification concurrente du catalogue interdit la publication et impose une nouvelle préparation.

Valider la copie avec des instances Auth/World séparées et des ports dédiés. L'Auth de validation doit pointer vers sa propre copie de `giny_auth` et annoncer le port du World de validation. Ne pas démarrer deux World sur la même base.

```bash
GINY_AUTH_PORT=28443 GINY_TEST_CHARACTER_ID=2 \
GINY_TEST_CATALOG_VERSION=<catalogVersion> perl scripts/smoke-test.pl
```

L'option `GINY_TEST_MONSTER_ID=236` ajoute un groupe et vérifie le démarrage d'un combat sur un personnage de validation ; elle modifie cette copie et est refusée sur le port Auth actif 8443. Adapter l'identifiant de personnage au compte de test.

Après validation, arrêter les World concernés, vérifier qu'aucun joueur n'est connecté et sauvegarder avant publication :

```bash
.local/catalog-venv/bin/python scripts/runtime-catalog.py publish \
  --release output/catalogs/runtime-<version>
./scripts/start.sh
```

La publication vérifie les fichiers, les empreintes SQL et la version, puis effectue un seul `RENAME TABLE` pour les tables autorisées. Les anciennes tables sont conservées dans `giny_catalog_rollback_*`. Les empreintes des autres tables sont comparées avant/après. Un reçu de récupération est écrit **avant** la bascule SQL, puis `.local/catalog/active-runtime.json` est remplacé après la bascule.

Redémarrer Vite/Electron pour charger le nouveau pointeur. Il n'y a pas de promesse d'atomicité entre le système de fichiers et SQL : les World doivent rester arrêtés pendant la publication et le reçu permet la récupération en cas d'interruption.

Retour arrière, World arrêté :

```bash
.local/catalog-venv/bin/python scripts/runtime-catalog.py rollback \
  --receipt .local/catalog/giny_catalog_rollback_<horodatage>.json
./scripts/start.sh
```

Le rollback remet les anciens catalogues et le pointeur précédent ; il conserve les données joueur courantes. Les tables de la release retirée retournent dans la base de préparation.

## Vérifications d'intégration

- 47 tests .NET réussis, dont sérialisation des effets/grades et tests MariaDB du stockage joueur.
- Deux tests Python des getters de flags et deux tests du pipeline de publication, dont une vraie bascule/annulation MariaDB sur trois bases jetables avec invariance de la table `characters`.
- Compilation TypeScript/Vite réussie ; deux tests client sur le chargeur réel et le pointeur de publication réussis.
- World de validation complètement démarré avec les trois modules. Connexion, personnage, HUD/version et carte vérifiés.
- Combat de validation créé contre un Piou Violet niveau 12 : **56 PV, 3 PA, 3 PM**, identiques au grade officiel. Ce test ne constitue pas une recette exhaustive de tous les sorts, drops et quêtes.

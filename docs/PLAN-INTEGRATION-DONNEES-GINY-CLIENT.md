# Plan d’intégration des données Giny dans le client

Audit du 5 septembre 2026. Périmètre : `client/web` (React/Pixi/Electron), serveurs Auth/World, modules Pokéfus, GuildCamp et Quests, schéma MariaDB local sur le port 3307.

**Conclusion : la majorité des interfaces courantes peuvent réutiliser les données et services de Giny. Le principal chantier est le raccordement client ↔ serveur, mais il existe aussi des défauts réels de schéma, de contenu et de persistance. Ajouter des tables sans corriger ces trois points ne rendrait pas les interfaces fonctionnelles.**

Ce document constitue un plan d’exécution, pas une migration appliquée. L’audit a uniquement lu le code, les catalogues et la base ; aucune donnée de jeu n’a été modifiée. Les disponibilités décrites sont établies par inspection, sans validation interactive de tous les parcours.

## 1. Résultat attendu

Une interface est terminée lorsque :

1. Elle présente les valeurs de la session Giny authentifiée et du bon personnage.
2. Ses actions envoient une commande au serveur ; le serveur vérifie droits, propriété, ressources et contexte.
3. Le résultat accepté ou refusé revient au client, avec une explication exploitable.
4. Les autres fenêtres concernées se mettent à jour : équiper un objet modifie inventaire, apparence et statistiques ; réclamer une récompense modifie quête, monnaie et objets.
5. L’état persistant survit à la reconnexion et au redémarrage du serveur.
6. Une fonctionnalité absente, une liste vide et une erreur réseau ont des affichages distincts.

Le registre actuel contient **29 fenêtres principales : 24 dans le menu et 5 supplémentaires**. Il faut aussi traiter les dialogues PNJ, échanges, combats, notifications et les interfaces des modules. Ouvrir un arbre UI officiel dans l’explorateur n’est pas une preuve de prise en charge fonctionnelle.

Objectif proposé : terminer les parcours du quotidien puis viser au moins **26 fenêtres sur 29**, chacune avec une liste explicite d’actions validées. Boutique, Bourse aux Kamas et l’élevage moderne complet sont les trois périmètres à estimer séparément. Une fenêtre masquée ou indiquant « indisponible » ne compte pas comme fonctionnelle. Les montures simples et l’élevage moderne constituent deux périmètres différents.

## 2. Constats vérifiés

### 2.1 Ce qui existe déjà

- Connexion, choix du serveur, création/sélection du personnage, entrée sur carte, déplacements et changements de carte ont leur chemin réseau dans `GinyClient.ts`.
- Le serveur produit `ModernCharacterSnapshot` : identité, vie, énergie, XP, caractéristiques, kamas, poids, objets, sorts, raccourcis de sorts, métiers, résumé de guilde et quêtes classiques actives.
- Le client reçoit des mises à jour de HUD et demande aussi une réconciliation toutes les deux secondes.
- `ModernMapSnapshot` expose acteurs et interactifs, avec leurs identifiants serveur et leur état.
- Giny possède déjà les handlers pour équipement, consommables, statistiques, variantes de sorts, raccourcis, titres/ornements, banque, HDV, craft, groupes, guilde, PNJ, téléportation, succès et combats. Leur présence ne garantit pas que chaque branche soit complète.
- Les progressions du personnage sont largement sérialisées dans des BLOB : `Stats`, `Spells`, `Jobs`, `Shortcuts`, `Achievements`, `Quests`, `KnownTitles`, `KnownOrnaments`, `KnownEmotes`.
- Les modules journalières/hebdomadaires, Battle Pass, Pokéfus et campement disposent déjà de tables et de logique métier.

### 2.2 Le branchement UI est beaucoup moins avancé

`WorldView` fournit au HUD les données et l’envoi du chat. Il ne lui fournit pas encore une API d’actions pour équiper, acheter, réclamer, modifier un rang ou lancer un sort.

Exemples concrets :

- Le choix d’un sort dans `useSpells` modifie une sélection React locale ; il n’active pas la variante auprès de Giny.
- L’inventaire Bubble est un atelier de prévisualisation séparé : son reducer équipe et consomme localement. Il ne constitue pas une implémentation réseau de l’inventaire en jeu.
- La fenêtre officielle d’inventaire reçoit des données de HUD mais ne bénéficie pas d’une API métier de mutations.
- La guilde attend `members` côté TypeScript, mais `ModernCharacterSnapshot` ne l’émet pas. Son champ `kamas` est fixé à zéro.
- Le journal de quêtes attend des objectifs, récompenses et états terminés absents du résumé serveur actuel.
- L’élevage affiche des capacités et jauges fixes ; ses onglets et filtres sont essentiellement locaux.
- Plusieurs fonctions appelées `preview...` lisent un vrai catalogue extrait. Leur nom ne prouve pas que leurs données soient inventées ; en revanche, un catalogue ne représente pas ce que le joueur a effectivement débloqué.
- `[QUEST_STATE]`, `[POKEFUS_STATE]` et `[GUILD_CAMP_STATE]` sont masqués dans le traitement du chat. Aucun routage vers un store métier dédié n’a été trouvé dans le client inspecté.
- Un `ModernFightSnapshot` existe côté C#, mais il n’est pas déclaré ni consommé par `GinyClient` comme état de combat.

### 2.3 Différences mesurées entre catalogue Giny et catalogue client

Comparaison des identifiants SQL locaux avec les JSON extraits de `client/dofus3/output/data`. Les quatre fichiers comparés ne sont pas présents dans le petit dossier de substitutions `runtime/data` inspecté.

| Domaine | Entrées Giny | Entrées client | Identifiants communs | Seulement Giny | Seulement client |
|---|---:|---:|---:|---:|---:|
| Objets | 18 118 | 21 748 | 16 448 | 1 670 | 5 300 |
| Sorts | 17 729 | 17 067 | 14 178 | 3 551 | 2 889 |
| Monstres | 4 971 | 5 135 | 4 570 | 401 | 565 |
| Recettes, par objet résultat | 4 446 | 4 858 | 4 191 | 255 | 667 |

Parmi les objets dont l’identifiant existe des deux côtés, **471 ont un niveau différent et 305 un type différent**. Ces ensembles peuvent se recouper. Les 5 300 objets uniquement client ne sont pas automatiquement du contenu à importer : certains peuvent être supprimés, internes, cosmétiques ou incompatibles avec les règles Giny.

Conséquence : même un identifiant partagé ne suffit pas à garantir que l’infobulle, le filtre de catégorie, la recette ou le comportement soient corrects. Conserver les ressources visuelles Dofus 3, mais prendre les règles, effets, niveaux, recettes et disponibilités depuis Giny.

### 2.4 Défauts de base et de code prioritaires

| Constat | Preuve | Effet | Action |
|---|---|---|---|
| `guilds` n’a pas `Ranks`, `Bulletin`, `GlobalActivities`, `ChestActivities` | Comparaison schéma local / `GuildRecord` | Création, lecture et sauvegarde de guilde exposées à un décalage de structure | Migration de compatibilité et initialisation des valeurs |
| SQL Auth : `CharactersSlots` ; C# : `CharacterSlots` | `accounts` / `AccountRecord` | Noms non alignés ; la lecture positionnelle peut masquer le problème | Renommer en préservant les valeurs, ou introduire un mapping explicite |
| `characters` et `character_items` sont en MyISAM | `information_schema` | Pas de rollback transactionnel pour monnaie/objets | Conversion préparée vers InnoDB avant les récompenses et transferts |
| `accounts`, `world_characters`, `world_servers` sont aussi en MyISAM | Schéma Auth | Transactionnalité Auth à revoir pour slots/monnaie/création | Planifier la conversion séparément |
| `quest_objectives` et `quest_step_rewards` sont vides | `COUNT(*)` exact : 0 et 0 | Contenu classique inexécutable ou incomplet | Import cohérent, contrôles de références, couverture des types |
| Les deux getters correspondants renvoient toujours `null` | `QuestObjectiveRecord.GetQuestObjective` et `QuestStepRewardRecord.GetQuestStepReward` | Remplir les tables seul ne rétablit pas les quêtes | Restaurer les lectures et gérer explicitement les références inconnues |
| Récompenses en objets ajoutées après la transaction de claim | `QuestRewardService` et `BattlePassTrackService` | Une interruption entre claim et ajout peut perdre la livraison | Atomicité ou journal durable de livraison |
| Battle Pass : progression par `PlayerId`, réclamations par joueur/saison | Schéma + repository | La séparation de progression entre saisons n’est pas modélisée | Ajouter la saison si les saisons doivent repartir à zéro |
| Amis et ignorés : listes vides renvoyées par le serveur | `FriendsHandler` | Ce n’est pas uniquement un défaut du client | Persistance et services sociaux à implémenter |
| Inscription/désinscription/réponse Kolizéum commentées | `ArenaHandler` | Les boutons ne peuvent pas déclencher une arène utilisable | Moteur d’inscription, matchmaking et résultats |
| Havre-sac réduit à une téléportation fixe | `HavenBagHandler` | Pas de logement privé, décoration ou permissions | Modèle de havre-sac et gestion des instances |

Attention aux statistiques MariaDB : `TABLE_ROWS` est une estimation pour InnoDB. Les vérifications exactes trouvent **1 saison Battle Pass, 1 espèce Pokéfus, 1 configuration de capture et 1 compte World**, malgré certaines estimations à zéro. Ne pas réimporter ces données sous prétexte que l’estimation est nulle. La guilde est réellement vide au moment du contrôle.

### 2.5 Risque transversal de l’ORM

L’ORM lit `SELECT *` puis associe les colonnes aux propriétés **par position**. Son INSERT est aussi un `INSERT INTO table VALUES ...` sans liste de colonnes. Les propriétés sont ordonnées par `MetadataToken`.

Cela rend dangereuse une migration consistant simplement à ajouter des champs en fin de table : `Ranks`, par exemple, est attendu avant `CreationDate`. Ajouter des colonnes utilisées par un autre module peut également casser les INSERT existants.

**Première correction technique recommandée : utiliser des noms de colonnes explicites pour SELECT et INSERT**, puis valider la présence et les types attendus. Garder la compatibilité des sérialiseurs BLOB. L’option de reconstruction de table proposée par `DatabaseReader` appelle DROP/CREATE : ce mécanisme ne doit pas servir de migration d’une base contenant des joueurs.

## 3. Architecture cible

### 3.1 Trois sources bien définies

| Nature de donnée | Autorité | Transport / lecture |
|---|---|---|
| Apparence des interfaces, sprites, sons, modèles, icônes | Cache local extrait Dofus 3 | Fichiers servis par Electron/Vite |
| Catalogue de jeu : niveaux, effets, recettes, monstres, drops, sorts, quêtes disponibles | Records/configuration réellement utilisés par Giny | Export public versionné, avec correspondances visuelles |
| État du joueur et du monde : possessions, droits, progression, combat, échanges | Services Giny en mémoire et persistance serveur | Connexion World authentifiée, snapshots et événements |

Le renderer n’accède jamais à MariaDB. Il ne modifie pas directement un BLOB, une quantité, un solde ou une progression. Une vue SQL peut aider le serveur pour un classement, mais ne remplace pas les services métier et leur cache mémoire.

### 3.2 Catalogue public Giny

Créer un exporteur côté serveur chargé après les Records et les configurations des modules :

1. Exporter des DTO publics pour objets/armes/panoplies, sorts/niveaux/variantes/effets, métiers/recettes, monstres/drops/zones, quêtes/étapes/objectifs/récompenses, succès, titres/ornements et fonctionnalités custom.
2. Exclure comptes, mots de passe, inventaires privés, informations administrateur et configuration de connexion.
3. Ajouter un manifeste : `schemaVersion`, `catalogVersion`, `serverBuild`, `generatedAt`, hashes et décomptes par domaine.
4. Établir une correspondance explicite entre identifiant métier Giny et ressources visuelles client. Essayer la correspondance historique validée, puis une surcharge ; sinon utiliser un visuel de remplacement identifiable.
5. Faire préférer les valeurs Giny dans `catalog.ts`, `encyclopedia.ts` et les infobulles. Utiliser le catalogue Dofus 3 comme enrichissement visuel, pas comme source de prix, d’effets ou de propriété.
6. Séparer les catalogues par domaine et les charger à la demande. Les gros catalogues ne doivent pas être inclus dans chaque snapshot de personnage.
7. Servir les exports par la couche locale Electron/Vite existante. Si le World devient distant, ajouter une distribution de catalogue explicitement autorisée par la politique réseau du produit.
8. À la connexion, comparer les versions annoncées ; en cas de désaccord incompatible, présenter l’erreur et empêcher les actions affectées.

Les textes et noms Giny déjà présents dans les Records priment ; les descriptions manquantes peuvent être enrichies si la correspondance sémantique est validée. Un sort ayant gardé son ID mais changé d’effet ne doit pas conserver une description trompeuse.

### 3.3 Contrats réseau et état client

Conserver la connexion TCP via WebSocket ou IPC Electron existante. Réutiliser les messages Giny standard pour les opérations déjà couvertes. Pour les fonctionnalités custom, créer des messages modernes typés vers les mêmes services métier.

Contrat proposé pour les nouveaux échanges :

```ts
type DomainEnvelope<T> = {
  schemaVersion: number
  sessionEpoch: string
  characterId: string
  domain: string
  revision: number
  requestId?: string
  payload: T
}

type CommandResult = {
  requestId: string
  success: boolean
  errorCode?: string
  message?: string
  affectedDomains: string[]
}
```

Ce contrat est une proposition, pas un message déjà disponible. Ne pas attribuer des IDs réseau au hasard : inventorier ceux de `Giny.Protocol`, y compris les extensions modernes et la limite du framing. Les messages standard sans `requestId` restent traités selon leur protocole, avec une seule mutation concurrente par domaine si nécessaire.

- Envoyer les identifiants `BIGINT` en chaînes dans les nouveaux JSON ; les `number` JavaScript perdent la précision au-delà de `Number.MAX_SAFE_INTEGER`. Adapter les frontières existantes progressivement.
- Valider les payloads à l’exécution ; le typage TypeScript ne valide pas un JSON reçu.
- Créer des stores séparés : personnage, inventaire, sorts, quêtes classiques, quêtes récurrentes/Battle Pass, social, guilde/campement, échange, combat, Pokéfus.
- Chaque store gère chargement, version, erreur, fraîcheur et mutation en cours.
- Purger données et commandes à la déconnexion/changement de personnage ; ignorer les réponses d’une ancienne session.
- Émettre les mises à jour après validation et persistance. Un timeout signifie « résultat inconnu », pas « opération forcément échouée » : resynchroniser avant de réessayer un achat ou une récompense.
- Installer l’attente de réponse avant l’envoi pour les nouveaux chemins réseau ; éviter les courses entre réponse immédiate et inscription du waiter.
- Remplacer progressivement le polling global de deux secondes par des événements ciblés ; conserver une réconciliation limitée en secours.
- Borner la file des messages non consommés. `dispatchFrame` ajoute actuellement les paquets restants à `frames` ; de nombreuses interfaces nouvelles augmenteront ce volume.
- Annoncer des capacités par serveur et domaine : `read`, `write`, version, motif d’indisponibilité. Ne pas confondre capability globale et droit du joueur, qui doit être recalculé par le serveur.

Pour les modules, solution de transition : décoder les préfixes d’état avant de filtrer le chat, les router vers leur store, et encapsuler les commandes actuelles derrière une API d’actions. Puis migrer vers de vrais messages réseau et garder le chat pour les échanges humains. Les commandes administrateur restent réservées aux administrateurs.

## 4. Matrice des 29 fenêtres

Légende : **B** = branchement surtout client ; **C** = contenu/contrat à compléter ; **S** = nouveaux services/persistance. Les niveaux expriment le travail restant, pas un taux d’avancement testé.

| Fenêtre / arbre | Situation actuelle | Travail nécessaire | Base | Lot |
|---|---|---|---|---|
| Personnage / `characterSheetUi` | Stats live disponibles | B : booster/reset, ventilation exacte, progression, conditions | Réutiliser `characters.Stats`, `Experience` | 2 |
| Sorts / `playerSpell` | Liste live, sélection locale | B/C : variante active, niveaux, raccourcis, règles Giny | `characters.Spells`, `Shortcuts`, catalogue existant | 2 |
| Inventaire / `equipmentStorageUi` | Données live, mutations non câblées | B : équiper, retirer, utiliser, nourrir, quantité, suppression avec résultat | `character_items`, `characters` | 2 |
| Monture / `rideParentUI` | Pas de projection live identifiée | S : posséder, équiper, monter, nourrir, XP, inventaire | Modèle montures proposé | 7 |
| Quêtes / `quests` | Résumé classique, détails manquants | C : réparer classique ; intégrer récurrentes et claims | Tables existantes, préférences éventuelles | 3 |
| Carte / `CartographyMapUI` | Position live + fond local | B/C : destinations réellement disponibles, zaaps, objectifs, repères | Tables cartes/waypoints existantes | 2–3 |
| Calendrier / `calendarUI` | Arbre UI sans domaine métier dédié | S : événements serveur, jours, détails, droits aux récompenses si proposés | `calendar_events`, claims conditionnels | 6 |
| Classement / `LadderUI` | Arbre UI | S : classement public calculé, filtres, pagination, rang personnel | Lecture existante ; snapshots optionnels | 6 |
| Recherche de groupe / `groupSearch` | Arbre UI ; groupes classiques côté serveur | S : annonces, candidature, invitation et expiration | Annonces persistantes optionnelles | 6 |
| Apparence / `cosmeticUi` | Catalogue cosmétique, possessions partielles | B/C : titres/ornements connus, sélection, objet vivant, tenue | Champs existants ; tenues/déblocages si nouveau modèle | 2, 6 |
| Amis / `friends` | Serveur renvoie listes vides | S : ajouter/retirer/ignorer, statut, notes, invitations pertinentes | Relations sociales | 5 |
| Guilde / `guildBase` | Résumé sans membres ; schéma incomplet | B/C : membres, rangs, droits, XP, notes, bulletin, invitations | Réparer `guilds`, réutiliser BLOB ; coffre/recrutement optionnels | 5 |
| Alliance / `allianceBase` | Arbre UI sans moteur identifié | S : identité, guildes membres, droits, invitations, chat | Modèle alliances | 7 |
| Succès / `achievements` | Points live et catégories catalogue | B/C : progression, détails, terminés, récompenses, suivi | `characters.Achievements` + catalogues existants | 3 |
| Boutique / `webBase` | Coquille web | S : catalogue privé, stock/droits, achat et livraison | Modèle commercial ; monnaie existante à réutiliser | 8 |
| Encyclopédie / `encyclopediaBase` | Consultation de données Dofus 3 | C : basculer vers catalogue Giny, butins/conditions/zones serveur | Export, pas duplication des monstres/objets | 1–3 |
| Métiers / `jobUI` | XP live, catalogue UI | B/C : recettes réalisables, ressources, sélection métier, progression réelle | `characters.Jobs`, `recipes`, `skills` | 4 |
| Guide / `guidebookBase` | Arbre UI | C : contenu Giny, recherche, liens vers actions disponibles | Fichiers versionnés suffisants | 6 |
| Ensembles / `CharacterPresetUi` | Arbre UI | S : CRUD et application d’équipement/sorts/raccourcis | Presets + entrées typées | 6 |
| Collection / `collectionTab` | Arbre UI | S/C : préciser collection Pokéfus ou collection générale ; progression réelle | Pokéfus existant ; nouvelle progression seulement si distincte | 3, 6 |
| Bourse / `bakTab` | Arbre UI | S : ordres, réservations, appariement, annulation, journal | Modèle économique séparé | 8 |
| Alignement / `alignmentTab` | Pas d’état persistant dédié identifié | S : choisir alignement, grade/honneur, progression et conditions | `character_alignments` | 7 |
| Havre-sac / `havenbagManager` | Téléportation fixe | S : instance personnelle, salles, mobilier, visites/droits | Havre-sacs, salles, placements | 7 |
| Kolizéum / `PvpArenaBase` | Handlers inactifs | S : file, confirmation, matchmaking, combat, résultat | Saisons/ratings/matches ; file en mémoire possible | 7 |
| Élevage / `BreedingUi` | Filtres et jauges locales | S : stable/enclos/transferts/généalogie puis reproduction | Montures/enclos ; clonage/extraction à définir séparément | 7–8 |
| Banque / `storageBank` | Moteur `BankExchange`, UI générique | B : ouvrir via PNJ, contenu privé, transférer objets/kamas, fermer | `bank_items`, `world_accounts.BankKamas` | 4 |
| HDV / `auctionHouse` | Moteur achat/vente, UI générique | B/C : recherche, prix, lots, achat, vente/retrait, suivi | `bidshops`, `bidshop_items` ; historique optionnel | 4 |
| Craft / `CraftUI` | Moteur métiers, UI générique | B/C : atelier valide, ingrédients, quantité, résultat, interruption | Tables existantes | 4 |
| Recettes / `recipesUI` | Catalogue extrait | C : recettes Giny, composants possédés, quantité fabricable, navigation | `recipes`, inventaire courant | 1, 4 |

L’interface Apparence englobe également `AppearanceUI` : modifier visage/couleurs/corps après création nécessite un service serveur validant les choix et, si nécessaire, leur coût. Réutiliser les champs d’identité/look existants ; ne pas rendre gratuit un service payant simplement en branchant un sélecteur visuel.

## 5. Interfaces transversales et modules

### 5.1 Combat : indispensable pour que la progression ait un sens

Priorité juste après le socle inventaire/sorts, et avant de valider les quêtes de combat.

1. Demander une attaque de groupe de monstres ; identifier groupe et adversaires depuis Giny.
2. Recevoir le contexte de combat et les équipes/cellules de placement.
3. Déplacer le personnage en placement, confirmer prêt, rejoindre/quitter selon les règles.
4. Afficher timeline, combattant actif, temps de tour, PA/PM/vie/bouclier.
5. Cibler et lancer un sort/arme ; fournir les règles du niveau et de la variante active depuis Giny.
6. Gérer cooldowns, états, buffs, invocations, déplacements forcés, mort et abandon.
7. Implémenter les acquittements d’action et de tour attendus par le séquenceur Giny.
8. Afficher résultats, XP, drops, kamas et changements de progression.
9. Reprendre un combat après reconnexion sans renvoyer la dernière attaque.

Étendre `ModernFightSnapshot` avec phase, combattant actif, délai serveur, cellules autorisées, états et résultats nécessaires. Ne pas supposer que son champ `last_action` suffit à rejouer tout le protocole de combat. Les classes d’effets visuels présentes côté client ne remplacent pas ce contrôleur réseau.

**SQL : aucune table nouvelle nécessaire pour le combat PvM de base.** L’historique de combats et le classement saisonnier sont des besoins supplémentaires.

### 5.2 PNJ, dialogues et échanges

- Ajouter un store de dialogue : PNJ, carte, question, réponses autorisées, contexte, révision.
- Brancher `NpcGenericActionRequestMessage`, `NpcDialogReplyMessage`, `LeaveDialogRequestMessage` et les réponses correspondantes.
- Ouvrir banque/HDV/craft uniquement à partir d’un contexte serveur valide ; l’explorateur UI reste un outil de développement.
- Invalider le dialogue au changement de carte, au combat et à la déconnexion.
- Gérer invitation, acceptation, objets/kamas proposés, changements d’offre et double validation pour les échanges joueur ↔ joueur.
- Vérifier les branches de `Exchange` qui lèvent `NotImplementedException`. Certaines représentent une action inapplicable au type d’échange, pas une fonction à implémenter ; elles doivent être refusées proprement si une requête les atteint.

### 5.3 Quêtes classiques, récurrentes et Battle Pass

Conserver trois identités distinctes : `classic:QuestId`, `recurring:PlayerQuestId`, `battlepass:SeasonId`. Un `TemplateId` récurrent n’est pas un identifiant de quête classique.

**Classiques :** état courant d’étape, objectifs et compteurs par objectif, quêtes terminées, conditions de visibilité et récompenses calculées par Giny. Réparer les deux getters désactivés, puis vérifier `QuestsHandler` sur un ID inconnu. L’import doit relier quêtes → étapes → objectifs/récompenses → PNJ/cartes/objets existants. Adapter ou marquer non pris en charge les types d’objectifs absents du moteur.

**Récurrentes :** réutiliser les 5 tables existantes `quest_templates`, `quest_rewards`, `player_quests`, `player_quest_rewards`, `player_battle_pass_progress` et, pour les claims de passe, les tables spécifiques ci-dessous. Le service d’état fournit déjà périodes, compteurs, objectifs, récompenses et échéances ; le client doit les consommer. Le suivi/masquage des quêtes ne doit pas être réinitialisé à chaque snapshot.

**Battle Pass :** réutiliser `battle_pass_seasons`, `battle_pass_rewards`, `player_battle_pass_claims`. Afficher saison, piste gratuite/VIP, niveau, XP, paliers, état récupérable/récupéré et échéance du serveur. Une saison existe en base ; son existence ne prouve pas qu’elle soit active à la date de connexion.

### 5.4 Pokéfus

Réutiliser :

- Configuration : `pokefus_capture_configuration`, `pokefus_capture_nets`, `pokefus_species`, `pokefus_genome_branches`, `pokefus_genes`.
- Joueurs : `pokefus`, `player_pokefus_species_progress`, `player_pokefus_researched_genes`, `pokefus_unlocked_genes`, `pokefus_equipped_genes`.

Brancher collection, équipe, capture ciblée au filet, recherche/déblocage/équipement des gènes, prérequis et ressources consommées. Les services et commandes joueur correspondants existent. Commencer par l’espèce effectivement configurée, puis élargir le contenu avec des références de monstres/objets/sorts valides. Ne pas confondre ce système avec l’élevage de montures Dofus 3.

### 5.5 Campement de guilde

Les 8 tables existent déjà : `guild_buildings`, `guild_building_levels`, `guild_building_effects`, `guild_building_level_requirements`, `guild_building_states`, `guild_projects`, `guild_project_requirements`, `guild_project_contributions`.

Brancher lecture des bâtiments et effets, lancement du projet, contributions kamas/ressources, progression, droits et résultat. Réparer d’abord le schéma et la création de guilde. Le test Forge niveau 1 → niveau 2 existant est un bon point de départ, mais ne remplace pas un test depuis les boutons du client.

## 6. Plan précis de base de données

Les noms suivants désignent soit des corrections identifiées, soit des propositions explicitement nouvelles. On ne crée pas une table par fenêtre : plusieurs interfaces doivent partager le même modèle.

### 6.1 Corrections requises avant les nouveaux domaines

| Table | Modification | Valeur initiale / reprise | Priorité |
|---|---|---|---|
| `guilds` | Ajouter `Ranks BLOB`, `Bulletin BLOB`, `GlobalActivities BLOB`, `ChestActivities BLOB` | Sérialiser des valeurs C# valides ; reconstruire les rangs depuis les membres si des guildes existent dans une autre base | P0 |
| `giny_auth.accounts` | Aligner `CharactersSlots` avec `CharacterSlots` | Préserver chaque valeur, défaut métier actuel 5 ; contrôler les bornes du `byte` avant réduction de type | P0 |
| `characters` | Passer MyISAM → InnoDB | Conserver PK, données et BLOB | P0 |
| `character_items` | Passer MyISAM → InnoDB ; index `CharacterId` | Contrôler les références personnage et quantités avant contraintes | P0 |
| `characters` | Index `AccountId`, `GuildId` si utiles aux requêtes | Rechercher les doublons avant une éventuelle unicité de `Name` | P1 |
| `bank_items` | Index `AccountId` | Pas de nouvelle table de banque | P1 |
| `bidshop_items` | Index adaptés aux requêtes `(BidShopId,GId,Sold)` et `(AccountId,Sold)` | Vérifier par plans de requêtes, adapter à l’ordre réel de filtrage | P1 |
| `quest_objectives`, `quest_step_rewards` | Import du contenu compatible ; index `StepId` si requêté | Ne pas importer sans adaptation des types et BLOB | P0/P1 |
| `player_battle_pass_progress` | Ajouter `SeasonId BIGINT NOT NULL` et PK `(PlayerId,SeasonId)` si progression saisonnière | Migration avec une saison explicitement choisie, adaptation de toutes lectures/écritures | P1 |

Pour le Battle Pass, décider si `Vip` est un droit de saison ou de compte. Dans le premier cas, il reste sur la progression saisonnière ; dans le second, il faut le lire depuis un droit de compte. Ne pas conserver une ambiguïté qui accorderait involontairement la piste VIP de toutes les saisons.

L’alignement des types SQL est un chantier séparé : les `TINYINT` signés, identifiants C# `short`, booléens en texte et dates en texte sont hérités du mapping ORM. Établir min/max et usages avant toute conversion. Une extension de catalogue au-delà de 32 767 pour un ID `short` implique aussi DTO, protocoles et sérialiseurs ; modifier seulement SQL ne suffit pas.

Vérifier également les attributs de sauvegarde : `GuildRecord.Experience` et `AccountRecord.Ogrines`/`CharacterSlots` ne portent pas `[Update]` dans les fichiers inspectés. L’ORM limite les UPDATE aux propriétés annotées. Pour chaque service qui doit les modifier, identifier son chemin de persistance et corriger l’annotation ou la requête dédiée ; la simple existence d’une colonne ne prouve pas que sa nouvelle valeur soit sauvegardée.

### 6.2 Nouvelles tables de socle proposées

**`schema_migrations` — nécessaire pour fiabiliser les évolutions**

- `Module VARCHAR(64)`, `Version VARCHAR(64)`, `Checksum CHAR(64)`, `AppliedAt DATETIME(6)`.
- PK `(Module,Version)` ; checksum immuable, dates UTC.
- Exécution une fois et arrêt clair si checksum incohérent. Les patches actuels de modules sont rejoués au démarrage : enregistrer une base de référence après vérification, puis n’appliquer que les nouvelles versions.
- Les deux fichiers préfixés `002` appartiennent à des fonctionnalités différentes : le namespace du module évite une collision.

**`reward_deliveries` — recommandée si la livraison ne peut pas être atomique dans les tables existantes**

- `Id BIGINT` PK ; `CharacterId BIGINT NOT NULL` ; `SourceType VARCHAR(32)` ; `SourceKey VARCHAR(128)` ; `RewardIndex INT`.
- `PayloadVersion INT`, `Payload LONGTEXT`, `State VARCHAR(16)`, `CreatedAt DATETIME(6)`, `DeliveredAt DATETIME(6) NULL`.
- UNIQUE `(CharacterId,SourceType,SourceKey,RewardIndex)` ; index `(State,CreatedAt)`.
- Écrire claim et livraison prévue dans la même transaction. Le worker inscrit les objets et marque la livraison exécutée dans une transaction atomique ; le cache mémoire est ensuite réconcilié.
- Si `Inventory.AddItem` ne permet pas de participer à cette transaction, le refactorer ou ajouter une identité de livraison durable aux attributions. Un simple booléen changé après `AddItem` ne garantit pas l’absence de doublons.
- Alternative acceptable : intégrer entièrement monnaie, XP et objets à la transaction existante ; dans ce cas cette table n’est pas obligatoire.

**`game_asset_mappings` — optionnelle ; un fichier versionné peut suffire au début**

- `EntityKind VARCHAR(32)`, `GinyId BIGINT`, `AssetPackVersion VARCHAR(64)`, `ClientId BIGINT NULL`, `IconId INT NULL`, `Look TEXT NULL`, `UpdatedAt DATETIME(6)`.
- PK `(EntityKind,GinyId,AssetPackVersion)` ; seulement les correspondances nécessaires, pas une copie de toutes les tables officielles.

### 6.3 Nouvelles tables utiles aux interfaces du quotidien

**`account_relations` — amis / ignorés**

- `OwnerAccountId INT`, `TargetAccountId INT`, `RelationType VARCHAR(16)`, `Note VARCHAR(255) NULL`, `CreatedAt DATETIME(6)`.
- PK `(OwnerAccountId,TargetAccountId,RelationType)` ; index inverse `(TargetAccountId,RelationType)`.
- Interdire l’auto-relation et contrôler existence, limites et valeurs de type. Statut en ligne calculé depuis les sessions, pas stocké comme vérité durable.
- Choix initial : relations locales au serveur World ; si elles doivent être communes à plusieurs mondes, déplacer la propriété du service vers Auth et prévoir l’échange IPC. Ne pas ajouter de FK vers un compte Auth sans vérifier moteurs et cycle de suppression.

**`character_presets` + `character_preset_entries` — ensembles**

- Parent : `Id BIGINT` PK, `CharacterId BIGINT`, `Name VARCHAR(64)`, `IconId INT NULL`, `PresetType VARCHAR(16)`, `SortOrder INT`, `Revision BIGINT`, `UpdatedAt DATETIME(6)`.
- Entrées : `PresetId BIGINT`, `EntryType VARCHAR(16)`, `Slot INT`, `ItemUid INT NULL`, `SpellId INT NULL`, `VariantId INT NULL`, `ShortcutType VARCHAR(16) NULL`.
- PK entrées `(PresetId,EntryType,Slot)` ; FK vers parent avec suppression en cascade ; index parent `(CharacterId,SortOrder)`.
- Contraintes par type d’entrée ; ne pas référencer un objet seulement par GID si deux exemplaires ont des effets différents.
- Appliquer un ensemble via les validations d’inventaire/sorts, avec résultat global. Signaler les objets vendus/supprimés. Choix recommandé : refuser l’application entière si elle ne peut pas être cohérente.

**`character_ui_preferences` — optionnelle pour synchronisation entre appareils**

- `CharacterId BIGINT`, `PreferenceKey VARCHAR(64)`, `Value LONGTEXT`, `SchemaVersion INT`, `UpdatedAt DATETIME(6)` ; PK `(CharacterId,PreferenceKey)`.
- Limiter taille et clés permises. Suivi de quêtes, filtres et favoris peuvent rester locaux dans une première livraison, avec stockage séparé par personnage.
- Ne pas mettre les sorts actifs, équipements, monnaie ou droits dans ces préférences.

**`calendar_events` — calendrier serveur**

- `Id BIGINT` PK, `Code VARCHAR(64)` UNIQUE, `Title VARCHAR(180)`, `Description TEXT`, `StartsAt DATETIME(6)`, `EndsAt DATETIME(6)`, `EventType VARCHAR(32)`, `TargetId BIGINT NULL`, `Enabled BOOLEAN`.
- Index `(Enabled,StartsAt,EndsAt)` ; contrôler `EndsAt > StartsAt`.
- Si les événements donnent des récompenses, ajouter `calendar_claims(AccountId ou CharacterId,EventId,PeriodKey,ClaimedAt)` avec unicité de bénéficiaire/événement/période ; réutiliser le service de livraison. Décider explicitement du bénéficiaire.

**Recherche de groupe et classement : aucune nouvelle table obligatoire pour leur première version.**

- La recherche peut conserver les annonces en mémoire, indexées par personnage, supprimer les annonces à la déconnexion et inviter dans le système de groupe existant.
- Si les annonces doivent survivre : `group_listings(Id,LeaderCharacterId,ActivityType,TargetId,MinLevel,MaxLevel,Capacity,Description,ExpiresAt,Status)` ; candidatures `group_applications(ListingId,CharacterId,Status,CreatedAt)`, PK composite. L’expiration reste obligatoire.
- Le classement de niveau peut être calculé depuis `characters.Experience`. Pour succès ou valeurs en BLOB, calculer côté services puis publier une projection ; ne pas essayer de trier le BLOB en SQL.
- Pour historique/saisons : `ladder_snapshots(SeasonId,Metric,CharacterId,Value,Rank,ComputedAt)`, PK `(SeasonId,Metric,CharacterId)`, index `(SeasonId,Metric,Rank)` ; exclure personnages administrateurs selon la règle du serveur.

### 6.4 Tables conditionnelles pour les domaines plus importants

Ces propositions nécessitent un modèle métier complet ; leur création seule n’ouvre pas les fonctionnalités.

| Domaine | Tables proposées et clés | Champs principaux / règles |
|---|---|---|
| Alliances | `alliances(Id)` ; `alliance_guilds(GuildId)` ; `alliance_ranks(AllianceId,RankId)` ; invitations optionnelles | Nom/emblème, guilde dirigeante, date ; adhésion `AllianceId,RankId,JoinedAt` ; droits ; une guilde dans une seule alliance ; chat via sessions |
| Alignement | `character_alignments(CharacterId)` | `AlignmentId,Grade,Honor,Dishonor,QuestProgress,UpdatedAt` ; valeurs et changements validés serveur |
| Montures | `mounts(Id)` ; `character_mount_state(CharacterId)` ; `mount_items` si stockage nécessaire | Espèce, propriétaire, nom, sexe, XP, énergie, maturité, amour, endurance, sérénité, fatigue, capacités, parents, lieu stable/enclos/équipée ; une seule localisation ; ID monture équipée et mode monté |
| Enclos | `paddocks(Id)` ; `paddock_objects(Id)` ; `mount_breeding_events(Id)` | Carte/cellules, propriétaire/guilde, capacité, permissions ; objets placés et durabilité ; parents, dates, naissance et résultat déterministe persisté |
| Havre-sac | `haven_bags(Id)` ; `haven_bag_rooms(Id)` ; `haven_bag_furniture(Id)` | Propriétaire compte, thème et droits de visite ; salle/template ; objet possédé, cellule et rotation ; aucune décoration inventée par le client |
| Kolizéum | `arena_seasons(Id)` ; `arena_ratings(SeasonId,CharacterId,Mode)` ; `arena_matches(Id)` ; `arena_match_participants(MatchId,CharacterId)` | Rating, victoires/défaites, abandon/pénalité ; équipe, résultat et deltas ; persister résultat et attribution une seule fois ; file en mémoire |
| Coffre de guilde, si retenu | `guild_chest_items(UId)` ; `guild_wallets(GuildId)` ; journal d’opérations | Propriétés d’objet identiques au stockage existant, guilde/onglet ; kamas >= 0 ; droits retrait/dépôt ; transaction avec inventaire personnage |
| Recrutement guilde, si retenu | `guild_recruitment(GuildId)` ; `guild_applications(Id)` | Présentation, critères, candidature, statut, dates ; absence actuelle d’une candidature n’est pas un moteur de recrutement |
| Déblocage cosmétique permanent, si retenu | `account_cosmetic_unlocks(AccountId,CosmeticId)` | Source/date de déblocage ; ne pas remplacer la propriété d’objets par cette table si le modèle choisi reste basé sur les objets |

Les types précis du modèle de montures doivent être arrêtés avec les règles effectivement implémentées. La fenêtre Dofus 3 expose accouplement, clonage et extraction : rien dans l’audit ne permet d’affirmer que Giny implémente ces mécanismes. Commencer par monture simple/stable, puis reproduction définie ; traiter clonage/extraction comme extensions distinctes.

Pour une collection générale, ne pas créer immédiatement une table fourre-tout : succès, titres, ornements et Pokéfus possèdent déjà une progression. Une table `character_collection_progress(CharacterId,CollectionId,EntryId,Progress,UnlockedAt)` ne se justifie que pour une nouvelle collection avec règles propres.

### 6.5 Boutique et Bourse aux Kamas : lot économique séparé

- Boutique privée : `shop_products`, `shop_prices`, `shop_orders`, `shop_order_lines`, avec achat identifié par une clé idempotente, prix fixé par le serveur, monnaie réservée/débitée, livraison durable et états explicites.
- `giny_auth.accounts.Ogrines` existe déjà. Ne pas inventer un second solde d’ogrines dans World. Décider quel service possède la monnaie et comment il confirme débit/livraison. Un verrou C# de personnage ne sécurise pas à lui seul des écritures sur deux processus Auth/World.
- Bourse privée : `currency_orders`, `currency_trades`, `currency_reservations` et journal comptable. Il faut gérer soldes disponibles/réservés, achats concurrents, prix, quantité partielle, annulation, frais et récupération après panne.
- Les monnaies du serveur privé doivent être clairement définies ; les UIs officielles ne donnent pas accès à une boutique ou bourse officielle.
- Aucun de ces services ne doit être simulé avec des montants modifiés uniquement dans React.

### 6.6 Tables qu’il n’est pas nécessaire de recréer

- Stats, sorts appris/variantes, métiers, raccourcis, succès, quêtes classiques : déjà dans `characters`.
- Membres/rangs/notes : modèle de guilde déjà en BLOB, à remettre en cohérence avant une éventuelle normalisation ultérieure.
- Inventaire, banque, HDV : `character_items`, `bank_items`, `bidshop_items`.
- Données classiques : objets, effets, sorts, niveaux de sorts, monstres, recettes, cartes, PNJ, succès, quêtes.
- Journalières/hebdomadaires, Battle Pass, Pokéfus, campement : tables déjà présentes.
- Ressources visuelles, guides statiques et disposition des fenêtres : fichiers/cache local suffisent.

## 7. Ordre d’exécution détaillé

Les estimations sont des ordres de grandeur en jours de travail concentré pour une personne connaissant le dépôt, tests inclus. Elles ne sont ni un devis ni une promesse : la couverture des quêtes et les règles des systèmes absents peuvent fortement les modifier.

### Lot 0 — schéma, persistance et preuves reproductibles — 3 à 6 jours

1. Sauvegarder et restaurer la base dans un environnement de validation.
2. Ajouter un comparateur Records ↔ schéma : noms, types, ordre hérité, index, moteur, valeurs nulles ; inclure propriétés héritées des objets et records des modules.
3. Corriger SELECT/INSERT positionnels de l’ORM ; vérifier lecture/création/sauvegarde d’un compte, personnage, objet, guilde et record de module.
4. Introduire `schema_migrations` et enregistrer le niveau réel des patches existants.
5. Aligner les champs de guilde et le nom des slots Auth, avec backfill C# des BLOB.
6. Préparer la conversion InnoDB des tables de progression/inventaire et les index nécessaires.
7. Corriger le parcours transactionnel des récompenses, avec livraison atomique ou journal durable.

**Sortie :** une base existante migre sans effacement ; un rollback de récompense n’altère pas monnaie/objets ; une récompense confirmée n’est ni perdue ni doublée après interruption.

### Lot 1 — catalogue Giny et contrats modernes — 4 à 8 jours

1. Exporteur public et manifeste de version.
2. Rapport complet IDs/références/types/effets/ressources visuelles.
3. Correspondances et fallbacks explicites ; priorité serveur dans les infobulles.
4. Stores, enveloppes versionnées, capabilities et API d’actions injectée au HUD.
5. Routage des messages de modules, gestion session/révision et files bornées.
6. Test d’égalité de catalogue entre Vite et Electron, puis changement de catalogue sans résidus de cache.

**Sortie :** l’encyclopédie, les recettes et les infobulles décrivent le jeu Giny ; les 471 écarts de niveau et 305 écarts de type ne sont plus silencieusement présentés comme les valeurs serveur.

### Lot 2 — personnage, inventaire, sorts et HUD — 4 à 7 jours

1. API client `equipItem`, `unequipItem`, `useItem`, `deleteItem`, `feedItem`, avec quantités, erreurs et mutation en cours.
2. Branchement des handlers existants et rafraîchissement cohérent objet/stats/look/poids/kamas.
3. Boost/reset des caractéristiques avec coûts serveur.
4. Variantes de sorts et niveaux réels ; raccourcis objets et sorts, ajout/retrait/déplacement.
5. Titres, ornements, emotes et objets vivants réellement possédés.
6. Carte : zaaps/destinations/respawn autorisés, ouverture et confirmation du trajet.

**Sortie :** équiper, consommer, changer de variante et recharger la session conserve exactement l’état confirmé par Giny.

### Lot 3 — combat, quêtes, succès et modules — 10 à 18 jours

1. Combat PvM complet minimal, acquittements et fin de combat avant les effets visuels avancés.
2. Import/réparation des quêtes classiques sur un lot représentatif de types d’objectifs.
3. Journal classique complet, terminées, détail d’étape, récompenses et suivi.
4. Quêtes journalières/hebdomadaires et Battle Pass, en utilisant leurs services actuels.
5. Succès : progression, détails et claim validé serveur.
6. Pokéfus : collection/équipe/capture/gènes sur le contenu configuré.
7. Brancher les événements combat/récolte/craft/capture et tester qu’ils ne créditent pas deux fois la progression.

**Sortie :** combattre → gagner → progresser → réclamer → retrouver les récompenses après reconnexion fonctionne depuis le client.

### Lot 4 — PNJ, banque, HDV, métiers et échanges — 6 à 10 jours

1. Contrôleur de dialogue et ouverture des fenêtres depuis le contexte réel.
2. Banque : dépôts/retraits partiels/totaux et monnaie ; afficher la capacité serveur, pas un chiffre codé côté UI.
3. HDV : recherche par catégorie/GID, lots/prix, achat, mise en vente, modification/retrait selon capacités du moteur.
4. Métiers/recettes : quantité fabricable calculée à partir de la vraie recette et du vrai stock.
5. Atelier/craft : sélection, ingrédients, nombre, progression/résultat et interruption.
6. Échange entre deux joueurs : deux validations, invalidation après changement d’offre, transfert atomique et fermeture.

**Sortie :** deux comptes ne peuvent ni acheter deux fois le même lot ni conserver chacun l’objet transféré ; les métiers progressent du montant Giny.

### Lot 5 — social, guilde, campement — 5 à 9 jours

1. Relations sociales et présence live ; filtrage des ignorés.
2. Groupes existants : inviter, accepter/refuser, quitter, exclure, changer de meneur.
3. Guilde : création, membres, rangs, droits, notes, bulletin, XP donnée.
4. Campement : lecture, projet, contribution, construction et effets appliqués.
5. Tests avec meneur, membre autorisé, membre sans droit, joueur hors guilde et joueur déconnecté.

**Sortie :** l’interface de guilde montre les mêmes membres/droits chez tous les joueurs concernés ; les contributions apparaissent et persistent.

### Lot 6 — ensembles, calendrier, classement, recherche, guide — 5 à 9 jours

1. Presets : créer/renommer/supprimer/appliquer avec objets manquants et restrictions de combat.
2. Calendrier alimenté par événements serveur ; temps serveur et éventuels claims.
3. Classement réel, pagination, filtres et rang personnel ; fraîcheur du calcul visible.
4. Recherche de groupe : annonces valides, places disponibles, candidature/invitation, expiration.
5. Guide Giny et liens vers les interfaces ; collection selon le modèle choisi.
6. Préférences/favoris/suivi par personnage, locales ou synchronisées.

**Sortie :** aucune de ces fenêtres ne dépend de valeurs de démonstration pour son contenu métier.

### Lot 7 — montures, alliances, alignement, havre-sac, arène — 15 à 30 jours ou plus

Développer domaine par domaine : règles → modèle persistant → services → protocole → UI → tests de reprise. Prioriser monture simple, alliance sociale, progression d’alignement simple, havre-sac privé puis arène fonctionnelle.

La présence des interfaces Dofus 3 ne réduit pas ce lot à un import SQL. Territoires AvA, élevage avancé, matchmaking fin et logement complet peuvent dépasser largement cette fourchette.

### Lot 8 — économie dédiée et extensions avancées — estimation après spécification

Boutique privée, Bourse aux Kamas, clonage/extraction, systèmes territoriaux et autres arbres officiels hors des 29 fenêtres. Définir les règles et critères de réussite avant de promettre leur couverture.

**Lecture des délais :** les lots 0 à 6 représentent environ **37 à 67 jours-personne**, soit approximativement 8 à 14 semaines à temps plein. Ajouter le lot 7 représente environ **52 à 97 jours-personne**, avec une forte incertitude. Ces fourchettes ne démontrent pas à elles seules l’atteinte des 26/29 fenêtres : celle-ci se constate dans la recette action par action.

## 8. Protocole de migration et de recette

### 8.1 Migrations

1. Export SQL de sauvegarde et essai de restauration, incluant les BLOB.
2. Préflight de schéma, moteurs, nulls, doublons, orphelins et bornes numériques.
3. Arrêt maîtrisé des écritures pour conversions de moteur ou changement de clés ; ne pas compter sur un rollback DDL transactionnel.
4. Migration sur une copie, exécution du backfill C# et contrôle des comptages.
5. Démarrage Auth/World/modules, test création/sauvegarde/lecture.
6. Tests métier ciblés, redémarrage, comparaison des invariants.
7. Déploiement de version serveur/client compatible, puis suppression éventuelle des chemins anciens dans une version ultérieure.

Pour les récompenses, verrouiller les ressources dans un ordre déterministe, utiliser les mêmes transactions pour soldes et attributions, puis actualiser la mémoire après commit. Vérifier que la sauvegarde périodique ne réécrit pas une ancienne valeur du cache par-dessus une mutation SQL récente.

### 8.2 Matrice de tests attendus

| Domaine | Scénario nominal | Cas limites obligatoires |
|---|---|---|
| Session | Connecter, changer de personnage, reconnecter | Réponse ancienne, déconnexion durant action, identité divergente |
| Inventaire | Équiper puis consommer | UID d’un autre joueur, quantité négative/trop grande, objet disparu, mauvais slot, poids/critère |
| Sorts/stats | Changer variante et booster | Niveau insuffisant, combat en cours, manque de points, double clic |
| Combat | Placement → tours → victoire | Refus de sort, cooldown, acquittement manquant, invocation, abandon, reconnexion |
| Quêtes | Objectif → complétion → claim | Objectif inconnu, fin de période, quête terminée non réclamée, claim répété |
| Battle Pass | Palier gratuit et VIP | Saison absente/expirée, VIP refusé, changement de saison, double claim |
| Banque/échange | Transfert partiel et monnaie | Annulation, modification après validation, concurrence, crash avant/après commit |
| HDV | Vendre et acheter un lot | Prix périmé, lot déjà vendu, solde insuffisant, retrait concurrent |
| Craft | Fabriquer et gagner XP | Recette hors catalogue, ingrédients insuffisants, atelier incorrect, interruption |
| Guilde/camp | Inviter, attribuer rang, contribuer | Droit refusé, sortie de guilde pendant opération, contribution simultanée |
| Social | Ajouter ami, présence, ignorer | Auto-ajout, doublon, compte absent, changement de personnage |
| Pokéfus | Capturer, équiper, débloquer gène | Filet invalide, slots pleins, prérequis manquant, ressource insuffisante |
| Presets | Sauvegarder et appliquer | Objet vendu, exemplaires similaires, restriction de classe/niveau/combat |
| UI/catalogue | Ouvrir chaque domaine | Liste vide, chargement, erreur, version incompatible, icône manquante |

### 8.3 Suites existantes à utiliser au bon moment

- `client/web` : `npm test`, `npm run build`, tests Playwright ciblés.
- `server/Tests/Giny.World.Tests` : exécuter les tests .NET appropriés aux modules et services modifiés.
- `scripts/smoke-test.pl` : parcours protocole Auth → World → personnages, après corrections du socle.
- `scripts/test-pokefus.sh`, `scripts/test-guild-camp.sh` et SQL smoke existants : sur une base de validation adaptée à leurs effets, pas comme simples lectures de production.
- Créer des tests de protocole pour les nouveaux messages, des tests d’intégration de transactions et des parcours E2E avec deux comptes.
- Tester Electron et navigateur : les deux transports doivent produire le même état et garder les ressources locales.

L’audit présent n’a pas lancé ces suites ni les scénarios qui écrivent en base. Les chiffres de catalogue, différences de schéma et lectures du code ont été vérifiés directement.

## 9. Décisions de produit à prendre avant les lots concernés

Le travail des lots 0 à 5 peut commencer sans attendre une réponse sur tous ces sujets, en adoptant les choix initiaux ci-dessous.

| Sujet | Choix initial recommandé | Conséquence |
|---|---|---|
| Source des règles | Giny existant ; Dofus 3 pour le visuel | Préserve le gameplay serveur et réduit les imports incohérents |
| Inventaire UI | Raccorder d’abord l’interface officielle en jeu | L’atelier Bubble reste séparé jusqu’à décision explicite de remplacement |
| Collection | Exploiter d’abord Pokéfus existant | Pas de nouvelle collection artificielle |
| Quêtes récurrentes | Onglets dédiés dans le journal, Battle Pass avec sa vue | Identités et récompenses séparées du classique |
| Amis | Compte, local au serveur au premier lot | Prévoir Auth/IPC seulement si intermondes demandé |
| Ensembles | Équipement + sorts + raccourcis, application globale | Règles de validation cohérentes |
| Calendrier | Événements propres au serveur | N’implique pas une implémentation automatique de l’Almanax |
| Élevage | Montures simples puis stable/reproduction spécifiée | Clonage/extraction restent un sous-projet |
| Boutique/BAK | Périmètre séparé | Leur économie doit être définie avant les tables finales |

## 10. Fichiers à modifier lors de l’implémentation

| Zone | Points d’entrée existants | Ajouts proposés |
|---|---|---|
| ORM | `server/Giny.ORM/IO/DatabaseReader.cs`, `IO/DatabaseWriter.cs`, `QueryConstants.cs`, `TableManager.cs` | Colonnes explicites, préflight, runner de migrations |
| Projections modernes | `server/Servers/Giny.World/Managers/Modern/`, `Handlers/ModernClientHandler.cs` | DTO et snapshots par domaine, capabilities, exporteur public |
| Messages | `server/Giny.Protocol/`, `client/web/src/giny/messages.ts`, `parsers.ts`, `types.ts` | Contrats et codecs validés, résultats structurés |
| Client réseau | `client/web/src/giny/GinyClient.ts` | Actions par domaine, abonnements, routage modules/combat |
| État client | `client/web/src/ui/screens/WorldView.tsx`, `ui/game/GameHud.tsx` | Stores et injection des actions aux contrôleurs |
| Catalogue | `client/web/src/ui/game/catalog.ts`, `encyclopedia.ts`, `tooltipBuilders.ts` | Fusion contrôlée Giny/visuels, version et fallbacks |
| Interfaces | `ui/game/hudBindings.ts`, `hudRepeaters.ts`, `quests.ts`, `guild.ts`, `spells.ts`, `cosmetics.ts`, `breeding.ts` | Bindings métier et contrôleurs manquants |
| Contenu classique | `server/Servers/Giny.World/Records/Quests/`, managers et handlers associés | Imports cohérents, getters, vérification de couverture |
| Modules | `server/Modules/Giny.Quests`, `Giny.Pokefus`, `Giny.GuildCamp` | Exposition des services existants, claims fiables, saisons |
| Transport local | `client/web/vite.config.ts`, `client/web/electron/` | Distribution du catalogue sans accès DB dans le renderer |

## 11. Livrables de cet audit

- Ce plan détaillé.
- `docs/audits/giny-schema-local-2026-09-05.tsv` : schémas Auth/World, moteurs, index, estimations de lignes et comptages exacts ciblés ; aucune valeur de compte exportée.
- `docs/audits/giny-catalogue-local-2026-09-05.tsv` : identifiants publics et quelques propriétés numériques du catalogue Giny utilisés pour la comparaison.
- `docs/audits/giny-catalogue-diff-2026-09-05.json` : résultats de comparaison des catalogues.

Points de preuve accessibles directement :

- [Registre des fenêtres](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/game/windows.ts).
- [Projection réelle du personnage](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Managers/Modern/ModernCharacterSnapshot.cs).
- [Contrôleur World et branchement du HUD](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/ui/screens/WorldView.tsx:72).
- [Champs attendus par la guilde](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Records/Guilds/GuildRecord.cs:40).
- [Requêtes positionnelles de l’ORM](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Giny.ORM/QueryConstants.cs:20).
- [Getter d’objectif désactivé](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Records/Quests/QuestObjectiveRecord.cs:95).
- [Getter de récompense désactivé](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Servers/Giny.World/Records/Quests/QuestStepRewardRecord.cs:109).
- [État des quêtes récurrentes déjà produit](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Modules/Giny.Quests/Services/QuestStateService.cs).
- [Filtrage des messages d’état dans le client](/Users/hugo/Downloads/Giny.NETCore-2.68/client/web/src/giny/GinyClient.ts:522).
- [Livraison des récompenses après transaction](/Users/hugo/Downloads/Giny.NETCore-2.68/server/Modules/Giny.Quests/Services/QuestRewardService.cs:118).
- [Schéma local relevé](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/giny-schema-local-2026-09-05.tsv).
- [Écarts mesurés entre catalogues](/Users/hugo/Downloads/Giny.NETCore-2.68/docs/audits/giny-catalogue-diff-2026-09-05.json).

**Premier jalon recommandé : corriger ORM/schéma et sécuriser les récompenses, publier le catalogue Giny, puis brancher inventaire + sorts + statistiques.** Ce jalon transforme immédiatement plusieurs interfaces visibles en fonctionnalités réelles et prépare les quêtes, métiers, économie et systèmes sociaux.

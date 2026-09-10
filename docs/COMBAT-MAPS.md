# Cartes de combat PvM

Le serveur peut choisir une carte de combat distincte à chaque agression de
monstres. La configuration fait autorité : aucune association n'est déduite
d'une ressemblance graphique ou de la proximité des identifiants.

## Configuration

Ajouter ces propriétés au `config.json` du serveur World (ou à
`server/Ressources/MacOS/world.config.json` si le lancement utilise scripts/start.sh) :

- `CombatMapsBySubarea` : dictionnaire identifiant de sous-zone → liste d'identifiants de cartes de combat.
- `CombatMapsByMap` : dictionnaire identifiant de carte d'exploration → liste de cartes de combat ; prioritaire sur la zone.

Les clés JSON sont des chaînes numériques, les identifiants des listes sont des
nombres. Les deux dictionnaires sont vides par défaut. Aucune association réelle
n'a été ajoutée sans preuve : Bubble reçoit la correspondance de son serveur via
FightMapPreviewMessage, elle n'a pas été retrouvée dans les ressources locales.

Une liste vide pour une carte désactive la redirection, même si sa zone possède
un pool. Les donjons restent sur leur salle habituelle sauf exception explicite
par carte. Un pool peut contenir une ou plusieurs cartes ; le choix est aléatoire
parmi celles capables d'accueillir les deux équipes. Si un pool configuré n'a
pas assez de places, l'agression est refusée sans retirer le groupe de monstres.

Au démarrage, les cartes inexistantes, les listes nulles et les placements
inutilisables ou communs aux deux équipes provoquent une erreur de configuration
explicite. Les positions doivent venir des cellules serveur de la carte choisie.
Les ressources graphiques correspondantes doivent aussi exister côté client ;
une carte serveur seule ne suffit pas.

## Cycle du combat

`Fight.Map` contient le terrain utilisé pour les déplacements, les sorts et les
positions de départ. `Fight.RoleplayMap` conserve la carte d'origine : épées,
recrutement, réapparition du groupe et retour des gagnants y restent attachés.
Le personnage conserve son identifiant de carte et sa cellule d'exploration
pendant le combat. En défaite, les règles habituelles du point de sauvegarde
restent applicables. La destination explicite de fin de donjon reste prioritaire.

Le snapshot moderne transmet `map_id` (combat) et `source_map_id` (exploration).
Le renderer attend le chargement du terrain de combat avant de présenter les
combattants. Les mises à jour HUD ne le ramènent pas sur la carte d'exploration.
La reconnexion utilise le même snapshot de combat ; la fin du combat restaure la
session d'exploration renvoyée par le serveur.

Les duels et combats contextuels/scriptés conservent leur sélection antérieure.
La logique ajoutée porte sur les combats PvM lancés contre un groupe de monstres.

## Vérification et activation

Les tests couvrent la priorité des règles, le choix dans un pool, les capacités,
les donjons, la destination de retour et le chargement côté client. Les tests
utilisent des identifiants fictifs exclusivement dans leurs fixtures.

Après ajout de correspondances vérifiées : compiler World et le client,
redémarrer World, reconnecter le client puis tester une agression, une jonction
via les épées, une reconnexion en combat et le retour après combat. Ces parcours
en jeu n'ont pas encore été validés avec de vraies associations.

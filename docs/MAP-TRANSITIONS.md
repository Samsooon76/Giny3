# Diagnostic des transitions — correction précédente retirée

La projection des voisins de l'ancienne base Giny vers le client a été retirée.
Les deux catalogues appartiennent à des versions différentes : l'autorité du
serveur sur le gameplay ne prouve pas que ses anciens voisins correspondent
à la géographie des ressources Dofus 3.

Exemple vérifié : pour 191105026, les quatre voisins SQL 191104514, 191105538,
191105025 et 191105027 sont absents du catalogue graphique actuel. Les voisins
graphiques 191104002, 191106050, 191105024 et 191105028 existent.

Le code Bubble distingue explicitement sourceMapId et fightMapId et reçoit leur
association via FightMapPreviewMessage. L'éditeur distingue fightMap et rpMaps.
Le diagnostic initial avait constaté que Giny utilisait directement la carte du
groupe. Le sélecteur PvM est désormais implémenté : voir COMBAT-MAPS.md.

L'audit des 73 identifiants absents n'est PAS une classification des cartes de
combat. Leur rôle demeure à établir. Les 1156 écarts de voisins sont des écarts
entre versions, pas 1156 liaisons dont la base SQL serait nécessairement correcte.

Le correctif de déblocage immédiat sur refus serveur est conservé, ainsi que
la journalisation de la carte source et destination dans CHANGE_MAP.

La correction géographique nécessite les liaisons d'exploration compatibles avec
les ressources actuelles, puis une correspondance distincte exploration/combat.
Ne pas ouvrir les transitions en acceptant un identifiant arbitraire du client.

Preuves locales : output/audits/bubble-fight-map-evidence.json ;
output/audits/map-transitions.json ; .local/map-topology-server.json.

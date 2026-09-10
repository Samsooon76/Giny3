# Présentation des combats reprise de Bubble

## Changements livrés

- **Mode tactique réel** : 115 atlas du cache local Bubble, 12 164 correspondances carte/template ; empreintes SHA-256 vérifiées. Sols, variantes d’obstacles déterministes, découpage des silhouettes et classification des cellules repris du client Bubble. Les décors sont masqués après chargement du thème, puis restaurés à la désactivation ou en sortie de combat.
- **Grille** : correction du `clear()` placé avant le test de cache. Deux checkpoints successifs conservent maintenant le dessin. Paramètres de trait repris de Bubble.
- **Aperçus de déplacement** : cellules accessibles, trajet, portion affectée par le tacle et portion hors budget ; géométrie arrondie et couleurs de Bubble. Prévisions PA/PM calculées avec les règles Giny, y compris l’arrondi C# au pair. Les données inconnues restent signalées comme telles. Le serveur décide toujours du déplacement et du débit.
- **Locomotion** : profil de vitesse de combat Bubble, y compris les trajets courts et le facteur des monstres ; les déplacements hors combat conservent leur comportement existant.
- **Tacle** : résolution de `AnimTacle` via le BoneIndex officiel, export des six clips partagés `AnimTacle`, `AnimHit`, `AnimMort` dans les directions disponibles du bundle `1-combat`. Les looks du personnage récupèrent ces clips sans remplacer leurs skins composés. Le handler attend la lecture du vrai clip.
- **PA/PM et vie** : chiffres officiels rouges/bleus/verts, animation Bubble de 2,5 s, agrandissement initial, montée et disparition. File par acteur avec décalage de 1,25 s ; l’animation des chiffres ne bloque pas les ACK pendant toute sa durée. Les esquives restent dans le journal, sans faux débit.
- **Socles et tour actif** : remplacement des ellipses de combattants par les textures officielles projetées sur la cellule ; pulsation de l’indicateur de tour selon Bubble.
- **HUD** : snapshot autoritaire séparé du snapshot présenté. Les valeurs et le tour affichés ne précèdent plus le traitement visuel correspondant. Le bouton conserve son libellé officiel pendant les animations, avec l’état désactivé.
- **Effets provisoires** : suppression de l’ellipse jaune systématique d’impact ; une téléportation n’utilise plus l’interpolation d’une glissade.

Les fenêtres de combat, timeline et résultats continuent d’utiliser le runtime UXML/USS officiel existant.

## Reproduction des ressources

Depuis la racine du dépôt :

```sh
python3 client/web/scripts/import-bubble-combat.py
```

Le script lit les manifests et packs locaux, vérifie leurs empreintes, décode le MessagePack des templates et importe les fonctions géométriques pures de `resources/app.asar`. Il n’exécute pas le client Bubble et ne télécharge rien.

Depuis `client/dofus3`, avec l’interpréteur UnityPy configuré dans cet environnement :

```sh
../../.local/catalog-venv/bin/python -m extractor.entities.export_combat
```

Sorties : `client/web/public/combat-assets/` et `client/dofus3/output/entities/combat_1.json`, sa version gzip et la texture référencée. Le manifeste de provenance des atlas est livré avec les ressources.

## Vérifications

- Suite web générale exécutée : **546 tests réussis, 1 ignoré**.
- Test ajouté sur deux checkpoints successifs du vrai `CombatScene`, puis désactivation/réactivation de grille.
- Tests ajoutés sur le tacle total, les informations inconnues, l’absence de mutation PA/PM, l’arrondi C# et la publication différée du HUD.
- Build TypeScript/Vite réussi ; les avertissements déjà présents sur quelques ressources CSS et la taille du bundle subsistent.
- Vérification dans le navigateur de l’atelier déconnecté, avec le vrai `GameRenderer` : carte normale, bascule tactique, restauration du décor, trajet vert/rouge, déplacement d’une cellule, chiffre officiel `-1` PM, nouvelle valeur dans le HUD et grille conservée après synchronisation.
- Scénario de tacle de l’atelier : les ressources passent de 6 PA/3 PM à 3 PA/1 PM ; les clips officiels sont chargés et le scénario termine sans erreur de combat. Les voisins de carte non préparés produisent leurs avertissements habituels.

Atelier existant enrichi : `/?ui-preview=hud&combat-preview=fighting` ou `combat-preview=tackle`. Il est réservé au développement et indique explicitement qu’il est déconnecté du serveur. `T` bascule le tactique ; `Maj+1` bascule la grille. Les commandes de cet atelier ne contactent pas Giny.

## Limites restant à traiter

Cette livraison rapproche concrètement le rendu de Bubble ; elle ne certifie pas une parité complète de tous les combats. Les effets spécifiques de sorts, les animations de glyphes/pièges, les sons et plusieurs contrôles avancés de combat restent à raccorder. Les conditions avancées de lancement restent partielles ; voir le correctif ci-dessous pour la portée et la ligne de vue. Un look dépourvu de clip officiel de tacle n’en reçoit pas un inventé.

La recette serveur connectée complète (plusieurs joueurs, états complexes, reconnexion, sorts et fin de combat) n’a pas été exécutée pendant cette livraison. Les écrans de résultat et les drops n’ont pas été refaits dans ce lot.


## Correctif suivant : ressources Electron, sorts et challenges

- Le protocole Electron accepte maintenant les URL d’assets utilisées par les workers Pixi (`app://dofus3/...`), en plus du chemin du renderer (`app://-/dofus3/...`). Les chiffres PA/PM/PV et les atlas tactiques ne perdent plus leur préfixe de dossier. Les hôtes externes restent refusés.
- La portée, les zones (cercle, croix, anneau, etc.) et la ligne de vue utilisent les fonctions extraites de Bubble. Le survol montre la zone d’effet ; les cellules interdites sont distinguées et ne déclenchent pas de lancement. La sélection se déploie avec les paramètres d’animation de Bubble.
- Le worker de calcul de dommages de Bubble est importé sans modification. Un adaptateur lui transmet les caractéristiques et effets exacts fournis par Giny. Les dégâts directs élémentaires, vols de vie et soins simples peuvent être prévus, y compris leurs effets critiques. Les fourchettes apparaissent dans l’infobulle officielle `PlayerFighterTooltip`, avec nom, niveau et vie. Pour plusieurs cibles, le composant officiel `TextTooltip` présente les résultats groupés.
- Le serveur transmet les zones brutes, les effets normaux/critiques, les caractéristiques de combat et la présence de buffs. Le calcul ne prétend pas connaître un état incomplet : buffs, marques, effets déclenchés/retardés, effets non pris en charge ou caractéristiques absentes donnent une prévision explicitement indisponible. La barre de vie n’affiche pas encore la portion de perte anticipée.
- La préparation utilise les arbres officiels de réglage et de choix des challenges : récompense XP/butin, mode Au choix/Aléatoire, sélection puis validation. 546 icônes extraites du cache Bubble sont raccordées au catalogue. L’option de récompense est XP ou butin dans les sources consultées, pas un bonus kamas séparé.
- Le bouton tactique rejoint les commandes sous Prêt/Passer le tour, avec l’icône officielle de grille et le raccourci T. Il reflète l’état réel du renderer.

### Reproduction et validation du correctif

Depuis `client/web` : `python3 scripts/import-bubble-spell-preview.py` et `python3 scripts/import-bubble-challenges.py`. Les fichiers de provenance livrés enregistrent les sources et empreintes vérifiées.

- 557 tests web réussis, 1 ignoré ; cas ajoutés pour les zones, la ligne de vue, les diagonales, les caractéristiques inconnues et un calcul réel du worker avec résistance élémentaire.
- Build TypeScript/Vite et build World Release réussis ; avertissements préexistants conservés.
- Test de la coque Electron réussi : chargement des chiffres bleus/rouges/verts et d’un atlas depuis un worker avec les URL app://, et refus des URL externes.
- Vérification visuelle en atelier déconnecté : récompense butin, mode aléatoire avec bouton Prêt, retour au choix manuel, validation d’un challenge, bascule tactique par bouton et portée/zone/prévision de 13 à 18 PV sur une cible.
- Atelier de sorts : `/?ui-preview=hud&combat-preview=spells`. Il utilise un effet officiel simple et des caractéristiques de démonstration déclarées ; il n’envoie aucun sort au serveur.

Le processus Electron et le serveur World doivent être redémarrés pour prendre leurs nouvelles versions ; ils n’ont pas été redémarrés par ce correctif. La recette connectée complète reste à effectuer. Ces changements ne constituent pas une parité intégrale de tous les effets de combat de Bubble.


## Régression corrigée : entrée en combat et initiative

Le nouvel export `preview_stats` appelait `TotalInContext()` sur chaque caractéristique. Or `InitiativeCharacteristic` interdit cette méthode et lève `InvalidOperationException`. Les checkpoints modernes étaient donc perdus, malgré la poursuite des messages legacy ; les logs disponibles montrent cette exception interceptée, sans prouver un arrêt fatal du processus World.

`ModernFightSnapshot.BuildPreviewStats` exporte désormais l’initiative via `Total()` (calcul Giny pondéré par la vie) et conserve `TotalInContext()` pour les autres caractéristiques. Les erreurs de projection conservent maintenant leur pile d’appel dans les logs.

Validation du correctif :

- Trois cas de régression avec les vraies `FighterStats`, à vie pleine, moitié de vie et zéro vie : échec reproduit avant correction, succès après correction ; conservation des bonus contextuels, résistances, PA/PM et multiplicateurs.
- Suite serveur : 47 tests réussis, 7 tests d’intégration conditionnels ignorés. Build World Release réussi.
- World actif redémarré avec le correctif ; Auth, sélection du monde 50, ticket World et liste des personnages vérifiés par le test de connexion.
- Combat réel créé sur les bases copiées `giny_restore_*`, ports dédiés 18443/15555 : personnage de validation 2, Piou Violet niveau 11, 49 PV. Le test vérifie les `preview_stats` et l’initiative de chaque combattant dans le snapshot reçu. Les instances de validation sont arrêtées après le test.

Le compte/personnage actif n’a pas été utilisé pour ce combat de validation.


## Correctif de ciblage au curseur

- Suppression de la marge de 2 % autour des losanges de détection : elle faisait chevaucher les cellules et pouvait sélectionner la voisine malgré un curseur à l’intérieur du losange affiché. Seule une tolérance numérique minime reste appliquée.
- En ciblage de sort, le test des combattants réutilise la géométrie des meshes officiels (`EntityRenderer.containsWorldPoint`) au lieu du rectangle englobant, afin que les zones vides autour de la silhouette ne capturent pas une cellule adjacente.
- Survol, clic, zoom et déplacement de caméra partagent la conversion des pixels CSS vers les coordonnées logiques Pixi, indépendamment de la mise à l’échelle du canvas.
- Tests : bords des 560 cellules, plusieurs échelles CSS et zooms caméra, silhouette et zone vide d’un mesh réel. Suite web : 560 tests réussis, 1 ignoré. Build web réussi.

Correctif côté client uniquement : recharger le client pour prendre le nouveau bundle ; aucun redémarrage World nécessaire.


## Refus de sélection pendant le démarrage de World

La séquence de sept refus observée après le redémarrage précède le handshake IPC de World. Auth accepte ensuite la sélection ; les logs World montrent un combat terminé avec récompenses. Auth transmet `isSelectable=true` même hors ligne, et le client ignorait les mises à jour de statut poussées : le bouton Jouer restait donc disponible trop tôt.

Le client vérifie désormais le statut ONLINE en plus du flag, désactive Jouer quand World est indisponible et conserve une liste actualisée via ServersListMessage/ServerStatusUpdateMessage. Les mises à jour n’accumulent plus de listes périmées dans la file de réponses. Le refus est décodé (serveur, raison, statut) et présenté explicitement ; les transitions de disponibilité sont journalisées. Aucun redémarrage du serveur actif n’a été effectué pour ce correctif client.

Validation : 564 tests web réussis, 1 ignoré ; cas ajoutés pour les statuts, l’arrivée de World après connexion Auth, les listes reçues avant leur attente et les raisons de refus. Build web réussi.

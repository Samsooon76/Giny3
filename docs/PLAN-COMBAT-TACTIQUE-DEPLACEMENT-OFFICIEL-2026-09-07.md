# Combat : mode tactique, grille, déplacements, tacle et PA/PM

Plan détaillé du 7 septembre 2026, établi à partir du code actuel et des ressources locales. **Ce document prépare les corrections ; il ne décrit pas des fonctionnalités nouvellement implémentées.** Aucun code de jeu n’a été modifié pendant cet audit, aucun nouveau combat connecté n’a été exécuté.

## 1. Résultat attendu et contrainte de fidélité

Le joueur doit pouvoir activer le mode tactique officiel, afficher la grille indépendamment, comprendre les cases accessibles et le coût d’un trajet, voir un déplacement conforme au chemin confirmé, puis lire les effets de tacle et les variations PA/PM au bon moment. La carte, les combattants, la timeline et les compteurs doivent raconter la même action.

**Tout rendu livré doit provenir des ressources ou du comportement du client officiel :** arbres UXML/USS, icônes, polices, clips, prefabs, matériaux, courbes, règles de composition et sons effectivement identifiés. Les captures servent à contrôler la fidélité ; elles ne servent pas à redessiner une interface approximative.

Le travail de code nécessaire concerne les adaptateurs d’extraction, la lecture des ressources dans Pixi, les liaisons UI et la synchronisation réseau. Une grille éventuellement générée par le client officiel doit être reproduite à partir de sa géométrie, de ses matériaux et de ses paramètres ; il ne faut ni supposer qu’elle est une image, ni dessiner un nouveau damier arbitraire.

Règles de livraison :

- Ne pas inventer un clip `AnimTacle`, une durée, une trajectoire de texte ou une couleur « ressemblante ».
- Ne pas utiliser un impact de sort générique pour représenter un tacle, une esquive ou une téléportation.
- Ne pas confondre mode tactique, grille et mode créatures : ce sont des options distinctes.
- Giny reste autoritaire sur les règles et les dépenses. L’aperçu client ne débite rien et ne choisit pas le résultat d’un effet aléatoire.
- Une ressource introuvable reste une lacune documentée. Le fonctionnement réseau continue et l’état se réconcilie ; aucun effet fictif ne masque cette lacune.
- Un lot visuel n’est déclaré terminé qu’après extraction, lecture et comparaison à l’officiel. Une compilation verte ne suffit pas.

## 2. Diagnostic concret du dépôt

Les chemins ci-dessous sont relatifs à la racine du projet.

| Sujet | État vérifié | Conséquence et correction nécessaire |
| --- | --- | --- |
| Mode tactique | Aucun contrôleur de bascule trouvé dans `GameRenderer.ts` / `CombatScene.ts` | Ajouter une politique de rendu du décor fondée sur celle de l’officiel, et relier son véritable contrôle UI |
| Grille | `CombatScene.paint()` dessine des losanges Pixi avec dimensions 42 × 21 et couleurs codées en dur ; `CellGrid` expose 43 × 21,5 | Vérifier l’écart géométrique face à l’officiel, remplacer les paramètres visuels arbitraires ; distinguer grille permanente et surbrillances |
| Déplacement | `CombatGrid.combatPath()` a déjà quatre voisins tactiques, obstacles de combat, occupation et budget PM | Le socle existe, mais ne tient compte ni du tacle ni des états qui modifient le déplacement ; il manque la carte d’accessibilité complète |
| Lecture du mouvement | `CombatScene.present()` joue les cases reçues avec `MovementController` | Durées fixes 0,22/0,14 s par case, seuil de course 4 cases, délais de secours : ce ne sont pas des preuves de synchronisation officielle |
| Tacle | Giny calcule les pertes dans `Fighter.GetTackle()` et envoie `GameActionFightTackledMessage` | Le reducer et la scène ne présentent pas cet événement |
| Tacle bloquant | `ApplyTackle()` renvoie un chemin vide si la perte PM atteint les PM disponibles, avant `OnTackled()` | Le signal et les pertes correspondantes ne sont pas émis par cette branche ; comportement à reproduire puis corriger avec référence et tests |
| Variations PA/PM | Giny émet `GameActionFightPointsVariationMessage` | Pas de traitement dédié dans `reduceCombat()` ni `CombatScene.present()` ; les compteurs peuvent n’être corrigés qu’au snapshot suivant |
| Identification PA/PM | Les dépenses ordinaires passent par `LooseAp(..., 0)` et `LooseMp(..., 0)` | Même message et même `actionId` pour deux ressources différentes : ne pas deviner la ressource par le contexte graphique |
| Esquive PA/PM | `OnDodge()` émet `GameActionFightDodgePointLossMessage` ; les handlers de retraits séparent esquivé et effectivement perdu | Le client doit afficher les deux sans soustraire le montant esquivé |
| Nombres flottants | `CombatScene.floating()` construit un `Text` Pixi, police/taille/couleur et trajectoire 550 ms à la main | Remplacer par le lecteur des paramètres officiels ; ne pas recopier ce modèle pour les PA/PM |
| Impacts et déplacement forcé | Impact elliptique générique ; glissade et téléportation partagent une interpolation de 220 ms | Retirer les substituts au profit de séquences officielles distinctes |
| Synchronisation | `GinyClient.receiveCombat()` publie le nouvel état avant sa présentation ; queue FIFO par message | Séparer état autoritaire et état présenté pour éviter un HUD déjà à jour sur un acteur encore en mouvement |
| Séquences | `CombatSequencer` gère annulation et délais, mais pas une représentation explicite des séquences imbriquées | Introduire des barrières d’action, des associations causales et un traitement robuste des ACK |
| UI | `liveCombat.ts` désactive les bindings `tg_*` du widget de fin de tour | Ne pas activer aveuglément ces boutons : les bindings présents sont ping, pointage, spectateurs et verrouillage, pas une preuve du bouton tactique |
| Resynchronisation | Snapshot avec PV/PA/PM, mais sans tacle/fuite, capacités de mouvement et état complet des marques/buffs | Étendre le contrat observable utile aux aperçus et à la reprise, avec filtrage par destinataire |

### Défauts à isoler avant de retoucher l’apparence

1. **PA/PM ambiguës avec `actionId = 0`.** Réparer le contrat à la source ; sinon même une animation fidèle peut afficher le mauvais type de perte.
2. **Tacle total sans signal.** Aucun client ne peut montrer fidèlement un événement que le serveur n’envoie pas.
3. **HUD en avance sur la scène.** Ajouter des chiffres animés sans corriger l’ordre aggraverait la désynchronisation.
4. **Annulation qui termine un ancien trajet.** Le callback de fin de mouvement fait actuellement un `snapTo` même lorsqu’il est appelé par l’abandon du signal. Un changement de contexte ne doit pas appliquer la destination d’une ancienne action.
5. **Bords de carte.** `PathReader.FightMove()` exclut les extrémités 0 et 559 dans sa condition actuelle. C’est une divergence potentielle à tester sur des cellules réellement valides, sans déclarer toutes les cellules de bord marchables.

## 3. Sources officielles : ce qui est prouvé et ce qui reste à extraire

### 3.1 Ressources déjà localisées

- Cache UI : `client/dofus3/.cache/dofus3/ui/current/trees`, `styles`, `textures`, `icons`, `fonts`, `themes`.
- `EndTurnWidget` : compteur, action de fin de tour et contrôles associés.
- `FightTimeline` / `timelineFighter` : portraits, jauges, actif, états des combattants.
- `FighterInfoTooltip`, `PlayerFighterTooltip`, `FighterInfoStat` : informations de combattant. Les bindings `lbl_pa`, `lbl_pm`, `stat_tackle`, `stat_evade`, `stat_dodgeAP`, `stat_dodgeMP` existent dans `FighterInfoTooltip`.
- `FightMapLegend` / `FightMapPreview` : vocabulaire et composants de présentation des cellules. **Leur présence ne prouve pas qu’ils sont utilisés comme grille du combat en cours.**
- Chargeurs existants : `extractor/animations`, `extractor/entities`, `EntityRenderer`, `loader`, moteur d’effets de carte `src/game/effects` et particules. Auditer leur compatibilité avant d’étendre ; éviter un second lecteur concurrent.
- Installation officielle : `/Applications/Ankama/Dofus-dofus3` ; `GameAssembly.dylib` et `global-metadata.dat` sont disponibles.
- Le parseur local `extractor/il2cpp/metadata.py` a été exécuté pendant cet audit. Son relevé et l’empreinte du fichier lu sont conservés dans [l’audit JSON](AUDIT-COMBAT-TACTIQUE-OFFICIEL-2026-09-07.json).

### 3.2 Pistes identifiées, sans promesse de code source déjà récupéré

Le cache `output/symbols/monoScripts.json` référence `FightTackleService` et `FightTackledStep`. La recherche par nom dans les types des métadonnées installées ne les a pas retrouvés : obfuscation, différence de build ou table partielle sont à investiguer. Ces noms sont des pistes de recherche, **pas des classes C# prêtes à copier**.

Le parseur a retrouvé notamment `Core.Rendering.Sprites.Interactive.TacticalDebugCell`, avec `m_spriteCellMov` et `m_spriteCellLos`, ainsi que `UniqueCellSelection`. Un composant nommé « Debug » n’est pas automatiquement la bonne ressource du mode tactique joueur.

`FightTextHelper` est également retrouvé. Ses méthodes concernent les textes de combat et leur mise en forme ; cela ne prouve pas qu’il contrôle la trajectoire des nombres flottants.

Les clés de localisation `UiFightOptionTacticMode`, `UiFightOptionNoTacticMode`, `UiFightDodgeFailed`, `UiFightLostAP`, `UiFightLostMP`, `UiFightWinAP`, `UiFightWinMP`, `UiFightDodgeAP` et `UiFightDodgeMP` sont présentes. Retrouver leurs consommateurs pour remonter aux actions et composants réels.

### 3.3 Livrable obligatoire : manifeste de provenance

Créer un manifeste versionné, par exemple `combat-presentation-manifest.json`, dont le nom est une proposition d’adaptateur et non un format existant d’Ankama. Chaque entrée doit contenir :

- version du client officiel et empreinte de ses tables ; version du schéma d’extraction ;
- rôle : grille, cellule accessible, obstacle, chemin, tacle, variation PA, variation PM, esquive, téléportation, etc. ;
- adresse Addressables, bundle, PathID/GUID et dépendances réellement résolus ;
- arbre UI / prefab / clip / matériau / courbes / événements et sons associés ;
- ancrage, pivot, ordre de rendu, blend, shader, vitesse et conditions d’affichage ;
- état de couverture : localisé, extrait, interprété, comparé ; lacunes explicites ;
- capture ou trace de référence et scénario de comparaison.

**Porte de sortie :** une simple correspondance de nom ou une PNG extraite ne valide pas une animation complète. Les sous-émetteurs, scripts, matériaux et sons doivent être recensés.

## 4. Architecture cible et ordre de travail

Flux recommandé :

```text
Messages Giny reçus et validés
    → état autoritaire révisé (permissions, validation des commandes)
    → journal typé de séquences et d’événements
    → ordonnanceur de présentation
        → positions / clips / effets officiels
        → état présenté du HUD et des infobulles
    → barrière de fin + ACK correspondant
    → réconciliation au checkpoint
```

Les aperçus utilisent l’état autoritaire et une génération de combat ; ils disparaissent ou sont recalculés dès qu’une donnée pertinente change. Le HUD animé suit l’état présenté. La légalité d’un clic reste contrôlée par l’état autoritaire.

Ordre de dépendance : **L0 inventaire → L1 contrat réseau → L2 séquences → L3 topologie → L4 tactique/grille → L5 aperçu → L6 mouvement → L7 tacle → L8 PA/PM → L9 UI et reprise → L10 recette complète.** L’extraction des ressources L0 continue par famille durant les autres lots ; chaque lot visuel attend sa propre preuve de provenance.

## 5. L0 — Extraction et scénarios de référence

1. Figer les versions effectivement utilisées : build officiel pour la présentation, protocole Giny 2.68 et catalogue actif du projet. Ne pas supposer qu’un identifiant moderne est compatible avec le serveur ancien.
2. Inventorier les arbres, options, raccourcis, sprites, prefabs et clips réellement accessibles.
3. Remonter depuis les clés tactiques aux actions officielles, puis aux services qui modifient les couches du monde.
4. Remonter depuis les événements tacle/pertes/esquive aux séquences officielles et à leurs ressources. Établir si le tacle est un clip du combattant, un effet, un texte, un son ou une combinaison.
5. Extraire les données utiles avec les outils existants. Étendre le parseur si le format comporte des champs non interprétés ; conserver les champs bruts et signaler leur couverture.
6. Capturer les mêmes scénarios en mode normal et tactique, à résolution/zoom/thème connus : trajet libre, sortie de contact, tacle total, deux tacleurs, retrait PA/PM partiellement esquivé, gain, mort pendant une action.
7. Pour chaque animation, relever début, événement de dépense, déplacements, apparition et disparition du texte, fin de clip et moment où l’action suivante est autorisée.

Acceptation : ressources traçables, dépendances complètes, captures annotées dans le temps, aucune durée inventée. Si la capture d’un scénario officiel n’est pas disponible, son timing reste « à mesurer ».

## 6. L1 — Contrat réseau fiable pour mouvement et ressources

### 6.1 Typage des événements

Remplacer les traitements implicites sur `Record<string, unknown>` par une normalisation typée des familles concernées. Conserver le message original à côté des données normalisées pour diagnostiquer un écart.

| Message / source | Informations nécessaires | Traitement |
| --- | --- | --- |
| `GameActionFightTackledMessage` | combattant taclé = `sourceId`, `tacklersIds`, identité d’action | Signal de tacle uniquement ; les pertes effectives viennent des variations, pas d’un second calcul graphique |
| `GameActionFightPointsVariationMessage` | `sourceId`, `targetId`, `delta` signé, ressource identifiée | Mettre à jour une seule fois PA ou PM et produire l’étape de présentation correspondante |
| `GameActionFightDodgePointLossMessage` | cible, ressource, `amount` esquivé | Présentation/journal d’esquive ; aucun débit pour cette quantité |
| `GameMapMovementMessage` | acteur, cases autorisées, directions si pertinentes | Lire le chemin serveur, pas le chemin demandé |
| Début/fin de séquence | action, auteur, profondeur, génération | Grouper et terminer exactement la bonne action |
| Checkpoint / début de tour | valeurs absolues, acteur contrôlé, statuts | Réconcilier sans réappliquer les deltas déjà inclus |

### 6.2 Résoudre `actionId = 0` à la source

Auditer les appels dans `Fighter.cs` et `CharacterFighter.cs`, puis choisir un contrat unique documenté :

- privilégier les identifiants protocolaires corrects pour dépenses PA/PM, après vérification de leur sens exact dans les enums et le client officiel ;
- si le protocole legacy doit conserver ces valeurs, enrichir la projection moderne **depuis le point d’émission qui connaît la ressource**, avec `resource`, `reason` et identifiant d’action ; ne pas tenter de les reconstruire après coup par réflexion ;
- distinguer coût de sort, coût du trajet, retrait, gain et tacle ; préserver les messages standards nécessaires aux autres clients ;
- versionner l’évolution du schéma ; rendre explicite le comportement d’un client/serveur qui n’expose pas la nouvelle information.

Les valeurs locales vérifiées incluent 101 pour perte PA, 127 pour perte PM, 120 pour gain PA et 78 pour gain PM. Cette liste ne suffit pas à décrire toutes les dépenses : l’audit des émetteurs reste obligatoire.

### 6.3 Snapshot observable

Ajouter les données utiles et autorisées : tacle/fuite, faculté de tacler/être taclé, faculté de se déplacer, état porté, contrôleur, invisibilité et occupation observable. Pour les caractéristiques cachées, fournir une prévision limitée ou indiquer qu’elle est inconnue, sans révéler les positions ou capacités secrètes.

Prévoir une identité de génération/session et un watermark de révision pour le journal. Les valeurs absolues du checkpoint doivent être associées aux événements qu’elles incluent.

Acceptation : coût PA de sort et coût PM de marche distinguables sans heuristique ; retrait esquivé non débité ; reconnexion sans double perte ; ancienne révision ignorée.

## 7. L2 — Séquences, état présenté et annulation

1. Garder `CombatSequencer` comme point d’entrée, mais introduire une représentation explicite des séquences, y compris imbriquées.
2. Construire des étapes : mouvement, réaction, variation de ressources, effet officiel, mise à jour du HUD, checkpoint, ACK.
3. Autoriser le parallélisme uniquement lorsqu’il est confirmé par la séquence officielle : par exemple réaction et nombre au même impact. Ne pas paralléliser automatiquement deux messages adjacents.
4. Associer chaque étape à l’action, au combattant, à la révision et à la génération de scène.
5. Publier les changements visuels au marqueur approprié : début, impact, arrivée ou fin. Une nouvelle valeur ne doit pas apparaître avant l’action qui la cause.
6. Sur timeout, onglet suspendu ou ressource absente, terminer proprement l’étape et réconcilier. Les budgets de secours sont des protections du transport, pas la durée nominale des animations.
7. Sur annulation, détruire les effets et arrêter les callbacks. Ne pas appeler le callback « arrivée normale » pour un changement de combat ; aucune ancienne destination ne doit réapparaître.
8. Distinguer ACK protocolaire et action « Prêt » du joueur. Émettre chaque ACK une seule fois, pour le bon auteur/contrôleur et la bonne action. Vérifier spécialement les invocations contrôlées.
9. Si le checkpoint arrive avant une animation lente, le conserver comme état autoritaire, sans téléporter visuellement le combattant au milieu de la lecture.

Acceptation : un sort, un tacle ou une rafale de retraits conservent le même ordre avec réseau rapide, réseau retardé et onglet suspendu ; sortie de combat possible même si un effet ne charge pas.

## 8. L3 — Topologie et obstacles de combat

1. Unifier les conversions cellule ↔ monde, centres, losanges et voisins ; supprimer les dimensions parallèles dans `CombatScene`.
2. Construire une table d’adjacence tactique à quatre voisins à partir des cellules extraites. La mettre en cache par carte, sans rechercher chaque voisin par parcours complet de la grille à chaque survol.
3. Séparer les notions : cellule représentée, marchable, occupée, bloquant la ligne de vue, accessible à ce combattant, autorisée au placement.
4. Auditer `mov`, `los`, `visible`, `nonWalkableDuringFight`, `floor`, `moveZone` et `linkedZone`. Ne pas appliquer les contraintes RP à un combat ; ne pas imposer l’usage de tous les champs sans preuve de leur sémantique.
5. Intégrer combattants vivants, invocations, morts, portés, invisibles selon les informations autorisées, obstacles dynamiques et états pertinents.
6. Comparer la reconstruction client et `PathReader.FightMove` sur des chemins droits, virages, frontières de rangée et extrémités 0/559.
7. Tester les détours : le nombre de pas réellement parcourus peut dépasser la distance directe entre départ et arrivée. Auditer la validation initiale de `Fighter.Move` et le coût final.

Acceptation : une case montrée comme obstacle ne peut pas être proposée comme passage ; l’ensemble des voisins et le coût des chemins testés concordent avec Giny ; aucune fuite de données cachées.

## 9. L4 — Mode tactique et grille officiels

### Mode tactique

- Retrouver le contrôle officiel, son icône, son libellé, son raccourci et sa persistance ; les relier à un état local de présentation.
- Définir la classification officielle des couches : sol, décor occlusif, arrière-plan, premier plan, props, particules d’ambiance, ombres, combattants et effets de combat.
- Extraire le matériau/mesh/texture ou la procédure de génération du fond tactique et des obstacles.
- Adapter `GameRenderer` pour basculer sans recharger la carte ni recréer les combattants. Les décors et les acteurs partagent aujourd’hui `sortable` : masquer ce conteneur entier masquerait aussi le combat.
- Séparer l’appartenance des objets et préserver leur état de visibilité précédent, leurs animations, matériaux et références. Restaurer cet état précis à la désactivation et à la sortie de combat.
- Conserver caméra, zoom, picking, ordre des personnages, pièges visibles, glyphes et VFX autorisés.
- Vérifier changement de carte, reconnexion, carte intérieure et extérieure, combats à différents niveaux de zoom.

### Grille indépendante

- Option séparée de la bascule tactique ; tester normal/grille masquée, normal/grille visible, tactique/grille masquée et tactique/grille visible selon les règles réellement permises par l’officiel.
- Rendu depuis les styles et matériaux extraits, avec arêtes et contours à l’échelle officielle.
- Priorités de superposition documentées : fond tactique, grille de base, placement, accessibilité, chemin, portée, zone, marque, sélection. L’ordre final doit être confirmé sur référence, pas choisi arbitrairement.
- Calculer les données seulement quand elles changent ; un survol ne doit pas reconstruire le décor ou tous les marqueurs d’équipe.
- Ne pas réutiliser `DebugOverlay` comme fonctionnalité destinée au joueur.

Acceptation : bascule en préparation, pendant un tour et pendant une animation sans changement de cellule ni perte d’interaction ; restauration du décor conforme ; comparaison visuelle normal/tactique réussie.

## 10. L5 — Accessibilité et prévision du déplacement

1. Calculer toutes les cellules atteignables avec les PM disponibles, pas seulement le chemin vers la dernière cellule survolée.
2. Garder séparés le coût de marche, les pertes de tacle prévisibles et les événements cachés qui peuvent interrompre le trajet.
3. Reproduire le comportement de Giny : sortie de contact, perte à la cellule de départ, entrée dans une nouvelle zone de tacle et point d’arrêt. Ne pas remplacer ce fonctionnement par une formule approximative à chaque case.
4. Pour les pertes prévisibles, comparer le calcul client à des fixtures serveur. `Math.Round` côté C# utilise par défaut l’arrondi au pair ; `Math.round` JavaScript n’est pas équivalent aux demi-unités. Tester explicitement ces cas.
5. Prendre en compte plusieurs tacleurs et les états d’immunité. Ne pas transformer une absence de donnée en zéro tacle.
6. Si une prévision autoritaire est nécessaire, exposer une requête dédiée sans mutation, limitée au combattant contrôlé et aux informations visibles. Partager la logique pure avec la validation serveur, sans exécuter `ApplyTackle()` pour simuler, car cette méthode émet des événements et modifie le combat.
7. Versionner la réponse par fight/génération/révision/cellule de départ/PM ; ignorer une réponse reçue après changement de tour ou de destination.
8. Afficher coût, pertes prévisibles et arrêt avec le composant ou marquage officiel identifié. Aucun chiffre présenté comme exact si l’information est insuffisante.
9. Invalider l’aperçu sur mouvement d’un acteur, perte/gain PM, mort, invocation, état, changement de contrôleur ou de contexte.

Acceptation : cas libre, détour, zéro PM, destination occupée, tacle faible, tacle total, plusieurs tacleurs et immunité ; la prévision n’a aucun effet sur le serveur.

## 11. L6 — Lecture du trajet confirmé

- Normaliser les deux représentations à leur frontière : clés de déplacement du protocole et liste complète de cellules lorsqu’elle est effectivement disponible. Ne pas mélanger compression, direction et cases.
- Utiliser uniquement le chemin confirmé pour déplacer l’entité ; garder la requête initiale comme intention et diagnostic.
- Si Giny raccourcit le trajet, jouer la portion autorisée et retirer l’aperçu restant.
- Synchroniser translation, orientation, marche/course et pas avec les clips et paramètres officiels. Les constantes actuelles deviennent un comportement à remplacer, pas la référence.
- Conserver le temps résiduel d’une frame lorsqu’elle franchit plusieurs segments ; ne pas perdre systématiquement le surplus de `deltaTime` aux arrivées de cellule.
- Déplacer les marqueurs avec l’acteur présenté, pas immédiatement avec sa destination autoritaire.
- Traiter à part marche, poussée/glissade, téléportation, échange et porter/jeter. Leurs effets et leurs barrières ne sont pas interchangeables.
- Gérer refus, double clic, clic pendant l’animation, arrêt sur piège, changement de tour et abandon.

Acceptation : aucun glissement hors des cases, aucune accélération arbitraire sur un long trajet, pas de saut final sauf rattrapage explicitement nécessaire ; dépense PM présentée au moment confirmé par la référence.

## 12. L7 — Tacle : règles, signal et animation officiels

### Côté serveur

1. Écrire les cas de reproduction du tacle total avant modification : PM/PA initiaux, tacleurs, état final, événements envoyés et chemin.
2. Vérifier le comportement attendu contre le client/règles de référence compatibles avec le serveur. Déplacer l’émission des pertes/signaux au bon endroit si la branche bloquante les omet, sans permettre des valeurs négatives ni un double débit.
3. Tester les interruptions au contact d’un autre tacleur sur le trajet et les limites `Take(index + 1)` ; vérifier les indices au lieu de modifier aveuglément la formule.
4. Préserver les triggers `OnTackle` / `OnTackled` et les challenges qui écoutent `Tackled` ; compter leur émission exactement une fois.
5. Pour les échecs de déplacement, exposer une cause exploitable au destinataire si le protocole existant ne la distingue pas. Ne pas annoncer un obstacle invisible avec ses coordonnées.

### Côté présentation

1. Le signal identifie le combattant qui tente de sortir et ses tacleurs. Ne pas inverser source et cible.
2. Déterminer, par extraction, qui joue quelle réaction et sur quel ancrage se place l’effet.
3. Construire la séquence visuelle officielle : réaction, éventuel effet/son, pertes PA/PM, puis portion de déplacement autorisée. L’ordre et les chevauchements attendent la mesure officielle.
4. Associer les variations qui suivent au signal de tacle par identité d’action/séquence, jamais par un délai de quelques millisecondes.
5. Ne pas additionner une estimation de tacle et les pertes réseau : seule la perte reçue est débitée et présentée comme résultat.
6. Lors d’une immunité ou d’un tacle sans perte, appliquer le comportement de référence ; ne pas jouer un échec de fuite par défaut.

Acceptation : effet officiel identifiable, bon combattant, chiffres exacts, aucune marche en cas de blocage total, reprise correcte d’un trajet partiel, triggers/challenges inchangés sauf correction explicitement testée.

## 13. L8 — PA/PM, esquives et nombres flottants

### État et sémantique

- Traiter les deltas signés, distinguer valeur courante et maximum, gain temporaire et restauration de début de tour.
- Pour un vol, traiter séparément perte de la cible et gain de la source ; un changement de ressource ne déduit pas implicitement l’autre.
- Pour un retrait partiellement esquivé, présenter montant retiré et montant esquivé selon les règles officielles, sans les sommer en débit.
- Une mise à jour absolue de stats ou un checkpoint réconcilie ; elle ne génère pas automatiquement une nouvelle animation de perte.
- Réévaluer la disponibilité des sorts et les cases atteignables après la modification réelle, sans attendre un polling du HUD de personnage.

### Présentation officielle

- Extraire la police/atlas, les sprites PA/PM, contours, teintes, offsets, courbes, durée, ancrages et modes de regroupement.
- Reprendre l’ordonnanceur de textes officiel : regroupement éventuel par ressource/cible/action, espacement de plusieurs nombres, priorité des coups simultanés, comportement en mouvement.
- Distinguer coût de sort, coût de trajet, retrait subi, gain et esquive : l’officiel peut ne pas afficher ces familles de la même façon. Ne pas créer systématiquement un `−1 PM` au-dessus du personnage à chaque case.
- Partager le lecteur avec PV/bouclier/soins lorsque le format officiel est commun ; supprimer progressivement `CombatScene.floating()` et l’impact elliptique de secours.
- Relier les libellés de journal aux clés officielles, notamment pertes, gains et esquives PA/PM. Aucun nouveau panneau ou notification inventé.
- Intégrer les sons trouvés, avec le mixage et les options officiels ; vérifier le lecteur audio existant et ajouter son adaptateur si nécessaire, sans effet sonore de substitution.

Acceptation : rafale de deltas lisible, aucune duplication, pas de mélange PA/PM, bon suivi spatial, cohérence entre texte flottant, compteurs et timeline.

## 14. L9 — UI officielle, préférences et reprise

1. Brancher les contrôles tactique/grille réellement identifiés. Ne pas détourner `tg_pointCell` ou le bouton spectateur parce qu’ils ont une icône disponible.
2. Réutiliser les composants officiels de tooltip combattant pour PA/PM, tacle/fuite et esquives ; filtrer les champs inconnus plutôt que remplir les valeurs avec zéro.
3. Faire suivre tous les affichages par le même état présenté : HUD contrôlé, timeline, survol du combattant, fiche épinglée et barre des sorts.
4. Invalider la sélection lors de mort, changement d’entité contrôlée, état incompatible, nouvelle génération de carte et fin de combat.
5. Respecter les interactions du chat, les raccourcis officiels et les préférences de modules. Un raccourci de grille ne doit pas intercepter la frappe dans un champ.
6. Reconnexion : poser l’état courant sans rejouer les anciennes pertes ; restaurer options de rendu, combattants et effets persistants autorisés.
7. Retour sur carte : supprimer sélection, marqueurs et effets de combat ; restaurer précisément décor/props/particules du mode normal.
8. Les glyphes/pièges visibles doivent survivre à une bascule tactique et se reconstruire à partir de l’état autorisé après reconnexion. L’absence de snapshot de ces éléments constitue une sous-tâche explicite.

Acceptation : aucune valeur contradictoire entre modules, aucune ancienne animation après retour carte, préférences conservées selon le comportement officiel.

## 15. Découpage de fichiers proposé

Les nouveaux noms ci-dessous désignent du code d’adaptation du projet, pas des classes officielles prétendument extraites.

| Ensemble | Fichiers existants à toucher | Ajouts possibles et responsabilité |
| --- | --- | --- |
| Extraction | `client/dofus3/extractor/il2cpp`, `animations`, `entities`, `maps`, `ui` | Export de présentation combat et manifeste de provenance ; extensions seulement si format manquant |
| Protocole | `ModernCombatEvents.cs`, `ModernFightSnapshot.cs`, émetteurs `Fighter.cs` / `CharacterFighter.cs` | Métadonnées non ambiguës de ressource/action, snapshot observable, éventuellement aperçu sans mutation |
| État | `src/giny/combatState.ts`, `GinyClient.ts` | Normalisation typée, journal, état présenté, watermark et générations |
| Séquences | `src/game/combat/CombatSequencer.ts` | Étapes et barrières ; annulation indépendante de l’arrivée normale |
| Géométrie | `CellGrid.ts`, `CombatGrid.ts`, `PathReader.cs` | Topologie mise en cache et tests de parité |
| Présentation carte | `GameRenderer.ts`, `CombatScene.ts`, `MapEffects.ts` | `CombatDisplayController` pour couches/préférences ; `CombatCellOverlay` pour les données visuelles officielles |
| Déplacement | `MovementController.ts`, `EntityRenderer.ts`, chargeurs de clips | Configuration de locomotion officielle et lecture du temps résiduel |
| Effets | `CombatScene.ts`, `spellScripts.ts`, lecteurs effets/particules existants | `CombatEffectPlayer` / `CombatResourceTextPlayer` si les abstractions actuelles ne couvrent pas les formats extraits |
| UI | `WorldView.tsx`, `GameHud.tsx`, `liveCombat.ts`, renderer officiel | Contrôles et tooltips existants ; pas de nouvelle UI dessinée à la main |
| Vérification | Tests de combat et tests C# existants | Fixtures réseau, scénarios connectés et comparaisons visuelles officielles |

## 16. L10 — Matrice de recette minimale

Chaque scénario doit conserver : version des ressources, état initial, action demandée, messages reçus, état final serveur/client, ACK et capture/vidéo. Les aperçus déconnectés servent à isoler un widget ; ils ne remplacent pas cette recette.

| Cas | Ce qui doit être démontré |
| --- | --- |
| Normal ↔ tactique, grille activée/désactivée | Même cellule, même caméra, décor correctement masqué/restauré |
| Bascule pendant mouvement et sort | Animation continue ; aucun acteur ou effet de combat masqué avec le décor |
| Trajet libre court/long/avec virage | Chemin confirmé, clips officiels, orientation et PM exacts |
| Détour autour d’un obstacle | Coût égal au parcours autorisé, pas à la distance directe |
| Case occupée, zéro PM, cellule hors carte | Aperçu/refus cohérents, aucune animation d’arrivée fantôme |
| Sortie de contact avec tacle faible | Pertes PA/PM et déplacement restant corrects |
| Tacle total | Signal reçu, réaction officielle, aucun pas ; état de ressources conforme au serveur corrigé |
| Plusieurs tacleurs et demi-unités d’arrondi | Prévision et calcul serveur identiques sur les fixtures |
| Immunité, porté, invisible | Règles de déplacement et confidentialité respectées |
| Entrée en nouvelle zone de tacle / piège | Trajet réellement interrompu, reprise et événements ordonnés |
| Coût d’un sort puis coût d’une marche | Ressources distinguées malgré l’ancien `actionId = 0` |
| Retrait PA et PM partiellement esquivé | Perdu et esquivé séparés, aucun double débit |
| Gains/vols/expiration/début de tour | Bon bénéficiaire, maximum et valeur courante cohérents |
| Poussée/téléportation/échange | Lectures officielles distinctes, pas de translation uniforme de secours |
| Plusieurs effets sur la même cible | Texte lisible, regroupement officiel, HUD au bon instant |
| Mort/fin de combat en milieu de séquence | Nettoyage des effets et ACK sans callback ancien |
| Reconnexion / onglet suspendu / retard réseau | État exact, aucune perte rejouée, rattrapage borné |
| Invocation contrôlée / groupe à plusieurs joueurs | Bon acteur contrôlé, commandes et ACK au bon auteur |
| Ressource absente ou format non supporté | Lacune diagnostiquée, aucune animation inventée, réseau non bloqué |
| Combat complet jusqu’aux drops et retour carte | Nouvelle recette connectée avec la présentation corrigée |

Tests automatisés prioritaires : reducer de ressources, replay/révisions, annulation, séquences imbriquées, décodage de chemins, tacle total, arrondis, parité de prévision, frontières de cellules et restauration des couches.

Validation visuelle : images pour layout/couleurs/ancrages ; vidéos alignées sur les événements pour timing/ordre ; comparaison par zones pour éviter que le décor masque les écarts. Les tolérances sont à fixer selon résolution, rendu de texte et cadence de la référence avant d’automatiser les comparaisons.

Performance : mesurer temps CPU par survol, coût de bascule, nombre d’objets/effets persistants, mémoire GPU et durée de rattrapage. Fixer les budgets sur le matériel cible après mesure initiale ; ne pas annoncer un nombre de FPS sans scénario et machine.

## 17. Livraisons et critères de fin

| Livraison | Contenu | Condition de validation |
| --- | --- | --- |
| A — Fondations exactes | Inventaire officiel, contrat PA/PM, tacle total reproduit, normalisation et séquences | Messages non ambigus, tests serveur/client, pas de double application |
| B — Carte tactique | Topologie, couches tactiques, grille et contrôle UI officiels | Comparaison visuelle et bascules sans régression du monde |
| C — Déplacements lisibles | Accessibilité, prévision tacle, trajet confirmé, locomotion officielle | Parité des scénarios de mouvement et synchronisation temporelle |
| D — Tacle et ressources | Effets/clips/textes/sons officiels, compteurs et tooltips reliés | Scénarios tacle/pertes/esquives validés en combat connecté |
| E — Consolidation | Reconnexion, annulation, multi-acteurs, retour carte, performance | Matrice de recette exécutée et lacunes résiduelles explicitement fermées ou listées |

Chaque livraison conserve les preuves. Ne pas réactiver un contrôle visuel sans son comportement, ni considérer un effet « supporté » parce qu’un placeholder apparaît. Les impacts et textes dessinés à la main doivent disparaître des familles déclarées couvertes.

Une estimation calendaire fiable dépend surtout de L0 : un prefab prêt à lire et un shader/script obfusqué représentent des travaux très différents. Chiffrer après le manifeste de couverture, en séparant découverte, adaptation du lecteur et recette ; ne pas annoncer un délai unique qui suppose toutes les animations déjà exportées.

## 18. Ordre de démarrage recommandé

1. Réserver les scénarios de référence et produire le manifeste des cinq familles prioritaires : tactique, grille, locomotion, tacle, PA/PM.
2. Fixer le contrat `actionId = 0`, reproduire le tacle total et sécuriser l’annulation des mouvements.
3. Installer les barrières de présentation et les tests de ressources avant d’ajouter les chiffres à l’écran.
4. Livrer tactique/grille officiels, puis aperçu et trajet, puis tacle/pertes avec leurs ressources vérifiées.
5. Terminer par un combat connecté complet et une reconnexion ; publier les captures et traces correspondant à cette version exacte.

**La priorité est la cohérence événement → animation officielle → état affiché.** C’est ce qui évite une nouvelle passe esthétiquement plus proche mais encore incorrecte sur le tacle, les coûts ou les déplacements.

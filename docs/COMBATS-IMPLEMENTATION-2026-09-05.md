# Combat PvM : livraison jouable du 5 septembre 2026

Le cycle groupe → préparation → combat → récompenses → retour sur la carte est connecté au serveur local. Cette livraison couvre le premier jalon jouable de [l’audit](PLAN-COMBATS-GINY-BUBBLE-2026-09-05.md). Elle ne certifie pas encore la fidélité de tous les scripts graphiques de Dofus ni tous les cas multi-joueurs.

## Fonctionnement livré

- Survol des groupes : noms, niveaux individuels, niveau total, composition et disponibilité reçus du serveur. Le clic attend l’arrivée du personnage avant d’attaquer.
- Préparation : positions des deux équipes, choix d’une case autorisée, choix du challenge, bonus individuel XP/butin, bouton Prêt.
- Combat : scène séparée des acteurs de carte, timeline, PV/bouclier/PA/PM, minuterie, passage de tour, sorts disponibles et relances. Raccourcis 1–0, Espace et Échap, sans intercepter la saisie dans le chat.
- Déplacements tactiques : quatre directions, obstacles et occupation, budget de PM ; portée et ligne de vue en prévisualisation. Giny reste l’autorité pour les masques des sorts, le tacle et les coûts effectifs.
- Présentation ordonnée : mouvement, clips d’attaque et de réaction, chiffres de dégâts/soins, mort, téléportation, glissement, échange de positions, visibilité, transformation par resynchronisation du look, apparition des nouvelles invocations lors des checkpoints et marques de sol simples.
- Scripts d’animation : chargement du catalogue local, ancien `animId` et clips `casterAnimation` des scripts JSON type 9. Les VFX de sorts absents des exports utilisent un impact générique.
- Synchronisation : enveloppes JSON par destinataire et révisions, snapshots aux étapes importantes, ACK après présentation, annulation, délais maximaux et rattrapage des longues files. Les messages binaires historiques restent envoyés pour les clients existants.
- Fin : résultat réel par combattant, XP entière exacte, kamas, identifiants et quantités des objets, icônes locales. Les récompenses sont attribuées uniquement côté serveur ; fermer le résultat n’attribue rien.
- Reprise : reconnexion au combat, restauration du contexte, des acteurs, des sorts et du temps restant. Le serveur ne tue plus immédiatement le personnage lors d’une simple déconnexion. Le mécanisme existant borne à cinq minutes l’attente d’un combat sans joueurs connectés à la synchronisation.

## Corrections serveur

Validation des cellules de préparation et des cibles d’échange ; refus des commandes de préparation pendant le combat ; validation des enums et propositions de challenges ; requêtes de propositions répétées sans prolongation supplémentaire ; conservation des choix déjà validés ; disponibilité cohérente du bouton Prêt ; addition correcte des quantités de butin ; garde de finalisation unique ; reprise sûre lorsqu’un ancien combat n’existe plus.

`ModernCombatEvents` sérialise les champs des types réellement présents dans le protocole, y compris l’héritage des résultats et effets. Les valeurs `long`/`ulong` passent en chaînes décimales pour éviter la perte de précision JavaScript. `ModernFightSnapshot` masque les cellules des ennemis invisibles dans les snapshots.

## Vérifications réalisées

| Vérification | Résultat |
| --- | --- |
| Compilation TypeScript + Vite | Réussie |
| Suite Vitest complète | 76 fichiers, 478 tests réussis |
| Compilation Giny.World Release | Réussie, avertissements existants du dépôt |
| Tests C# `ModernCombatTests` | 3 réussis : agrégation du butin, résultats polymorphes/XP exacte, champs hérités des sorts |
| Groupe et préparation | Testés via le navigateur contre Auth/World, case 227 confirmée par le serveur |
| Victoire | Deux Attaques Naturelles sur un Feu de Joie : résultat serveur de 75 XP, 7 kamas, objets 16518 et 1984 en quantité 1 chacun |
| Déplacement | Passage de la case 227 à 240 confirmé dans le snapshot ; coûts effectifs de PA/PM renvoyés par Giny |
| Tours adverses | Déplacements et dégâts des monstres, minuterie et reprise du tour joueur observés |
| Reconnexion | Rechargement du navigateur en cours de combat, reprise sans décès, acteurs et compteur restaurés, poursuite des tours |
| Abandon | Commande serveur, écran de défaite, fermeture et retour au HUD de carte testés |

Captures : [survol](../output/playwright/combat-monster-tooltip.png), [placement](../output/playwright/combat-placement-final.png), [déplacement](../output/playwright/combat-movement-final.png), [reconnexion](../output/playwright/combat-reconnected.png), [victoire et drops](../output/playwright/combat-victory.png), [défaite](../output/playwright/combat-defeat.png), [retour carte](../output/playwright/combat-return-final.png).

Les tests ont utilisé le compte de test local existant. Aucun équilibrage ni taux de drop n’a été modifié pour obtenir la victoire. Le serveur World local a été recompilé et relancé ; Auth a été conservé. Journaux dans `.local/logs/combat-*.log` et `.local/logs/world-combat-reconnect.log`.

## Couverture restant à compléter

- Export et lecture des VFX et sons propres aux sorts : projectiles, impacts, strates, points d’attache et scripts conditionnels. Le clip du lanceur et l’impact générique ne remplacent pas cette couverture.
- Prévisualisations des zones d’effet et masques complexes ; animations spécifiques porter/jeter, portails et pièges, au-delà de la position finale synchronisée.
- Restauration exhaustive des challenges, marques et buffs déjà actifs après reconnexion ; statistiques détaillées du combat et progression XP dans la fenêtre de résultat.
- Recette multi-joueurs, contrôle d’invocations, enchaînement de salles de donjon, mort simultanée et charge prolongée. Ces cas ne sont pas déclarés validés par la victoire PvM testée ici.

## Points d’entrée

Client : `src/giny/combatState.ts`, `src/giny/GinyClient.ts`, `src/game/combat/CombatScene.ts`, `CombatGrid.ts`, `CombatSequencer.ts`, `spellScripts.ts`, `src/ui/game/liveCombat.ts`, `src/ui/game/CombatHud.tsx`, `src/ui/screens/WorldView.tsx` et `src/game/renderer/GameRenderer.ts`, sous `client/web`.

Serveur : `Managers/Modern/ModernCombatEvents.cs`, `ModernFightSnapshot.cs`, `Handlers/ModernClientHandler.cs`, `Network/WorldClient.cs`, handlers et gestionnaires de combat sous `server/Servers/Giny.World`. L’envoi réseau de base dans `server/Giny.Core/Network/Client.cs` est virtuel pour permettre la projection optionnelle.


## Reprise de l’interface officielle — 5 septembre, seconde passe

Les panneaux HTML génériques de combat ont été retirés. `GameHud` branche maintenant les données serveur dans les documents extraits `FightTimeline` / `timelineFighter`, `EndTurnWidget`, `challengeSettingsDisplay`, `challengeChoiceDisplay`, `challengeGroup` et `fightResult`. L’action bar et les compteurs PV/PA/PM restent les modules officiels existants. Le survol utilise `WorldRpMonstersGroupTooltip` et `MonsterTooltipLine`.

La source visuelle est le cache du parseur sous `client/dofus3/.cache/dofus3/ui/current/trees` et ses textures/polices. Il ne s’agit pas d’une transcription CSS des captures. Les feuilles UITK par document de combat n’étant pas générées dans ce cache, `UITK_COMPILED_TREES` conserve leur UXML/USS compilé ; les contrôles Figma utilisent toujours le thème officiel pour les états actifs. Les modèles à plusieurs racines conservent désormais tous leurs éléments lors du clonage, notamment le contenu de `fightResultSection`.

Le résultat affiche les récompenses exactes reçues, les onglets Personnage / Résumé / Statistiques, les portraits et les listes de vainqueurs/vaincus. Les dégâts, soins et ennemis achevés sont comptés depuis les événements ordonnés ; les statistiques absentes après une reconnexion et celles non transmises sont marquées « — ». Les challenges utilisent actuellement le pictogramme officiel générique avec leur nom et description ; la correspondance des pictogrammes individuels n’est pas encore exportée.

Validation de cette seconde passe : compilation TypeScript/Vite réussie ; 483 tests Vitest réussis, 1 ignoré. Contrôles dans le navigateur de la sélection/validation du challenge, du bonus, du mode aléatoire, de Prêt → Passer le tour, des trois onglets et de la fermeture du résultat. Les vérifications visuelles emploient l’atelier de développement explicitement déconnecté (`?ui-preview=hud&combat-preview=preparation`, `result`, `group`) qui monte les mêmes composants que le client connecté. Aucun nouveau cycle serveur complet n’est certifié par ces captures ; la recette serveur décrite plus haut concernait la première passe.

Captures de cette interface : [préparation](../output/playwright/official-combat-preparation.png), [challenges](../output/playwright/official-combat-challenges.png), [résultat](../output/playwright/official-combat-result.png), [résumé](../output/playwright/official-combat-summary.png), [statistiques](../output/playwright/official-combat-statistics.png), [groupe](../output/playwright/official-combat-group.png).

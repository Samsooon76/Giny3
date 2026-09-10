# Suivi des interfaces Giny

Dernière mise à jour : 5 septembre 2026, incrément 006 (recette et lancement local).

Ce fichier suit les 29 fenêtres du registre client et les parcours transversaux. Il sera mis à jour à chaque incrément du chantier, avec le [journal](JOURNAL.md). Les données d’audit décrivent le code constaté ; elles ne constituent pas une recette interactive.

Statuts : **audité** = état identifié ; **en cours** = code modifié, validation incomplète ; **validé techniquement** = tests identifiés passés ; **validé en jeu** = parcours exécuté depuis le client. Aucune interface ne passe « terminée » sur la seule présence d’un écran ou d’un handler.

Dernière validation globale : 448 tests client et 22 tests serveur réussis. Les migrations sont appliquées au serveur local courant après sauvegarde ; restauration de copie vérifiée sur 79 tables. Les parcours interactifs ci-dessous ont été exécutés sur cette copie. Aucun écran entier n’est déclaré terminé : les limites restantes figurent dans chaque fiche.

## 01. Personnage / `characterSheetUi`

- **Statut :** parcours boost/reset validé en jeu sur copie ; interface partielle.
- **Existant constaté :** Stats live disponibles.
- **Travail restant :** Reconnexion, ventilation et progression aux limites.
- **Données / schéma :** Réutiliser `characters.Stats`, `Experience`.
- **Lot prévu :** 2.
- **Fait dans ce chantier :** Formulaire de boost/reset raccordé au serveur ; retour et resynchronisation.
- **Vérification en jeu :** 995 points → boost de 10 Force → 985 ; reset → 995, avec confirmations serveur.

## 02. Sorts / `playerSpell`

- **Statut :** activation de variante validée en jeu sur copie ; interface partielle.
- **Existant constaté :** Liste live, sélection locale.
- **Travail restant :** Reconnexion, raccourcis, correspondances des icônes, états requis et cas limites des effets.
- **Données / schéma :** `characters.Spells`, `Shortcuts`, catalogue existant.
- **Lot prévu :** 2.
- **Fait dans ce chantier :** Variantes sélectionnables ; état actif, paires, noms, niveaux et disponibilité fournis par Giny. Infobulles alimentées par descriptions, effets et limites serveur ; exemples statiques masqués.
- **Vérification en jeu :** Inertie 13026 activée depuis la grille, message serveur reçu et surbrillance mise à jour.

## 03. Inventaire / `equipmentStorageUi`

- **Statut :** équiper/déséquiper validé en jeu sur copie ; interface partielle.
- **Existant constaté :** Données live, mutations non câblées.
- **Travail restant :** Usage des différentes familles de consommables, reconnexion, nourrir, quantités, déplacer/supprimer, tri/filtres et ensembles.
- **Données / schéma :** `character_items`, `characters`.
- **Lot prévu :** 2.
- **Fait dans ce chantier :** Sélection, équiper/déséquiper/utiliser une unité et double-clic raccordés ; slots autorisés par Giny.
- **Vérification en jeu :** Pile de 2 anneaux : une unité équipée, seconde conservée ; déséquipement puis sauvegarde SQL confirmant les 2 unités dans le sac.

## 04. Monture / `rideParentUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Pas de projection live identifiée.
- **Travail restant :** S : posséder, équiper, monter, nourrir, XP, inventaire.
- **Données / schéma :** Modèle montures proposé.
- **Lot prévu :** 7.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 05. Quêtes / `quests`

- **Statut :** claim récurrent validé en jeu sur copie ; quêtes classiques incomplètes.
- **Existant constaté :** Résumé classique, détails manquants.
- **Travail restant :** Reconnexion, expiration et changement de période ; objectifs/récompenses des quêtes classiques à importer.
- **Données / schéma :** Tables existantes, préférences éventuelles.
- **Lot prévu :** 3.
- **Fait dans ce chantier :** Panneau récurrentes/Battle Pass, état dédié, sync/claim corrélés ; objets dans la transaction du claim.
- **Vérification en jeu :** Quête 22 : claim confirmé, 3400 kamas + 3 objets + 120 XP Battle Pass vérifiés en SQL ; seconde tentative refusée.

## 06. Carte / `CartographyMapUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Position live + fond local.
- **Travail restant :** B/C : destinations réellement disponibles, zaaps, objectifs, repères.
- **Données / schéma :** Tables cartes/waypoints existantes.
- **Lot prévu :** 2–3.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 07. Calendrier / `calendarUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI sans domaine métier dédié.
- **Travail restant :** S : événements serveur, jours, détails, droits aux récompenses si proposés.
- **Données / schéma :** `calendar_events`, claims conditionnels.
- **Lot prévu :** 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 08. Classement / `LadderUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI.
- **Travail restant :** S : classement public calculé, filtres, pagination, rang personnel.
- **Données / schéma :** Lecture existante ; snapshots optionnels.
- **Lot prévu :** 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 09. Recherche de groupe / `groupSearch`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI ; groupes classiques côté serveur.
- **Travail restant :** S : annonces, candidature, invitation et expiration.
- **Données / schéma :** Annonces persistantes optionnelles.
- **Lot prévu :** 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 10. Apparence / `cosmeticUi`

- **Statut :** en cours, code raccordé ; recette en jeu restante.
- **Existant constaté :** Catalogue cosmétique, possessions partielles.
- **Travail restant :** Recette en jeu ; objets vivants, mimibiotes, tenues, vignettes d’ornements.
- **Données / schéma :** Champs existants ; tenues/déblocages si nouveau modèle.
- **Lot prévu :** 2, 6.
- **Fait dans ce chantier :** Liste des titres/ornements connus et noms Giny ; sélection/retrait raccordés.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 11. Amis / `friends`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Serveur renvoie listes vides.
- **Travail restant :** S : ajouter/retirer/ignorer, statut, notes, invitations pertinentes.
- **Données / schéma :** Relations sociales.
- **Lot prévu :** 5.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 12. Guilde / `guildBase`

- **Statut :** migration déployée ; projection des membres ajoutée, recette de guilde restante.
- **Existant constaté :** Résumé sans membres ; schéma incomplet.
- **Travail restant :** Recette avec une guilde réelle ; modification des rangs/droits, XP, notes, bulletin et invitations.
- **Données / schéma :** Réparer `guilds`, réutiliser BLOB ; coffre/recrutement optionnels.
- **Lot prévu :** 5.
- **Fait — incrément 001 :** migration des quatre colonnes BLOB, historique/checksum et sauvegarde de l’XP de guilde ; tests MariaDB isolés réussis. Migration appliquée à la base courante dans l’incrément 006 après sauvegarde. Projection des membres, présence, niveau, rang, note et contribution XP ajoutée ; faux solde supprimé.
- **Reste côté socle :** reprise des anciennes guildes sans rangs si une telle base est importée ; recette des membres puis droits et actions UI. Aucune guilde présente dans la base locale pour cette recette.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 13. Alliance / `allianceBase`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI sans moteur identifié.
- **Travail restant :** S : identité, guildes membres, droits, invitations, chat.
- **Données / schéma :** Modèle alliances.
- **Lot prévu :** 7.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 14. Succès / `achievements`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Points live et catégories catalogue.
- **Travail restant :** B/C : progression, détails, terminés, récompenses, suivi.
- **Données / schéma :** `characters.Achievements` + catalogues existants.
- **Lot prévu :** 3.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 15. Boutique / `webBase`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Coquille web.
- **Travail restant :** S : catalogue privé, stock/droits, achat et livraison.
- **Données / schéma :** Modèle commercial ; monnaie existante à réutiliser.
- **Lot prévu :** 8.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 16. Encyclopédie / `encyclopediaBase`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Consultation de données Dofus 3.
- **Travail restant :** C : basculer vers catalogue Giny, butins/conditions/zones serveur.
- **Données / schéma :** Export, pas duplication des monstres/objets.
- **Lot prévu :** 1–3.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 17. Métiers / `jobUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** XP live, catalogue UI.
- **Travail restant :** B/C : recettes réalisables, ressources, sélection métier, progression réelle.
- **Données / schéma :** `characters.Jobs`, `recipes`, `skills`.
- **Lot prévu :** 4.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 18. Guide / `guidebookBase`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI.
- **Travail restant :** C : contenu Giny, recherche, liens vers actions disponibles.
- **Données / schéma :** Fichiers versionnés suffisants.
- **Lot prévu :** 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 19. Ensembles / `CharacterPresetUi`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI.
- **Travail restant :** S : CRUD et application d’équipement/sorts/raccourcis.
- **Données / schéma :** Presets + entrées typées.
- **Lot prévu :** 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 20. Collection / `collectionTab`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI.
- **Travail restant :** S/C : préciser collection Pokéfus ou collection générale ; progression réelle.
- **Données / schéma :** Pokéfus existant ; nouvelle progression seulement si distincte.
- **Lot prévu :** 3, 6.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 21. Bourse / `bakTab`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Arbre UI.
- **Travail restant :** S : ordres, réservations, appariement, annulation, journal.
- **Données / schéma :** Modèle économique séparé.
- **Lot prévu :** 8.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 22. Alignement / `alignmentTab`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Pas d’état persistant dédié identifié.
- **Travail restant :** S : choisir alignement, grade/honneur, progression et conditions.
- **Données / schéma :** `character_alignments`.
- **Lot prévu :** 7.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 23. Havre-sac / `havenbagManager`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Téléportation fixe.
- **Travail restant :** S : instance personnelle, salles, mobilier, visites/droits.
- **Données / schéma :** Havre-sacs, salles, placements.
- **Lot prévu :** 7.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 24. Kolizéum / `PvpArenaBase`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Handlers inactifs.
- **Travail restant :** S : file, confirmation, matchmaking, combat, résultat.
- **Données / schéma :** Saisons/ratings/matches ; file en mémoire possible.
- **Lot prévu :** 7.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 25. Élevage / `BreedingUi`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Filtres et jauges locales.
- **Travail restant :** S : stable/enclos/transferts/généalogie puis reproduction.
- **Données / schéma :** Montures/enclos ; clonage/extraction à définir séparément.
- **Lot prévu :** 7–8.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 26. Banque / `storageBank`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Moteur `BankExchange`, UI générique.
- **Travail restant :** B : ouvrir via PNJ, contenu privé, transférer objets/kamas, fermer.
- **Données / schéma :** `bank_items`, `world_accounts.BankKamas`.
- **Lot prévu :** 4.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 27. HDV / `auctionHouse`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Moteur achat/vente, UI générique.
- **Travail restant :** B/C : recherche, prix, lots, achat, vente/retrait, suivi.
- **Données / schéma :** `bidshops`, `bidshop_items` ; historique optionnel.
- **Lot prévu :** 4.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 28. Craft / `CraftUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Moteur métiers, UI générique.
- **Travail restant :** B/C : atelier valide, ingrédients, quantité, résultat, interruption.
- **Données / schéma :** Tables existantes.
- **Lot prévu :** 4.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 29. Recettes / `recipesUI`

- **Statut :** audité, raccordement à poursuivre.
- **Existant constaté :** Catalogue extrait.
- **Travail restant :** C : recettes Giny, composants possédés, quantité fabricable, navigation.
- **Données / schéma :** `recipes`, inventaire courant.
- **Lot prévu :** 1, 4.
- **Fait dans ce chantier :** aucun branchement UI livré à ce stade.
- **Vérification en jeu :** non exécutée ; prévoir lecture réelle → action acceptée/refusée → mise à jour → reconnexion.

## 30. Combat et résultats

- **Statut :** audité.
- **Existant :** moteur Giny et snapshot C# ; pas de contrôleur de combat raccordé dans le client inspecté.
- **Reste :** attaque, placement, prêt, timeline, tours, ciblage, sorts/armes, acquittements, buffs, résultats et reprise de session.
- **Validation :** combat depuis le client jusqu’à récompense et reconnexion ; non exécutée.

## 31. PNJ, dialogues, échanges entre joueurs

- **Statut :** audité.
- **Reste :** contrôleur de dialogue, réponses autorisées, ouverture contextuelle banque/HDV/craft, échange à double validation, transferts atomiques et fermeture.
- **Validation :** deux comptes, modification de l’offre, annulation et interruption ; non exécutée.

## 32. Quêtes récurrentes et Battle Pass

- **Statut :** lecture et claims validés en jeu sur copie ; parcours partiel.
- **Fait :** état de module versionné par personnage, store client, panneau de progression/récompenses, actualisation et claims corrélés. Objets, claim et crédit regroupés dans une transaction SQL.
- **Validation :** quête avec objets et refus de seconde attribution ; palier gratuit Battle Pass accordant 5000 kamas, solde 8400 et un seul claim confirmé en SQL. Palier VIP affiché verrouillé.
- **Reste :** reconnexion, expiration/changement de saison, cas VIP autorisé, crash après commit et cohérence des stats dérivées d’un gain de niveau.

## 33. Pokéfus

- **Statut :** audité.
- **Existant :** configuration et progression persistantes, commandes de capture/équipe/gènes.
- **Reste :** store, collection, équipe, capture ciblée, gènes et synchronisation ; étendre le contenu au-delà de l’espèce configurée.
- **Validation :** capture → équipe → recherche/déblocage → reconnexion ; non exécutée.

## 34. Campement de guilde

- **Statut :** audité ; socle de persistance guilde validé dans l’incrément 001, branchement encore à réaliser.
- **Existant :** huit tables et services de contribution/construction.
- **Reste :** store et vues, droits, projets, contributions et retour des effets.
- **Validation :** Forge niveau 1 → niveau 2 depuis le client, avec droits et contributions concurrentes ; non exécutée.

## 35. Session, HUD, transport, catalogue

- **Rendu des entités, 7 septembre 2026 :** couleurs additives du Feu de Joie rétablies dans le moteur partagé. Validation sur fichiers réels en WebGL, transparence inchangée, 38 tests ciblés et build réussis ; comparaison dans `output/playwright/feu-de-joie-colors.png`. Client compilé, relance d'Electron nécessaire pour une session déjà ouverte. Voir l'entrée « Rendu des entités » du journal.

- **Statut :** premier incrément ORM validé techniquement ; reste du socle, catalogue et protocole à poursuivre.
- **Existant :** authentification, carte/déplacement, snapshots HUD et polling.
- **Reste :** exporter catalogue Giny, manifeste, correspondances visuelles, stores des domaines restants, révisions/session et bornage général des files. Capabilities, résultats corrélés, store quêtes et grandes projections JSON sont livrés.
- **Validation :** navigateur/Electron, changement de personnage, réponses anciennes, catalogue incompatible ; non exécutée dans cet incrément.

## Règle de mise à jour

À chaque livraison : indiquer ici les actions ajoutées, les tests réellement exécutés, le dernier identifiant d’incrément et les blocages concrets. Conserver le récit daté et les fichiers modifiés dans le journal. Les futures tâches doivent lire ces deux fichiers avant de reprendre le chantier.

## Complément HUD — 7 septembre 2026 : options des modules

Les menus des sept captures récentes sont repris. Validation technique : build client et 42 tests ciblés ; recette interactive dans l’aperçu du HUD pour les PV, lignes, filtres, opacité, icônes et ouverture des menus. Les actions non prises en charge restent grisées, notamment les jauges métier, l’ajout d’une barre et les options de combat non raccordées. Détails et limites dans le journal du 7 septembre.

Clic droit carte (capture 23:43) : menu de zoom et options générales ajouté. Grille, premier plan des entités et coordonnées raccordés ; mode créature/noms permanents désactivés. Recette locale du zoom, retour 100 %, grille et placement au bord droit réussie ; 32 tests ciblés caméra/bindings passent.

Menu d’un autre personnage (8 septembre) : ouverture au clic gauche réservée aux autres joueurs, menu de la référence 23:30 reproduit. MP préparé dans le chat, protocole privé sérialisé, zoom et ignorance de session raccordés. Autres actions sociales grisées. Build et 9 tests ciblés réussis ; recette visuelle sur acteur de test, sans envoi ni session multi-joueurs réelle.

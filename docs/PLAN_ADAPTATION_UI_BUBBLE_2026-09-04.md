# Adapter les interfaces Bubble au client Giny

Audit local du 4 septembre 2026 — Bubble 0.1.328.

**Recommandation : porter progressivement la couche de présentation React de Bubble dans le client web Giny, conserver le rendu du monde et la connexion Giny, puis remplacer les contrôleurs Bubble par des contrôleurs Giny. Commencer par l’inventaire pour valider cette stratégie.**

Il existe une vraie possibilité de réutilisation : les deux clients utilisent React. En revanche, le dossier livré contient du JavaScript compilé et minifié, sans les sources applicatives TypeScript/TSX ni leurs source maps. Ce sera un travail de récupération et de remise en structure, pas une simple copie d’un dossier de composants.

## 1. Le résultat le plus important : les images sont déjà là

Vérification effective des fichiers, et non déduction à partir de leurs noms :

| Comparaison | Résultat |
| --- | --- |
| `client/web/public/dofus3/` | **4 767 fichiers, tous identiques** à leurs références Bubble dans l’archive ou le manifeste d’assets |
| `dofus3-globals.css` | Identique au fichier global Bubble après neutralisation des URL |
| `themes.css` | Identique au fichier de thèmes Bubble après neutralisation des URL |
| Ressources Bubble sous `ui/` et `dofus3/` | **13 319 ressources présentes et vérifiées** par taille et SHA-256 : 13 234 lues dans les packs et 85 dans les blobs |
| Cache d’interfaces Giny | 685 fichiers d’arbres UI ; 526 fichiers dans `ui/styles` ; 72 fichiers dans `uitk/trees` |

Ces nombres ne mesurent pas la couverture fonctionnelle. Un arbre, une texture ou une feuille CSS ne représente pas nécessairement une fenêtre autonome ou utilisable.

**Recopier les 4 767 ressources existantes ne réduira donc pas l’écart.** Les ressources supplémentaires de `ui/` peuvent servir à certains écrans Bubble, mais l’effort principal concerne les composants, leur composition et leurs interactions.

Les résultats et empreintes sont conservés dans [BUBBLE_UI_AUDIT_2026-09-04.json](BUBBLE_UI_AUDIT_2026-09-04.json).

## 2. Où se trouve réellement Bubble

`bubble/` est essentiellement un répertoire de données d’application : caches Chromium, préférences, mises à jour et ressources de jeu. Les images téléchargées sont adressées par empreinte et rangées dans des blobs ou des fichiers `.pack`. Le manifeste donne leur chemin logique et, pour les packs, leur offset et leur longueur.

**Le code exploitable est dans `resources/app.asar`, à la racine du projet.** Son SHA-256 correspond exactement à celui annoncé par le manifeste de mise à jour Bubble 0.1.328 : `9d2bd53656e91c52b20db881225617625222d74b41f965dd961bfd35d7301a8f`.

Entrées importantes de cette archive :

| Entrée interne | Utilité |
| --- | --- |
| `dist/assets/game-entry-D5YuSIvZ.js` — 5,39 Mo | Composants d’interface, contrôleurs, interactions, fonctions du jeu |
| `dist/assets/game-entry-BYX3ak61.css` — 1,02 Mo | Styles propres aux écrans et comportements du client |
| `dist/assets/globals-YtF8dp2z.css` | Styles globaux déjà présents chez Giny |
| `dist/assets/themes-DzPays1k.css` | Thèmes déjà présents chez Giny |
| `dist/assets/base-Bq0vdgr4.css` | Règles structurelles du DOM `.dofus3-scene` |
| `dist/core/dofus3/` | Polices, icônes, textures et ressources embarquées |
| `dist/assets/app-CgRsD63L.js` et autres chunks | État partagé, utilitaires et dépendances à inventorier lors du portage |
| `dist-electron/*.cjs` | Services Electron, chargement des ressources et réseau |

Les fichiers tels que `inventory-lJ-7XlJI.js` ou `ui-AAu9c_kT.js` contiennent notamment des codecs de messages : leur nom ne signifie pas qu’ils exportent une fenêtre React prête à importer.

## 3. La différence d’architecture

### Giny aujourd’hui

Le client actif est `client/web/` : React, PixiJS et Electron. `client/dofus3/` sert notamment de chaîne d’extraction et de cache.

Le parcours de rendu est :

```text
Arbre UI JSON + styles extraits de Unity
  → useOfficialTree / OfficialScreen / VisualNode
  → adaptation des composants UITK et de leurs styles
  → bindings et listes remplis depuis CharacterHud
  → DOM React
```

Le projet possède déjà des fenêtres déplaçables, du magnétisme, des infobulles, des thèmes, un HUD, une carte du monde et des données de personnage. Ce sont des fondations à conserver.

La difficulté est que les données extraites ne contiennent pas toute la logique que le client officiel ajoute au runtime. Le code complète donc des intérieurs de composants, des templates et des états. Voir `official/uitk.ts`, `treeLoader.ts`, `OfficialScreen.tsx`, `game/hudBindings.ts` et `game/hudRepeaters.ts`.

De plus, le HUD combine des styles JSON/USS appliqués en ligne avec `/uitk/theme.css`, des feuilles par arbre et une passe DOM de teinte/découpe. Il faut contrôler cette chaîne pour atteindre une fidélité visuelle stable. Le nombre de feuilles présentes ne suffit pas à conclure que les autres arbres sont inutilisables : des styles communs et des replis existent.

### Bubble dans le build examiné

Bubble livre des fonctions de composants React avec leur structure DOM, leurs propriétés et leurs callbacks déjà définis. Les conventions visuelles officielles restent visibles : `data-name`, classes de texte et de couleur, composants de fenêtres, cases, boutons, champs et listes.

Des fonctions de présentation relativement isolables côtoient des contrôleurs fortement liés aux stores Bubble, au bus d’actions et à `IsoEngine`. Le build ne permet pas d’affirmer comment leur générateur de sources fonctionne, ni que tout a été écrit à la main. Il permet de constater que **les interfaces inspectées sont livrées sous forme de composants React compilés**, là où Giny reconstruit ses arbres au runtime.

Pour reproduire Bubble, le bon niveau de reprise est donc : **DOM + composants + CSS + états d’interaction**, puis adaptation des données et actions.

## 4. Exemple vérifié : l’inventaire

Dans `game-entry-D5YuSIvZ.js`, les symboles minifiés suivants donnent des points d’entrée concrets. Ces noms sont propres à cette version ; les futurs modules Giny doivent recevoir des noms lisibles.

| Symbole Bubble | Rôle constaté | Destination proposée |
| --- | --- | --- |
| `zt` | Cadre, titre, fermeture, déplacement et options de fenêtre | `GameWindow` |
| `ln` | Case d’objet, quantité, sélection, verrouillage, callbacks souris | `ItemTile` |
| `Vk` | Présentation du stockage, recherche, filtres, poids et boutons | `StoragePanel` |
| `IIt` | Composition `PlayerInventory`, emplacements équipement et stockage | `InventoryView` |
| `Qlt` | Composition de l’équipement et des cosmétiques | `EquipmentPanel` |
| `$It` | Contrôleur d’inventaire dépendant de l’état Bubble et d’`IsoEngine` | À remplacer par `useGinyInventory` |
| `sy` | Grille affichant une plage de lignes, marge de deux lignes | `VirtualItemGrid` |

Le cadre `IIt` reçoit notamment `equipmentSlot`, `storageSlot`, `decorations` et `onClose`. Cette séparation rend plausible un premier port de présentation sans importer tout le moteur Bubble. **La fermeture de toutes ses dépendances reste à démontrer dans le prototype.**

Chez Giny, `bindInventory()` affiche déjà les objets, l’équipement, les infobulles, les kamas et les pods. En revanche, ses bindings de recherche/tri sont essentiellement des libellés et ceux des cases n’exposent pas les actions d’équipement ou d’utilisation. `GameHud` ne reçoit comme callback métier explicite que l’envoi du chat.

Le serveur fournit déjà `HandleObjectSetPositionMessage`, `HandleObjectUseMessage` et les handlers d’ajout, suppression et permutation de raccourcis. Il faut les exposer dans le client et traiter leurs mises à jour, plutôt que recréer ces règles côté UI.

Exemple de raccordement :

```text
Déposer un objet sur un emplacement
  → InventoryView appelle actions.equipItem(uid, position, quantity)
  → GinyClient sérialise ObjectSetPositionMessage (ID 5569 dans ce dépôt)
  → Giny valide et modifie l’inventaire
  → le client reçoit les changements d’inventaire / statistiques / apparence
  → les stores actualisent la fenêtre
```

Les messages Bubble inspectés possèdent des codecs de type Protobuf et des actions comme `ObjectSetPositionRequestAction`. Giny a son propre framing, ses identifiants et ses classes de messages. **Même lorsqu’une action a le même sens, ses octets ne sont pas interchangeables.**

## 5. Plan de migration proposé

### Étape 1 — Figer la référence et préparer l’atelier

Conserver la version et l’empreinte de l’archive. Construire un index reproductible des entrées ASAR et des ressources, avec résolution chemin → blob/pack et contrôle SHA-256. Extraire uniquement les dépendances des écrans étudiés. Les caches de session et paramètres personnels ne sont pas nécessaires au portage.

Préparer une page de développement dédiée à la comparaison, avec données déterministes. Relever les écrans Bubble à reproduire : HUD, inventaire, personnage, sorts, chat, quêtes, carte, puis écrans custom. Définir thème, résolution, échelle, contenu et états souris identiques.

**Livrable :** références visuelles et inventaire des dépendances pour un premier écran. L’audit présent apporte déjà l’inventaire statique, mais pas les captures de cette session.

### Étape 2 — Porter le socle et un inventaire statique

Créer une petite bibliothèque de composants dans `client/web/src/ui/bubble/` : fenêtre, bouton, icône, case d’objet, champ de recherche, onglets, liste/grille, tooltip et menu contextuel. Récupérer ou reconstruire leurs dépendances avec des noms explicites.

Réutiliser les ressources et styles déjà identiques. Ajouter les règles nécessaires de `base` et de `game-entry`, en maîtrisant leur portée. La copie brute de toutes les feuilles peut modifier les anciens écrans : vérifier les collisions, les styles inline et les portails de tooltip/menu. Un conteneur CSS seul ne protège pas les portails rendus ailleurs dans le document.

Monter `InventoryView` avec des données fixes : objets équipés, sac, quantités et poids. Faire fonctionner ouverture, fermeture, déplacement, survol, sélection, recherche et tri locaux.

**Critère de passage :** obtenir l’inventaire de référence avec ses principaux états, dans une page indépendante, sans initialiser la connexion ni les stores Bubble. Si les dépendances empêchent cet isolement, reconstruire la vue à partir de sa composition DOM et des ressources, plutôt qu’embarquer tout le bundle comme fondation permanente.

### Étape 3 — Brancher l’inventaire sur Giny

Définir un contrat de vue indépendant du protocole : objets et identifiants d’instance, équipement, monnaie, pods, sélection, état d’attente et erreurs ; actions équiper, déséquiper, utiliser et déplacer.

Ajouter les messages nécessaires à `GinyClient`, leurs parseurs et les mises à jour reçues. Reprendre les IDs et sérialisations du dépôt serveur. Maintenir l’autorité serveur et prévoir la restauration de l’état si une action est refusée. Préserver les identifiants d’instance : un identifiant de type d’objet seul ne suffit pas pour déplacer un objet précis.

Réutiliser le catalogue local pour noms, icônes, effets et catégories ; identifier les différences entre les données modernes de Bubble et les données Giny 2.68. Les tiers Stasis, monnaies alternatives et métadonnées custom doivent passer par des capacités optionnelles.

**Critère de passage :** équiper, déséquiper et utiliser un objet sur Giny, constater les quantités/statistiques/apparences actualisées et retrouver le bon état après reconnexion. Tester également un refus serveur.

### Étape 4 — Migrer les écrans partageant ce socle

Ordre conseillé après validation de l’inventaire :

1. **HUD, barre d’actions et chat** : cases, raccourcis, menus, focus clavier et couche de fenêtres commune.
2. **Personnage et sorts** : données déjà partiellement présentes, états sélectionnés, listes, effets et actions disponibles.
3. **Quêtes, succès et métiers** : différencier données de catalogue, progression réelle et données d’aperçu. Une fenêtre remplie de contenu de démonstration n’est pas une fonctionnalité raccordée.
4. **Banque, échanges, hôtel de vente et artisanat** : réutiliser les vues de stockage, puis couvrir les transactions et mises à jour serveur propres à chaque activité.
5. **Social, guilde, alliance et apparence**, selon les priorités du serveur et la disponibilité de leurs contrats de données.
6. **Interfaces custom Bubble**, après inventaire explicite de leurs dépendances serveur.

Garder les anciens écrans accessibles pendant cette migration. Une bascule par fenêtre permet de comparer et revenir en arrière. Le registre de fenêtres, le focus, les modales, les raccourcis et les infobulles doivent avoir un propriétaire commun pour éviter que deux systèmes concurrents répondent au même clic ou à la même touche.

### Étape 5 — Adapter les interfaces custom à ton serveur

Séparer la présentation et les capacités : par exemple une fenêtre de calendrier peut reprendre sa disposition, tout en obtenant son programme auprès de Giny. Les actions `__Stasis...` repérées dans Bubble nécessitent leurs propres données et règles ; une simple modification de texte ne les rendra pas fonctionnelles.

Prévoir un registre `WindowDefinition` avec composant, titre, icône, raccourci, dimensions, capacité requise et version de configuration. Les variantes custom restent dans leurs modules. Tu pourras modifier une vue, son contenu ou ses actions sans toucher au renderer générique de toutes les interfaces.

### Étape 6 — Valider fidélité et fluidité

Pour chaque écran : captures comparables à résolution/échelle fixes ; états normal, survolé, pressé, désactivé et sélectionné ; liste vide et liste longue ; texte français long ; fenêtre déplacée ou redimensionnée ; tooltip et menu près d’un bord.

Mesurer ouverture à froid et à chaud, fluidité de déplacement et défilement, nombre de nœuds DOM et re-rendus lors d’une mise à jour de données. Tester une petite et une grande collection, par exemple 100 puis 2 000 objets simulés. Fixer le budget à partir de mesures sur la même machine, au lieu de promettre un nombre de FPS sans observation.

Bubble présente des mécanismes utiles : abonnements ciblés via `useSyncExternalStore`, grille avec plage visible et rafraîchissement du déplacement via `requestAnimationFrame`. Cela justifie de reprendre ces patterns. Cela ne prouve pas à lui seul la cause de toute la fluidité constatée en jeu.

## 6. Architecture cible

```text
Vues React inspirées/reprises de Bubble
  │  props de données + callbacks métier
  ▼
Stores et contrôleurs Giny par domaine
  │  inventaire, personnage, sorts, chat, quêtes…
  ▼
GinyClient + sérialisation du protocole du dépôt
  ▼
Serveur Giny

Services UI communs : fenêtres, focus, drag/drop, tooltips, raccourcis
Ressources : fichiers locaux déjà présents + compléments vérifiés
Monde : renderer PixiJS existant
```

Emplacements proposés, non créés pendant cet audit :

```text
client/web/src/ui/bubble/components/
client/web/src/ui/bubble/windows/inventory/
client/web/src/ui/bubble/styles/
client/web/src/ui/controllers/
client/web/src/ui/models/
client/web/src/ui/services/
```

Ne pas remplacer le renderer du monde pour ce chantier d’interfaces. Les portraits 3D/2D, previews de personnages ou mini-cartes utilisés dans les fenêtres doivent recevoir un adaptateur vers les services de rendu existants. Leur exactitude dépend aussi du moteur et des données d’apparence ; le CSS ne peut pas corriger ces écarts.

## 7. Décision et limites

**Premier lot recommandé : une fenêtre d’inventaire fidèle, maintenable, branchée sur Giny et validée dans ses états interactifs.** Son socle servira ensuite au HUD, aux raccourcis et aux autres fenêtres de stockage.

Effort relatif : inventaire des ressources faible à ce stade ; portage du socle moyen à élevé ; contrôleurs réseau moyen à élevé selon l’écran ; interfaces custom dépendantes du serveur élevé et à cadrer individuellement. Le premier prototype donnera une base crédible pour chiffrer la suite. Le fait de disposer du build complet ne justifie pas une promesse de reprise intégrale en quelques jours.

L’analyse démontre la présence des ressources, l’identité de ce qui est déjà copié et des frontières exploitables dans le code compilé. Elle **ne démontre pas encore une identité visuelle pixel par pixel ni une équivalence fonctionnelle de tous les écrans**. Aucune session Bubble n’a été ouverte, aucun profilage de performance ni nouvelle comparaison de captures n’a été réalisé. Le générateur original de leurs interfaces et leurs sources applicatives ne sont pas inclus dans l’archive inspectée.

Cet audit a uniquement ajouté ce plan et son relevé de preuves ; il n’a pas modifié l’implémentation du client.

# PNJ : état actuel et raccordement inspiré de Bubble

Analyse statique du 8 septembre 2026. Sources : serveur Giny, client web, catalogues locaux et application Bubble dans `resources/app.asar`. Aucun parcours en jeu ni contenu de la base SQL active n'a été vérifié. Cette note prépare l'implémentation ; elle ne rend pas les interactions opérationnelles.

## Conclusion

Giny dispose déjà des dialogues, boutiques et trocs côté serveur. Le travail principal consiste à exposer les informations PNJ au client web, ajouter leur sélection et brancher les interfaces sur les messages existants. Les catalogues fournissent les textes et l'apparence, mais ne remplacent pas la configuration serveur des dialogues et récompenses.

## Ce qui existe dans Giny

| Fonction | Source | Comportement |
| --- | --- | --- |
| Modèle PNJ | `server/Servers/Giny.World/Records/Npcs/NpcRecord.cs` | Table `npcs` : nom, apparence, actions du modèle. |
| Placement | `server/Servers/Giny.World/Records/Npcs/NpcSpawnRecord.cs` | Table `npc_spawns` : modèle, carte, cellule, direction. |
| Actions | `server/Servers/Giny.World/Records/Npcs/NpcActionRecord.cs` | Table `npc_actions` : action liée au spawn, paramètres, critères. |
| Réponses | `server/Servers/Giny.World/Records/Npcs/NpcReplyRecord.cs` | Table `npc_replies` : message, réponse, critères, action générique et paramètres. |
| Apparition | `server/Servers/Giny.World/Managers/Maps/Npcs/NpcsManager.cs` | Charge les spawns dont le modèle possède une apparence et est disponible dans le catalogue runtime. |
| Interaction | `server/Servers/Giny.World/Managers/Entities/Npcs/Npc.cs` | Filtre les actions par type et critères du personnage. |

Trois gestionnaires sont enregistrés dans `Managers/Maps/Npcs/NpcActions.cs` :

- `TALK = 3` : `Param1` contient l'identifiant du premier message.
- `BUYSELL = 1` : `Param1` contient les identifiants des objets séparés par des virgules ; `Param2` contient l'identifiant du jeton, ou zéro pour les kamas.
- `EXCHANGE = 2` : `Param1` contient des paires `objetEntrant:objetSortant` séparées par des virgules ; `Param2` contient le taux de conversion.

Une réponse `ContinueDialog` passe par `GenericActions` puis `Npc.ContinueDialoging`. Dans cette implémentation, le message suivant doit aussi avoir une action TALK correspondante dans le spawn. Il faut examiner les critères et l'ordre de ces actions lors de la configuration : l'interaction initiale choisit la première action admissible.

## Ce que fait Bubble

Référence locale : `resources/app.asar`, entrées `dist/assets/game-entry-D5YuSIvZ.js` et `dist/assets/index-hvlyseB_.js`. Les positions suivantes sont des offsets de caractères dans les bundles décodés, spécifiques à cette version.

- Vers `1235800`, le menu PNJ parcourt les actions du modèle, résout leurs libellés et émet `__NpcTalk` avec l'identifiant de l'acteur et l'action.
- Vers `461109`, le dialogue est alimenté par `NpcDialogCreationMessage` puis `NpcDialogQuestionMessage` ; `LeaveDialogMessage` le ferme.
- Fonction `Aje`, offset `445717` : résolution du nom, du skin, du texte et des paramètres, puis construction des réponses à partir de `visibleReplies` uniquement. Une option de fermeture est ajoutée lorsqu'il n'y a aucune réponse.
- Fonction `Hmt`, offset `2498468` : bulle positionnée par rapport au PNJ et au cadre de jeu, sélection clavier, validation, fermeture et verrou contre les envois répétés.
- Dans `index-hvlyseB_.js`, vers `142329` : boutique alimentée par `ExchangeStartOkNpcShopMessage`, achats/ventes suivis par des acquittements serveur.
- Dans ce même bundle, vers `345199` : `ExchangeStartOkNpcTradeMessage` ouvre un échange joueur/PNJ ; les messages d'ajout, modification et retrait distinguent les objets locaux et distants par `remote`.

À reprendre : la séparation menu / dialogue / boutique / troc, les mises à jour autoritaires du serveur, la navigation clavier et la protection contre les doubles clics. Adapter au protocole Giny : le message boutique de Bubble utilise notamment `allowSell`, absent du constructeur Giny observé. Les identifiants et formats réseau ne doivent pas être copiés du bundle.

## Ce qui manque côté client web

1. **Données de carte.** `server/Servers/Giny.World/Handlers/ModernClientHandler.cs` projette nom, apparence et type, mais aucun bloc PNJ avec identifiant du modèle, actions et marqueurs de quête. `WorldActor` dans `client/web/src/giny/types.ts` n'a pas de contrat PNJ explicite.
2. **Clic PNJ.** `GameRenderer.ts` utilise `selectOtherCharacter` pour le menu personnage. Ce sélecteur exclut volontairement les PNJ. Ajouter une voie de sélection PNJ dédiée avant le déplacement au sol et garder le menu joueur séparé.
3. **État réseau.** Aucun traitement des messages de dialogue/boutique/troc PNJ n'a été trouvé dans `client/web/src/giny`. Ajouter les envois, le décodage et un état de session nettoyé à la fermeture, au changement de carte et à la déconnexion.
4. **Interfaces.** Les textures `npcDialog` sont déjà présentes, mais ne constituent pas une fenêtre fonctionnelle. Il faut relier les composants à cet état de session.
5. **Textes.** `output/catalogs/runtime-d3-v4/data/` contient `npcs`, `npcmessages`, `npcactions` et `npcdialogskins`. Les messages renvoient à des identifiants i18n ; les PNJ possèdent aussi `dialogMessages` et `dialogReplies`. Vérifier la résolution sur le catalogue réellement servi et sur les identifiants de la configuration Giny 2.68.

Attention aux trois identifiants : modèle PNJ pour le catalogue, spawn pour la configuration SQL, acteur contextuel pour la requête sur la carte. Le champ `npcId` du dialogue Giny est ici l'acteur contextuel.

## Contrat réseau à raccorder

| Parcours | Client → serveur | Serveur → client |
| --- | --- | --- |
| Choisir une action | `NpcGenericActionRequestMessage(npcId, npcActionId, npcMapId)` | Dialogue, boutique, troc ou retour d'erreur |
| Parler | Action 3 | `NpcDialogCreationMessage`, `NpcDialogQuestionMessage` |
| Répondre | `NpcDialogReplyMessage(replyId)` | Question suivante, effets de l'action ou fermeture |
| Acheter/vendre | Action 1, puis `ExchangeBuyMessage` / `ExchangeSellMessage` | `ExchangeStartOkNpcShopMessage`, acquittements et inventaire |
| Troquer | Action 2, déplacement d'objets, validation | `ExchangeStartOkNpcTradeMessage`, états des objets et validation |
| Quitter | `LeaveDialogRequestMessage` | `LeaveDialogMessage` ou message de clôture propre à l'échange |

Ne présenter que les réponses transmises par le serveur. Pour le menu, préférer des actions réellement configurées et prises en charge par Giny aux seules actions théoriques du catalogue. Le serveur doit réévaluer les critères lors de chaque requête.

## Points serveur à corriger ou vérifier avant les transactions

- `NpcTradeExchange.Ready(bool ready, short step)` ignore `ready` et `step`, transfère les objets et ferme l'échange. Corriger au minimum le cas `ready == false` et définir la validation de l'étape.
- Dans ce même échange, `MoveKamas` et `OnNpcGenericAction` lèvent `NotImplementedException`. Refuser proprement les opérations non prises en charge.
- `BuySellExchange.Buy` et `Sell` n'appliquent pas eux-mêmes de garde explicite `quantity > 0` ; les calculs de prix convertissent en `int`. Vérifier les gardes de toute la chaîne et traiter les dépassements avant de modifier l'inventaire.
- `NpcTalkDialog.Reply` ferme le dialogue pour un identifiant qui ne correspond à aucune réponse disponible. Préférer un rejet explicite sans exécuter d'action.
- Vérifier les conversions fractionnaires et les retraits successifs dans `NpcTradeItemCollection`, ainsi que la revalidation des quantités possédées au moment du transfert.

## Ordre d'implémentation proposé

1. Projection PNJ typée, nom au survol et menu d'actions réellement disponibles.
2. Dialogue complet : textes, paramètres, réponses, continuation, Échap, clavier et attente de la réponse serveur.
3. Boutique : catalogue d'offres reçu du serveur, devise, quantités, achats/ventes et rafraîchissement de l'inventaire après confirmation.
4. Troc : deux côtés, ajout/retrait d'objets, aperçu des retours calculé par le serveur, validation et annulation.
5. Marqueurs de quêtes et actions spécialisées, après vérification des gestionnaires correspondants.

Validation attendue : un PNJ de dialogue à plusieurs étapes et critères ; un marchand en kamas puis en jetons ; un troc avec ajout/retrait/annulation ; double clic ; quantité invalide ; changement de carte ; déconnexion. Vérifier les résultats réels en inventaire et en base, pas uniquement l'ouverture des fenêtres.

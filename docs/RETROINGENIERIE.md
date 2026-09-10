# Giny · client web · rétro-ingénierie

Le client Dofus 3, ouvert.

Une question sur les icônes d’un menu a fini en lecteur de métadonnées IL2CPP
écrit à la main. Voilà ce que chaque fichier contient, comment il s’articule au
reste, et ce que ça débloque pour le projet.

Le point de départ tenait en une phrase : le `bannerMenu` officiel ne décrit
pas son contenu. Son UXML livre une grille vide, et c’est du C# compilé qui la
remplit. Tout le reste découle de là.

| | |
| ---: | --- |
| 40 878 | types lus |
| 367 516 | méthodes |
| 430 769 | fonctions adressées |
| 25 | entrées de menu |
| 0 | outil tiers |

Les preuves détaillées du lecteur — pavage de l’en-tête, structs rétrécis,
fixups, calibration des adresses — sont dans [`IL2CPP.md`](./IL2CPP.md).

## Ce que contient chaque fichier

Deux fichiers portent tout. Ils ne se lisent pas indépendamment : le premier
nomme, le second exécute.

### `global-metadata.dat` — durci, lisible — 40 406 428 o

**Contenu.** Le système de types complet du client, en 31 tables : 40 878
types, 367 516 méthodes, 192 690 champs, 332 262 noms, 32 775 littéraux de
chaîne, 143 assemblies.

**Durcissement.** Trois écarts avec IL2CPP amont, tous récupérés par validation
et non par supposition.

1. L’en-tête est une suite de triplets `(offset, size, count)` — la preuve
   étant qu’ainsi lues, les 31 tables pavent le fichier exactement, à 0–3
   octets d’alignement près.
2. Des champs passent de `u32` à `u16`, donc `Il2CppTypeDefinition` fait 82
   octets au lieu de 88 et `fieldStart` tombe à l’offset 26, non aligné.
3. Les valeurs par défaut sont des entiers compressés Unity avec zigzag, pas
   du brut.

**Relations.** Il nomme ce que le binaire implémente. Un champ y porte un
index de `Il2CppType` que seul le binaire sait résoudre — c’est cette double
lecture qui a débloqué la structure du menu.

**Apport.** Toute énumération du client sort avec ses valeurs exactes. Vérifié
sur `FigmaIcons` : 333 membres, valeurs 0 à 332, contiguës. Une extraction
naïve « par voisinage de chaînes » en donnait 273 et en perdait 60 — d’où la
nécessité du vrai parseur.

### `GameAssembly.dylib` — adressable — 235 188 928 o

**Contenu.** Le code compilé, en binaire universel x86_64 + arm64. La tranche
arm64 porte une section `il2cpp` de 85 Mo et 430 769 bornes de fonction
déclarées.

**Pièges.** Les offsets de section sont relatifs au début de la tranche : les
lire depuis le début du fichier ne lève aucune erreur, ça rend simplement les
octets de l’autre architecture. Et les pointeurs de données sont des chained
fixups — un slot ne contient pas une adresse mais une cible sur 36 bits et un
saut vers le slot suivant.

**Ancrages.** `Il2CppMetadataRegistration` se trouve par ses deux compteurs
qui valent forcément le nombre de types, 16 octets d’écart : ici `0x63e0938`,
avec 139 520 `Il2CppType`. Les 140 modules de code se reconnaissent à leur
premier champ pointant sur un nom `*.dll` ; `Core.dll` en déclare 112 373
méthodes.

**Apport.** Localiser n’importe quelle méthode, puis lire son graphe d’appels
en scannant les `BL` qui visent une adresse connue. C’est ainsi que la classe
du menu a été trouvée sans jamais deviner un nom.

## La chaîne qui relie les deux

Chaque étape dépend de la précédente ; c’est la seule séquence de ce récap, et
elle est vérifiée de bout en bout sur les 136 méthodes de la classe du menu.

1. **Le type.** Son nom survit à l’obfuscation, ses membres non. On le trouve
   donc par son nom.
2. **Ses méthodes.** `methodStart` et `method_count`, prouvés par partition
   exacte de la table des méthodes.
3. **Le token.** `0x06......`, dont les 24 bits bas donnent la ligne dans son
   assembly.
4. **Le module.** Le type se rattache à son assembly par la remise à 1 du
   token — 143 frontières pour 143 images, somme exacte.
5. **L’adresse.** `methodPointers[ligne − 1]`, puis `LC_FUNCTION_STARTS` pour
   savoir où la fonction s’arrête.

## Ce qui est lisible, et ce qui ne l’est pas

L’obfuscation n’est pas uniforme. Elle vise précisément le code d’Ankama et
laisse le reste intact — ce qui détermine où le client sert de source fiable
et où il ne sert pas.

| Assembly | Types | Noms de type lisibles | Utilisable comme source ? |
| --- | ---: | ---: | --- |
| `Core.dll` | 9 430 | 48 % | partiel : types oui, membres non |
| `Ankama.Dofus.Protocol.Game.dll` | 5 631 | 1 % | non, voir ci-dessous |
| `Com.Ankama.HaapiAnkama.dll` | 1 328 | 97 % | oui |
| `UnityEngine.UIElementsModule.dll` | 1 702 | 93 % | oui |
| `mscorlib.dll` | 1 853 | 99 % | oui |
| `BouncyCastle.Crypto.dll` | 2 236 | 100 % | oui |

## Le protocole n’est pas un raccourci

C’est le résultat négatif le plus utile de tout ce travail, parce qu’il
économise un chantier entier. `Ankama.Dofus.Protocol.Game.dll` porte 5 631
types, et ce sont bien des messages protobuf — les méthodes `MergeFrom`,
`WriteTo`, `CalculateSize`, `Clone` y sont partout. Mais sur 400 types
examinés, aucun n’a de propriété nommée : les champs s’appellent `ebex`,
`ebey`, `ebez`. Aucun descripteur protobuf n’est embarqué non plus.

Autrement dit, le client ne peut pas servir à retrouver les noms du protocole
pour `Giny.Protocol`. Cette voie est fermée et il n’y a pas à la creuser.

## Une trouvaille latérale : 7 248 chemins sources

Le blob des valeurs par défaut contient, en clair, l’arborescence source du
client.

Dont les 102 fichiers du package protocole, ce qui donne la carte sémantique
de ses messages malgré l’obfuscation des types :

`Account.cs`, `Achievement.cs`, `AllianceConquest.cs`, `Arena.cs`, `Chat.cs`,
`Character.cs`, `Connection.cs`, `Context.cs`, `Dialog.cs`, `Dungeon.cs`,
`Emote.cs`, …

Et 496 fichiers pour `com.ankama.dofus.core.datacenter`, la couche de données.

Mais c’est un inventaire, pas une table. Les trois voies qui l’auraient rendu
interrogeable sont fermées : le champ `debuggerMetadata` du module est nul,
aucun fichier de debug séparé n’est livré, et les 55 `MonoScript` du bundle ne
couvrent que les scripts référencés par des assets. Il n’y a donc pas de
correspondance type → fichier ; on sait quels groupes de messages existent,
pas lequel est lequel.

## Ce que ça a donné sur la question de départ

La structure du menu officiel, lue dans le client et non déduite.

**Le compte.** L’énumération `fmp` a exactement 25 membres plus une sentinelle
(`dtsn = Int32.MaxValue`). La fabrique est appelée 26 fois. Notre client en
affichait 15 — il en manque donc dix.

**La forme.** `lr` est le type d’une entrée : deux entiers, une icône, une
`System.Action` pour le clic, trois chaînes, un booléen optionnel, et un
`AddressableEntry` qui désigne l’UXML à ouvrir. Deux constructeurs, 8
paramètres chacun.

**L’icône.** `lr` a deux constructeurs, l’un prenant `FigmaIcons`, l’autre une
`string`. La fabrique appelle celui à `string` : l’icône d’une tuile est un
nom de sprite. C’est ce qui a infirmé la déduction précédente selon laquelle
le menu officiel devait être monochrome — rien ne l’y oblige, et la capture
officielle montre des icônes en couleur.

**Extrait.** `menuActions.json` — les 31 actions `Menu` du client avec leurs
raccourcis par défaut. `figmaIcons.json` — les 333 icônes indexées par
valeur.

## Déjà appliqué au client web

Quatre corrections issues de données réelles, plus une du thème officiel.
315 tests au vert.

- **La teinte.** Le thème pose `--uitk-tint: #b6b3e6` sur une tuile-glyphe, ce
  qui masquait le PNG et l’aplatissait. Le token est désormais vidé pour ces
  tuiles seulement — les pictos ressortent en couleur.
- **Les raccourcis.** Carte est `;` et non `m`, Quêtes est `a` et non `q`, et
  Succès, Métiers, Monture, Apparence n’en avaient aucun. Le gestionnaire
  ignorait les modificateurs, donc `shift+C` était inexprimable.
- **Le trophée.** `icons/success.png` est le glyphe monochrome ; le trophée
  doré est `styles/images/success.png`. Deux subtilités de résolution au
  passage : les noms nus essaient `icons/` d’abord, et un chemin doit porter
  son extension sinon l’index par nom de fichier l’élimine.
- **La carte.** `map`, l’éclat doré, et non le globe `world` — la capture
  officielle montre l’éclat et aucun globe dans toute la grille.

## Le mur, et où est le levier

**Les 25 noms de sprite sont chiffrés.** La méthode qui construit la table ne
contient aucun littéral. Ses chaînes passent par un type à 29 985 méthodes —
une par chaîne — avec un blob chiffré, un cache `string[]`, et un déchiffreur
qui ne déchiffre pas lui-même : il charge un pointeur de fonction depuis un
champ statique et fait un `BLR`. C’est une protection anti-analyse statique,
pas un format à décoder comme tout ce qui précède.

La lecture en mémoire vive n’est pas praticable : `Dofus.app` est signé avec
le runtime durci et sans `get-task-allow`, donc il faudrait désactiver SIP ou
re-signer le binaire d’Ankama.

Reste la voie qui n’exige de contourner quoi que ce soit : les 24 tuiles sont
visibles à l’écran, et les 3 508 PNG candidats sont sur le disque.
`extractor/ui/match_tiles.py` découpe une capture et nomme chaque tuile par
recouvrement de silhouette — insensible à la teinte, puisque celle-ci
préserve la forme — en rendant pour chacune son score et son second, de sorte
que la marge dise elle-même si le résultat tient.

```bash
cd client/dofus3
python3 -m extractor tiles capture.png --cols 8 --rows 3
```

Il ne manque que la capture officielle du menu déployé, en fichier. Les PNG
déjà présents sous `client/dofus3/` (`banner_hud.png`,
`official_banner_wide.png`, `montage_official.png`, …) sont des vues du
client web, pas de la grille officielle à 25 tuiles.

## I18n : `fr.bin` est lu

`Core.Localization.LocalizationTableHeader.ReadFrom` est la spec.
`extractor/i18n.py` en sort `output/client/i18n.json.gz` : 339 342 textes
indexés par `nameId`, et 4 699 clés `ui.*` récupérées depuis GeneratedTexts
(FNV-1a 64). Le catalogue web tamponne `name` / `description` sur items,
sorts, quêtes, métiers, succès. `python3 -m extractor i18n`.

## Deux tables de noms que le build livre en clair

`python3 -m extractor symbols` écrit `output/symbols/`. Les deux fichiers lus
ne sont ni obfusqués ni compilés : ils sont là pour que le runtime Unity
fonctionne, et personne ne les a durcis.

### `globalgamemanagers.assets` — 7 404 `MonoScript`

Le backend de script a besoin d'un nom pour chaque classe compilée dans le
player, et il le stocke tel que le développeur l'a écrit : assembly, namespace,
classe. Ce n'est pas le bundle `dofus_unity_monoscripts` déjà lu — celui-là
porte 55 enregistrements, ceux qu'un asset Addressable désigne. Ici, 7 404, sur
66 assemblies : `Core` 3 877, `Ankama.Dofus.Core.DataCenter` 495,
`Com.Ankama.HaapiAnkama` 395, `Ankama.Dofus.Protocol.Game` 102.

Chaque nom est cherché dans le blob `T_STRING` des métadonnées. **2 216 sont
absents**, dont 1 811 pour `Core` seul. Deux causes possibles, que le module ne
prétend pas trancher ligne à ligne :

- **renommé** — le type est bien dans le build, sous un nom obfusqué. Certain
  pour `Ankama.Dofus.Protocol.Game` : 95 noms sur 102 absents, 0 % résolus en
  typedef, alors que le client parle manifestement le protocole. Là, le vrai
  nom est réellement récupéré.
- **strippé** — le linker managé a retiré le type avant conversion, aucun nom
  n'est dû. C'est le cas des 135 absences de `Unity.InputSystem` : les
  assemblies Unity ne sont pas obfusquées, et `link.xml` existe précisément
  parce que le stripping est actif.

Le taux `typed` par assembly est le discriminant, et il est dans le JSON.
`properties_hash` est conservé pour la suite : Unity le dérive des champs
sérialisés du type, c'est la seule valeur qu'une passe ultérieure pourra
apparier à un `Il2CppTypeDefinition` candidat pour établir nom → type obfusqué.

### `AddressablesLink/link.xml` — 295 types préservés

33 Ko de XML clair, 19 assemblies. 204 types y sont marqués
`preserve="nothing" serialized="true"` : ce n'est pas une préférence, ça veut
dire qu'un asset dans un bundle porte un blob exactement de cette forme.

C'est ce qui a débloqué `world-graph`, dans `worldassets_assets_all.bundle` :
6 076 480 octets de `MonoBehaviour` dont `link.xml` nomme les enregistrements
(`Vertex`, `Edge`, `Transition`, `DictionaryMapIdVertices`, `DictionaryUidToEdges`,
`EdgeListWrapper`). Lu : **10 980 sommets** `{mapId, zoneId, uid}` et
**10 909 arêtes**, chaque transition portant `type`, `direction`, `skillId`,
`criterion`, `transitionMapId`, `cellId`. C'est le graphe de déplacement du
monde entier.

Les 103 lignes `Foo/UxmlSerializedData` sont les éléments UXML customs. À
mesurer honnêtement : 102 des 103 apparaissent déjà comme `full_type` dans les
685 arbres exportés, donc la liste n'apprend presque rien de neuf — elle
**ferme** l'inventaire, ce que les arbres seuls ne pouvaient pas faire. Elle
sort tout de même un piège réel : `RadioButton` est réclamé deux fois, par
`Core.UILogic.Components.Figma.RadioButton` et par
`UnityEngine.UIElements.RadioButton`. Un UXML écrit `<RadioButton>` pour les
deux et c'est le xmlns du document qui tranche ; mapper le tag sur le natif
rend le mauvais composant, sans erreur. Les collisions sont donc publiées comme
donnée (`uxml_tag_collisions`) au lieu d'être dédupliquées.

Les deux dumps portent `client_version` : `3.6.10.11`. Un patch rebat les noms
obfusqués contre lesquels les comptes sont mesurés.

## Pour la suite du projet

La répartition est nette.

- Les constantes d’interface posées par le C# sont désormais vérifiables au
  lieu d’être devinées.
- La couche de données se lit par les bundles `data_assets_*dataroot` et le
  package datacenter, qui ne sont pas obfusqués. Les `nameId` se résolvent
  dans `fr.bin`.
- Du protocole, les **noms de messages** se lisent : 513 noms complets dans
  les littéraux des métadonnées, plus les 103 classes `*Reflection` nommées par
  `globalgamemanagers.assets`. Les **champs**, non — testé sur `accountId`,
  `characterId`, `hasRights`, `serverId` : 0 à 2 occurrences, du bruit venu
  d'autres assemblies. Donc pas de schéma, et `Giny.Protocol` ne se régénère
  pas depuis le client.

Outillage : `extractor/il2cpp/{metadata,binary,arm64}.py` · preuves détaillées
dans [`IL2CPP.md`](./IL2CPP.md) · métadonnées IL2CPP version 39, sanity
`0xFAB11BAF`.

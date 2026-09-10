# Lire le client compilé (IL2CPP)

Le `bannerMenu` officiel ne décrit pas son contenu : l'UXML livre une `SlotGrid`
vide et c'est du C# compilé qui la remplit. Ce document note ce qui a été
reconstruit à la main pour aller le lire, et **comment chaque point a été
prouvé** — pas deviné. Le code correspondant est dans `extractor/il2cpp/`.

La vue d'ensemble — ce que chaque fichier contient, ce que l'obfuscation laisse
intact, ce que ça débloque pour le client web — est dans
[`RETROINGENIERIE.md`](./RETROINGENIERIE.md).

Aucun outil tiers n'est utilisé : `global-metadata.dat` est en version 39,
durcie, qu'aucun dumper public ne lit.

## 1. En-tête des métadonnées : des triplets, pas des paires

En amont, IL2CPP écrit un en-tête de paires `(offset, size)`. Ici ce sont des
**triplets `(offset, size, count)`**, 31 d'affilée à partir du mot 2.

La preuve est le pavage : lus comme des triplets, les 31 tables se suivent bout
à bout et finissent exactement sur la taille du fichier (40 406 428 octets), avec
0 à 3 octets d'alignement entre elles. Toute autre lecture laisse des trous ou
des chevauchements. `Metadata.report()` revérifie ce pavage à chaque ouverture.

Le `count` désambiguïse aussi les tables : `size / count` donne la taille d'un
enregistrement, ce qui identifie chaque table sans avoir à supposer l'ordre
(`24` → events, `20` → properties, `12` → fields, `82` → typeDefs…).

## 2. Deux tables compactées autrement qu'en amont

**`stringLiteral`** n'est pas un tableau de structs `{length, dataIndex}` de 8
octets : c'est un simple tableau d'offsets u32 avec une **sentinelle** finale
égale à la taille du blob de données. Le littéral `i` est donc la tranche entre
l'offset `i` et l'offset `i+1`. Vérification : la dernière valeur du tableau vaut
exactement `size` de la table de données, et `literal(1000)` rend `" PUBLIC "`.

**Les valeurs par défaut de champ** ne sont pas brutes. Le blob contient des
**entiers compressés Unity avec zigzag**, ce qui explique que deux membres
d'enum consécutifs ne soient séparés que de 1 ou 2 octets et pas des 4 qu'un
`int` prendrait. Préfixe `0xxxxxxx` = 1 octet, `10xxxxxx` = 2, `110xxxxx` = 3,
`0xF0` = u32 complet, `0xFE`/`0xFF` = sentinelles. Puis zigzag : `0,2,4,…` sont
`0,1,2,…` et les encodages impairs sont les négatifs.

Preuve : `FigmaIcons` ressort avec 333 membres de valeurs `0..332` contiguës,
`none = 0` et `zaap = 332`. Lu en brut, on obtenait `0, 2, 4, 6…`.

> Piège : une extraction « par adjacence » du blob de noms (lire les chaînes
> voisines du nom de type) donnait 273 membres et en manquait 60, dont `none`,
> `alliance` et `zaap`. Les valeurs d'enum ne sont donc justes qu'en passant par
> `fieldDefaultValues`, pas par la proximité des chaînes.

## 3. Structs rétrécis : u32 devenus u16

Les enregistrements sont plus petits qu'en amont et **ne sont plus alignés sur
4**. `Il2CppTypeDefinition` fait 82 octets au lieu de 88 : `elementTypeIndex`,
`genericContainerIndex` et `flags` sont des u16 (88 − 3 × 2 = 82). Conséquence
directe : `fieldStart` tombe à l'offset **26**, non aligné.

La disposition n'est pas supposée, elle est **prouvée par partition exacte** :
pour un couple candidat (offset du start, offset du count), on prend les 40 878
enregistrements et on vérifie que les intervalles `[start, start+count)`
découpent la table visée en tranches disjointes qui la couvrent entièrement,
sans trou ni chevauchement. Un seul couple passe le test par table :

| champ | offset | largeur | table découpée | total |
|---|---|---|---|---|
| `fieldStart` / `field_count` | 26 / 62 | u32 / u16 | fields | 192 690 |
| `methodStart` / `method_count` | 30 / 58 | u32 / u16 | methods | 367 516 |
| `eventStart` / `event_count` | 34 / 64 | u32 / u16 | events | 315 |
| `propertyStart` / `property_count` | 38 / 60 | u32 / u16 | properties | 73 131 |
| `nestedTypesStart` / `nested_type_count` | 42 / 66 | u32 / u16 | nestedTypes | 16 395 |
| `interfacesStart` / `interfaces_count` | 46 / 70 | u32 / u16 | interfaces | 25 800 |
| `vtableStart` / `vtable_count` | 50 / 68 | u32 / u16 | vtableMethods | 468 988 |
| `interfaceOffsetsStart` / `…_count` | 54 / 72 | u32 / u16 | interfaceOffsets | 47 779 |

Deux repères annexes valident l'alignement : `u32@78` est le token
(`0x020012D0` pour l'entrée 4815, soit `0x02000000 | row`), et les deux derniers
octets de **chaque** entrée valent `0x0200` — constant sur les 40 878, ce qui
confirme le stride de 82.

`Il2CppMethodDefinition` subit le même traitement : 32 octets au lieu de 36,
`parameterStart` en u32 non aligné à l'offset 14, `token` à 20 (`0x06......`),
`parameterCount` en u16 à 30, résolus par le même test de partition contre les
328 248 paramètres.

## 4. La table des images a perdu `typeStart`

L'`Il2CppImageDefinition` durci fait 36 octets et **ne contient plus** de
`typeStart` / `typeCount`. Le rattachement type → assembly se fait autrement :
le **token de type se réinitialise à 1 à chaque image**. On coupe donc la table
des types là où `token & 0xFFFFFF == 1`.

Preuve : on trouve exactement 143 frontières pour 143 images, et la somme des
tranches vaut exactement 40 878. `Core.dll` est l'image 0 et tient 9 430 types.

Ce qui reste identifiable dans l'entrée : `nameIndex` (+0), `assemblyIndex`
(+4), `exportedTypeCount` (+16, somme = 3 235 = la table des types exportés),
`entryPointIndex` (+20, constant `-1`), `customAttributeStart` / `…Count`
(+28 / +32, somme = 145 800 = la table `attributeDataRange`).

## 5. Le binaire : tranche, fixups, modules

`GameAssembly.dylib` est un binaire universel. **Les offsets de section sont
relatifs au début de la tranche** : les lire depuis le début du fichier rend
silencieusement les octets de l'autre architecture — l'erreur ne lève rien, elle
donne juste des résultats faux (elle a d'abord fait « trouver » les compteurs de
registration au mauvais endroit).

Les pointeurs de données sont des **chained fixups**, donc un slot ne contient
pas une adresse. Pour `DYLD_CHAINED_PTR_64` : cible sur les 36 bits bas, `next`
sur les bits 51..62 en pas de 4 octets. Un slot à zéro n'est pas un pointeur.

`Il2CppMetadataRegistration` se trouve par ses deux compteurs qui valent
forcément le nombre de types : `fieldOffsetsCount` et
`typeDefinitionsSizesCount`, 16 octets d'écart, à +0x50 et +0x60. Ici
`0x63e0938`, avec `typesCount = 139 520`.

Un `Il2CppCodeGenModule` se reconnaît à son premier champ qui pointe sur un nom
`*.dll` suivi d'un compteur de méthodes plausible — 140 modules trouvés (les
modules sans aucune méthode ne sortent pas). `Core.dll` en déclare 112 373.

## 6. Métadonnée → adresse de code

Le chemin complet, vérifié sur les 136 méthodes de `BannerMenu` (136/136
résolues) :

```
type → method_range → token (0x06......) → row = token & 0xFFFFFF
     → module de son assembly → methodPointers[row - 1] → adresse
```

Les bornes de fonction viennent de `LC_FUNCTION_STARTS` (deltas ULEB128 depuis
le début de `__TEXT`, 430 769 fonctions), ce qui donne la fin d'une méthode sans
avoir à deviner où elle s'arrête.

## 7. Ce que ça a permis de localiser

Les membres des classes de gameplay sont renommés (`dttb`, `bgrl`…) ; les noms
de types, eux, survivent. La classe se trouve donc par son nom, et ses méthodes
par leur graphe d'appels — en scannant tout le code pour les `BL` qui visent une
adresse connue.

* `Core.Services.UI.MainMenu.BannerMenu` (type 8060, `Core.dll`) : 50 champs,
  136 méthodes, tous obfusqués sauf les surcharges d'interface.
* `BannerMenu::bgrl` @ `0x1f1f658` — seul lecteur de `get_gd_btnUis` hors
  constructeur ; appelle `SlotGrid::get_itemSize`, `ResizableWindow::
  set_headerTitle` / `set_headerIcon` / `set_headerStyle`. C'est le
  redimensionnement, qui retitre la poignée : cohérent avec l'UXML.
* **`BannerMenu::bguv` @ `0x1f2b7cc`** — appelle `SlotGrid::set_slotDataList`
  **deux fois** (la grille principale puis la grille de débordement) et
  `Slot::DisableDrag`. C'est là que la liste des tuiles est posée.

## 8. Ce qui bloque encore : les 25 noms de sprite

La structure du menu est lue (`fmp` = 25 membres + sentinelle, `lr` = une
entrée, deux constructeurs dont celui à `string`). Ce qui ne l'est pas, ce sont
les 25 noms de sprite que la fabrique passe à `lr`.

Pour lire la liste dans `bguv`, le motif `ADD xN, page, off ; BL 0x3f2210` est
l'initialisation paresseuse d'un handle de métadonnée. Le slot visé, en
`__data`, contient un index encodé. Les 3 bits hauts sont un genre, et les
genres observés dans la classe sont 1 (TypeInfo, 195 slots), 2 (Il2CppType, 1),
3 (MethodDef, 96) et 6 (MethodRef, 296) — **aucun genre 5**, donc la classe ne
référence aucun littéral de chaîne. Les noms d'icônes n'y sont pas en clair.

Ils passent par un type à 29 985 méthodes — une par chaîne — avec un blob
chiffré, un cache `string[]`, et un déchiffreur qui ne déchiffre pas lui-même :
il charge un pointeur de fonction depuis un champ statique et fait un `BLR`.
C'est une protection anti-analyse statique, pas un format à reconstruire comme
les 31 tables qui précèdent.

Trois voies autour de ça sont fermées :

* le champ `debuggerMetadata` du `Il2CppCodeGenModule` est nul, et aucun
  fichier de debug séparé n'est livré ;
* les 55 `MonoScript` du bundle ne couvrent que les scripts référencés par des
  assets, donc pas de table type → fichier source ;
* `Dofus.app` est signé, runtime durci, sans `get-task-allow` : une lecture en
  mémoire vive exigerait de couper SIP ou de re-signer le binaire d'Ankama.

Reste `extractor/ui/match_tiles.py` : les tuiles sont visibles à l'écran, les
3 508 PNG candidats sont sur le disque, et la comparaison porte sur la
silhouette (la teinte officielle préserve la forme). Chaque tuile ressort avec
un score et un second ; la marge dit si le nom tient. Il ne manque que la
capture officielle du menu déployé — voir
[`RETROINGENIERIE.md`](./RETROINGENIERIE.md).

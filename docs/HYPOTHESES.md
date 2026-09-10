# Hypothèses non confirmées

Tout ce qui n’est pas validé par un test d’alignement binaire ou par lecture
directe d’un type tree Unity reste ici. Ne pas promouvoir ces champs en
sémantique « officielle » sans nouvelle preuve.

## Bundles Unity

- Le header UnityFS des bundles Dofus 3 annonce `unityVersion = 5.x.x` et
  `unityRevision = 0.0.0`. Ce n’est pas une vraie version. UnityPy a besoin
  d’un fallback (`2022.3.0f1`). Le jeu réel est IL2CPP (GameAssembly.dylib +
  global-metadata.dat).
- doduda sait déjà décompresser UnityFS / LZ4 / LZMA et décoder un
  **seul** MonoBehaviour par bundle. Les bones (plusieurs SkinAsset +
  TextAsset + Texture2D) sortent de ce cadre : on réutilise UnityPy, pas une
  réécriture du loader.

## Animation.dataBytes

Validé (tests) :

- header `u16 frameCount, recordCount, eventCount, formatFlags`
- events `u16 frame, u8 length, text`, align 2 puis align 4
- `u32 frameOffsets[frameCount]`
- chaque frame se termine **exactement** à l’offset suivant
- header de record `u16 node, u8 tag, u8 extra`
- tailles des tags 0x00, 0x06, 0x0c, 0x10–0x17, 0x1c, 0x1d, 0x21, 0x30,
  0x31, 0x35

Non confirmé :

| Champ | Observation | Statut |
| --- | --- | --- |
| `formatFlags` | 0x0017 idle/walk, 0x001f sur quelques attaques/tacles | brut |
| `extra` (u8) | 0x7F sur le record racine 0x17, 0 sinon | brut |
| 0x11 `meta_u16[0]` | **prouvé : index 0-based dans `AnimatedObjectDefinition.graphics`** (pas un nom de part). Bone 4924 `AnimStatique_3` (60 frames) : bounds calculées x-119.6 w197.1 y-32.6 h202.5 vs officielles x-119.6 w197.1 y-32.6 h202.5, à 0.05 près ; ~20 clips idle/walk (bones 556, 4907, 714, 231, 284, 6399, 1) exacts aussi. L'exporteur résout vers `part_ref` (format doc `v2`). Les ids hors-plage retombent sur le nom brut | **validé** |
| 0x11 `meta_u16[1]` | toujours 0xFFFF sur le Bouftou idle/walk | brut, probablement « pas de parent / pas de couleur » |
| parent node | pas de champ parent identifié. Les nodes sans part résolue (ex. evens 2,4,6… en mapping direct) sont des conteneurs : avec la résolution par index, ils mappent vers des parts existantes. Les transforms restent non composés (`T0 * T_node` dégrade les bounds) : ils sont déjà en espace animation | **validé (bornes exactes)** |
| 0x17 extra_floats (2) | `0.0` et `~3.992` (bits `7f7f7f40`) devant les 6 floats d’affine | brut, **pas** utilisés pour le mesh |
| 0x17 transform | les 6 derniers floats matchent le 0x10 du même node aux frames suivantes. **Non composés** dans le rendu : les bounds officielles de `AnimStatique_1` (y -16.75..42.3) matchent les transforms locaux, pas `T0*T_node` | **hypothèse de travail** |
| 0x31 | dernier record, souvent identité, `meta[0]` invalide (>60000). Non drawable dans ce cas ; drawable si l'id résout vers une part (résolution par index). Un record à meta invalide ne doit **pas** hériter du visuel précédent (fantômes) | **validé** |
| 0x00 | no-op / conserve l’état précédent du **même index de record** | validé par AnimMarche frame 1 |

## SkinAsset

Validé :

- vertices `{pos, uv, multiplicativeColor, additiveColor}`
- triangles, chunks `{startVertexIndex, vertexCount, startIndexIndex, indexCount, textureIndex, maskState}`
- **indices chunk-local** : `idx_max == vertexCount-1` même si `startVertexIndex` est 527

Non confirmé :

- `multiplicativeColor` 0x7F7F7F7F. Le POC divise par 128 (127≈1.0). Peut être
  255-based. Conservé aussi en u32 brut.
- 4 SkinAsset dans bone_563, tous sur la texture `563-0`. Le POC prend
  `AnimatedObjectDefinition.boneAsset` uniquement.
- `DisplayListEntry.transform` est identité sur les parts Bouftou inspectées.

## Coordonnées

- Espace Unity Y-up, 1 unité ≈ 1 pixel (`pixelsPerUnit = 1` sur les sprites map).
- Grille map 14×40, 560 cellules, projection :

```
x = -580.5 + column * 86 + (row & 1) * 43
y =  483.75 - row * 21.5
```

  Confirmé comme *actuellement identifiée*, pas comme spec Ankama.

## Map gfx

- `mapelements_assets_.bundle` expose `m_elementsMap` dont les values sont
  des `{rid}` (managed references). Le POC **ne** résout **pas** encore ce
  registre.
- Beaucoup de `gfxId` existent comme `Sprite.m_Name` dans
  `Map/Textures/1x/mapgfx_1x_<prefix>_assets_all.bundle`.
- Préfixe de bundle = plus grand préfixe connu `<= gfxId`. Non garanti pour
  tous les IDs.
- `displayBehaviour == 1` : sprites de remplissage quasi blancs (ex. 2080×1108)
  tintés par un material/shader côté client officiel. Sans ce shader ils
  occultent la map. Le POC les ignore. Conservé dans le JSON.

## Direction _1 / _5

- `_1` et `_5` sont les deux directions exportées pour le POC.
- Mapping vers les 8 directions Dofus non confirmé. Le walker utilise
  `_1` si Δx ≥ 0, sinon `_5`.

## EntityLook `{563|||105}`

- `boneId = 563`, `scale ≈ 1.05` (105 / 100). Standard look Dofus, pas relu
  depuis un bundle `monsters` dans ce POC.

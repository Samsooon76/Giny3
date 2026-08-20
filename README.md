# Dofus 3 → Godot (POC)

Client graphique **cross-platform** (Godot 4) qui lit le contenu Unity de
Dofus 3. Pas de réseau, pas de combat, pas d’UI métier.

```
/Applications/Ankama/Dofus-dofus3
        ↓
extractor/          (Python + UnityPy)
        ↓
output/             JSON + PNG normalisés
        ↓
godot/              ArrayMesh + Sprite2D
```

Godot ne dépend d’aucune structure Unity.

## Jalons

1. Bouftou statique (`bone 563` → SkinAsset → mesh)
2. Idle `AnimStatique_1` à 25 FPS
3. Marche `AnimMarche_1` puis `_5`
4. Une vraie map (cellules + layers gfx)
5. Bouftou sur la map, déplacement cellule à cellule

## Prérequis

- Dofus 3 installé (défaut : `/Applications/Ankama/Dofus-dofus3`)
- Python 3.11+
- Godot 4.7 (`brew install --cask godot`)

```bash
cd DOFUS_3
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m extractor poc
.venv/bin/python -m pytest tests -q
godot --path godot
```

Le POC cible :

- entity `{563|||105}` → `Characters/Bones/bones_assets_bone_563.bundle`
- map `154644` → `mapdata_assets_world_0.bundle`

Souris : molette zoom, clic milieu pan, `G` grille on/off.

## Contrôles d’architecture

- **Ne pas** réécrire doduda (UnityFS / LZ4 / LZMA / type tree Go).
- Godot ne parle qu’au format `giny.dofus3.{entity,map}.v1`.
- Champs inconnus conservés bruts (`payload_hex`, `meta_u16`, `format_flags`).
- Chaque frame d’animation doit finir **exactement** à l’offset suivant
  (voir `tests/test_animation_decoder.py`, 33 animations Bouftou).
- Hypothèses : `docs/HYPOTHESES.md`.

## Réutilisation

| Projet | Ce qu’on en prend |
| --- | --- |
| [doduda](https://github.com/dofusdude/doduda) | confirmation du format UnityFS, type tree, images ; on ne le fork pas pour les bones (1 MonoBehaviour / bundle) |
| UnityPy | dump de **tous** les objets d’un bundle (SkinAsset, TextAsset dataBytes, Texture2D, Sprite) |
| Alpux / dofux-unitx | maps pré-cuites côté Unity ; on reconstruit nativement à la place |
| `kvarenzn/ssm` (via doduda) | référence Go si UnityPy lâche sur un header non standard |

## Layout

```
extractor/animations/   décodeur dataBytes
extractor/entities/     bone + SkinAsset + preview CPU
extractor/maps/         mapData + mapgfx
output/entities|maps|gfx|textures
godot/scripts           MeshInstance2D + Sprite2D
tests/fixtures          33 anims Bouftou
```

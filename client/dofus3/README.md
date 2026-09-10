# Extracteur Dofus 3

Chaîne d’extraction Python des ressources de l’installation Dofus 3 locale
pour le client React/PixiJS et Electron situé dans `../web/`.

```text
Installation Dofus 3 locale
        ↓
extractor/          Python + UnityPy
        ↓
output/ et .cache/ JSON, textures, animations et interface
        ↓
../web/game-data/  ressources préparées et publiées pour le client
```

## Prérequis

- Dofus 3 installé (défaut : `/Applications/Ankama/Dofus-dofus3`)
- Python 3.11+

```bash
cd client/dofus3
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m extractor --help
.venv/bin/python -m extractor bone 563
.venv/bin/python -m extractor map 154644
.venv/bin/python -m pytest tests -q
```

Les commandes écrivent uniquement dans leur répertoire de sortie ; `--output`
permet de le choisir. La commande `poc` rassemble l’extraction d’un Bouftou,
d’une carte et d’aperçus CPU pour inspecter les ressources.
Les préparations et la publication du monde se trouvent dans `../web/scripts/`.

## Architecture

- Ne pas réécrire doduda (UnityFS / LZ4 / LZMA / type tree Go).
- Conserver les champs inconnus bruts (`payload_hex`, `meta_u16`, `format_flags`).
- Chaque frame d’animation doit finir exactement à l’offset suivant
  (voir `tests/test_animation_decoder.py`).
- Hypothèses et observations : `docs/HYPOTHESES.md`.

## Organisation

```text
extractor/animations/   décodeur dataBytes
extractor/entities/     bones, SkinAsset, looks et aperçus CPU
extractor/maps/         cartes, effets et textures
extractor/ui/           ressources de l’interface
output/                exports normalisés
.cache/                ressources d’interface et données de préparation
tests/                tests et fixtures
```

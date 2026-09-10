"""Export the world-space overlay sprites the client draws over a map.

These do not ship with the content patch: `worldassets` is part of the player
build (StreamingAssets/aa), next to the platform Unity was built for. The
sprites are authored white with a black outline — the client tints them at
runtime, so the PNG stays a mask and the colour belongs to the renderer.
"""

from __future__ import annotations

from pathlib import Path

from extractor.unity_loader import load_bundle, player_data_root

ADDRESSABLES = Path("StreamingAssets") / "aa"
BUNDLE_NAME = "worldassets_assets_all.bundle"

# `Prefabs/Map/DirectionArrow` renders `MapArrow` in world space: the chevron
# shown on the border cell aimed at, pointing out of the map.
TEXTURES = ("MapArrow",)


def _bundle(client_root: Path) -> Path:
    """The addressables folder is named after the build platform."""
    root = player_data_root(client_root) / ADDRESSABLES
    for platform in sorted(root.glob("*")):
        candidate = platform / BUNDLE_NAME
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"{BUNDLE_NAME} introuvable sous {root}")


def export_overlays(client_root: Path, output_dir: Path) -> Path:
    destination = output_dir / "client" / "world"
    destination.mkdir(parents=True, exist_ok=True)
    # The Texture2D, not the Sprite: the sprite crops to the drawn pixels, and
    # that crop is off-centre, while the renderer wants the pivot the prefab
    # uses — the middle of the square texture.
    wanted = set(TEXTURES)
    for obj in load_bundle(_bundle(client_root)).objects:
        if obj.type.name != "Texture2D":
            continue
        texture = obj.read()
        if texture.m_Name in wanted:
            texture.image.save(destination / f"{texture.m_Name}.png")
            wanted.discard(texture.m_Name)
    if wanted:
        raise LookupError(f"textures absentes du bundle : {sorted(wanted)}")
    return destination

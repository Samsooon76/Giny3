"""Extract the world map: zoom pyramids of tiles, plus the hint icons.

`Picto/Worldmaps/worldmap_assets_.bundle` holds 1 216 sprites for 40 world maps.
Their `m_Name` is only the **tile index**, so grouping by name — as an earlier
pass did — mixes every world map together and keeps one arbitrary 1024² square
per index. The bundle carries no position either; the placement comes from the
Addressables catalog beside it, which addresses each tile as
``worldmaps/<worldmapId>/<zoom>/<tileIndex>.jpg`` (see `extractor.addressables`).

The grid follows from `worldmaps.json` alone and is verified against every
exported sprite: at zoom `z`, the picture is ``round(total * z)``, cut into
1024² tiles **row-major from the top-left, indices 1-based**. Edge tiles are
padded up to a multiple of 4 by texture compression, with the last rows and
columns duplicated, so each one is cropped back to the size its cell asks for.

The pins painted over those tiles are `hints.json`, whose `gfx` is a sprite of
`uidarkstone_assets_all.bundle` (zaaps, dungeons, workshops, resources…), not a
map element of `mapgfx_1x_*` — those numbers collide, and 62 of the 91 the world
map needs do not exist there at all.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from extractor.addressables import location_ids
from extractor.unity_loader import DEFAULT_CLIENT, load_bundle

BUNDLE = Path("DofusContent") / "Content" / "Picto" / "Worldmaps" / "worldmap_assets_.bundle"
CATALOG = BUNDLE.parent / "catalog_1.0.bin"
HINT_BUNDLE = (
    Path("Dofus.app") / "Contents" / "Resources" / "Data" / "StreamingAssets" / "aa"
    / "StandaloneOSX" / "uidarkstone_assets_all.bundle"
)

TILE_SIZE = 1024
#: Re-encoding a tile the client already ships as JPEG; 92 keeps the seams clean.
JPEG_QUALITY = 92

_ADDRESS = re.compile(r"^worldmaps/(\d+)/([\d.]+)/(\d+)\.jpg$")
_NUMERIC = re.compile(r"^\d+$")

#: Overlays the cartography view paints on the parchment. `currenMapHighlight`
#: is the four corner brackets around the map you stand on; the three pins are
#: the player-placed flags of the `Points de repère` filter.
MARKERS = ("currenMapHighlight", "pin_normal", "pin_selected", "pin_white")


def level_grid(total_width: int, total_height: int, zoom: float) -> dict[str, int]:
    """Picture size and tile grid of one zoom level of a world map."""
    width = round(total_width * zoom)
    height = round(total_height * zoom)
    return {
        "width": width,
        "height": height,
        "columns": max(1, math.ceil(width / TILE_SIZE)),
        "rows": max(1, math.ceil(height / TILE_SIZE)),
    }


def tile_box(grid: dict[str, int], index: int) -> tuple[int, int, int, int]:
    """`(x, y, width, height)` of tile `index` (1-based, row-major, top-left)."""
    column = (index - 1) % grid["columns"]
    row = (index - 1) // grid["columns"]
    x = column * TILE_SIZE
    y = row * TILE_SIZE
    return x, y, min(TILE_SIZE, grid["width"] - x), min(TILE_SIZE, grid["height"] - y)


def zoom_key(zoom: float) -> str:
    """A zoom spelled the way the catalog does: `1`, `0.75`, `0.2`.

    `worldmaps.json` stores float32, so `0.8` arrives as `0.800000011920929`
    and printing it raw would name a level no address ever points at."""
    return f"{round(zoom, 4):g}"


def _worldmap_meta(output: Path) -> dict[str, dict[str, Any]]:
    path = output / "data" / "worldmaps.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _export_overlays(client_root: Path, dest_dir: Path) -> tuple[dict[str, str], list[str]]:
    """The sprites drawn *over* the parchment, from `uidarkstone_assets_all`.

    `hints.gfx` is a sprite of that UI bundle, named by the number itself — not
    a `mapgfx_1x_*` map element, where the same numbers mean other things.
    Kept at native size: the official view paints a pin at 1:1 whatever the
    zoom, so scaling here would only lose pixels."""
    hint_dir = dest_dir / "hints"
    marker_dir = dest_dir / "markers"
    hint_dir.mkdir(parents=True, exist_ok=True)
    marker_dir.mkdir(parents=True, exist_ok=True)
    hints = {path.stem: path.name for path in hint_dir.glob("*.png")}
    markers = sorted(path.stem for path in marker_dir.glob("*.png"))
    if hints and len(markers) == len(MARKERS):
        return dict(sorted(hints.items(), key=lambda row: int(row[0]))), markers
    bundle = Path(client_root) / HINT_BUNDLE
    if not bundle.is_file():
        return dict(sorted(hints.items(), key=lambda row: int(row[0]))), markers
    env = load_bundle(bundle)
    found: list[str] = []
    for obj in env.objects:
        if obj.type.name != "Sprite":
            continue
        sprite = obj.read()
        if _NUMERIC.match(sprite.m_Name):
            name = f"{sprite.m_Name}.png"
            sprite.image.save(hint_dir / name)
            hints[sprite.m_Name] = name
        elif sprite.m_Name in MARKERS:
            sprite.image.save(marker_dir / f"{sprite.m_Name}.png")
            found.append(sprite.m_Name)
    return dict(sorted(hints.items(), key=lambda row: int(row[0]))), sorted(found or markers)


def export_worldmaps(
    client_root: Path = DEFAULT_CLIENT,
    output_dir: Path | None = None,
    force: bool = False,
) -> Path:
    output = Path(output_dir or Path(__file__).resolve().parents[2] / "output")
    dest_dir = output / "worldmaps"
    dest_dir.mkdir(parents=True, exist_ok=True)
    index_path = dest_dir / "index.json"

    meta = _worldmap_meta(output)
    addresses = location_ids(Path(client_root) / CATALOG, "worldmaps/")

    wanted: dict[str, tuple[int, str, int]] = {}
    for guid, address in addresses.items():
        match = _ADDRESS.match(address)
        if match:
            wanted[guid] = (int(match.group(1)), match.group(2), int(match.group(3)))

    # The zoom levels are the ones the catalog actually addresses, spelled the
    # way it spells them; `worldmaps.json` only supplies the picture size.
    zooms: dict[int, set[str]] = {}
    for worldmap_id, zoom, _index in wanted.values():
        zooms.setdefault(worldmap_id, set()).add(zoom)

    grids: dict[int, dict[str, dict[str, int]]] = {}
    for worldmap_id, keys in zooms.items():
        row = meta.get(str(worldmap_id)) or {}
        total_width = int(row.get("totalWidth") or 0)
        total_height = int(row.get("totalHeight") or 0)
        grids[worldmap_id] = {
            key: level_grid(total_width, total_height, float(key))
            for key in sorted(keys, key=float, reverse=True)
        } if total_width and total_height else {}

    missing = [
        guid for guid, (worldmap_id, zoom, index) in wanted.items()
        if not (dest_dir / str(worldmap_id) / zoom / f"{index}.jpg").is_file()
    ]
    if force or missing:
        env = load_bundle(Path(client_root) / BUNDLE)
        # `container` maps one GUID to both the Sprite and its Texture2D, so it
        # yields the same key twice; every pair has to be walked, not the keys.
        by_path_id: dict[int, tuple[int, str, int]] = {}
        for guid, pointer in env.container.items():
            key = wanted.get(guid)
            if key is not None:
                by_path_id[pointer.path_id] = key
        for obj in env.objects:
            if obj.type.name != "Sprite":
                continue
            key = by_path_id.get(obj.path_id)
            if key is None:
                continue
            worldmap_id, zoom, index = key
            path = dest_dir / str(worldmap_id) / zoom / f"{index}.jpg"
            if path.is_file() and not force:
                continue
            image = obj.read().image
            grid = grids.get(worldmap_id, {}).get(zoom)
            if grid:
                _x, _y, width, height = tile_box(grid, index)
                # Texture compression pads the last row and column up to a
                # multiple of 4 by repeating the edge; that would show as a
                # seam once the tiles are laid side by side.
                if 0 < width <= image.width and 0 < height <= image.height:
                    image = image.crop((0, 0, width, height))
            path.parent.mkdir(parents=True, exist_ok=True)
            image.convert("RGB").save(path, quality=JPEG_QUALITY, subsampling=0)

    hints, markers = _export_overlays(client_root, dest_dir)

    index: dict[str, Any] = {
        "tileSize": TILE_SIZE,
        "hints": hints,
        "markers": markers,
        "worldmaps": {},
    }
    for worldmap_id in sorted(grids):
        row = dict(meta.get(str(worldmap_id)) or {})
        row["id"] = worldmap_id
        row["levels"] = {
            zoom: {
                **grid,
                "tiles": sum(
                    1 for path in (dest_dir / str(worldmap_id) / zoom).glob("*.jpg")
                ),
            }
            for zoom, grid in grids[worldmap_id].items()
        }
        index["worldmaps"][str(worldmap_id)] = row
    index_path.write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return index_path

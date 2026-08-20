"""Extract one Dofus 3 map + the gfx sprites it actually uses."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

from extractor.unity_loader import content_root, iter_monobehaviours, load_bundle

# 14 columns × 40 rows = 560 cells. Projection from reverse notes.
MAP_COLUMNS = 14
MAP_ROWS = 40
CELL_COUNT = 560

# Observed 1x mapgfx bundle prefixes (largest matching prefix <= gfxId).
_GFX_PREFIXES = [
    13370000,
    3060000,
    900000,
    800000,
    700000,
    600000,
    550000,
    500000,
    400000,
    300000,
    260000,
    250000,
    200000,
    140000,
    130000,
    120000,
    110000,
    100000,
    90000,
    80000,
    70000,
    60000,
    50000,
    40000,
    30000,
    20000,
    10000,
    0,
]


def cell_to_world(cell_id: int) -> tuple[float, float]:
    row = cell_id // MAP_COLUMNS
    column = cell_id % MAP_COLUMNS
    x = -580.5 + column * 86 + (row & 1) * 43
    y = 483.75 - row * 21.5
    return x, y


def gfx_bundle_prefix(gfx_id: int) -> int:
    for prefix in _GFX_PREFIXES:
        if gfx_id >= prefix:
            return prefix
    return 0


def _color_u32(value: Any) -> int:
    if isinstance(value, dict):
        return int(value.get("value") or 0)
    return int(value or 0)


def _element(el: dict[str, Any], layer: str, order: int) -> dict[str, Any]:
    tr = el.get("transform") or {}
    return {
        "gfx_id": int(el.get("gfxId") or 0),
        "layer": layer,
        "order": order,
        "color_u32": _color_u32(el.get("color")),
        "transform": {
            "m11": float(tr.get("m11") or 1),
            "m12": float(tr.get("m12") or 0),
            "m21": float(tr.get("m21") or 0),
            "m22": float(tr.get("m22") or 1),
            "m31": float(tr.get("m31") or 0),
            "m32": float(tr.get("m32") or 0),
        },
        "material_index": int(el.get("materialIndex") or 0),
        "display_behaviour": int(el.get("displayBehaviour") or 0),
        "cell_id": int(el.get("cellId") or 0) if "cellId" in el else None,
        "inner_cell_render_order": int(el.get("innerCellRenderOrder") or 0)
        if "innerCellRenderOrder" in el
        else None,
    }


def _find_map_bundle(map_dir: Path, map_id: int) -> Path:
    target = f"map_{map_id}"
    for bundle in sorted(map_dir.glob("mapdata_assets_world_*.bundle")):
        env = load_bundle(bundle)
        for _obj, tree in iter_monobehaviours(env):
            if tree.get("m_Name") == target:
                return bundle
    raise FileNotFoundError(f"map_{map_id} not found under {map_dir}")


def _load_map_tree(bundle: Path, map_id: int) -> dict[str, Any]:
    env = load_bundle(bundle)
    target = f"map_{map_id}"
    for _obj, tree in iter_monobehaviours(env):
        if tree.get("m_Name") == target:
            return tree
    raise RuntimeError(f"{target} missing in {bundle}")


def _export_sprites(client_root: Path, gfx_ids: Iterable[int], gfx_dir: Path) -> dict[int, dict[str, Any]]:
    gfx_dir.mkdir(parents=True, exist_ok=True)
    needed = sorted(set(int(g) for g in gfx_ids if g))
    by_prefix: dict[int, list[int]] = {}
    for gid in needed:
        by_prefix.setdefault(gfx_bundle_prefix(gid), []).append(gid)

    tex_root = content_root(client_root) / "Map" / "Textures" / "1x"
    catalog: dict[int, dict[str, Any]] = {}
    missing: list[int] = []

    for prefix, ids in by_prefix.items():
        bundle = tex_root / f"mapgfx_1x_{prefix}_assets_all.bundle"
        if not bundle.is_file():
            missing.extend(ids)
            continue
        env = load_bundle(bundle)
        want = {str(i) for i in ids}
        found: set[int] = set()
        for obj in env.objects:
            if obj.type.name != "Sprite":
                continue
            spr = obj.read()
            if spr.m_Name not in want:
                continue
            gid = int(spr.m_Name)
            png_name = f"{gid}.png"
            spr.image.save(gfx_dir / png_name)
            pivot = spr.m_Pivot
            rect = spr.m_Rect
            catalog[gid] = {
                "id": gid,
                "texture": f"gfx/{png_name}",
                "width": float(rect.width),
                "height": float(rect.height),
                "pivot": [float(pivot.x), float(pivot.y)],
                "offset": [float(spr.m_Offset.x), float(spr.m_Offset.y)],
                "pixels_per_unit": float(spr.m_PixelsToUnits),
            }
            found.add(gid)
        for gid in ids:
            if gid not in found:
                missing.append(gid)

    if missing:
        catalog_meta = gfx_dir / "_missing.json"
        catalog_meta.write_text(json.dumps(missing))
    return catalog


def export_map(client_root: Path, map_id: int, output_dir: Path) -> Path:
    map_dir = content_root(client_root) / "Map" / "Data"
    bundle = _find_map_bundle(map_dir, map_id)
    tree = _load_map_tree(bundle, map_id)
    md = tree["mapData"]
    cells = md["cellsData"]
    if len(cells) != CELL_COUNT:
        raise RuntimeError(f"map {map_id} has {len(cells)} cells, expected {CELL_COUNT}")

    elements: list[dict[str, Any]] = []
    for i, el in enumerate(md.get("backgroundElements") or []):
        elements.append(_element(el, "background", i))
    for i, el in enumerate(md.get("sortableElements") or []):
        elements.append(_element(el, "sortable", i))
    for i, el in enumerate(md.get("foregroundElements") or []):
        elements.append(_element(el, "foreground", i))
    for i, el in enumerate(md.get("animatedElements") or []):
        elements.append(_element(el, "animated", i))

    gfx_ids = [e["gfx_id"] for e in elements]
    gfx_catalog = _export_sprites(client_root, gfx_ids, output_dir / "gfx")

    cells_out = []
    for cell in cells:
        cid = int(cell["cellNumber"])
        x, y = cell_to_world(cid)
        cells_out.append(
            {
                "id": cid,
                "x": x,
                "y": y,
                "mov": int(cell.get("mov") or 0),
                "los": int(cell.get("los") or 0),
                "speed": int(cell.get("speed") or 0),
                "move_zone": int(cell.get("moveZone") or 0),
                "linked_zone": int(cell.get("linkedZone") or 0),
                "map_change_data": int(cell.get("mapChangeData") or 0),
                "non_walkable_during_fight": int(cell.get("nonWalkableDuringFight") or 0),
                "non_walkable_during_rp": int(cell.get("nonWalkableDuringRP") or 0),
                "visible": int(cell.get("visible") or 0),
                "floor": int(cell.get("floor") or 0),
                "raw": {
                    k: cell[k]
                    for k in cell
                    if k
                    not in {
                        "cellNumber",
                        "mov",
                        "los",
                        "speed",
                        "moveZone",
                        "linkedZone",
                        "mapChangeData",
                        "nonWalkableDuringFight",
                        "nonWalkableDuringRP",
                        "visible",
                        "floor",
                    }
                },
            }
        )

    walkable = [
        c["id"]
        for c in cells_out
        if c["mov"] == 1 and c["non_walkable_during_rp"] == 0 and c["visible"] == 1
    ]

    doc = {
        "format": "giny.dofus3.map.v1",
        "id": map_id,
        "source_bundle": bundle.name,
        "neighbours": {
            "top": int(md.get("topNeighbourId") or 0),
            "bottom": int(md.get("bottomNeighbourId") or 0),
            "left": int(md.get("leftNeighbourId") or 0),
            "right": int(md.get("rightNeighbourId") or 0),
        },
        "background_color_u32": _color_u32(md.get("backgroundColor")),
        "columns": MAP_COLUMNS,
        "rows": MAP_ROWS,
        "cells": cells_out,
        "walkable_cells": walkable,
        "elements": elements,
        "gfx": {str(k): v for k, v in gfx_catalog.items()},
        "missing_gfx": sorted({e["gfx_id"] for e in elements if e["gfx_id"] not in gfx_catalog}),
        "notes": {
            "coordinate_space": "unity_y_up_pixels",
            "element_matrix": "x' = m11*x + m21*y + m31 ; y' = m12*x + m22*y + m32",
            "mapelements": "GfxElement values are managed references (rid); POC resolves gfxId directly against mapgfx sprite names.",
        },
    }
    out = output_dir / "maps"
    out.mkdir(parents=True, exist_ok=True)
    dest = out / f"{map_id}.json"
    dest.write_text(json.dumps(doc, indent=2))
    return dest

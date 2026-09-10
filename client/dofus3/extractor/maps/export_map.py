"""Extract one Dofus 3 map + the gfx sprites it actually uses."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable

from extractor.maps.effects import (
    EFFECTS_VERSION,
    associate_refraction_material,
    build_effects_document,
    resolve_all_material_tables,
    resolve_material_table,
)
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


def _ref_data_by_rid(tree: dict[str, Any]) -> dict[int, tuple[dict[str, Any], str]]:
    """Map ``rid`` → ``(data, type class name)`` from ``references.RefIds``."""
    index: dict[int, tuple[dict[str, Any], str]] = {}
    refs = (tree.get("references") or {}).get("RefIds") or []
    for ref in refs:
        if not isinstance(ref, dict) or "rid" not in ref:
            continue
        data = ref.get("data")
        if not isinstance(data, dict):
            continue
        type_info = ref.get("type") or {}
        class_name = str(type_info.get("class") or "") if isinstance(type_info, dict) else ""
        index[int(ref["rid"])] = (data, class_name)
    return index


# ``ShaderBlendingParameters`` carries Unity's BlendMode enum. Only the factor
# pairs the maps actually use are named here.
_BLEND_ZERO = 0
_BLEND_ONE = 1
_BLEND_DST_COLOR = 2
_BLEND_SRC_COLOR = 3
_BLEND_SRC_ALPHA = 5
_BLEND_ONE_MINUS_SRC_ALPHA = 10

# Internal marker, never written to a map document.
_BRIGHTEN = "brighten"

# Above this mean premultiplied luminance (0-255) a brightening source is a
# full-map paint plate rather than a glow. Measured glows sit at 5-33 and the
# neutral plates at ~230, so the gap is wide.
_BRIGHTEN_PLATE_LUMINANCE = 96

_BLEND_MODES = {
    (_BLEND_ONE, _BLEND_ONE_MINUS_SRC_ALPHA): "normal",
    (_BLEND_DST_COLOR, _BLEND_ONE_MINUS_SRC_ALPHA): "multiply",
    (_BLEND_ONE, _BLEND_ONE): "add",
    (_BLEND_SRC_ALPHA, _BLEND_ONE): "add",
    # dst*(1+src) and src*src+dst: brightening passes with no WebGL equivalent.
    # Resolved per sprite by resolve_brighten below.
    (_BLEND_DST_COLOR, _BLEND_ONE): _BRIGHTEN,
    (_BLEND_SRC_COLOR, _BLEND_ONE): _BRIGHTEN,
    # Source scaled by zero: the element contributes nothing and must not be drawn.
    (_BLEND_ZERO, _BLEND_ONE): "none",
}

# Without ShaderBlendingParameters the native DofusMainShader uses
# One / OneMinusSrcAlpha, including painted scenery and water backgrounds.
# Multiply is only valid when explicitly declared by the material.
_DEFAULT_BLEND = {
    "ShaderData": "normal",
    "PaintShaderData": "normal",
    "ParticlesShaderData": "none",
}

_NEUTRAL_MATERIAL = {"shader": "", "blend": "normal", "gfx_id": 0}


def material_table(tree: dict[str, Any], material_key: str) -> list[dict[str, Any]]:
    """Resolve one layer's material list into shader family, blend, and parameters.

    An element's ``materialIndex`` indexes the table of its own layer;
    interactive elements index the sortable layer's table. Unknown blend
    factor pairs are marked ``unsupported`` rather than silently treated as
    normal.
    """
    return resolve_material_table(tree, material_key)


def resolve_brighten(
    tables: dict[str, list[dict[str, Any]]],
    catalog: dict[int, dict[str, Any]],
) -> None:
    """Turn the ``brighten`` marker into a mode the renderer can draw.

    Unity's ``(DstColor, One)`` is ``dst * (1 + src)`` and ``(SrcColor, One)``
    is ``src^2 + dst``. Neither exists in WebGL's fixed blend set, and
    approximating them with plain additive blending is only harmless while the
    source is dark: on a near-white full-map plate it saturates the whole map.

    A dark source is therefore drawn additively, close enough for a glow; a
    bright plate is dropped, since its real effect comes from a paint shader
    the renderer does not implement anyway.
    """
    for table in tables.values():
        for material in table:
            if material["blend"] != _BRIGHTEN:
                continue
            entry = catalog.get(int(material["gfx_id"]))
            if entry is None:
                # Unmeasurable source. Erring towards additive is what saturates
                # a whole map to white, so err towards not drawing instead: the
                # cost is a missing glow rather than an unplayable map.
                material["blend"] = "none"
                continue
            luminance = float(entry.get("luminance") or 0)
            material["blend"] = (
                "none" if luminance >= _BRIGHTEN_PLATE_LUMINANCE else "add"
            )


def _material(table: list[dict[str, Any]] | None, material_index: int) -> dict[str, Any]:
    if table and 0 <= material_index < len(table):
        return table[material_index]
    return _NEUTRAL_MATERIAL


def resolve_interactive_props(
    tree: dict[str, Any],
    found_gfx_ids: Iterable[int] = (),
) -> list[dict[str, Any]]:
    """Resolve ``mapData.interactiveElements`` ``{rid}`` entries into MapProp dicts.

    ``found_gfx_ids`` are identifiers that exist as sprites in a ``mapgfx_1x_*``
    bundle; those props are ``static: true``. Every other prop is Animator2D
    (``static: false``). Unresolved rids are dropped — never left as raw ``{rid}``.
    """
    found = {int(g) for g in found_gfx_ids}
    md = tree.get("mapData") if isinstance(tree.get("mapData"), dict) else tree
    entries = [(e, False) for e in md.get("interactiveElements", [])] + [(e, True) for e in md.get("animatedElements", [])] if isinstance(md, dict) else []
    refs = _ref_data_by_rid(tree)
    props: list[dict[str, Any]] = []
    for entry, ambient in entries:
        if not isinstance(entry, dict):
            continue
        resolved = (entry, "AnimatedElement") if ambient and "gfxId" in entry else refs.get(int(entry.get("rid", 0)))
        if resolved is None:
            continue
        data, class_name = resolved
        gfx_raw = data.get("gfxId")
        gfx_id = int(gfx_raw) if gfx_raw is not None else 0
        tr = data.get("transform") or {}
        kind = "animated" if "Animated" in class_name else "interactive"
        props.append(
            {
                "kind": kind,
                "prop_id": gfx_id,
                "gfx_id": gfx_id,
                "cell_id": int(data.get("cellId") or 0),
                "transform": {
                    "m11": float(tr.get("m11") or 1),
                    "m12": float(tr.get("m12") or 0),
                    "m21": float(tr.get("m21") or 0),
                    "m22": float(tr.get("m22") or 1),
                    "m31": float(tr.get("m31") or 0),
                    "m32": float(tr.get("m32") or 0),
                },
                "color_u32": _color_u32(data.get("color")),
                "display_behaviour": int(data.get("displayBehaviour") or 0),
                "inner_cell_render_order": int(data.get("innerCellRenderOrder") or 0),
                "interaction_id": int(data.get("m_interactionId") or data.get("interactionId") or 0),
                "play_animation": int(data.get("playAnimation") or 0),
                "ambient": ambient,
                "play_anim_static": bool(data.get("playAnimStatic")),
                "min_delay": float(data.get("minDelay") or 0),
                "max_delay": float(data.get("maxDelay") or 0),
                "requires_server_update": bool(data.get("requiresServerUpdate")),
                "static": not ambient and gfx_id in found,
            }
        )
    return props


def resolve_particles(tree: dict[str, Any]) -> list[dict[str, Any]]:
    """Preserve authored emitters and resolve their layer-local materials offline."""
    md = tree.get("mapData", tree)
    refs = _ref_data_by_rid(tree)
    def material(layer, index):
        entries = md.get(layer + "MaterialData", {}).get("shaderData", [])
        if index < 0 or index >= len(entries):
            return {"gfxId": -1, "parameters": {}}
        data, shader = refs.get(int(entries[index].get("rid", 0)), ({}, ""))
        parameters = {}
        for ref in data.get("shaderParameters", []):
            value, kind = refs.get(int(ref.get("rid", 0)), ({}, ""))
            parameters[kind] = value
        return {"gfxId": data.get("gfxId", -1), "shader": shader, "parameters": parameters}
    def compact(value):
        if isinstance(value, list):
            return [compact(v) for v in value]
        if isinstance(value, float) and not math.isfinite(value):
            return "Infinity" if value > 0 else "-Infinity" if value < 0 else None
        if not isinstance(value, dict):
            return value
        if "constantMax" in value and value.get("mode", 0) in (0, 3):
            return {k: compact(value[k]) for k in ("mode", "constantMin", "constantMax")}
        return {k: compact(v) for k, v in value.items()}
    result = []
    for emitter in md.get("particlesParameters", []):
        effect_layer = int(emitter.get("layer", 5))
        layer = "background" if effect_layer < 5 else "sortable" if effect_layer == 5 else "foreground"
        item = dict(emitter)
        item["hostLayer"] = layer
        item["material"] = material(layer, int(item.get("materialIndex", 0)))
        item["trailMaterial"] = material(layer, int(item.get("trailMaterialIndex", 0)))
        result.append(compact(item))
    return result


def resolve_element_dict(
    el: dict[str, Any],
    index: int,
    refs: dict[int, tuple[dict[str, Any], str]],
    elements_map: dict[Any, Any] | None = None,
) -> dict[str, Any]:
    """Resolve an element dictionary, expanding {rid} if needed.

    Checks m_elementsMap (int -> string / dict), references.RefIds, and falls
    back to direct index in refs to plug gfx holes.
    """
    if not isinstance(el, dict):
        return {}
    if "gfxId" in el and el["gfxId"]:
        return el
    rid = el.get("rid")
    if rid is not None:
        int_rid = int(rid)
        if elements_map:
            mapped = elements_map.get(int_rid)
            if mapped is None:
                mapped = elements_map.get(str(int_rid))
            if isinstance(mapped, dict):
                return mapped
            if isinstance(mapped, (int, str)) and str(mapped).lstrip("-").isdigit():
                return {**el, "gfxId": int(mapped)}
        if int_rid in refs:
            ref_data = refs[int_rid][0]
            if isinstance(ref_data, dict):
                return ref_data
    if index in refs:
        ref_data = refs[index][0]
        if isinstance(ref_data, dict) and "gfxId" in ref_data:
            return ref_data
    return el


def _element(
    el: dict[str, Any],
    layer: str,
    order: int,
    materials: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    tr = el.get("transform") or {}
    material = _material(materials, int(el.get("materialIndex") or 0))
    res: dict[str, Any] = {
        "shader": material["shader"],
        "blend": material["blend"],
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
    if "uniforms" in material:
        res["uniforms"] = material["uniforms"]
    if material.get("parameters"):
        res["parameters"] = material["parameters"]
    if material.get("blend_raw"):
        res["blend_raw"] = material["blend_raw"]
    return res


def _bundle_index_path(output_dir: Path) -> Path:
    return output_dir / "maps" / "_bundle_index.json"


def _read_bundle_index(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}
    return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}


def _write_bundle_index(path: Path, index: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(index, separators=(",", ":")))


def _index_bundle_maps(bundle: Path) -> tuple[dict[str, str], dict[str, Any]]:
    """Map id → bundle name for every map in this file, plus the typetrees."""
    env = load_bundle(bundle)
    names: dict[str, str] = {}
    trees: dict[str, Any] = {}
    for _obj, tree in iter_monobehaviours(env):
        name = str(tree.get("m_Name") or "")
        if name.startswith("map_"):
            map_id = name.removeprefix("map_")
            names[map_id] = bundle.name
            trees[map_id] = tree
    return names, trees


def _locate_map(map_dir: Path, map_id: int, output_dir: Path) -> tuple[Path, dict[str, Any]]:
    """Find ``map_{id}`` without scanning 569 world bundles on every call.

    ``world_0`` alone takes ~4s to open. The previous lookup loaded every
    bundle until it scored, then loaded the winner a second time — a first
    visit easily sat on "Chargement de la carte" for 10s+. The on-disk index
    remembers which bundle owns which map after the first scan.
    """
    target = str(map_id)
    index_path = _bundle_index_path(output_dir)
    index = _read_bundle_index(index_path)

    if target in index:
        bundle = map_dir / index[target]
        if bundle.is_file():
            _names, trees = _index_bundle_maps(bundle)
            index.update(_names)
            _write_bundle_index(index_path, index)
            if target in trees:
                return bundle, trees[target]

    indexed_bundles = set(index.values())
    for bundle in sorted(map_dir.glob("mapdata_assets_world_*.bundle")):
        if bundle.name in indexed_bundles:
            continue
        names, trees = _index_bundle_maps(bundle)
        index.update(names)
        _write_bundle_index(index_path, index)
        if target in trees:
            return bundle, trees[target]
    raise FileNotFoundError(f"map_{map_id} not found under {map_dir}")


def _gfx_meta_path(gfx_dir: Path, gid: int) -> Path:
    return gfx_dir / f"{gid}.json"


def _mean_luminance(image: Any) -> float:
    """Mean premultiplied luminance of a sprite, 0-255.

    Premultiplied because a mostly transparent glow must read as dark: what
    matters is how much light the sprite actually adds, not the colour of its
    opaque pixels.
    """
    thumb = image.convert("RGBA")
    thumb.thumbnail((32, 32))
    # tobytes rather than getdata: no per-pixel Python objects, and getdata is
    # deprecated in Pillow 14.
    raw = thumb.tobytes()
    count = len(raw) // 4
    if count == 0:
        return 0.0
    total = 0.0
    for i in range(0, count * 4, 4):
        red, green, blue, alpha = raw[i], raw[i + 1], raw[i + 2], raw[i + 3]
        total += (red * 0.299 + green * 0.587 + blue * 0.114) * alpha / 255.0
    return total / count


def _read_gfx_meta(gfx_dir: Path, gid: int) -> dict[str, Any] | None:
    png = gfx_dir / f"{gid}.png"
    meta = _gfx_meta_path(gfx_dir, gid)
    if not png.is_file() or not meta.is_file():
        return None
    try:
        data = json.loads(meta.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if "luminance" not in data:
        # Meta written before luminance was recorded: fill it in from the PNG
        # rather than treating the sprite as black, which would draw a full-map
        # paint plate additively and wash the map out.
        try:
            from PIL import Image

            with Image.open(png) as image:
                data["luminance"] = round(_mean_luminance(image), 2)
        except Exception:
            data["luminance"] = 0.0
        _write_gfx_meta(gfx_dir, data)
    return data


def _write_gfx_meta(gfx_dir: Path, entry: dict[str, Any]) -> None:
    gid = int(entry["id"])
    _gfx_meta_path(gfx_dir, gid).write_text(json.dumps(entry, separators=(",", ":")))


def _export_sprites(client_root: Path, gfx_ids: Iterable[int], gfx_dir: Path) -> dict[int, dict[str, Any]]:
    gfx_dir.mkdir(parents=True, exist_ok=True)
    needed = sorted(set(int(g) for g in gfx_ids if g))
    catalog: dict[int, dict[str, Any]] = {}
    missing: list[int] = []
    still_need: list[int] = []
    for gid in needed:
        cached = _read_gfx_meta(gfx_dir, gid)
        if cached:
            catalog[gid] = cached
        else:
            still_need.append(gid)

    by_prefix: dict[int, list[int]] = {}
    for gid in still_need:
        by_prefix.setdefault(gfx_bundle_prefix(gid), []).append(gid)

    tex_root = content_root(client_root) / "Map" / "Textures" / "1x"

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
            png_path = gfx_dir / png_name
            if not png_path.is_file():
                spr.image.save(png_path)
            pivot = spr.m_Pivot
            rect = spr.m_Rect
            entry = {
                "id": gid,
                "texture": f"gfx/{png_name}",
                "width": float(rect.width),
                "height": float(rect.height),
                "pivot": [float(pivot.x), float(pivot.y)],
                "offset": [float(spr.m_Offset.x), float(spr.m_Offset.y)],
                "pixels_per_unit": float(spr.m_PixelsToUnits),
                # Drives resolve_brighten: a glow can be drawn additively, a
                # bright full-map plate cannot.
                "luminance": round(_mean_luminance(spr.image), 2),
            }
            catalog[gid] = entry
            _write_gfx_meta(gfx_dir, entry)
            found.add(gid)
        for gid in ids:
            if gid not in found:
                missing.append(gid)

    if missing:
        catalog_meta = gfx_dir / "_missing.json"
        catalog_meta.write_text(json.dumps(missing))
    return catalog


def build_map_document(client_root: Path, map_id: int, output_dir: Path, *,
                       source: tuple[Path, dict[str, Any]] | None = None,
                       sprite_catalog: dict[int, dict[str, Any]] | None = None) -> dict[str, Any]:
    """Build one map; bulk export reuses a loaded bundle and sprite catalog."""
    map_dir = content_root(client_root) / "Map" / "Data"
    bundle, tree = source if source is not None else _locate_map(map_dir, map_id, output_dir)
    md = tree["mapData"]
    cells = md["cellsData"]
    if len(cells) != CELL_COUNT:
        raise RuntimeError(f"map {map_id} has {len(cells)} cells, expected {CELL_COUNT}")

    # Each layer owns its material list; an element's materialIndex points into
    # the one of its own layer, and interactive elements into the sortable one.
    materials = resolve_all_material_tables(tree)

    layers = [
        ("backgroundElements", "background"),
        ("sortableElements", "sortable"),
        ("foregroundElements", "foreground"),
        ("refractionElements", "refraction"),
    ]

    # Interactive gfx that live as mapgfx sprites (doors, zaaps, ateliers)
    # join the sprite catalog; Animator2D props (kind=animated) do not.
    refs = _ref_data_by_rid(tree)
    elements_map = md.get("m_elementsMap") or tree.get("m_elementsMap") or {}
    if not isinstance(elements_map, dict):
        elements_map = {}

    resolved_layer_elements: list[tuple[str, str, int, dict[str, Any]]] = []
    for key, layer in layers:
        source = md.get(key) or []
        for i, raw_el in enumerate(source):
            resolved = resolve_element_dict(raw_el, i, refs, elements_map)
            resolved_layer_elements.append((key, layer, i, resolved))

    # Must be bound before gfx_ids: static interactive sprites (doors, zaaps)
    # join the catalog. A later pass re-resolves with found_gfx_ids for `static`.
    preview_props = resolve_interactive_props(tree)
    gfx_ids = [
        int(el.get("gfxId") or 0) for _, _, _, el in resolved_layer_elements
    ] + [p["gfx_id"] for p in preview_props if p["kind"] != "animated" and p["gfx_id"] > 0]
    # Sprites are exported before the elements are built: resolve_brighten needs
    # each source's luminance to pick a blend mode the renderer can draw.
    gfx_catalog = (_export_sprites(client_root, gfx_ids, output_dir / "gfx") if sprite_catalog is None
                   else {gid: sprite_catalog[gid] for gid in set(gfx_ids) if gid in sprite_catalog})
    resolve_brighten(materials, gfx_catalog)

    elements: list[dict[str, Any]] = []
    for key, layer, i, el in resolved_layer_elements:
        table = materials.get(layer) if layer != "refraction" else materials.get("foreground")
        if layer == "refraction":
            _host, _index, host_material = associate_refraction_material(el, materials)
            table = [host_material]
            el = {**el, "materialIndex": 0}
        elements.append(
            _element(el, "animated" if key == "animatedElements" else layer, i, table)
        )
    # Interactive elements are always plain sprites (checked across 29 maps:
    # 86/86 resolve to ShaderData/normal) and the animated ones are drawn by the
    # entity renderer, not by a material, so they carry no blend of their own.
    props = resolve_interactive_props(tree, found_gfx_ids=gfx_catalog)
    effects = build_effects_document(tree, particles=resolve_particles(tree), extra_families=(
        ["animated_props"] if any(p.get("ambient") for p in props) else []
    ))

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
            }
        )

    walkable = [
        c["id"]
        for c in cells_out
        if c["mov"] == 1 and c["non_walkable_during_rp"] == 0 and c["visible"] == 1
    ]

    doc = {
        # v2 added the per-element material (shader family + blend mode); v3
        # resolves Unity's brightening formulas per sprite instead of drawing
        # them all additively, which saturated the maps carrying a paint plate.
        "format": "giny.dofus3.map.v3",
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
        "props": props,
        "particles": effects["particles"],
        "gfx": {str(k): v for k, v in gfx_catalog.items()},
        "missing_gfx": sorted({e["gfx_id"] for e in elements if e["gfx_id"] not in gfx_catalog}),
        "effects_version": EFFECTS_VERSION,
        "environment": effects["environment"],
        "materials": effects["materials"],
        "refraction": effects["refraction"],
        "effect_sequences": effects["effect_sequences"],
        "effect_dependencies": effects["effect_dependencies"],
        "effect_coverage": effects["effect_coverage"],
        "notes": {
            "coordinate_space": "unity_y_up_pixels",
            "element_matrix": "x' = m11*x + m21*y + m31 ; y' = m12*x + m22*y + m32",
            "mapelements": "GfxElement values are managed references (rid); POC resolves gfxId directly against mapgfx sprite names.",
            "materials": "blend comes from ShaderBlendingParameters, else from the shader family; 'none' means the element must not be drawn; unknown factor pairs are 'unsupported'.",
            "effects": "texture ids are qualified by category; refraction materials are associated by gfx, not by assuming the foreground table.",
        },
    }
    return doc


def export_map(client_root: Path, map_id: int, output_dir: Path) -> Path:
    doc = build_map_document(client_root, map_id, output_dir)
    out = output_dir / "maps"
    out.mkdir(parents=True, exist_ok=True)
    dest = out / f"{map_id}.json"
    dest.write_text(json.dumps(doc, separators=(",", ":")))
    return dest

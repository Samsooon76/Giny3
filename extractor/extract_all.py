"""Batch extraction of every bundle category, one pass per folder.

Reuses the per-item decoding rules of export_map / export_bone but walks
whole bundle directories so a full-client refresh is a single command.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from extractor.maps.export_map import (
    _element,
    _export_sprites,
    CELL_COUNT,
)
from extractor.unity_loader import content_root, iter_monobehaviours, load_bundle


def _bundle_name(bundle: Path) -> str:
    return bundle.stem.replace(".asset", "")


def inline_rids(value, refs: dict, seen: set | None = None):
    """Replace Unity `{rid}` managed references with the pointed-at data.

    Item `possibleEffects` (and similar lists) ship as rids into the bundle's
    `references.RefIds`. Leaving them as `{rid: N}` makes the dump unreadable.
    """
    walking = seen if seen is not None else set()
    if isinstance(value, dict):
        if "rid" in value and set(value.keys()) <= {"rid"}:
            rid = value["rid"]
            if rid in walking:
                return value
            data = refs.get(rid)
            if not isinstance(data, dict):
                return value
            # Track ancestors, not every reference visited in the document.
            # The same effect can legitimately appear in multiple siblings.
            return inline_rids(data, refs, walking | {rid})
        return {key: inline_rids(item, refs, walking) for key, item in value.items()}
    if isinstance(value, list):
        return [inline_rids(item, refs, walking) for item in value]
    return value


def _write_json(path: Path, payload) -> None:
    """Big extractor JSONs are stored gzipped at rest; the dev servers
    (vite.config.ts / electron main) decompress transparently on request."""
    import gzip

    gz = path if path.suffix == ".gz" else path.with_name(path.name + ".gz")
    with gzip.open(gz, "wt", compresslevel=6, encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    if path != gz and path.exists():
        path.unlink()


def extract_data(client_root: Path, output_dir: Path, names: set[str] | None = None) -> None:
    """Dump every data_assets_*dataroot bundle: objectsById -> references."""
    data_dir = content_root(client_root) / "Data"
    dest = output_dir / "data"
    dest.mkdir(parents=True, exist_ok=True)
    for bundle in sorted(data_dir.glob("data_assets_*dataroot.asset.bundle")):
        name = _bundle_name(bundle)
        name = name.removeprefix("data_assets_").removesuffix("dataroot")
        if names is not None and name not in names:
            continue
        out = dest / f"{name}.json"
        env = load_bundle(bundle)
        records = {}
        for _obj, tree in iter_monobehaviours(env):
            keys = (tree.get("objectsById") or {}).get("m_keys") or []
            refs = {r["rid"]: r.get("data") for r in (tree.get("references") or {}).get("RefIds", []) if "rid" in r}
            for i, key in enumerate(keys):
                rid = (tree["objectsById"]["m_values"][i] or {}).get("rid")
                data = refs.get(rid)
                if data is not None:
                    records[key] = inline_rids(data, refs)
        _write_json(out, records)
        print(f"data {name}: {len(records)} entries", flush=True)


def extract_maps(client_root: Path, output_dir: Path) -> None:
    """Extract every map from every mapdata bundle + the gfx sprites used."""
    map_dir = content_root(client_root) / "Map" / "Data"
    dest = output_dir / "maps"
    dest.mkdir(parents=True, exist_ok=True)
    for bundle in sorted(map_dir.glob("mapdata_assets_world_*.bundle")):
        env = load_bundle(bundle)
        maps = {t["m_Name"]: t for _o, t in iter_monobehaviours(env) if t.get("m_Name", "").startswith("map_")}
        if not maps:
            continue
        gfx_ids: set[int] = set()
        prepared = {}
        for name, tree in maps.items():
            map_id = int(name.removeprefix("map_"))
            md = tree["mapData"]
            cells = md["cellsData"]
            if len(cells) != CELL_COUNT:
                print(f"skip map {map_id}: {len(cells)} cells", file=sys.stderr)
                continue
            elements = []
            for layer in ("backgroundElements", "sortableElements", "foregroundElements", "animatedElements"):
                for i, el in enumerate(md.get(layer) or []):
                    elements.append(_element(el, layer.removesuffix("Elements"), i))
            prepared[map_id] = (cells, elements)
            gfx_ids.update(e["gfx_id"] for e in elements)
        if not prepared:
            continue
        catalog = _export_sprites(client_root, gfx_ids, output_dir / "gfx")
        for map_id, (cells, elements) in prepared.items():
            out = dest / f"{map_id}.json"
            if out.exists():
                continue
            doc = {
                "id": map_id,
                "cells": cells,
                "elements": elements,
                "gfx_catalog": {str(g): catalog[g] for g in (e["gfx_id"] for e in elements) if g in catalog},
            }
            _write_json(out, doc)
        print(f"{bundle.name}: {len(prepared)} maps", flush=True)


def main(argv: list[str]) -> int:
    from extractor.unity_loader import DEFAULT_CLIENT

    client = Path(argv[1]) if len(argv) > 1 else DEFAULT_CLIENT
    output = Path(argv[2]) if len(argv) > 2 else Path(__file__).resolve().parent.parent / "output"
    what = argv[3] if len(argv) > 3 else "data+maps"
    output.mkdir(parents=True, exist_ok=True)
    if what.startswith("data:"):
        extract_data(client, output, set(what.split(":", 1)[1].split(",")))
    elif "data" in what:
        extract_data(client, output)
    if "maps" in what:
        extract_maps(client, output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

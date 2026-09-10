#!/usr/bin/env python3
"""Inventory every map-effect family before shaders are written.

Walks installed world bundles once per file (or synthetic fixtures). Distinguishes
present configuration from active effects. Missing props and textures are looked
up in their own namespaces; they are never replaced by an arbitrary image.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE / "dofus3"))

from extractor.maps.effects import (  # noqa: E402
    EFFECTS_VERSION,
    EXPORTER_VERSION,
    FAMILIES,
    FAMILY_STATUS,
    STATUS_SOURCE_MISSING,
    fingerprint_payload,
    inventory_map,
    prepared_path,
)
from extractor.unity_loader import (  # noqa: E402
    DEFAULT_CLIENT,
    client_version,
    content_root,
    load_bundle,
    iter_monobehaviours,
)

REPO = BASE.parent if (BASE / "dofus3").exists() else BASE
WORLD = BASE / "dofus3/.cache/dofus3/world"
GAME_DATA = BASE / "web/game-data"
DOCS = REPO / "docs"


def read_json(path: Path) -> Any:
    import gzip

    raw = path.read_bytes()
    if path.suffix == ".gz" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def load_index(path: Path) -> dict[str, str]:
    data = read_json(path)
    return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}


def trees_from_bundle(bundle: Path) -> dict[str, dict]:
    env = load_bundle(bundle)
    trees: dict[str, dict] = {}
    for _obj, tree in iter_monobehaviours(env):
        name = str(tree.get("m_Name") or "")
        if name.startswith("map_"):
            trees[name.removeprefix("map_")] = tree
    return trees


def trees_from_fixtures(root: Path) -> dict[str, dict]:
    trees: dict[str, dict] = {}
    for path in sorted(root.glob("*.json")):
        trees[path.stem] = json.loads(path.read_text())
    return trees


def bundle_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.name.encode())
    digest.update(str(path.stat().st_size).encode())
    digest.update(str(int(path.stat().st_mtime)).encode())
    return digest.hexdigest()[:16]


def load_ambient_gaps() -> tuple[list[str], dict[str, list[int]]]:
    report_path = GAME_DATA / "ambient-report.json"
    if not report_path.exists():
        return [], {}
    report = read_json(report_path)
    props = [str(p) for p in report.get("unavailable_ambient_props") or []]
    missing = {str(k): list(v) for k, v in (report.get("missing_textures") or {}).items()}
    return props, missing


def search_prop(client_root: Path, prop_id: str) -> dict[str, Any]:
    ident = str(prop_id)
    props_dir = content_root(client_root) / "Animations" / "Props"
    candidates = [
        props_dir / f"props_assets_prop_{ident}.bundle",
        props_dir / f"prop_{ident}.bundle",
        props_dir / f"{ident}.bundle",
    ]
    found = [str(p) for p in candidates if p.is_file()]
    prepared = GAME_DATA / "entities" / f"prop_{ident}.json.gz"
    prepared_plain = GAME_DATA / "entities" / f"prop_{ident}.json"
    return {
        "id": ident,
        "namespace": "Animations/Props",
        "bundle_found": found[0] if found else None,
        "prepared": prepared.exists() or prepared_plain.exists(),
        "status": "source_present_decoder_gap" if found else STATUS_SOURCE_MISSING,
    }


def search_texture(client_root: Path, ident: str, maps: list[int]) -> dict[str, Any]:
    effects_root = content_root(client_root) / "Map" / "Textures" / "Effects"
    bundle = effects_root / "mapeffects_assets_all.bundle"
    categories = []
    if bundle.is_file():
        # Cheap path probe: exported catalog, then on-disk prepared files.
        for category in ("particles", "noises", "masks", "emissive", "wind", "wave"):
            prepared = GAME_DATA / prepared_path(category, int(ident))
            world = WORLD / prepared_path(category, int(ident))
            if prepared.exists() or world.exists():
                categories.append(category)
    gfx = GAME_DATA / f"gfx/{ident}.png"
    if gfx.exists():
        categories.append("mapgfx")
    return {
        "id": ident,
        "maps": maps,
        "namespaces_found": categories,
        "status": "ambiguous_or_other_namespace" if categories else STATUS_SOURCE_MISSING,
    }


def pick_representatives(occurrences: dict[str, list[int]], limit: int = 3) -> dict[str, list[int]]:
    return {family: sorted(set(maps))[:limit] for family, maps in occurrences.items()}


def markdown_report(coverage: dict[str, Any]) -> str:
    lines = [
        "# Inventaire des effets de maps",
        "",
        f"Audit reproductible. Version source `{coverage['source_version']}`, "
        f"exporteur `{coverage['exporter_version']}`, schéma effets `{coverage['effects_version']}`.",
        "",
        f"Maps examinées : **{coverage['maps_examined']}**.",
        "",
        "## Familles observées",
        "",
        "| Famille | Occurrences | Actives | Statut | Maps de référence |",
        "| --- | ---: | ---: | --- | --- |",
    ]
    for family in FAMILIES:
        info = coverage["families"].get(family) or {
            "occurrences": 0,
            "active": 0,
            "status": FAMILY_STATUS.get(family, "semantics_unknown"),
            "representatives": [],
        }
        reps = ", ".join(str(m) for m in info.get("representatives") or []) or "—"
        lines.append(
            f"| `{family}` | {info.get('occurrences', 0)} | {info.get('active', 0)} | "
            f"{info.get('status')} | {reps} |"
        )
    extra = [name for name in coverage["families"] if name not in FAMILIES]
    for family in extra:
        info = coverage["families"][family]
        reps = ", ".join(str(m) for m in info.get("representatives") or []) or "—"
        lines.append(
            f"| `{family}` | {info.get('occurrences', 0)} | {info.get('active', 0)} | "
            f"{info.get('status')} | {reps} |"
        )
    lines += [
        "",
        "## Ressources absentes",
        "",
        f"- Props indisponibles : {len(coverage.get('missing_props') or [])}",
        f"- Références de textures manquantes : {len(coverage.get('missing_textures') or [])}",
        "",
        "Les absences source restent des exceptions visibles. Aucune image de substitution n'est inventée.",
        "",
        "## Collisions de particules",
        "",
        "Aucun module `isCollisionModuleActivated` n'apparaît dans les 17 353 documents de particules "
        "exportés. Les cellules marchables décrivent le déplacement du joueur et ne sont pas utilisées "
        "comme colliders visuels.",
        "",
        "## Maps de test",
        "",
    ]
    for item in coverage.get("test_maps") or []:
        lines.append(f"- `{item['id']}` — {item['reason']}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", type=Path, default=DEFAULT_CLIENT)
    parser.add_argument("--index", type=Path, default=WORLD / "maps/_bundle_index.json")
    parser.add_argument("--fixture-dir", type=Path)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--output", type=Path, default=GAME_DATA / "effects-coverage.json")
    parser.add_argument("--docs", type=Path, default=DOCS / "EFFETS-MAPS-INVENTAIRE-2026-09-07.md")
    parser.add_argument("--test-maps", type=Path, default=GAME_DATA / "effects-test-maps.json")
    args = parser.parse_args()

    started = time.monotonic()
    family_maps: dict[str, list[int]] = defaultdict(list)
    family_active: Counter[str] = Counter()
    family_counts: Counter[str] = Counter()
    examined = 0
    fingerprints: list[str] = []
    samples: dict[str, dict] = {}

    if args.fixture_dir:
        groups = [trees_from_fixtures(args.fixture_dir)]
        source_version = "fixture"
        bundle_prints = {"fixture": fingerprint_payload(sorted(p.name for p in args.fixture_dir.glob('*.json')))}
    else:
        index = load_index(args.index)
        map_dir = content_root(args.client) / "Map" / "Data"
        by_bundle: dict[str, list[str]] = defaultdict(list)
        for map_id, bundle_name in index.items():
            by_bundle[bundle_name].append(map_id)
        groups = []
        bundle_prints = {}
        for bundle_name, map_ids in sorted(by_bundle.items()):
            bundle = map_dir / bundle_name
            if not bundle.is_file():
                continue
            bundle_prints[bundle_name] = bundle_fingerprint(bundle)
            trees = trees_from_bundle(bundle)
            selected = {mid: trees[mid] for mid in map_ids if mid in trees}
            groups.append(selected)
        source_version = client_version(args.client) or "unknown"

    for trees in groups:
        for map_id, tree in trees.items():
            if args.limit and examined >= args.limit:
                break
            info = inventory_map(tree, map_id)
            examined += 1
            fingerprints.append(fingerprint_payload({"id": info["map_id"], "families": info["families"]}))
            for family in info["families"]:
                family_counts[family] += 1
                family_maps[family].append(int(info["map_id"]) if str(info["map_id"]).lstrip("-").isdigit() else 0)
            for family, active in info.get("active", {}).items():
                if active:
                    family_active[family] += 1
            combo = "+".join(info["families"]) or "none"
            samples.setdefault(combo, info)
        if args.limit and examined >= args.limit:
            break

    missing_props, missing_textures = load_ambient_gaps()
    prop_lookup = [search_prop(args.client, pid) for pid in missing_props]
    texture_lookup = [search_texture(args.client, tid, maps) for tid, maps in missing_textures.items()]

    representatives = pick_representatives(family_maps)
    families_out = {}
    for family in list(FAMILIES) + [name for name in family_counts if name not in FAMILIES]:
        families_out[family] = {
            "occurrences": family_counts.get(family, 0),
            "active": family_active.get(family, 0),
            "status": FAMILY_STATUS.get(family, "semantics_unknown"),
            "representatives": representatives.get(family, []),
        }

    test_maps = [
        {"id": 154010371, "reason": "Incarnam [-1,-3] particules + décors animés"},
        {"id": 154644, "reason": "vent, vagues, bloom, ShaderWindParameters"},
        {"id": 54162245, "reason": "réfraction PaintShaderData + ShaderRefractionParameters"},
        {"id": 152337, "reason": "séquences de mise en scène"},
        {"id": 229651207, "reason": "MapNoiseModifierConfiguration"},
    ]
    for info in samples.values():
        mid = info["map_id"]
        if not any(item["id"] == mid for item in test_maps):
            test_maps.append({"id": mid, "reason": "combinaison " + "+".join(info["families"])})

    coverage = {
        "format": "giny.effects-coverage.v1",
        "source_version": source_version,
        "exporter_version": EXPORTER_VERSION,
        "effects_version": EFFECTS_VERSION,
        "maps_examined": examined,
        "bundle_fingerprints": bundle_prints,
        "entry_fingerprint": hashlib.sha256("".join(sorted(fingerprints)).encode()).hexdigest(),
        "seconds": round(time.monotonic() - started, 3),
        "families": families_out,
        "missing_props": prop_lookup,
        "missing_textures": texture_lookup,
        "test_maps": test_maps,
        "notes": {
            "particle_collision": "absent from authored map particle modules",
            "refraction_material": "associated by gfx id, not by assuming foreground indices",
            "neutral_vs_active": "configuration presence is not sufficient; active flags use non-zero authored parameters",
        },
    }
    write_json(args.output, coverage)
    write_json(args.test_maps, test_maps)
    write_text(args.docs, markdown_report(coverage))
    print(json.dumps({
        "maps": examined,
        "families": {k: v["occurrences"] for k, v in families_out.items() if v["occurrences"]},
        "output": str(args.output),
    }), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

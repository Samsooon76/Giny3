#!/usr/bin/env python3
"""Verify a prepared world pack against the effects inventory. No Unity launch."""
from __future__ import annotations

import argparse
import gzip
import json
import importlib.util
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
# Read the pure-data contract without importing maps/__init__, which loads UnityPy.
# Verification needs neither Unity nor the extractor's binary dependencies.
spec = importlib.util.spec_from_file_location("effects_contract", BASE.parent / "dofus3/extractor/maps/effects.py")
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)
EFFECTS_VERSION, FAMILIES = contract.EFFECTS_VERSION, contract.FAMILIES


def effect_readiness(coverage, expected_maps, resources_complete):
    """Re-evaluate old inventories against today's renderer, not old release claims."""
    families = (coverage or {}).get("families") or {}
    unsupported = {}
    for name in FAMILIES:
        info = families.get(name)
        if not isinstance(info, dict):
            unsupported[name] = "coverage_missing"
            continue
        if not info.get("active", info.get("occurrences", 0)):
            continue
        source_status = info.get("status")
        runtime_status = contract.FAMILY_STATUS.get(name, "render_absent")
        if source_status in ("source_missing", "invalid", "export_incomplete"):
            unsupported[name] = source_status
        elif runtime_status != "supported":
            unsupported[name] = runtime_status
        elif not source_status:
            unsupported[name] = "coverage_missing"
    complete = bool(coverage) and coverage.get("maps_examined") == expected_maps and resources_complete and not unsupported
    return {"effects_complete": bool(complete), "unsupported_effect_families": unsupported}


def read(path: Path):
    raw = path.read_bytes()
    if path.suffix == ".gz" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=BASE / "game-data")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    root = args.root
    coverage_path = root / "effects-coverage.json"
    manifest_path = root / "optimized" / "manifest.json"
    issues = []
    coverage = read(coverage_path) if coverage_path.exists() else None
    if coverage is None:
        issues.append("missing effects-coverage.json")
    elif coverage.get("maps_examined") != 17353 and coverage.get("source_version") != "fixture":
        issues.append(f"coverage maps_examined={coverage.get('maps_examined')}")
    if coverage:
        for family in FAMILIES:
            if family not in coverage.get("families", {}):
                issues.append(f"family missing from coverage: {family}")
    if not manifest_path.exists():
        issues.append("missing optimized/manifest.json")
        print(json.dumps({"ok": False, "issues": issues}, indent=2))
        return 1
    manifest = read(manifest_path)
    checked = 0
    missing_deps = []
    unknown_version = []
    for mid, entry in manifest.get("maps", {}).items():
        if args.limit and checked >= args.limit:
            break
        path = root / (entry["path"] + ".gz")
        if not path.exists():
            path = root / entry["path"]
        if not path.exists():
            issues.append(f"missing map blob {mid}")
            continue
        doc = read(path)
        if doc.get("effects_version", 0) not in (0, EFFECTS_VERSION):
            unknown_version.append(int(mid))
        for dep in doc.get("effect_dependencies") or []:
            rel = dep.get("path")
            if not rel:
                continue
            if not (root / rel).exists():
                missing_deps.append({"map": int(mid), "path": rel, "category": dep.get("category"), "id": dep.get("id")})
        for effect in doc.get("refraction") or []:
            gid = str(effect.get("gfx_id"))
            gfx = doc.get("gfx", {}).get(gid)
            if not gfx:
                missing_deps.append({"map": int(mid), "category": "refraction_gfx", "id": gid})
            elif not (root / gfx["texture"]).exists():
                missing_deps.append({"map": int(mid), "category": "refraction_gfx", "id": gid, "path": gfx["texture"]})
        checked += 1
    unique_missing = {}
    for dependency in missing_deps:
        key = dependency.get("path") or f"{dependency.get('category')}/{dependency.get('id')}"
        if key not in unique_missing:
            unique_missing[key] = {k: v for k, v in dependency.items() if k != "map"}
            unique_missing[key]["maps"] = []
        unique_missing[key]["maps"].append(dependency["map"])
    report = {
        "ok": not issues and not missing_deps[:1] and not unknown_version,
        "maps_checked": checked,
        "issues": issues,
        "missing_dependencies": missing_deps[:50],
        "missing_dependency_count": len(missing_deps),
        "unique_missing_dependencies": list(unique_missing.values()),
        "unique_missing_dependency_count": len(unique_missing),
        "unknown_effects_version": unknown_version[:20],
        "scan_complete": checked == len(manifest.get("maps", {})),
        **effect_readiness(coverage, len(manifest.get("maps", {})),
                           not issues and not missing_deps and not unknown_version
                           and checked == len(manifest.get("maps", {}))),
    }
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

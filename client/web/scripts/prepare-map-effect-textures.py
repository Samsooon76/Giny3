#!/usr/bin/env python3
"""Export map effect textures with qualified categories. Numeric-only lookup is a fallback."""
from __future__ import annotations

import io
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE / "dofus3"))
from extractor.unity_loader import DEFAULT_CLIENT, content_root, load_bundle

WORLD = BASE / "dofus3/.cache/dofus3/world"
TARGET = BASE / "web/game-data"
CATEGORIES = ("particles", "noises", "masks", "emissives", "windModels", "wave")
LOSSLESS = {"noises", "masks", "windModels", "wave"}


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def main() -> None:
    bundle = content_root(DEFAULT_CLIENT) / "Map" / "Textures" / "Effects" / "mapeffects_assets_all.bundle"
    env = load_bundle(bundle)
    catalog = {}
    qualified = {}
    for name, ptr in env.container.items():
        relative = name.split("/effects/")[-1] if "/effects/" in name else name.split("effects/")[-1]
        category = relative.split("/")[0]
        if category not in CATEGORIES:
            # Keep unknown folders instead of dropping them.
            if "/" not in relative:
                continue
        rel = "effects/" + relative.replace("\\", "/")
        try:
            texture = ptr.read()
        except Exception:
            continue
        image = getattr(texture, "image", None)
        if image is None:
            continue
        for root in (WORLD, TARGET):
            dest = root / rel
            if not dest.exists():
                buf = io.BytesIO()
                image.save(buf, format="PNG")
                atomic_write(dest, buf.getvalue())
            elif dest.stat().st_size == 0:
                continue
        stem = Path(rel).stem
        try:
            ident = int(stem)
        except ValueError:
            ident = -1
        entry = {
            "category": category,
            "id": ident,
            "path": rel,
            "width": int(getattr(texture, "m_Width", 0) or 0),
            "height": int(getattr(texture, "m_Height", 0) or 0),
            "lossless": category in LOSSLESS,
        }
        catalog[rel] = entry
        if ident >= 0:
            qualified[f"{category}/{ident}"] = entry
    for root in (WORLD, TARGET):
        atomic_write(root / "effects/catalog.json", json.dumps(catalog, separators=(",", ":")).encode())
        atomic_write(root / "effects/qualified-catalog.json", json.dumps(qualified, separators=(",", ":")).encode())
    # Deprecated numeric table: last writer wins, qualified catalog is authoritative.
    paths = {}
    for key, entry in qualified.items():
        paths[str(entry["id"])] = entry["path"]
    ts = BASE / "web/src/game/particles/effectTexturePaths.ts"
    ts.write_text(
        "/** Generated from the local effect texture catalog by prepare-map-effect-textures.py. */\n"
        "const paths: Record<string, string> = "
        + json.dumps(paths, separators=(",", ":"))
        + "\nexport const effectTexturePath = (id: number): string | undefined => paths[String(id)]\n"
        "export const QUALIFIED_EFFECT_TEXTURES: Record<string, string> = "
        + json.dumps({k: v["path"] for k, v in qualified.items()}, separators=(",", ":"))
        + "\nexport const effectTexturePathQualified = (category: string, id: number): string | undefined => "
        "QUALIFIED_EFFECT_TEXTURES[`${category}/${id}`]\n"
    )
    print("Exported", len(catalog), "effect textures in", len({e["category"] for e in catalog.values()}), "categories")


if __name__ == "__main__":
    main()

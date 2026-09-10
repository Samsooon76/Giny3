"""Compose a `{bone|skins|…}` look: bone animations + extra SkinAsset parts."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path
from typing import Any

from extractor.entities.export_bone import _part_payload, export_bone
from extractor.unity_loader import content_root, iter_monobehaviours, load_bundle


def parse_look(raw: str) -> tuple[int, list[int]]:
    text = raw.strip()
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    fields = text.split("|")
    bone = int(fields[0]) if fields and fields[0].isdigit() else 0
    skins = [int(token) for token in (fields[1].split(",") if len(fields) > 1 else []) if token.isdigit()]
    return bone, skins


def _load_entity_json(path: Path) -> dict[str, Any] | None:
    try:
        if path.name.endswith(".gz"):
            with gzip.open(path, "rt", encoding="utf-8") as handle:
                data = json.load(handle)
        else:
            data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def document_has_drawable_frames(doc: dict[str, Any]) -> bool:
    """True when at least one adapted node would survive and resolve a part.

    The web adapter drops `drawable: false` / `visible: false` nodes and any
    node without `part_ref`/`graphic`. Overlaying SkinAsset parts onto a
    player bone-1 v1 decode yields graphic ids that are not in `parts`, so
    the client reports `has no animations`.
    """
    parts = doc.get("parts")
    animations = doc.get("animations")
    if not isinstance(parts, dict) or not isinstance(animations, dict):
        return False
    for anim in animations.values():
        if not isinstance(anim, dict):
            continue
        for frame in anim.get("frames") or []:
            if not isinstance(frame, list):
                continue
            for node in frame:
                if not isinstance(node, dict):
                    continue
                if node.get("visible") is False or node.get("drawable") is False:
                    continue
                ref = node.get("part_ref") or node.get("partRef") or node.get("graphic")
                if ref is None or ref == "":
                    continue
                if str(ref) in parts:
                    return True
    return False


def reuse_existing_look(dest: Path) -> Path | None:
    """Keep a drawable look already on disk; never hide it with a broken `.json`.

    Vite and Electron serve `name.json` in preference to `name.json.gz`. A
    v1 rewrite of the player look therefore shadows the working v2 gzip.

    v1 entity documents (raw animation graphic ids used as part names) render
    incomplete meshes plus solid-colour plates; they are never reused so the
    caller re-exports them as v2 (resolved `part_ref` names).
    """
    if dest.is_file():
        doc = _load_entity_json(dest)
        if doc and document_has_drawable_frames(doc):
            if doc.get("format") == "giny.dofus3.entity.v2":
                return dest
    gz = Path(str(dest) + ".gz")
    if gz.is_file():
        doc = _load_entity_json(gz)
        if doc and document_has_drawable_frames(doc):
            if doc.get("format") == "giny.dofus3.entity.v2":
                if dest.is_file():
                    dest.unlink()
                return dest
    return None


def export_skin(client_root: Path, skin_id: int, output_dir: Path) -> Path:
    """Write `entities/skins/{id}.json` + the skin texture PNG."""
    bundle = content_root(client_root) / "Characters" / "Skins" / f"skins_assets_skin_{skin_id}.bundle"
    if not bundle.is_file():
        raise FileNotFoundError(bundle)
    dest_json = Path(output_dir) / "entities" / "skins" / f"{skin_id}.json"
    if dest_json.exists():
        cached = _load_entity_json(dest_json)
        if cached and cached.get("format") == "giny.dofus3.skin.v2":
            return dest_json
    env = load_bundle(bundle)
    skin = None
    textures: dict[int, Any] = {}
    for _obj, tree in iter_monobehaviours(env):
        values = tree.get("m_values") or [{}]
        if "vertices" in tree and "skinChunks" in (values[0] or {}):
            skin = tree
    for obj in env.objects:
        if obj.type.name == "Texture2D":
            textures[obj.path_id] = obj.read()
    if skin is None:
        raise RuntimeError(f"no SkinAsset in {bundle.name}")
    tex_refs = skin.get("textures") or []
    if not tex_refs:
        raise RuntimeError(f"SkinAsset {skin_id} has no textures")
    tex = textures.get(int(tex_refs[0]["m_PathID"]))
    if tex is None:
        raise RuntimeError(f"Texture2D missing for skin {skin_id}")
    out_tex = Path(output_dir) / "textures"
    out_tex.mkdir(parents=True, exist_ok=True)
    tex_name = f"skin_{skin_id}.png"
    tex.image.save(out_tex / tex_name)
    vertices = skin["vertices"]
    triangles = [int(x) for x in skin["triangles"]]
    parts = {}
    texture_path = f"textures/{tex_name}"
    for part in skin["m_values"]:
        payload = _part_payload(part, vertices, triangles)
        symbols = skin.get("referencedSymbols") or []
        ancestry = []
        leaf_index = 0
        for index, entry in enumerate(payload["display_list"]):
            ancestry = [(end, color) for end, color in ancestry if end >= index]
            symbol_id = entry["symbol_id"]
            name = symbols[symbol_id] if 0 <= symbol_id < len(symbols) else ""
            match = re.search(r"ColorGray_(\d+)_", name, re.IGNORECASE)
            color = int(match.group(1)) if match else (ancestry[-1][1] if ancestry else None)
            if entry["entries"] >= 0:
                ancestry.append((index + entry["entries"], color))
            elif leaf_index < len(payload["chunks"]):
                payload["chunks"][leaf_index]["indexed_color"] = color
                leaf_index += 1
        for chunk in payload["chunks"]:
            chunk["texture"] = texture_path
        parts[payload["name"]] = payload
    dest_json.parent.mkdir(parents=True, exist_ok=True)
    dest_json.write_text(json.dumps({
        "format": "giny.dofus3.skin.v2",
        "empty_customisations": skin.get("emptyCustomisations") or [],
        "skin_id": skin_id,
        "texture": texture_path,
        "parts": parts,
    }, indent=2))
    return dest_json


def load_slot_rules(data_dir: Path | None = None) -> dict[str, Any]:
    """Load skinslotsrules.json.gz from data_dir or output/data."""
    candidates = []
    if data_dir:
        candidates.append(data_dir / "skinslotsrules.json.gz")
        candidates.append(data_dir / "data" / "skinslotsrules.json.gz")
    root_data = Path(__file__).resolve().parent.parent.parent / "output" / "data" / "skinslotsrules.json.gz"
    candidates.append(root_data)
    for path in candidates:
        if path.is_file():
            try:
                with gzip.open(path, "rt", encoding="utf-8") as handle:
                    return json.load(handle)
            except Exception:
                pass
    return {}


def apply_slot_rules(doc: dict[str, Any], skin_ids: list[int], data_dir: Path | None = None) -> None:
    """Mask parts in doc according to slot rules for the equipped skins."""
    rules = load_slot_rules(data_dir)
    if not rules:
        return

    masked_part_prefixes: set[str] = set()
    for sid in skin_ids:
        rule_entry = rules.get(str(sid))
        if not rule_entry:
            continue
        for rule in rule_entry.get("slotRulesList", []):
            for sr in rule.get("slotsRules", []):
                slot_id = sr.get("id")
                mask = sr.get("mask", 0)
                if mask != 0:
                    if slot_id in (0, 1, 5, 6, 20):
                        masked_part_prefixes.update(["cheveux", "cheveuxcrane", "natte", "natte_basse", "nattehaute", "patte"])
                    if slot_id in (7, 8, 9, 10):
                        masked_part_prefixes.update(["cape", "capebas"])

    if not masked_part_prefixes:
        return

    for anim in (doc.get("animations") or {}).values():
        if not isinstance(anim, dict):
            continue
        for frame in anim.get("frames") or []:
            if not isinstance(frame, list):
                continue
            for node in frame:
                if not isinstance(node, dict):
                    continue
                part_ref = str(node.get("part_ref") or node.get("slot_name") or "").lower()
                part_name = str(node.get("part_name") or "").lower()
                for prefix in masked_part_prefixes:
                    if prefix in part_ref or prefix in part_name:
                        node["visible"] = False
                        node["drawable"] = False


def export_look(client_root: Path, look: str, output_dir: Path, scale: float = 1.05) -> Path:
    """Bone + overlay skins → `entities/look_{bone}_{skins}.json`.

    Player bone 1 is split across static/combat/movement bundles; the v1
    decoder does not produce drawable `part_ref` frames for it. If a composed
    v2 document is already on disk, return that path and do not clobber it.
    """
    bone_id, skin_ids = parse_look(look)
    if not bone_id:
        raise ValueError(f"look illisible : {look}")
    stem = f"look_{bone_id}" + (f"_{'_'.join(str(s) for s in skin_ids)}" if skin_ids else "_base")
    dest = Path(output_dir) / "entities" / f"{stem}.json"
    existing = reuse_existing_look(dest)
    if existing is not None:
        return existing
    bone_path = export_bone(client_root, bone_id, output_dir, scale=scale)
    doc = json.loads(bone_path.read_text(encoding="utf-8"))
    for skin_id in skin_ids:
        try:
            skin_path = export_skin(client_root, skin_id, output_dir)
        except (FileNotFoundError, RuntimeError):
            continue
        skin = json.loads(skin_path.read_text(encoding="utf-8"))
        doc.setdefault("parts", {}).update(skin.get("parts") or {})
    apply_slot_rules(doc, skin_ids, Path(output_dir) / "data")
    if not document_has_drawable_frames(doc):
        raise RuntimeError(
            f"look {look} : le bone {bone_id} n'a aucune frame drawable "
            "(le document précomposé v2 ne doit pas être écrasé)"
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(doc, indent=2))
    return dest

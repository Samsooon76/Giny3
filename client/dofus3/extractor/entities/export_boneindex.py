"""Export BoneIndex from Dofus 3 bundle to output/data/boneindex.json.

Maps bone -> class -> anim -> bundle file.
Ex: Bone 1 -> Class 0 -> AnimStatiqueExplo0 -> 1-static
    Bone 1 -> Class 1 -> AnimAttaque101 -> 1-1-combat
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from extractor.unity_loader import content_root, iter_monobehaviours, load_bundle


def parse_boneindex_tree(tree: dict[str, Any]) -> dict[str, dict[str, dict[str, str]]]:
    """Convert raw MonoBehaviour typetree of BoneIndexData to nested dict."""
    abi = tree.get("animationsBoneIndex") or {}
    keys = abi.get("m_keys") or []
    values = abi.get("m_values") or []

    index: dict[str, dict[str, dict[str, str]]] = {}
    for bone_key, bone_val in zip(keys, values):
        classes_dict: dict[str, dict[str, str]] = {}
        c_keys = bone_val.get("m_keys") or []
        c_values = bone_val.get("m_values") or []
        for class_key, class_val in zip(c_keys, c_values):
            anim_dict: dict[str, str] = {}
            a_keys = class_val.get("m_keys") or []
            a_values = class_val.get("m_values") or []
            for anim_key, anim_val in zip(a_keys, a_values):
                anim_dict[str(anim_key)] = str(anim_val)
            classes_dict[str(class_key)] = anim_dict
        index[str(bone_key)] = classes_dict
    return index


def export_boneindex(client_root: Path, output_dir: Path) -> Path:
    bundle_path = content_root(client_root) / "Characters" / "Bones" / "bones_assets_boneindexdata.bundle"
    if not bundle_path.is_file():
        raise FileNotFoundError(f"BoneIndex bundle not found: {bundle_path}")

    env = load_bundle(bundle_path)
    tree_found = None
    for _obj, tree in iter_monobehaviours(env):
        if "animationsBoneIndex" in tree:
            tree_found = tree
            break

    if tree_found is None:
        raise RuntimeError(f"No animationsBoneIndex found in {bundle_path.name}")

    index = parse_boneindex_tree(tree_found)

    data_dir = output_dir if output_dir.name == "data" else output_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    dest = data_dir / "boneindex.json"
    dest.write_text(json.dumps(index, indent=2), encoding="utf-8")
    return dest

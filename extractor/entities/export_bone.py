"""Extract AnimatedObjectDefinition + SkinAsset + texture + animations."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from extractor.animations.decoder import DecodeError, decode_animation, expand_frames
from extractor.animations.prop_decoder import decode_prop_frames
from extractor.unity_loader import content_root, iter_monobehaviours, load_bundle


def _as_bytes(value: Any) -> bytes:
    if value is None:
        return b""
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    if isinstance(value, list):
        return bytes(int(x) & 0xFF for x in value)
    raise TypeError(f"cannot coerce {type(value)} to bytes")


def _argb_u32(value: int) -> list[float]:
    """Unpack a packed color. Hypothesis: channels are 0..128 with 128 ≈ 1.0."""
    a = ((value >> 24) & 0xFF) / 128.0
    r = ((value >> 16) & 0xFF) / 128.0
    g = ((value >> 8) & 0xFF) / 128.0
    b = (value & 0xFF) / 128.0
    return [r, g, b, a]


def _part_payload(part: dict[str, Any], vertices: list[dict], triangles: list[int]) -> dict[str, Any]:
    chunks = []
    for ch in part.get("skinChunks") or []:
        start_v = int(ch["startVertexIndex"])
        vcount = int(ch["vertexCount"])
        start_i = int(ch["startIndexIndex"])
        icount = int(ch["indexCount"])
        local_indices = [int(x) for x in triangles[start_i : start_i + icount]]
        # Indices are chunk-local (verified: idx_max == vertexCount-1 even when
        # startVertexIndex is in the hundreds).
        verts = []
        for v in vertices[start_v : start_v + vcount]:
            pos = v["pos"]
            uv = v["uv"]
            verts.append(
                {
                    "x": float(pos["x"]),
                    "y": float(pos["y"]),
                    "u": float(uv["x"]),
                    "v": float(uv["y"]),
                    "mul": _argb_u32(int(v.get("multiplicativeColor") or 0)),
                    "add": _argb_u32(int(v.get("additiveColor") or 0)),
                    "mul_u32": int(v.get("multiplicativeColor") or 0),
                    "add_u32": int(v.get("additiveColor") or 0),
                }
            )
        chunks.append(
            {
                "texture_index": int(ch.get("textureIndex") or 0),
                "mask_state": int(ch.get("maskState") or 0),
                "vertices": verts,
                "indices": local_indices,
            }
        )
    dle = []
    for entry in part.get("DisplayListEntry") or []:
        tr = entry.get("transform") or {}
        dle.append(
            {
                "symbol_id": int(entry.get("symbolId", -1)),
                "entries": int(entry.get("entries", -1)),
                "transform": {
                    "rX": float(tr.get("rX") or 0),
                    "uX": float(tr.get("uX") or 0),
                    "rY": float(tr.get("rY") or 0),
                    "uY": float(tr.get("uY") or 0),
                    "tX": float(tr.get("tX") or 0),
                    "tY": float(tr.get("tY") or 0),
                },
            }
        )
    return {"name": str(part["name"]), "display_list": dle, "chunks": chunks}


def _animation_wanted(name: str, names: set[str], default_idle_walk: bool) -> bool:
    if "*" in names:
        return True
    if name in names:
        return True
    for pattern in names:
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            # ``AnimState*`` must not swallow character ``AnimStatique*``.
            if prefix == "AnimState" and name.startswith("AnimStatique"):
                continue
            if name.startswith(prefix):
                return True
    return default_idle_walk and any(
        name.startswith(prefix) for prefix in ("AnimStatique", "AnimMarche", "AnimCourse")
    )


def resolve_part_ref(graphic: Any, gfx_order: list[Any]) -> str | None:
    """Map an animation ``graphic`` id to its SkinAsset part name.

    Proven by exact official-bounds matches (e.g. bone 4924
    ``AnimStatique_3`` over 60 frames: calc x-119.6 w197.1 y-32.6 h202.5 vs
    recorded x-119.6 w197.1 y-32.6 h202.5, plus ~20 idle/walk clips on bones
    556/4907/714/231/284/6399): the id is a **0-based index** into
    ``AnimatedObjectDefinition.graphics``, not a part name. Out-of-range ids
    fall back to the raw id as a name for backward compatibility.
    """
    try:
        idx = int(str(graphic))
    except (TypeError, ValueError):
        return str(graphic) if graphic not in (None, "") else None
    if 0 <= idx < len(gfx_order) and gfx_order[idx] not in (None, ""):
        return str(gfx_order[idx])
    return str(graphic)


def _resolve_frame_nodes(
    snap: list[Any], gfx_order: list[Any], exposed_names: list[str] | None = None
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for st in snap:
        node = st.to_json()
        if exposed_names is not None and st.customisation >= 0:
            slot = exposed_names[st.customisation]
            node.update(part_ref="@slot:" + slot, slot_name=slot, drawable=st.mask in (0, 2))
            out.append(node)
            continue
        graphic = node.get("graphic")
        if graphic is not None and graphic != "":
            resolved = resolve_part_ref(graphic, gfx_order)
            if resolved:
                node["part_ref"] = resolved
        out.append(node)
    return out


def export_animated_bundle(
    bundle: Path,
    output_dir: Path,
    object_id: int,
    dest_name: str,
    scale: float = 1.05,
    animation_filter: set[str] | None = None,
    default_idle_walk: bool = True,
    extra_fields: dict[str, Any] | None = None,
    native: bool = False,
    customisable: bool = False,
) -> Path:
    """Decode one AnimatedObjectDefinition bundle into an entity JSON + PNG.

    Shared by character bones and map props: callers pick the bundle path,
    output filename, and which animation names to keep.
    """
    if not bundle.is_file():
        raise FileNotFoundError(bundle)

    if animation_filter is None:
        animation_filter = {
            "AnimStatique_1",
            "AnimStatique_5",
            "AnimMarche_1",
            "AnimMarche_5",
        }

    env = load_bundle(bundle)
    aod = None
    skins: dict[int, dict[str, Any]] = {}
    textures: dict[int, Any] = {}

    for obj, tree in iter_monobehaviours(env):
        if "graphics" in tree and "animations" in tree:
            aod = tree
        elif "vertices" in tree and "skinChunks" in (tree.get("m_values") or [{}])[0]:
            skins[obj.path_id] = tree

    for obj in env.objects:
        if obj.type.name == "Texture2D":
            textures[obj.path_id] = obj.read()

    if aod is None:
        raise RuntimeError(f"no AnimatedObjectDefinition in {bundle}")

    bone_pid = int(aod["boneAsset"]["m_PathID"])
    skin = skins.get(bone_pid)
    if skin is None:
        raise RuntimeError(f"SkinAsset {bone_pid} missing (have {list(skins)})")

    tex_refs = skin.get("textures") or []
    if not tex_refs:
        raise RuntimeError("SkinAsset has no textures")
    tex_pid = int(tex_refs[0]["m_PathID"])
    tex = textures.get(tex_pid)
    if tex is None:
        raise RuntimeError(f"Texture2D {tex_pid} missing")

    out_ent = output_dir / "entities"
    out_tex = output_dir / "textures"
    out_ent.mkdir(parents=True, exist_ok=True)
    out_tex.mkdir(parents=True, exist_ok=True)

    tex_name = f"{tex.m_Name}.png"
    tex.image.save(out_tex / tex_name)

    vertices = skin["vertices"]
    triangles = [int(x) for x in skin["triangles"]]
    parts = {}
    for part in skin["m_values"]:
        payload = _part_payload(part, vertices, triangles)
        parts[payload["name"]] = payload

    anims_out: dict[str, Any] = {}
    skipped: list[str] = []

    # Animation graphic ids are 0-based indices into aod.graphics (proven by
    # exact official-bounds matches). Resolve once per bundle.
    gfx_order: list[Any] = [(g.get("part") or {}).get("name") for g in aod.get("graphics") or []]

    def _decode_named(names: set[str]) -> None:
        for anim in aod["animations"]:
            name = anim["name"]
            if not _animation_wanted(name, names, default_idle_walk) or name in anims_out:
                continue
            raw = _as_bytes(anim.get("dataBytes"))
            try:
                if native or dest_name.startswith('prop_'):
                    metadata, states = decode_prop_frames(raw)
                else:
                    decoded = decode_animation(raw, name)
                    states = expand_frames(decoded)
                    metadata = {
                        "frame_count": decoded.frame_count, "record_count": decoded.record_count,
                        "format_flags": decoded.format_flags,
                        "events": [{"frame": e.frame, "text": e.text} for e in decoded.events],
                    }
            except DecodeError:
                skipped.append(name)
                continue
            anims_out[name] = {
                **metadata,
                "bounds": {key: value if not isinstance(value, float) or math.isfinite(value) else None for key, value in (anim.get("bounds") or {}).items()},
                "frames": [_resolve_frame_nodes(snap, gfx_order, aod.get("exposedNodeNames") if customisable else None) for snap in states],
            }

    _decode_named(animation_filter)
    # NPC bones often lack the four POC clips; keep whatever decoded rather
    # than writing an empty animations object the web client rejects.
    if not anims_out:
        skipped.clear()
        _decode_named({"*"})

    doc = {
        "format": "giny.dofus3.entity.v2",
        "color_encoding": "signed-rgba-flags-v2" if native or dest_name.startswith('prop_') else "legacy",
        "bone_id": object_id,
        "name": aod.get("m_Name"),
        "scale": scale,
        "frame_rate": int(aod.get("defaultFrameRate") or 25),
        "max_node_count": int(aod.get("maxNodeCount") or 0),
        "default_animation_name": aod.get("defaultAnimationName") or "",
        "exposed_node_names": aod.get("exposedNodeNames") or [],
        "maskable_nodes": aod.get("maskableNodes") or [],
        "texture": f"textures/{tex_name}",
        "parts": parts,
        "animations": anims_out,
        "skipped_animations": skipped,
        "notes": {
            "coordinate_space": "unity_y_up_pixels",
            "index_space": "chunk_local",
            "root_node": 0,
            "parent_mapping": "unknown_assume_parent_is_root",
            "graphic_mapping": "animation graphic id is a 0-based index into aod.graphics; resolved to part_ref",
        },
    }
    if extra_fields:
        doc.update(extra_fields)
    dest = out_ent / dest_name
    dest.write_text(json.dumps(doc, indent=2))
    return dest


def export_bone(
    client_root: Path,
    bone_id: int,
    output_dir: Path,
    scale: float = 1.05,
    animation_filter: set[str] | None = None,
) -> Path:
    """Write ``output/entities/{bone_id}.json`` + texture PNG.

    ``animation_filter`` defaults to idle/walk for the POC. Pass ``None``
    (the default here is idle/walk) or a set of names. Use ``{"*"}`` for all.
    """
    default_idle_walk = animation_filter is None
    bones = content_root(client_root) / "Characters" / "Bones"
    bundle = bones / f"bones_assets_bone_{bone_id}.bundle"
    if not bundle.is_file():
        # Player bones are `bone_{id}-{variant}-static.bundle`.
        matches = sorted(bones.glob(f"bones_assets_bone_{bone_id}-*-static.bundle"))
        bundle = matches[0] if matches else bundle
    return export_animated_bundle(
        bundle,
        output_dir,
        bone_id,
        dest_name=f"{bone_id}.json",
        scale=scale,
        animation_filter=animation_filter,
        default_idle_walk=default_idle_walk,
    )

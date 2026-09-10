"""Normalize map visual effects without dropping useful source parameters.

Runtime packs keep compact, versioned fields. Audit dumps may retain extra
raw blocks. Texture numbers are always qualified by category: the same integer
in ``mapgfx``, ``particles``, ``noises`` or ``masks`` is not the same file.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

EFFECTS_VERSION = 1
EXPORTER_VERSION = "map-effects-3"
NULL_RID = -2
EPS = 1e-6

# Statuses used by the inventory and the runtime coverage block.
STATUS_SUPPORTED = "supported"
STATUS_EXPORT_INCOMPLETE = "export_incomplete"
STATUS_RENDER_ABSENT = "render_absent"
STATUS_SOURCE_MISSING = "source_missing"
STATUS_INVALID = "invalid"
STATUS_SEMANTICS_UNKNOWN = "semantics_unknown"

FAMILIES = (
    "wind_config",
    "wave_config",
    "noise_config",
    "postprocess_config",
    "refraction",
    "particles",
    "animated_props",
    "staging_sequences",
    "shader_wind",
    "shader_wave",
    "shader_dissolve",
    "shader_distortion",
    "shader_emissive",
    "shader_refraction",
    "shader_rotation",
    "shader_scale",
    "shader_translation",
    "shader_color_animation",
    "shader_texture_offset",
    "shader_outline",
    "shader_custom_framerate",
    "shader_depth_alpha_clip",
    "pp_bloom",
    "pp_chromatic",
    "pp_film_grain",
    "paint_shader",
    "particles_shader",
    "animator2d_filters",
    "animator2d_masks",
    "particle_collision",
    "localized_sounds",
)

# Runtime support, not extraction completeness. Parameter preservation alone is not rendering.
FAMILY_STATUS = {
    "wind_config": STATUS_SUPPORTED,
    "wave_config": STATUS_SEMANTICS_UNKNOWN,
    "noise_config": STATUS_RENDER_ABSENT,
    "postprocess_config": STATUS_SEMANTICS_UNKNOWN,
    "refraction": STATUS_SUPPORTED,
    "particles": STATUS_SUPPORTED,
    "animated_props": STATUS_SUPPORTED,
    "staging_sequences": STATUS_SEMANTICS_UNKNOWN,
    "shader_wind": STATUS_SUPPORTED,
    "shader_wave": STATUS_SEMANTICS_UNKNOWN,
    "shader_dissolve": STATUS_SEMANTICS_UNKNOWN,
    "shader_distortion": STATUS_SEMANTICS_UNKNOWN,
    "shader_emissive": STATUS_SEMANTICS_UNKNOWN,
    "shader_rotation": STATUS_SUPPORTED,
    "shader_scale": STATUS_SUPPORTED,
    "shader_translation": STATUS_SUPPORTED,
    "shader_color_animation": STATUS_SEMANTICS_UNKNOWN,
    "shader_texture_offset": STATUS_SEMANTICS_UNKNOWN,
    "shader_refraction": STATUS_SUPPORTED,
    "shader_outline": STATUS_RENDER_ABSENT,
    "shader_custom_framerate": STATUS_RENDER_ABSENT,
    "shader_depth_alpha_clip": STATUS_SEMANTICS_UNKNOWN,
    "pp_bloom": STATUS_SEMANTICS_UNKNOWN,
    "pp_chromatic": STATUS_SUPPORTED,
    "pp_film_grain": STATUS_SUPPORTED,
    "paint_shader": STATUS_SUPPORTED,
    "particles_shader": STATUS_SUPPORTED,
    "animator2d_filters": STATUS_SUPPORTED,
    "animator2d_masks": STATUS_SUPPORTED,
    # No collision volumes are present on the 17 353 exported maps; walkable
    # cells are player navigation, not particle colliders.
    "particle_collision": STATUS_SOURCE_MISSING,
    "localized_sounds": STATUS_RENDER_ABSENT,
}

PARAM_FAMILY = {
    "ShaderWindParameters": "shader_wind",
    "ShaderWaveParameters": "shader_wave",
    "ShaderDissolveParameters": "shader_dissolve",
    "ShaderDistortionParameters": "shader_distortion",
    "ShaderEmissiveParameters": "shader_emissive",
    "ShaderRefractionParameters": "shader_refraction",
    "ShaderRotationParameters": "shader_rotation",
    "ShaderScaleParameters": "shader_scale",
    "ShaderTranslationParameters": "shader_translation",
    "ShaderColorAnimationParameters": "shader_color_animation",
    "ShaderTextureOffsetParameters": "shader_texture_offset",
    "ShaderOutlineParameters": "shader_outline",
    "ShaderCustomFramerateParameters": "shader_custom_framerate",
    "ShaderDepthAlphaClipParameters": "shader_depth_alpha_clip",
    "ShaderBlendingParameters": None,
    "PPBloomParameters": "pp_bloom",
    "PPChromaticAberrationParameters": "pp_chromatic",
    "PPFilmGrainParameters": "pp_film_grain",
}

_BLEND_ZERO = 0
_BLEND_ONE = 1
_BLEND_DST_COLOR = 2
_BLEND_SRC_COLOR = 3
_BLEND_SRC_ALPHA = 5
_BLEND_ONE_MINUS_SRC_ALPHA = 10
BRIGHTEN = "brighten"

BLEND_MODES = {
    (_BLEND_ONE, _BLEND_ONE_MINUS_SRC_ALPHA): "normal",
    (_BLEND_DST_COLOR, _BLEND_ONE_MINUS_SRC_ALPHA): "multiply",
    (_BLEND_ONE, _BLEND_ONE): "add",
    (_BLEND_SRC_ALPHA, _BLEND_ONE): "add",
    (_BLEND_DST_COLOR, _BLEND_ONE): BRIGHTEN,
    (_BLEND_SRC_COLOR, _BLEND_ONE): BRIGHTEN,
    (_BLEND_ZERO, _BLEND_ONE): "none",
}

DEFAULT_BLEND = {
    "ShaderData": "normal",
    "PaintShaderData": "normal",
    "ParticlesShaderData": "none",
}

NEUTRAL_MATERIAL = {"shader": "", "blend": "normal", "gfx_id": 0, "parameters": {}}

# Field → category. Two equal numbers in different categories stay distinct.
TEXTURE_FIELDS: dict[str, str] = {
    "noiseTexID": "noises",
    "frequencyNoiseTexID": "noises",
    "mainWindNoiseTexID": "noises",
    "swingNoiseTexID": "noises",
    "windModelTexID": "windModels",
    "mapNoiseModifierTexId": "noises",
    "waveDynamicsTexID": "wave",
    "waveDissolveDynamicsTexID": "wave",
    "waveDistoTexID": "noises",
    "dissolveTexID": "noises",
    "flowmapID": "noises",
    "dissolveMaskID": "masks",
    "maskTexID": "masks",
    "emissiveTexID": "emissives",
    "waveTexID": "mapgfx",
}

# id 0 is a real noises/0.png, but for masks/models it means "none".
ZERO_MEANS_NONE = {
    "dissolveMaskID",
    "maskTexID",
    "windModelTexID",
    "flowmapID",
    "emissiveTexID",
    "frequencyNoiseTexID",
}

LAYER_MATERIAL_KEYS = {
    "background": "backgroundMaterialData",
    "sortable": "sortableMaterialData",
    "foreground": "foregroundMaterialData",
}


def compact_value(value: Any) -> Any:
    if isinstance(value, list):
        return [compact_value(v) for v in value]
    if isinstance(value, float):
        if not math.isfinite(value):
            return "Infinity" if value > 0 else "-Infinity" if value < 0 else None
        return value
    if not isinstance(value, dict):
        return value
    return {k: compact_value(v) for k, v in value.items()}


def as_float(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, bool) or value is None:
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, dict) and "value" in value:
        return as_float(value.get("value"), fallback)
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def as_int(value: Any, fallback: int = 0) -> int:
    if isinstance(value, bool) or value is None:
        return fallback
    if isinstance(value, dict) and "value" in value:
        return as_int(value.get("value"), fallback)
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def vec2(value: Any, fallback: tuple[float, float] = (0.0, 0.0)) -> dict[str, float]:
    if not isinstance(value, dict):
        return {"x": fallback[0], "y": fallback[1]}
    return {"x": as_float(value.get("x"), fallback[0]), "y": as_float(value.get("y"), fallback[1])}


def vec3(value: Any, fallback: float = 0.0) -> dict[str, float]:
    if not isinstance(value, dict):
        return {"x": fallback, "y": fallback, "z": fallback}
    return {
        "x": as_float(value.get("x"), fallback),
        "y": as_float(value.get("y"), fallback),
        "z": as_float(value.get("z"), fallback),
    }


def color_u32(value: Any, fallback: int = 0xFFFFFFFF) -> int:
    if isinstance(value, dict):
        return as_int(value.get("value"), fallback)
    return as_int(value, fallback)


def nonzero(value: float) -> bool:
    return abs(value) > EPS


_QUALIFIED: dict[str, Any] | None = None


def qualified_catalog() -> dict[str, Any]:
    """Load the prepared effect catalog so nested wave/mask paths stay exact."""
    global _QUALIFIED
    if _QUALIFIED is not None:
        return _QUALIFIED
    root = Path(__file__).resolve().parents[3]
    for candidate in (
        root / "web" / "game-data" / "effects" / "qualified-catalog.json",
        root / "dofus3" / ".cache" / "dofus3" / "world" / "effects" / "qualified-catalog.json",
    ):
        if candidate.is_file():
            try:
                _QUALIFIED = json.loads(candidate.read_text())
                return _QUALIFIED
            except (OSError, json.JSONDecodeError):
                continue
    _QUALIFIED = {}
    return _QUALIFIED


def prepared_path(category: str, source_id: int) -> str:
    if category == "mapgfx":
        return f"gfx/{source_id}.png"
    entry = qualified_catalog().get(f"{category}/{source_id}")
    if isinstance(entry, dict) and entry.get("path"):
        return str(entry["path"])
    return f"effects/{category}/{source_id}.png"


def texture_ref(category: str, source_id: Any, *, field: str = "") -> dict[str, Any] | None:
    if source_id is None:
        return None
    try:
        ident = int(source_id)
    except (TypeError, ValueError):
        return None
    if ident < 0:
        return None
    if ident == 0 and field in ZERO_MEANS_NONE:
        return None
    cat = category
    if field == "waveTexID" and ident >= 10000:
        cat = "mapgfx"
    elif field == "waveTexID":
        cat = "noises"
    return {
        "category": cat,
        "id": ident,
        "path": prepared_path(cat, ident),
        "field": field or None,
    }


def classify_field(field: str) -> str | None:
    if field in TEXTURE_FIELDS:
        return TEXTURE_FIELDS[field]
    if field.startswith("waveDissolveTexID"):
        return "noises"
    if field.endswith("TexID") or field.endswith("TexId"):
        lowered = field.lower()
        if "mask" in lowered:
            return "masks"
        if "emissive" in lowered:
            return "emissives"
        if "windmodel" in lowered or "wind_model" in lowered:
            return "windModels"
        if "noise" in lowered or "disto" in lowered or "dissolve" in lowered:
            return "noises"
        return "noises"
    return None


def collect_texture_refs(data: Any, acc: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    acc = acc if acc is not None else []
    if isinstance(data, list):
        for item in data:
            collect_texture_refs(item, acc)
        return acc
    if not isinstance(data, dict):
        return acc
    for key, value in data.items():
        category = classify_field(key)
        if category is not None and not isinstance(value, (dict, list)):
            ref = texture_ref(category, value, field=key)
            if ref is not None:
                acc.append(ref)
        else:
            collect_texture_refs(value, acc)
    return acc


def ref_data_by_rid(tree: dict[str, Any]) -> dict[int, tuple[dict[str, Any], str]]:
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


def resolve_rid(value: Any, index: dict[int, tuple[dict[str, Any], str]]) -> tuple[dict[str, Any], str] | None:
    if isinstance(value, dict) and "rid" in value:
        rid = as_int(value.get("rid"), NULL_RID)
        if rid <= 0:
            return None
        return index.get(rid)
    return None


def map_data(tree: dict[str, Any]) -> dict[str, Any]:
    md = tree.get("mapData")
    return md if isinstance(md, dict) else tree


def blend_from_parameters(data: dict[str, Any]) -> tuple[str | None, dict[str, int]]:
    raw = {
        "source_factor": as_int(data.get("sourceFactor")),
        "destination_factor": as_int(data.get("destinationFactor")),
        "blend_operation": as_int(data.get("blendOperation")),
    }
    if raw["blend_operation"] != 0:
        return "unsupported", raw
    named = BLEND_MODES.get((raw["source_factor"], raw["destination_factor"]))
    if named is None:
        return "unsupported", raw
    return named, raw


def convert_parameter_block(class_name: str, data: dict[str, Any]) -> dict[str, Any]:
    """Keep the source type and compact every useful field, including unknowns."""
    block = compact_value(data) if isinstance(data, dict) else {}
    if not isinstance(block, dict):
        block = {}
    block["_type"] = class_name
    refs = collect_texture_refs(data)
    if class_name == "PPFilmGrainParameters" and as_float(block.get("intensity")) > 0:
        grain_type = as_int(block.get("type"), 0)
        if 0 <= grain_type <= 9:
            refs.append({"category": "grain", "id": grain_type,
                         "path": f"effects/grain/{grain_type}.png", "field": "type"})
    if refs:
        # Stable unique refs for the runtime pack.
        seen: set[tuple[str, int]] = set()
        unique = []
        for ref in refs:
            key = (ref["category"], ref["id"])
            if key in seen:
                continue
            seen.add(key)
            unique.append(ref)
        block["_textures"] = unique
    return block


def resolve_material_entry(
    data: dict[str, Any],
    shader: str,
    index: dict[int, tuple[dict[str, Any], str]],
) -> dict[str, Any]:
    blend: str | None = None
    blend_raw: dict[str, int] | None = None
    parameters: dict[str, Any] = {}
    uniforms: dict[str, Any] = {}
    for ref in data.get("shaderParameters") or []:
        resolved = resolve_rid(ref, index) if isinstance(ref, dict) else None
        if resolved is None:
            continue
        p_data, p_class = resolved
        converted = convert_parameter_block(p_class, p_data)
        parameters[p_class] = converted
        if p_class == "ShaderBlendingParameters":
            blend, blend_raw = blend_from_parameters(p_data)
        elif p_class == "ShaderWindParameters":
            uniforms["flexibility"] = as_float(p_data.get("flexibility"))
            uniforms["shouldSwing"] = as_int(p_data.get("shouldSwing"))
        elif p_class == "ShaderWaveParameters":
            uniforms["waveTexID"] = as_int(p_data.get("waveTexID"), -1)
        elif p_class == "ShaderRotationParameters":
            uniforms["frequency"] = as_float(p_data.get("frequency"))
            uniforms["amplitude"] = as_float(p_data.get("amplitude"))
        elif p_class == "ShaderTranslationParameters":
            uniforms["speed"] = as_float(p_data.get("frequency"))
            uniforms["intensity"] = as_float(p_data.get("amplitude"))
    # Direct fields on the shader data (rare, kept for completeness).
    for key, value in data.items():
        if key in ("shaderParameters", "gfxId", "unique", "isStagingTarget", "stagingId", "paintSpanOrder", "background"):
            continue
        if key not in uniforms:
            uniforms[key] = compact_value(value)

    material: dict[str, Any] = {
        "shader": shader,
        "blend": blend or DEFAULT_BLEND.get(shader, "normal"),
        "gfx_id": as_int(data.get("gfxId")),
        "parameters": parameters,
        "staging_id": str(data.get("stagingId") or ""),
        "unique": bool(data.get("unique")),
    }
    if blend_raw is not None:
        material["blend_raw"] = blend_raw
    if shader == "PaintShaderData":
        material["paint_span_order"] = as_int(data.get("paintSpanOrder"))
        material["background"] = as_int(data.get("background"))
    if uniforms:
        material["uniforms"] = uniforms
    gfx_category = "particles" if shader == "ParticlesShaderData" else "mapgfx"
    gfx_ref = texture_ref(gfx_category, material["gfx_id"], field="gfxId")
    if gfx_ref is not None:
        material["albedo"] = gfx_ref
    return material


def resolve_material_table(tree: dict[str, Any], material_key: str) -> list[dict[str, Any]]:
    md = map_data(tree)
    entries = (md.get(material_key) or {}).get("shaderData") or [] if isinstance(md, dict) else []
    index = ref_data_by_rid(tree)
    table: list[dict[str, Any]] = []
    for entry in entries:
        resolved = resolve_rid(entry, index) if isinstance(entry, dict) else None
        if resolved is None:
            table.append(dict(NEUTRAL_MATERIAL))
            continue
        data, shader = resolved
        table.append(resolve_material_entry(data, shader, index))
    return table


def resolve_all_material_tables(tree: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    return {layer: resolve_material_table(tree, key) for layer, key in LAYER_MATERIAL_KEYS.items()}


def _config_payload(tree: dict[str, Any], field: str, wrapper: str) -> dict[str, Any] | None:
    md = map_data(tree)
    index = ref_data_by_rid(tree)
    resolved = resolve_rid(md.get(field), index)
    if resolved is None:
        return None
    data, class_name = resolved
    inner = data.get(wrapper) if isinstance(data, dict) else None
    payload = inner if isinstance(inner, dict) else data
    if not isinstance(payload, dict):
        return None
    out = compact_value(payload)
    out["_type"] = class_name
    refs = collect_texture_refs(payload)
    if refs:
        out["_textures"] = refs
    return out


def wind_active(params: dict[str, Any] | None) -> bool:
    if not params:
        return False
    return (
        nonzero(as_float(params.get("windPower")))
        or nonzero(as_float(params.get("mainWindAmplitudeMultiplier")))
        or nonzero(as_float(params.get("swingAmplitudeMultiplier")))
    )


def wave_active(params: dict[str, Any] | None) -> bool:
    if not params:
        return False
    if nonzero(as_float(params.get("waveFrequency"))) or nonzero(as_float(params.get("waveDistoPower"))):
        return True
    for i in range(1, 5):
        if nonzero(as_float(params.get(f"waveDissolvePower{i}"))):
            return True
    return False


def noise_active(params: dict[str, Any] | None) -> bool:
    if not params:
        return False
    if as_int(params.get("mapNoiseModifierTexId"), -1) > 0:
        return True
    tiling = params.get("mapNoiseModifierTiling") or {}
    speed = params.get("mapNoiseModifierSpeed") or {}
    return any(nonzero(as_float(v)) for v in (tiling.get("x"), tiling.get("y"), speed.get("x"), speed.get("y")))


def postprocess_active(blocks: list[dict[str, Any]]) -> bool:
    for block in blocks:
        kind = block.get("_type")
        if kind == "PPBloomParameters" and nonzero(as_float(block.get("intensity"))):
            return True
        if kind == "PPChromaticAberrationParameters" and nonzero(as_float(block.get("intensity"))):
            return True
        if kind == "PPFilmGrainParameters" and nonzero(as_float(block.get("intensity"))):
            return True
    return False


def resolve_environment(tree: dict[str, Any]) -> dict[str, Any]:
    index = ref_data_by_rid(tree)
    wind = _config_payload(tree, "mapWindConfiguration", "windParameters")
    wave = _config_payload(tree, "mapWaveConfiguration", "waveParameters")
    noise = _config_payload(tree, "mapNoiseModifierConfiguration", "noiseModifierParameters")
    pp_root = resolve_rid(map_data(tree).get("mapPostProcessConfiguration"), index)
    post_blocks: list[dict[str, Any]] = []
    if pp_root is not None:
        data, class_name = pp_root
        for ref in data.get("postProcessParameters") or []:
            resolved = resolve_rid(ref, index)
            if resolved is None:
                continue
            post_blocks.append(convert_parameter_block(resolved[1], resolved[0]))
        if not post_blocks:
            post_blocks.append({"_type": class_name})
    return {
        "wind": {"active": wind_active(wind), "parameters": wind},
        "wave": {"active": wave_active(wave), "parameters": wave},
        "noise": {"active": noise_active(noise), "parameters": noise},
        "post_process": {"active": postprocess_active(post_blocks), "parameters": post_blocks},
    }


def associate_refraction_material(
    element: dict[str, Any],
    tables: dict[str, list[dict[str, Any]]],
) -> tuple[str, int, dict[str, Any]]:
    """Pick the material table whose gfx actually belongs to this element.

    Indices are layer-local. Matching gfx_id on the foreground table is the
    usual case, but it is not assumed.
    """
    index = as_int(element.get("materialIndex"))
    gfx_id = as_int(element.get("gfxId"))
    preferred = ("foreground", "sortable", "background")
    for layer in preferred:
        table = tables.get(layer) or []
        if 0 <= index < len(table) and as_int(table[index].get("gfx_id")) == gfx_id:
            return layer, index, table[index]
    for layer in preferred:
        table = tables.get(layer) or []
        for i, material in enumerate(table):
            if as_int(material.get("gfx_id")) == gfx_id:
                return layer, i, material
    for layer in preferred:
        table = tables.get(layer) or []
        if 0 <= index < len(table):
            return layer, index, table[index]
    return "foreground", index, dict(NEUTRAL_MATERIAL)


def resolve_refraction(
    tree: dict[str, Any],
    tables: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    md = map_data(tree)
    out: list[dict[str, Any]] = []
    for order, raw in enumerate(md.get("refractionElements") or []):
        if not isinstance(raw, dict):
            continue
        layer, material_index, material = associate_refraction_material(raw, tables)
        tr = raw.get("transform") or {}
        item = {
            "order": order,
            "gfx_id": as_int(raw.get("gfxId")),
            "layer": "refraction",
            "host_material_layer": layer,
            "material_index": material_index,
            "display_behaviour": as_int(raw.get("displayBehaviour")),
            "color_u32": color_u32(raw.get("color"), 0x808080),
            "transform": {
                "m11": as_float(tr.get("m11"), 1),
                "m12": as_float(tr.get("m12"), 0),
                "m21": as_float(tr.get("m21"), 0),
                "m22": as_float(tr.get("m22"), 1),
                "m31": as_float(tr.get("m31"), 0),
                "m32": as_float(tr.get("m32"), 0),
            },
            "shader": material.get("shader") or "",
            "blend": material.get("blend") or "normal",
            "parameters": material.get("parameters") or {},
        }
        if material.get("blend_raw"):
            item["blend_raw"] = material["blend_raw"]
        if material.get("uniforms"):
            item["uniforms"] = material["uniforms"]
        out.append(item)
    return out


def _shot_effects(raw: Any, index: dict[int, tuple[dict[str, Any], str]]) -> list[dict[str, Any]]:
    effects: list[dict[str, Any]] = []
    packs = raw.get("stagingEffectsPacks") if isinstance(raw, dict) else None
    entries = packs if isinstance(packs, list) else []
    for pack in entries:
        if not isinstance(pack, dict):
            continue
        targets = pack.get("targets")
        for effect_ref in pack.get("stagingEffects") or []:
            resolved = resolve_rid(effect_ref, index)
            if resolved is None:
                continue
            data, class_name = resolved
            effects.append(
                {
                    "type": class_name,
                    "targets": compact_value(targets),
                    "parameters": convert_parameter_block(class_name, data),
                    "visual": class_name
                    not in (
                        "PlayFmodEventStagingEffect",
                        "StopLocalizedFmodEventsStagingEffect",
                        "SetFmodParamStagingEffect",
                    ),
                }
            )
    return effects


def resolve_sequences(tree: dict[str, Any]) -> list[dict[str, Any]]:
    md = map_data(tree)
    index = ref_data_by_rid(tree)
    out: list[dict[str, Any]] = []
    for raw_ref in md.get("stagingSequences") or []:
        resolved = resolve_rid(raw_ref, index)
        if resolved is None and isinstance(raw_ref, dict) and "id" in raw_ref:
            data, class_name = raw_ref, "StagingSequence"
        elif resolved is None:
            continue
        else:
            data, class_name = resolved
        shots = []
        for shot in data.get("stagingShots") or []:
            if not isinstance(shot, dict):
                continue
            shots.append(
                {
                    "id": str(shot.get("id") or ""),
                    "previous_shot": str(shot.get("previousShot") or ""),
                    "delay": as_float(shot.get("delay")),
                    "duration": as_float(shot.get("duration")),
                    "skip_if_instant": bool(shot.get("skipIfInstant")),
                    "effects": _shot_effects(shot, index),
                }
            )
        out.append(
            {
                "id": str(data.get("id") or ""),
                "unique_id": as_int(data.get("uniqueId")),
                "exclusive_group_id": str(data.get("exclusiveGroupId") or ""),
                "exclusivity_resolve_method": as_int(data.get("exclusivityResolveMethod")),
                "type": class_name,
                "shots": shots,
            }
        )
    return out


def iter_texture_refs(value: Any) -> Iterable[dict[str, Any]]:
    if value is None:
        return
    if isinstance(value, dict):
        if "category" in value and "id" in value:
            yield value
            return
        if "_textures" in value:
            for ref in value["_textures"] or []:
                yield from iter_texture_refs(ref)
            return
        for nested in value.values():
            yield from iter_texture_refs(nested)
        return
    if isinstance(value, (list, tuple)):
        for nested in value:
            yield from iter_texture_refs(nested)


def flatten_dependencies(*groups: Any) -> list[dict[str, Any]]:
    seen: set[tuple[str, int]] = set()
    out: list[dict[str, Any]] = []
    for group in groups:
        for ref in iter_texture_refs(group):
            key = (str(ref["category"]), as_int(ref.get("id"), -1))
            if key[1] < 0 or key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "category": key[0],
                    "id": key[1],
                    "path": ref.get("path") or prepared_path(key[0], key[1]),
                }
            )
    return out


def coverage_for(environment: dict[str, Any], tables: dict[str, list[dict[str, Any]]], refraction: list[dict[str, Any]], sequences: list[dict[str, Any]], particles: list[dict[str, Any]], extra: Iterable[str] = ()) -> dict[str, Any]:
    families: set[str] = set(extra)
    if environment["wind"]["parameters"] is not None:
        families.add("wind_config")
    if environment["wave"]["parameters"] is not None:
        families.add("wave_config")
    if environment["noise"]["parameters"] is not None:
        families.add("noise_config")
    if environment["post_process"]["parameters"]:
        families.add("postprocess_config")
        for block in environment["post_process"]["parameters"]:
            mapped = PARAM_FAMILY.get(str(block.get("_type") or ""))
            if mapped:
                families.add(mapped)
    if refraction:
        families.add("refraction")
    if particles:
        families.add("particles")
        for particle in particles:
            modules = particle.get("particlesModulesParameters") or {}
            if modules.get("isCollisionModuleActivated") or particle.get("particlesCollisionParameters"):
                families.add("particle_collision")
    if sequences:
        families.add("staging_sequences")
    for table in tables.values():
        for material in table:
            shader = material.get("shader") or ""
            if shader == "PaintShaderData":
                families.add("paint_shader")
            elif shader == "ParticlesShaderData":
                families.add("particles_shader")
            for p_class in material.get("parameters") or {}:
                mapped = PARAM_FAMILY.get(p_class)
                if mapped:
                    families.add(mapped)
    for item in refraction:
        for p_class in item.get("parameters") or {}:
            mapped = PARAM_FAMILY.get(p_class)
            if mapped:
                families.add(mapped)
    used = sorted(families)
    issues = []
    for family in used:
        status = FAMILY_STATUS.get(family, STATUS_SEMANTICS_UNKNOWN)
        if status != STATUS_SUPPORTED:
            issues.append({"family": family, "status": status})
    return {
        "families": used,
        "status": {family: FAMILY_STATUS.get(family, STATUS_SEMANTICS_UNKNOWN) for family in used},
        "issues": issues,
        "complete": not issues,
    }


def inventory_map(tree: dict[str, Any], map_id: int | str = 0) -> dict[str, Any]:
    """Classify every observed effect family on one Unity typetree."""
    md = map_data(tree)
    index = ref_data_by_rid(tree)
    tables = resolve_all_material_tables(tree)
    environment = resolve_environment(tree)
    refraction = resolve_refraction(tree, tables)
    sequences = resolve_sequences(tree)
    particles = md.get("particlesParameters") or []
    animated = md.get("animatedElements") or []
    families: set[str] = set()
    if environment["wind"]["parameters"] is not None:
        families.add("wind_config")
    if environment["wave"]["parameters"] is not None:
        families.add("wave_config")
    if environment["noise"]["parameters"] is not None:
        families.add("noise_config")
    if environment["post_process"]["parameters"]:
        families.add("postprocess_config")
    if refraction:
        families.add("refraction")
    if particles:
        families.add("particles")
    if animated:
        families.add("animated_props")
    if sequences:
        families.add("staging_sequences")
    if md.get("localizedSounds"):
        families.add("localized_sounds")
    param_counts: Counter[str] = Counter()
    for _rid, (data, class_name) in index.items():
        mapped = PARAM_FAMILY.get(class_name)
        if mapped:
            families.add(mapped)
            param_counts[class_name] += 1
        if class_name == "MapWindConfiguration":
            families.add("wind_config")
        elif class_name == "MapWaveConfiguration":
            families.add("wave_config")
        elif class_name == "MapNoiseModifierConfiguration":
            families.add("noise_config")
        elif class_name == "MapPostProcessConfiguration":
            families.add("postprocess_config")
        elif class_name == "StagingSequence":
            families.add("staging_sequences")
        elif class_name == "PaintShaderData":
            families.add("paint_shader")
        elif class_name == "ParticlesShaderData":
            families.add("particles_shader")
    for particle in particles:
        if not isinstance(particle, dict):
            continue
        modules = particle.get("particlesModulesParameters") or {}
        if isinstance(modules, dict) and (
            modules.get("isCollisionModuleActivated") or "particlesCollisionParameters" in particle
        ):
            families.add("particle_collision")
    active = {
        "wind_config": environment["wind"]["active"],
        "wave_config": environment["wave"]["active"],
        "noise_config": environment["noise"]["active"],
        "postprocess_config": environment["post_process"]["active"],
        "refraction": bool(refraction),
        "particles": bool(particles),
        "animated_props": bool(animated),
        "staging_sequences": bool(sequences),
    }
    coverage = coverage_for(environment, tables, refraction, sequences, particles if isinstance(particles, list) else [], families)
    return {
        "map_id": int(map_id) if str(map_id).lstrip("-").isdigit() else map_id,
        "families": sorted(families),
        "active": {k: v for k, v in active.items() if k in families},
        "parameter_types": dict(param_counts),
        "refraction_count": len(refraction),
        "particle_count": len(particles) if isinstance(particles, list) else 0,
        "animated_count": len(animated) if isinstance(animated, list) else 0,
        "sequence_count": len(sequences),
        "coverage": coverage,
        "texture_refs": flatten_dependencies(environment, tables, refraction),
    }


def qualify_particle_material(material: dict[str, Any]) -> dict[str, Any]:
    gfx_id = as_int(material.get("gfxId"), -1)
    if gfx_id >= 0 and "texture" not in material:
        ref = texture_ref("particles", gfx_id, field="gfxId")
        if ref is not None:
            material = dict(material)
            material["textureRef"] = ref
    textures = flatten_dependencies(material.get("parameters") or {})
    if textures:
        material = dict(material)
        material["effectTextures"] = textures
    return material


def build_effects_document(
    tree: dict[str, Any],
    *,
    particles: list[dict[str, Any]] | None = None,
    extra_families: Iterable[str] = (),
) -> dict[str, Any]:
    tables = resolve_all_material_tables(tree)
    environment = resolve_environment(tree)
    refraction = resolve_refraction(tree, tables)
    sequences = resolve_sequences(tree)
    particle_list = particles if particles is not None else []
    qualified = []
    for particle in particle_list:
        item = dict(particle)
        if isinstance(item.get("material"), dict):
            item["material"] = qualify_particle_material(item["material"])
        if isinstance(item.get("trailMaterial"), dict):
            item["trailMaterial"] = qualify_particle_material(item["trailMaterial"])
        qualified.append(item)
    md = map_data(tree)
    extras = list(extra_families)
    if md.get("animatedElements"):
        extras.append("animated_props")
    if md.get("localizedSounds"):
        extras.append("localized_sounds")
    coverage = coverage_for(environment, tables, refraction, sequences, qualified, extras)
    dependencies = flatten_dependencies(environment, tables, refraction, qualified)
    return {
        "effects_version": EFFECTS_VERSION,
        "exporter_version": EXPORTER_VERSION,
        "environment": environment,
        "materials": tables,
        "refraction": refraction,
        "effect_sequences": sequences,
        "effect_dependencies": dependencies,
        "effect_coverage": coverage,
        "particles": qualified,
    }


def fingerprint_payload(payload: Any) -> str:
    raw = json.dumps(compact_value(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()

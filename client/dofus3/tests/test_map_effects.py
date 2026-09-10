import json
from pathlib import Path

from extractor.maps.effects import (
    EFFECTS_VERSION,
    STATUS_SOURCE_MISSING,
    associate_refraction_material,
    blend_from_parameters,
    build_effects_document,
    compact_value,
    flatten_dependencies,
    inventory_map,
    resolve_environment,
    resolve_material_table,
    texture_ref,
    wave_active,
    wind_active,
)
from extractor.maps.export_map import build_map_document


def tree_with_refs(map_data, refs):
    return {
        "mapData": map_data,
        "references": {
            "RefIds": [
                {"rid": rid, "type": {"class": class_name}, "data": data}
                for rid, class_name, data in refs
            ]
        },
    }


def test_texture_refs_keep_categories_distinct():
    noise = texture_ref("noises", 1, field="noiseTexID")
    particle = texture_ref("particles", 1, field="gfxId")
    mask = texture_ref("masks", 1, field="maskTexID")
    assert noise["path"] == "effects/noises/1.png"
    assert particle["path"] == "effects/particles/1.png"
    assert mask["path"] == "effects/masks/1.png"
    assert noise["id"] == particle["id"] == mask["id"]
    assert len({noise["path"], particle["path"], mask["path"]}) == 3
    assert texture_ref("masks", 0, field="maskTexID") is None
    assert texture_ref("noises", 0, field="noiseTexID")["path"] == "effects/noises/0.png"


def test_unknown_blend_is_marked_not_normalized_to_normal():
    named, raw = blend_from_parameters({"sourceFactor": 7, "destinationFactor": 4, "blendOperation": 0})
    assert named == "unsupported"
    assert raw["source_factor"] == 7
    op, _ = blend_from_parameters({"sourceFactor": 1, "destinationFactor": 1, "blendOperation": 2})
    assert op == "unsupported"


def test_compact_preserves_step_tangents_and_rejects_nan_json():
    compact = compact_value({"keys": [{"outTangent": float("inf"), "inTangent": float("-inf"), "value": 3}]})
    assert compact["keys"][0]["outTangent"] == "Infinity"
    assert compact["keys"][0]["inTangent"] == "-Infinity"
    json.dumps(compact, allow_nan=False)


def test_inline_and_rid_materials_keep_parameter_types():
    tree = tree_with_refs(
        {
            "backgroundMaterialData": {"shaderData": [{"rid": 1}]},
            "sortableMaterialData": {"shaderData": []},
            "foregroundMaterialData": {"shaderData": []},
        },
        [
            (1, "ShaderData", {"gfxId": 10, "shaderParameters": [{"rid": 2}, {"rid": 3}]}),
            (2, "ShaderBlendingParameters", {"sourceFactor": 1, "destinationFactor": 1, "blendOperation": 0}),
            (3, "ShaderWindParameters", {"flexibility": 0.7, "shouldSwing": 1, "bendAxe": {"x": 0, "y": 1}}),
        ],
    )
    table = resolve_material_table(tree, "backgroundMaterialData")
    assert table[0]["shader"] == "ShaderData"
    assert table[0]["blend"] == "add"
    assert table[0]["parameters"]["ShaderWindParameters"]["_type"] == "ShaderWindParameters"
    assert table[0]["parameters"]["ShaderWindParameters"]["flexibility"] == 0.7
    assert table[0]["blend_raw"]["source_factor"] == 1


def test_null_rid_configs_are_inactive_and_absent():
    tree = {
        "mapData": {
            "mapWindConfiguration": {"rid": -2},
            "mapWaveConfiguration": {"rid": -2},
            "mapNoiseModifierConfiguration": {"rid": -2},
            "mapPostProcessConfiguration": {"rid": -2},
            "backgroundMaterialData": {"shaderData": []},
            "sortableMaterialData": {"shaderData": []},
            "foregroundMaterialData": {"shaderData": []},
        }
    }
    env = resolve_environment(tree)
    assert env["wind"]["parameters"] is None and env["wind"]["active"] is False
    assert env["wave"]["active"] is False
    assert env["noise"]["active"] is False
    assert env["post_process"]["active"] is False


def test_wind_and_wave_distinguish_neutral_from_active():
    assert wind_active({"windPower": 0, "mainWindAmplitudeMultiplier": 0}) is False
    assert wind_active({"windPower": 0.5, "mainWindAmplitudeMultiplier": 0.75}) is True
    assert wave_active({"waveFrequency": 0, "waveDistoPower": 0, "waveDissolvePower1": 0}) is False
    assert wave_active({"waveFrequency": 0.16, "waveDistoPower": 0.06}) is True


def test_refraction_associates_by_gfx_not_foreground_index_guess():
    tables = {
        "background": [{"gfx_id": 2039, "shader": "ParticlesShaderData"}],
        "sortable": [{"gfx_id": 306111, "shader": "ShaderData"}],
        "foreground": [
            {"gfx_id": 1, "shader": "ShaderData"},
            {"gfx_id": 2, "shader": "ShaderData"},
            {"gfx_id": 3, "shader": "ShaderData"},
            {"gfx_id": 4, "shader": "ShaderData"},
            {"gfx_id": 57971, "shader": "PaintShaderData", "parameters": {"ShaderRefractionParameters": {"strength": 8.6}}},
        ],
    }
    layer, index, material = associate_refraction_material({"gfxId": 57971, "materialIndex": 4}, tables)
    assert layer == "foreground" and index == 4
    assert material["shader"] == "PaintShaderData"
    # Same index on another table would be the wrong sprite.
    layer, index, material = associate_refraction_material({"gfxId": 57971, "materialIndex": 0}, tables)
    assert layer == "foreground" and material["gfx_id"] == 57971


def test_matrix_and_alpha_survive_effects_document():
    tree = tree_with_refs(
        {
            "refractionElements": [
                {
                    "gfxId": 9,
                    "materialIndex": 0,
                    "displayBehaviour": 1,
                    "color": {"value": 0x80808080},
                    "transform": {"m11": 1.2, "m12": 0, "m21": 0, "m22": 0.5, "m31": 10, "m32": 20},
                }
            ],
            "foregroundMaterialData": {"shaderData": [{"rid": 1}]},
            "backgroundMaterialData": {"shaderData": []},
            "sortableMaterialData": {"shaderData": []},
            "mapWindConfiguration": {"rid": -2},
            "mapWaveConfiguration": {"rid": -2},
            "mapNoiseModifierConfiguration": {"rid": -2},
            "mapPostProcessConfiguration": {"rid": -2},
        },
        [
            (1, "PaintShaderData", {"gfxId": 9, "shaderParameters": [{"rid": 2}]}),
            (2, "ShaderRefractionParameters", {"noiseTexID": 1, "strength": 8.6, "maskTexID": 0}),
        ],
    )
    doc = build_effects_document(tree, particles=[])
    assert doc["effects_version"] == EFFECTS_VERSION
    item = doc["refraction"][0]
    assert item["transform"]["m11"] == 1.2 and item["transform"]["m32"] == 20
    assert item["color_u32"] == 0x80808080
    assert item["host_material_layer"] == "foreground"
    assert item["parameters"]["ShaderRefractionParameters"]["strength"] == 8.6
    deps = { (d["category"], d["id"]) for d in doc["effect_dependencies"] }
    assert ("noises", 1) in deps
    assert ("masks", 0) not in deps


def test_collision_family_is_source_missing_when_absent():
    info = inventory_map({"mapData": {"particlesParameters": [{"id": "a"}], "backgroundMaterialData": {"shaderData": []}, "sortableMaterialData": {"shaderData": []}, "foregroundMaterialData": {"shaderData": []}}})
    assert "particles" in info["families"]
    assert "particle_collision" not in info["families"]
    from extractor.maps.effects import FAMILY_STATUS
    assert FAMILY_STATUS["particle_collision"] == STATUS_SOURCE_MISSING


def test_build_map_document_keeps_maps_without_effects_valid(tmp_path):
    tree = {"mapData": {"cellsData": [{"cellNumber": i, "mov": 1, "visible": 1} for i in range(560)]}}
    doc = build_map_document(Path("/unused"), 42, tmp_path, source=(Path("test.bundle"), tree), sprite_catalog={})
    assert doc["format"] == "giny.dofus3.map.v3"
    assert doc["effects_version"] == EFFECTS_VERSION
    assert doc["environment"]["wind"]["active"] is False
    assert doc["refraction"] == []
    assert doc["effect_coverage"]["families"] == [] or isinstance(doc["effect_coverage"]["families"], list)
    json.dumps(doc, allow_nan=False)


def test_flatten_does_not_confuse_equal_numeric_ids():
    refs = flatten_dependencies(
        {"_textures": [texture_ref("noises", 12, field="noiseTexID"), texture_ref("masks", 12, field="maskTexID")]}
    )
    paths = {item["path"] for item in refs}
    assert paths == {"effects/noises/12.png", "effects/masks/12.png"}


def test_film_grain_preset_zero_is_a_qualified_dependency():
    from extractor.maps.effects import convert_parameter_block
    block = convert_parameter_block('PPFilmGrainParameters', {'type': 0, 'intensity': .3, 'response': .8})
    assert flatten_dependencies(block) == [{'category': 'grain', 'id': 0, 'path': 'effects/grain/0.png'}]
    neutral = convert_parameter_block('PPFilmGrainParameters', {'type': 0, 'intensity': 0, 'response': .8})
    assert flatten_dependencies(neutral) == []

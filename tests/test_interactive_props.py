"""Map interactiveElements → props, plus prop animation / ensure-data wiring."""

from __future__ import annotations

from pathlib import Path

from extractor.entities.export_bone import _animation_wanted
from extractor.maps.export_map import (
    _element,
    _mean_luminance,
    material_table,
    resolve_brighten,
    resolve_element_dict,
    resolve_interactive_props,
)

DOOR_TRANSFORM = {
    "m11": -1.0,
    "m12": 0.0,
    "m21": 0.0,
    "m22": 1.0,
    "m31": -439.5,
    "m32": 296.75,
}

TREE = {
    "mapData": {
        "interactiveElements": [
            {"rid": 11},
            {"rid": 22},
            {"rid": 99},
        ]
    },
    "references": {
        "RefIds": [
            {"rid": -2, "type": {"class": ""}},
            {
                "rid": 11,
                "type": {
                    "class": "ClientInteractiveElementTransform",
                    "ns": "Editor.AleCore.Data",
                    "asm": "AleCore",
                },
                "data": {
                    "gfxId": 19725,
                    "cellId": 170,
                    "m_interactionId": 435481,
                    "color": {"value": 4286677377},
                    "transform": dict(DOOR_TRANSFORM),
                    "displayBehaviour": 0,
                    "innerCellRenderOrder": 1,
                },
            },
            {
                "rid": 22,
                "type": {
                    "class": "ClientInteractiveAnimatedElementTransform",
                    "ns": "Editor.AleCore.Data",
                    "asm": "AleCore",
                },
                "data": {
                    "gfxId": 1839,
                    "cellId": 545,
                    "m_interactionId": 491165,
                    "playAnimation": 0,
                    "transform": {
                        "m11": 1.0,
                        "m12": 0.0,
                        "m21": 0.0,
                        "m22": 1.0,
                        "m31": 881.5,
                        "m32": -333.25,
                    },
                    "color": {"value": 4286677377},
                    "innerCellRenderOrder": 0,
                    "displayBehaviour": 0,
                },
            },
        ]
    },
}


def _by_interaction(props: list[dict]) -> dict[int, dict]:
    return {int(p["interaction_id"]): p for p in props}


def test_resolve_interactive_props_resolves_rids_and_static_flag() -> None:
    props = resolve_interactive_props(TREE, found_gfx_ids={19725})
    assert [p["interaction_id"] for p in props] == [435481, 491165]
    assert all("rid" not in p for p in props)

    door = _by_interaction(props)[435481]
    assert door["cell_id"] == 170
    assert door["gfx_id"] == 19725
    assert door["prop_id"] == 19725
    assert door["static"] is True
    assert door["kind"] == "interactive"
    assert door["transform"] == DOOR_TRANSFORM
    assert door["display_behaviour"] == 0
    assert door["inner_cell_render_order"] == 1
    assert door["color_u32"] == 4286677377

    ore = _by_interaction(props)[491165]
    assert ore["cell_id"] == 545
    assert ore["gfx_id"] == 1839
    assert ore["static"] is False
    assert ore["kind"] == "animated"


def test_static_is_true_only_for_found_mapgfx_sprites() -> None:
    none_found = resolve_interactive_props(TREE, found_gfx_ids=())
    assert all(p["static"] is False for p in none_found)

    both_found = resolve_interactive_props(TREE, found_gfx_ids={19725, 1839})
    by_id = _by_interaction(both_found)
    assert by_id[435481]["static"] is True
    assert by_id[491165]["static"] is True


def test_prop_animation_filter_keeps_state_clips_not_character_idle() -> None:
    names = {"AnimState*"}
    assert _animation_wanted("AnimState0_0", names, False)
    assert _animation_wanted("AnimState1_0", names, False)
    assert _animation_wanted("AnimState2_0", names, False)
    assert _animation_wanted("AnimState1_to_AnimState0_0", names, False)
    assert not _animation_wanted("AnimStatique_1", names, False)
    assert not _animation_wanted("AnimMarche_5", names, False)
    assert not _animation_wanted("AnimCourse_1", names, False)


def test_vite_and_electron_dispatch_prop_kind() -> None:
    web = Path(__file__).resolve().parents[2] / "web"
    sources = {
        "vite": (web / "vite.config.ts").read_text(),
        "electron": (web / "electron" / "main.mjs").read_text(),
    }
    for label, text in sources.items():
        prop_at = text.index("kind === 'prop'")
        export_at = text.index("export_prop")
        fallback_at = text.index("Extraction non prise en charge")
        assert prop_at < fallback_at, label
        assert export_at < fallback_at, label
        assert "extractor.entities.export_prop" in text, label


BLEND_TREE = {
    "mapData": {
        "backgroundElements": [],
        "sortableMaterialData": {
            "shaderData": [
                {"rid": 100},
                {"rid": 200},
                {"rid": 300},
                {"rid": 400},
                {"rid": 500},
            ]
        },
    },
    "references": {
        "RefIds": [
            # Plain sprite, no blending parameters at all.
            {"rid": 100, "type": {"class": "ShaderData"}, "data": {"shaderParameters": []}},
            # Painted veil without parameters: multiplied, not opaque.
            {"rid": 200, "type": {"class": "PaintShaderData"}, "data": {"shaderParameters": []}},
            # SrcAlpha / One -> additive glow.
            {"rid": 300, "type": {"class": "PaintShaderData"}, "data": {"shaderParameters": [{"rid": 301}]}},
            {"rid": 301, "type": {"class": "ShaderBlendingParameters"},
             "data": {"sourceFactor": 5, "destinationFactor": 1, "blendOperation": 0}},
            # DstColor / OneMinusSrcAlpha -> multiply.
            {"rid": 400, "type": {"class": "PaintShaderData"}, "data": {"shaderParameters": [{"rid": 401}]}},
            {"rid": 401, "type": {"class": "ShaderBlendingParameters"},
             "data": {"sourceFactor": 2, "destinationFactor": 10, "blendOperation": 0}},
            # Zero / One: the source contributes nothing.
            {"rid": 500, "type": {"class": "ShaderData"}, "data": {"shaderParameters": [{"rid": 501}]}},
            {"rid": 501, "type": {"class": "ShaderBlendingParameters"},
             "data": {"sourceFactor": 0, "destinationFactor": 1, "blendOperation": 0}},
        ]
    },
}


def test_material_table_resolves_shader_family_and_blend() -> None:
    table = material_table(BLEND_TREE, "sortableMaterialData")
    assert [entry["shader"] for entry in table] == [
        "ShaderData", "PaintShaderData", "PaintShaderData", "PaintShaderData", "ShaderData",
    ]
    assert [entry["blend"] for entry in table] == [
        "normal", "normal", "add", "multiply", "none",
    ]


def test_material_table_is_empty_without_material_data() -> None:
    assert material_table({"mapData": {}}, "sortableMaterialData") == []


def test_element_carries_its_layer_material() -> None:
    table = material_table(BLEND_TREE, "sortableMaterialData")
    veil = _element({"gfxId": 62942, "materialIndex": 1}, "foreground", 0, table)
    assert veil["blend"] == "normal"
    assert veil["shader"] == "PaintShaderData"

    # An index outside the table must stay neutral rather than raise.
    orphan = _element({"gfxId": 1, "materialIndex": 99}, "background", 0, table)
    assert orphan["blend"] == "normal"


def test_export_map_binds_preview_props_before_collecting_sprite_ids() -> None:
    source = (Path(__file__).resolve().parents[1] / "extractor" / "maps" / "export_map.py").read_text()
    bind = source.index("preview_props = resolve_interactive_props")
    use = source.index('[p["gfx_id"] for p in preview_props')
    assert bind < use


def test_map_format_is_versioned_for_the_material_upgrade() -> None:
    source = (Path(__file__).resolve().parents[1] / "extractor" / "maps" / "export_map.py").read_text()
    assert '"format": "giny.dofus3.map.v3"' in source
    loader = (
        Path(__file__).resolve().parents[2] / "web" / "server" / "ensureMap.mjs"
    ).read_text()
    # The client must re-extract anything older, or cached maps stay washed out.
    assert "giny.dofus3.map.v3" in loader


BRIGHTEN_TREE = {
    "mapData": {
        "foregroundMaterialData": {
            "shaderData": [{"rid": 600}, {"rid": 700}]
        }
    },
    "references": {
        "RefIds": [
            # DstColor / One on the neutral full-map paint plate.
            {"rid": 600, "type": {"class": "PaintShaderData"},
             "data": {"gfxId": 62942, "shaderParameters": [{"rid": 601}]}},
            {"rid": 601, "type": {"class": "ShaderBlendingParameters"},
             "data": {"sourceFactor": 2, "destinationFactor": 1, "blendOperation": 0}},
            # SrcColor / One on a small dark glow.
            {"rid": 700, "type": {"class": "PaintShaderData"},
             "data": {"gfxId": 36648, "shaderParameters": [{"rid": 701}]}},
            {"rid": 701, "type": {"class": "ShaderBlendingParameters"},
             "data": {"sourceFactor": 3, "destinationFactor": 1, "blendOperation": 0}},
        ]
    },
}


def test_brightening_formulas_wait_for_their_sprite() -> None:
    table = material_table(BRIGHTEN_TREE, "foregroundMaterialData")
    # Neither is drawable yet: the blend depends on how bright the source is.
    assert [entry["blend"] for entry in table] == ["brighten", "brighten"]
    assert [entry["gfx_id"] for entry in table] == [62942, 36648]


def test_a_bright_paint_plate_is_dropped_and_a_dark_glow_is_additive() -> None:
    tables = {"foreground": material_table(BRIGHTEN_TREE, "foregroundMaterialData")}
    resolve_brighten(tables, {
        62942: {"luminance": 235.02},
        36648: {"luminance": 11.4},
    })
    # dst*(1+src) on a near-white plate saturates the whole map when drawn
    # additively, so it is not drawn at all; a dark glow is close enough to add.
    assert [entry["blend"] for entry in tables["foreground"]] == ["none", "add"]


def test_an_unmeasured_sprite_is_not_drawn() -> None:
    tables = {"foreground": material_table(BRIGHTEN_TREE, "foregroundMaterialData")}
    resolve_brighten(tables, {})
    # Guessing additive is what turns a whole map white; a missing glow is the
    # cheaper mistake.
    assert [entry["blend"] for entry in tables["foreground"]] == ["none", "none"]


def test_mean_luminance_is_premultiplied_by_alpha() -> None:
    from PIL import Image

    opaque_white = Image.new("RGBA", (8, 8), (255, 255, 255, 255))
    faint_white = Image.new("RGBA", (8, 8), (255, 255, 255, 26))
    black = Image.new("RGBA", (8, 8), (0, 0, 0, 255))

    assert _mean_luminance(opaque_white) > 250
    # A mostly transparent veil adds almost no light and must read as dark.
    assert _mean_luminance(faint_white) < 30
    assert _mean_luminance(black) == 0


def test_resolve_element_dict_resolves_via_elements_map_and_refs() -> None:
    refs = {
        10: ({"gfxId": 9999, "cellId": 100}, "ClientElement"),
        2: ({"gfxId": 8888, "cellId": 200}, "ClientElement"),
    }
    elements_map = {
        5: 12345,
        "6": "67890",
        7: {"gfxId": 1111, "cellId": 300},
    }

    # 1. Direct gfxId remains untouched
    assert resolve_element_dict({"gfxId": 42}, 0, refs, elements_map)["gfxId"] == 42

    # 2. Resolution via elements_map (int and str)
    assert resolve_element_dict({"rid": 5}, 0, refs, elements_map)["gfxId"] == 12345
    assert resolve_element_dict({"rid": 6}, 0, refs, elements_map)["gfxId"] == 67890
    assert resolve_element_dict({"rid": 7}, 0, refs, elements_map)["gfxId"] == 1111

    # 3. Resolution via refs
    assert resolve_element_dict({"rid": 10}, 0, refs, elements_map)["gfxId"] == 9999

    # 4. Fallback direct index in refs when rid is missing or unknown
    assert resolve_element_dict({"rid": 999}, 2, refs, elements_map)["gfxId"] == 8888


def test_material_table_and_element_export_named_uniforms() -> None:
    tree = {
        "mapData": {
            "foregroundMaterialData": {
                "shaderData": [{"rid": 800}]
            }
        },
        "references": {
            "RefIds": [
                {
                    "rid": 800,
                    "type": {"class": "ParticlesShaderData"},
                    "data": {
                        "gfxId": 50000,
                        "WaveAmplitude": 2.5,
                        "WindSpeed": 10.0,
                        "shaderParameters": [
                            {
                                "rid": 801,
                                "type": {"class": "WaveParameters"},
                                "data": {"frequency": 1.2, "amplitude": 3.0}
                            }
                        ]
                    }
                },
                {
                    "rid": 801,
                    "type": {"class": "WaveParameters"},
                    "data": {"frequency": 1.2, "amplitude": 3.0}
                }
            ]
        }
    }
    table = material_table(tree, "foregroundMaterialData")
    assert len(table) == 1
    assert table[0]["shader"] == "ParticlesShaderData"
    assert "uniforms" in table[0]
    uniforms = table[0]["uniforms"]
    assert uniforms["WaveAmplitude"] == 2.5
    assert uniforms["WindSpeed"] == 10.0
    assert table[0]["parameters"]["WaveParameters"]["frequency"] == 1.2
    assert table[0]["parameters"]["WaveParameters"]["amplitude"] == 3.0

    el = _element({"gfxId": 50000, "materialIndex": 0}, "foreground", 0, table)
    assert el["uniforms"]["WindSpeed"] == 10.0
    assert el["parameters"]["WaveParameters"]["amplitude"] == 3.0


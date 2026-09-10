import gzip
import json
from pathlib import Path

from extractor.entities.export_look import (
    document_has_drawable_frames,
    export_look,
    parse_look,
    reuse_existing_look,
)


def _drawable_v2() -> dict:
    return {
        "format": "giny.dofus3.entity.v2",
        "parts": {"skin/Torse_1": {"leaves": [{"vertices": [0], "indices": [0]}]}},
        "animations": {
            "AnimStatiqueExplo0_1": {
                "frames": [
                    [
                        {
                            "slot": 12,
                            "part_ref": "skin/Torse_1",
                            "visible": True,
                            "drawable": True,
                            "transform": [1, 0, 0, 0, 1, 0],
                        }
                    ]
                ]
            }
        },
    }


def _empty_v1() -> dict:
    return {
        "format": "giny.dofus3.entity.v1",
        "parts": {"398": {"chunks": []}},
        "animations": {
            "AnimStatiqueExploRetro1_1": {
                "frames": [[{"node": 0, "tag": 49, "drawable": False}]]
            }
        },
    }


def test_parse_look_reads_bone_and_skins():
    assert parse_look("{1|10,2012|1=#e59b68|53}") == (1, [10, 2012])
    assert parse_look("{563|||105}") == (563, [])


def test_document_has_drawable_frames_requires_a_resolvable_part():
    assert document_has_drawable_frames(_drawable_v2())
    assert not document_has_drawable_frames(_empty_v1())
    # graphic "0" is drawable but does not exist in parts — the web adapter
    # keeps the clip, then the renderer paints nothing.
    ghost = {
        "parts": {"398": {}},
        "animations": {
            "AnimStatiqueExploNewAge1_1": {
                "frames": [[{"graphic": "0", "drawable": True}]]
            }
        },
    }
    assert not document_has_drawable_frames(ghost)


def test_reuse_existing_look_keeps_uncompressed_v2(tmp_path: Path):
    dest = tmp_path / "look_1_10_2012.json"
    dest.write_text(json.dumps(_drawable_v2()))
    assert reuse_existing_look(dest) == dest
    assert dest.is_file()


def test_reuse_existing_look_unlinks_broken_json_when_gzip_is_drawable(tmp_path: Path):
    dest = tmp_path / "look_1_10_2012.json"
    dest.write_text(json.dumps(_empty_v1()))
    with gzip.open(str(dest) + ".gz", "wt", encoding="utf-8") as handle:
        json.dump(_drawable_v2(), handle)
    assert reuse_existing_look(dest) == dest
    assert not dest.exists()
    assert Path(str(dest) + ".gz").is_file()


def test_export_look_does_not_clobber_gzip_v2(tmp_path: Path):
    dest = tmp_path / "entities" / "look_1_10_2012.json"
    dest.parent.mkdir(parents=True)
    dest.write_text(json.dumps(_empty_v1()))
    with gzip.open(str(dest) + ".gz", "wt", encoding="utf-8") as handle:
        json.dump(_drawable_v2(), handle)
    out = export_look(Path("/nonexistent-client"), "{1|10,2012|}", tmp_path)
    assert out == dest
    assert not dest.exists()
    stored = json.loads(gzip.open(str(dest) + ".gz", "rt", encoding="utf-8").read())
    assert stored["format"] == "giny.dofus3.entity.v2"


def test_export_look_refuses_to_write_a_look_without_drawable_frames(tmp_path: Path, monkeypatch):
    bone = tmp_path / "entities" / "1.json"
    bone.parent.mkdir(parents=True)
    bone.write_text(json.dumps(_empty_v1()))

    import extractor.entities.export_look as export_look_mod

    monkeypatch.setattr(export_look_mod, "export_bone", lambda *_args, **_kwargs: bone)
    monkeypatch.setattr(
        export_look_mod,
        "export_skin",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(FileNotFoundError("skin")),
    )
    try:
        export_look(Path("/nonexistent-client"), "{1|10,2012|}", tmp_path)
        raise AssertionError("expected RuntimeError")
    except RuntimeError as error:
        assert "aucune frame drawable" in str(error)
    assert not (tmp_path / "entities" / "look_1_10_2012.json").exists()


def test_apply_slot_rules_masks_hair_part(tmp_path: Path):
    from extractor.entities.export_look import apply_slot_rules

    doc = {
        "format": "giny.dofus3.entity.v2",
        "parts": {
            "skin/Cheveux_0": {"leaves": []},
            "skin/Torse_1": {"leaves": []},
        },
        "animations": {
            "AnimStatiqueExplo0_1": {
                "frames": [
                    [
                        {"slot": 1, "part_ref": "skin/Cheveux_0", "visible": True, "drawable": True},
                        {"slot": 2, "part_ref": "skin/Torse_1", "visible": True, "drawable": True},
                    ]
                ]
            }
        },
    }
    # Mock slot rules where skin 240 masks slot 0/5 (hair)
    rules_dir = tmp_path / "data"
    rules_dir.mkdir(parents=True)
    fake_rules = {
        "240": {
            "skinId": 240,
            "slotRulesList": [
                {
                    "slotRuleType": 0,
                    "slotRuleInfo": 0,
                    "slotsRules": [{"id": 5, "mask": 62}],
                }
            ],
        }
    }
    with gzip.open(rules_dir / "skinslotsrules.json.gz", "wt", encoding="utf-8") as f:
        json.dump(fake_rules, f)

    apply_slot_rules(doc, [10, 2012, 240], tmp_path)

    frame = doc["animations"]["AnimStatiqueExplo0_1"]["frames"][0]
    hair_node = frame[0]
    torse_node = frame[1]
    assert hair_node["visible"] is False
    assert hair_node["drawable"] is False
    assert torse_node["visible"] is True
    assert torse_node["drawable"] is True

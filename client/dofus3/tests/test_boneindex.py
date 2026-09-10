from pathlib import Path
import json

from extractor.entities.export_boneindex import parse_boneindex_tree, export_boneindex
from extractor.unity_loader import DEFAULT_CLIENT


def test_parse_boneindex_tree():
    synthetic_tree = {
        "animationsBoneIndex": {
            "m_keys": [1],
            "m_values": [
                {
                    "m_keys": [0, 1],
                    "m_values": [
                        {
                            "m_keys": ["AnimStatiqueExplo0"],
                            "m_values": ["1-static"],
                        },
                        {
                            "m_keys": ["AnimAttaque101"],
                            "m_values": ["1-1-combat"],
                        },
                    ],
                }
            ],
        }
    }
    index = parse_boneindex_tree(synthetic_tree)
    assert "1" in index
    assert "0" in index["1"]
    assert index["1"]["0"]["AnimStatiqueExplo0"] == "1-static"
    assert index["1"]["1"]["AnimAttaque101"] == "1-1-combat"


def test_export_boneindex_generates_file(tmp_path: Path):
    dest = export_boneindex(DEFAULT_CLIENT, tmp_path)
    assert dest.is_file()
    assert dest.name == "boneindex.json"
    data = json.loads(dest.read_text())
    assert "1" in data
    assert "0" in data["1"]
    assert "AnimStatiqueExplo0" in data["1"]["0"]
    assert data["1"]["0"]["AnimStatiqueExplo0"] == "1-static"

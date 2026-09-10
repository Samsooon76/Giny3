"""Animation graphic ids are 0-based indices into aod.graphics (not part names).

Proven by exact official-bounds matches, e.g. bone 4924 AnimStatique_3 over
60 frames: calc x-119.6 w197.1 y-32.6 h202.5 vs recorded x-119.6 w197.1
y-32.6 h202.5.
"""

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "export_bone_mod", Path(__file__).parent.parent / "extractor" / "entities" / "export_bone.py"
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

resolve_part_ref = _mod.resolve_part_ref


def test_index_zero_maps_to_first_graphic():
    # bone 4924: gfx_order starts at '3'; animation graphic '2' is gfx[2].
    assert resolve_part_ref("2", ["3", "5", "7"]) == "7"


def test_graphic_zero_maps_to_first_graphic():
    assert resolve_part_ref("0", ["3", "5", "7"]) == "3"


def test_out_of_range_falls_back_to_raw_id():
    assert resolve_part_ref("99", ["3", "5"]) == "99"


def test_empty_graphic_resolves_to_none():
    assert resolve_part_ref("", ["3"]) is None
    assert resolve_part_ref(None, ["3"]) is None

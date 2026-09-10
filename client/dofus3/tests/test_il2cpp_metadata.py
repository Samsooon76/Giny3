"""The IL2CPP reader against the installed Dofus 3 client.

Skipped when the official install is absent: the proofs live in the 40 MB
metadata file, not in a fixture.
"""

from __future__ import annotations

import struct
from pathlib import Path

import pytest

from extractor.il2cpp.metadata import SANITY, VERSION, Metadata
from extractor.ui.menu import extract_figma_icons
from extractor.unity_loader import DEFAULT_CLIENT

CLIENT = Path(DEFAULT_CLIENT)
pytestmark = pytest.mark.skipif(
    not (CLIENT / "Dofus.app").exists(),
    reason="Dofus 3 client not installed",
)


def test_header_tiles_the_file_exactly():
    md = Metadata()
    assert md.version == VERSION
    assert len(md.tables) == 31
    assert md.type_count == 40_878
    last = md.report().splitlines()[-1]
    assert last.endswith(f"/ file {len(md.data)}: exact")
    sanity, version = struct.unpack_from("<II", md.data, 0)
    assert sanity == SANITY
    assert version == VERSION


def test_figma_icons_is_contiguous_none_to_zaap():
    members = extract_figma_icons()
    assert len(members) == 333
    assert members[0] == "none"
    assert members[-1] == "zaap"
    assert "alliance" in members
    assert "addCharacter" in members
    assert "world" in members


def test_banner_menu_enum_has_twenty_five_members_and_a_sentinel():
    md = Metadata()
    fmp = md.types_named("fmp")
    assert fmp, "obfuscated banner-entry enum fmp is missing"
    members = fmp[0].enum_members()
    assert len(members) == 26
    assert members[-1][1] == 2147483647
    assert [value for _, value in members[:-1]] == list(range(1, 26))


def test_banner_menu_type_survives_obfuscation():
    md = Metadata()
    types = md.types_named("BannerMenu")
    assert len(types) == 1
    banner = types[0]
    assert banner.full_name == "Core.Services.UI.MainMenu.BannerMenu"
    assert len(banner.field_range) == 50
    assert len(banner.method_range) == 136

"""The two name tables the build ships outside the obfuscated metadata.

Skipped without the official install: like the IL2CPP proofs, these assert
against the shipped files rather than a fixture. The exact counts are true of
one build (`client_version` in each dump); a patch moving them is a real
signal, not test flake.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from extractor.symbols import linker, monoscripts
from extractor.unity_loader import DEFAULT_CLIENT, client_version

CLIENT = Path(DEFAULT_CLIENT)
pytestmark = pytest.mark.skipif(
    not (CLIENT / "Dofus.app").exists(),
    reason="Dofus 3 client not installed",
)
BUILD = "3.6.10.11"


@pytest.fixture(scope="module")
def scripts() -> dict:
    return monoscripts.collect()


@pytest.fixture(scope="module")
def link() -> dict:
    return linker.collect()


def test_client_is_the_build_these_counts_were_read_from():
    assert client_version() == BUILD


# ---- globalgamemanagers.assets -----------------------------------------


def test_monoscript_table_is_the_whole_build_not_the_addressable_subset(scripts):
    """7 404 records, against the 55 of dofus_unity_monoscripts.bundle."""
    assert scripts["counts"]["scripts"] == 7404
    assert scripts["counts"]["assemblies"] == 66
    assert scripts["assemblies"]["Core"]["total"] == 3877


def test_every_row_carries_assembly_namespace_and_class(scripts):
    for row in scripts["scripts"]:
        assert row["class"], row
        assert row["assembly"], row
        assert row["properties_hash"] is None or len(row["properties_hash"]) == 32


def test_core_names_the_metadata_no_longer_spells(scripts):
    """The recovered surface, and the floor it is measured as."""
    assert scripts["assemblies"]["Core"]["absent"] == 1811
    by_class = {r["class"]: r for r in scripts["scripts"] if r["assembly"] == "Core"}
    for name in ("ChatService", "FightVanishStep", "IBadgeService", "ApplicationContainerService"):
        assert by_class[name]["absent"], name
        assert not by_class[name]["in_typedefs"], name
    # Readable half: present as a name *and* resolvable as a type.
    for name in ("EntitySprite", "DofusUISettings", "InteractiveCellManager"):
        assert by_class[name]["in_metadata"], name
        assert by_class[name]["in_typedefs"], name


def test_absent_is_a_floor_never_claimed_beyond_the_string_blob(scripts):
    """`absent` means the metadata spells the name nowhere at all."""
    names = monoscripts.metadata_names()
    for row in scripts["scripts"]:
        assert row["absent"] == (row["class"] not in names)
        if row["in_typedefs"]:
            assert row["in_metadata"], row


def test_protocol_assembly_is_renamed_wholesale_not_stripped(scripts):
    """0 % typed while the client plainly speaks the protocol: renamed."""
    protocol = scripts["assemblies"]["Ankama.Dofus.Protocol.Game"]
    assert protocol["total"] == 102
    assert protocol["absent"] == 95
    assert protocol["typed_rate"] == 0.0
    reflections = [
        r["class"] for r in scripts["scripts"]
        if r["assembly"] == "Ankama.Dofus.Protocol.Game" and r["class"].endswith("Reflection")
    ]
    assert len(reflections) >= 80


def test_unity_assemblies_stay_readable_so_their_absences_are_strippage(scripts):
    """The discriminator the summary reports, asserted rather than assumed."""
    for name in ("Unity.Mathematics", "Ankama.Dofus.Core.DataCenter", "Com.Ankama.HaapiAnkama"):
        assert scripts["assemblies"][name]["typed_rate"] == 1.0
        assert scripts["assemblies"][name]["absent"] == 0
    assert scripts["assemblies"]["Unity.InputSystem"]["typed_rate"] > 0.5


def test_datacenter_and_ui_namespaces_are_fully_named(scripts):
    ui = monoscripts.namespaces(scripts, "Core")
    assert ui["Core.UILogic.Bindings"] == 526
    assert ui["Core.UI.Bindings"] == 231
    assert monoscripts.namespaces(scripts, "Core", absent_only=True)["Core.Services.Contracts"] == 147


def test_write_monoscripts_round_trips(tmp_path):
    dest = monoscripts.write_monoscripts(tmp_path)
    table = json.loads(dest.read_text())
    assert dest.name == "monoScripts.json"
    assert table["format"] == monoscripts.FORMAT
    assert table["client_version"] == BUILD
    assert len(table["scripts"]) == table["counts"]["scripts"]


# ---- link.xml ----------------------------------------------------------


def test_link_xml_declares_nineteen_assemblies_and_295_types(link):
    assert link["counts"]["assemblies"] == 19
    assert link["counts"]["types"] == 295
    assert sum(a["types"] for a in link["assemblies"]) == 295
    assert link["assemblies"][0]["name"] == "Ankama.Animator2D"


def test_serialized_types_are_the_shapes_assets_actually_hold(link):
    assert link["counts"]["serialized"] == 204
    by_full = {r["fullname"]: r for r in link["types"]}
    for name in (
        "Core.UILogic.Figma.ScriptableObject.Script.FigmaThemeData",
        "Core.PathFinding.WorldPathfinding.Edge",
        "Ankama.Animations.SkinAssetPart",
    ):
        assert by_full[name]["serialized"], name
        assert by_full[name]["preserve"] == "nothing", name


def test_uxml_elements_are_the_custom_tag_checklist(link):
    assert link["counts"]["uxml_elements"] == 103
    tags = linker.uxml_tags(link)
    for tag in ("DofusButton", "Combobox", "CircularGauge", "ExtendedProgressBarLong", "WindowFigma"):
        assert tag in tags, tag
    # Every holder is a nested serialized type; that is what makes it a holder.
    # One tag is claimed twice, and which class a UXML file means depends on
    # its xmlns: mapping it to the built-in renders the wrong component.
    assert link["uxml_tag_collisions"] == {
        "RadioButton": [
            "Core.UILogic.Components.Figma.RadioButton",
            "UnityEngine.UIElements.RadioButton",
        ]
    }
    assert len(set(tags)) == len(tags) - 1
    holders = [r for r in link["types"] if r["fullname"].endswith(linker.UXML_HOLDER)]
    assert len(holders) == 103
    assert all(r["nested"] and r["serialized"] for r in holders)


def test_uxml_elements_live_where_the_ui_logic_does(link):
    ns = linker.namespaces(link)
    assert ns["Core.UILogic.Components.Figma"] == 43
    assert ns["Core.UILogic.Components"] == 29
    assert ns["UnityEngine.UIElements"] == 11


def test_write_link_types_round_trips(tmp_path):
    dest = linker.write_link_types(tmp_path)
    table = json.loads(dest.read_text())
    assert dest.name == "linkTypes.json"
    assert table["format"] == linker.FORMAT
    assert table["client_version"] == BUILD
    assert len(table["types"]) == table["counts"]["types"]

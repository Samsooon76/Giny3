from __future__ import annotations

from pathlib import Path

import pytest

from extractor.i18n import (
    LocalizationTable,
    fnv1a64,
    read_7bit_string,
    write_i18n,
)
from extractor.unity_loader import DEFAULT_CLIENT

CLIENT = Path(DEFAULT_CLIENT)


def _put_string(text: str) -> bytes:
    payload = text.encode("utf-8")
    assert len(payload) < 128
    return bytes([len(payload)]) + payload


def _mini_table() -> bytes:
    """A one-id, one-key table that tiles exactly like the official file."""
    import struct

    int_blob = _put_string("Épée de Boisaille")
    key_blob = _put_string("Niveau")
    header_without_payloads = (
        len(_put_string("xx"))  # language
        + 4  # int count
        + 8  # one int pair
        + 4  # string count
        + 12  # one hash pair
    )
    lang = _put_string("xx")
    int_off = header_without_payloads
    key_off = int_off + len(int_blob)
    header = bytearray()
    header += lang
    header += struct.pack("<I", 1)
    header += struct.pack("<II", 995824, int_off)
    header += struct.pack("<I", 1)
    header += struct.pack("<QI", fnv1a64("ui.common.level"), key_off)
    return bytes(header) + int_blob + key_blob


def test_fnv1a64_matches_string_to_hash_constants():
    assert fnv1a64("ui.common.level") == 0x1965B524FD6F323E


def test_7bit_string_roundtrip():
    blob = _put_string("Épée")
    text, end = read_7bit_string(blob, 0)
    assert text == "Épée"
    assert end == len(blob)


def test_mini_table_looks_up_id_and_named_key():
    table = LocalizationTable(_mini_table())
    assert table.language == "xx"
    assert table.int_count == 1
    assert table.string_count == 1
    assert table.lookup_id(995824) == "Épée de Boisaille"
    assert table.lookup_id(1) is None
    assert table.lookup_key("ui.common.level") == "Niveau"
    assert table.lookup_key("ui.common.missing") is None


@pytest.mark.skipif(not (CLIENT / "Dofus.app").exists(), reason="Dofus 3 client not installed")
def test_official_fr_bin_resolves_item_and_ui_keys():
    table = LocalizationTable.from_client(language="fr")
    assert table.language == "fr"
    assert table.int_count == 339_342
    assert table.lookup_id(995824) == "Épée de Boisaille"
    assert table.lookup_id(995825) == (
        "Épée de simple facture, elle ne fera pas de votre héros une légende."
    )
    assert table.lookup_key("ui.common.level") == "Niveau"
    assert table.lookup_key("ui.common.inventory") == "Inventaire"
    assert table.lookup_key("ui.stats.PAAttack") is not None


@pytest.mark.skipif(not (CLIENT / "Dofus.app").exists(), reason="Dofus 3 client not installed")
def test_write_i18n_replaces_the_handful_of_ui_keys(tmp_path: Path):
    dest = write_i18n(tmp_path, language="fr")
    assert dest.name == "i18n.json.gz"
    import gzip
    import json

    payload = json.loads(gzip.open(dest).read())
    assert payload["language"] == "fr"
    assert payload["strings"]["ui.common.level"] == "Niveau"
    assert payload["by_id"]["995824"] == "Épée de Boisaille"
    assert len(payload["by_id"]) == 339_342
    assert len(payload["strings"]) > 59

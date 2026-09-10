"""World map: Addressables catalog reader and tile grid.

The grid assertions use the two rows measured against the client, so a change
that silently reshuffles indices or drops the edge crop fails here rather than
on screen."""

import struct

import pytest

from extractor.addressables import BinaryCatalog, CatalogError, DYNAMIC_STRING_FLAG, MAGIC
from extractor.maps.export_worldmap import level_grid, tile_box, zoom_key


def _catalog_bytes(internal_id: str, guid: str, separator: str = "/") -> bytes:
    """A minimal buffer shaped the way `catalog_1.0.bin` stores one location.

    `internal_id` is split on its first separator so the tail is a plain string
    and the head is the prefix a `DynamicString` points at, which is exactly the
    layout the real catalog uses to share `worldmaps/28` between tiles."""
    prefix, _, tail = internal_id.partition(separator)
    blob = bytearray(b"\x00" * 32)  # header: only the magic is read back

    def put_string(text: str) -> int:
        data = text.encode()
        blob.extend(struct.pack("<I", len(data)))
        at = len(blob)
        blob.extend(data)
        return at

    prefix_at = put_string(prefix)
    tail_at = put_string(tail)
    prefix_dyn = len(blob)
    blob.extend(struct.pack("<II", prefix_at, 0xFFFFFFFF))
    tail_dyn = len(blob)
    blob.extend(struct.pack("<II", tail_at, prefix_dyn))
    guid_at = put_string(guid)
    # The location record: the internal id tagged as a dynamic string, then the
    # primary key right after it.
    blob.extend(struct.pack("<II", DYNAMIC_STRING_FLAG | tail_dyn, guid_at))
    struct.pack_into("<II", blob, 0, MAGIC, 2)
    return bytes(blob)


def test_catalog_reads_the_split_internal_id(tmp_path):
    guid = "000d1f541973cd848a8a7222af368f04"
    path = tmp_path / "catalog_1.0.bin"
    path.write_bytes(_catalog_bytes("worldmaps/28/1/12.jpg", guid))
    assert BinaryCatalog(path).location_ids("worldmaps/") == {guid: "worldmaps/28/1/12.jpg"}


def test_catalog_prefix_rejects_other_locations(tmp_path):
    guid = "004f38c9496f6a64e8435522e41cbf8a"
    path = tmp_path / "catalog_1.0.bin"
    path.write_bytes(_catalog_bytes("items/3/1.png", guid))
    assert BinaryCatalog(path).location_ids("worldmaps/") == {}
    assert BinaryCatalog(path).location_ids() == {guid: "items/3/1.png"}


def test_catalog_rejects_a_file_that_is_not_one(tmp_path):
    path = tmp_path / "catalog_1.0.bin"
    path.write_bytes(b"not a catalog")
    with pytest.raises(CatalogError):
        BinaryCatalog(path)


def test_zoom_key_matches_the_addressed_level():
    # `worldmaps.json` stores float32: 0.8 arrives as 0.800000011920929.
    assert zoom_key(0.800000011920929) == "0.8"
    assert zoom_key(0.20000000298023224) == "0.2"
    assert zoom_key(1.0) == "1"
    assert zoom_key(0.75) == "0.75"


def test_level_grid_reproduces_the_tile_counts_the_catalog_addresses():
    # World map 1, 10000 × 8000: 80 + 56 + 30 + 16 + 4 = 186 tiles.
    counts = [
        level_grid(10000, 8000, zoom)["columns"] * level_grid(10000, 8000, zoom)["rows"]
        for zoom in (1.0, 0.8, 0.6, 0.4, 0.2)
    ]
    assert counts == [80, 56, 30, 16, 4]
    assert sum(counts) == 186
    # World map 12, 3274 × 2498: 12 + 6 + 4 + 1 = 23.
    assert [
        level_grid(3274, 2498, zoom)["columns"] * level_grid(3274, 2498, zoom)["rows"]
        for zoom in (1.0, 0.75, 0.5, 0.25)
    ] == [12, 6, 4, 1]


def test_tile_box_is_row_major_from_the_top_left_and_crops_the_edges():
    grid = level_grid(3274, 2498, 1.0)
    assert grid == {"width": 3274, "height": 2498, "columns": 4, "rows": 3}
    assert tile_box(grid, 1) == (0, 0, 1024, 1024)
    assert tile_box(grid, 4) == (3072, 0, 202, 1024)      # last column
    assert tile_box(grid, 5) == (0, 1024, 1024, 1024)     # second row starts over
    assert tile_box(grid, 9) == (0, 2048, 1024, 450)      # last row
    assert tile_box(grid, 12) == (3072, 2048, 202, 450)   # bottom-right corner

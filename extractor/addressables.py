"""Read an Addressables *binary* content catalog (`catalog_1.0.bin`).

A bundle only names its assets by GUID: `worldmap_assets_.bundle` holds 1 216
sprites all called `1`…`80`, and nothing inside it says which world map a tile
belongs to or where it sits in the grid. That mapping lives in the catalog next
to the bundle, which addresses every asset as
`worldmaps/<worldmapId>/<zoom>/<tileIndex>.jpg`.

Unity's `BinaryStorageBuffer` is not documented, so only the two shapes this
module actually needs were recovered, and both are checked at read time:

* a **string** is `[u32 byteLength][utf-8 bytes]`, and the offset stored in the
  file points at the *bytes*;
* an **id** is a `DynamicString` pair `{u32 dataOffset, u32 prefixOffset}` so a
  shared prefix is written once. `worldmaps/28/1/12.jpg` is stored as the pair
  (`1/12.jpg`, →(`worldmaps/28`, none)). `0xFFFFFFFF` ends the chain.

A resource location record stores its primary key (the asset GUID, as a plain
string) and, one word earlier, its internal id tagged with `0x40000000` — the
flag that says "this word is a `DynamicString` offset, not a plain one". That
adjacency is what `location_ids` keys off, and it is not assumed: a candidate is
kept only when the word carries the flag *and* the chain resolves to a valid
UTF-8 id, so a false positive would have to be a valid id by accident.
"""

from __future__ import annotations

import re
import struct
from collections import defaultdict
from pathlib import Path

MAGIC = 0x0DE38942
#: A word holding a `DynamicString` offset instead of a plain string offset.
DYNAMIC_STRING_FLAG = 0x40000000
OFFSET_MASK = 0x3FFFFFFF
END_OF_CHAIN = 0xFFFFFFFF
#: Unity asset GUIDs, which is what an Addressables primary key is here.
_GUID = re.compile(rb"[0-9a-f]{32}")
_MAX_PREFIX_DEPTH = 8


class CatalogError(ValueError):
    pass


class BinaryCatalog:
    """One `catalog_*.bin`, read lazily out of a single in-memory buffer."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.data = self.path.read_bytes()
        if len(self.data) < 8 or self.u32(0) != MAGIC:
            raise CatalogError(f"{self.path} is not an Addressables binary catalog")
        self.version = self.u32(4)

    def u32(self, at: int) -> int:
        return struct.unpack_from("<I", self.data, at)[0]

    def string(self, at: int) -> str | None:
        """The string whose *bytes* start at `at`, or None if `at` is not one."""
        if at < 4 or at >= len(self.data):
            return None
        length = self.u32(at - 4)
        if length == 0 or length > 4096 or at + length > len(self.data):
            return None
        try:
            return self.data[at : at + length].decode("utf-8")
        except UnicodeDecodeError:
            return None

    def dynamic_string(self, at: int, separator: str = "/") -> str | None:
        """Resolve a `DynamicString` chain into the full id it encodes."""
        parts: list[str] = []
        cursor = at
        for _ in range(_MAX_PREFIX_DEPTH):
            if cursor == END_OF_CHAIN or cursor + 8 > len(self.data):
                return None
            part = self.string(self.u32(cursor))
            if part is None:
                return None
            parts.append(part)
            cursor = self.u32(cursor + 4)
            if cursor == END_OF_CHAIN:
                return separator.join(reversed(parts))
        return None

    def _word_positions(self) -> dict[int, list[int]]:
        positions: dict[int, list[int]] = defaultdict(list)
        data = self.data
        for offset in range(4, len(data) - 3):
            positions[struct.unpack_from("<I", data, offset)[0]].append(offset)
        return positions

    def location_ids(self, prefix: str | None = None) -> dict[str, str]:
        """`{asset GUID: internal id}` for every location the catalog carries.

        `prefix` keeps only ids starting with it, which is also the cheapest
        way to reject a coincidental match."""
        positions = self._word_positions()
        found: dict[str, str] = {}
        for match in _GUID.finditer(self.data):
            at = match.start()
            if at < 4 or self.u32(at - 4) != 32:
                continue
            guid = match.group().decode("ascii")
            for reference in positions.get(at, ()):
                if reference < 8:
                    continue
                word = self.u32(reference - 4)
                if not word & DYNAMIC_STRING_FLAG:
                    continue
                internal_id = self.dynamic_string(word & OFFSET_MASK)
                if internal_id is None:
                    continue
                if prefix is not None and not internal_id.startswith(prefix):
                    continue
                found[guid] = internal_id
                break
        return found


def location_ids(path: Path | str, prefix: str | None = None) -> dict[str, str]:
    return BinaryCatalog(path).location_ids(prefix)

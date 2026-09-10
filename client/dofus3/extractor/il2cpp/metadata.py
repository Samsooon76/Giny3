"""Reader for the Dofus 3 `global-metadata.dat` (IL2CPP metadata version 39).

Ankama ships a hardened variant, so no public dumper reads it as-is. Three things
differ from upstream IL2CPP, and all three were recovered by validation rather
than guessed — see `docs/IL2CPP.md` for the proofs.

1. The header is a run of **(offset, size, count) triples**, not the upstream
   (offset, size) pairs. The 31 triples tile the file exactly, end to end, with
   only 0-3 bytes of alignment padding between them, which is what pins the
   reading down: any other interpretation leaves holes or overlaps.

2. Several struct fields are narrowed from u32 to u16, so records are smaller
   than upstream and no longer 4-aligned. `Il2CppTypeDefinition` is 82 bytes
   instead of 88 (`elementTypeIndex`, `genericContainerIndex` and `flags` are
   u16 here), which puts `fieldStart` at the unaligned offset 26.

3. Field default values are Unity compressed integers with zigzag, not raw
   ints — consecutive enum members sit 1 or 2 bytes apart, not 4.

Every index/count pair below was proved by an exact partition test: taking the
starts and counts off all 40878 type records has to carve the target table into
disjoint runs that cover it completely, with no hole and no overlap. Only one
(offset, offset) candidate does that per table, so the layout is not a guess.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from functools import cached_property
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT

METADATA_RELATIVE = (
    Path("Dofus.app") / "Contents" / "Resources" / "Data" / "il2cpp_data" / "Metadata" / "global-metadata.dat"
)

SANITY = 0xFAB11BAF
VERSION = 39

#: Table order matches upstream IL2CPP; the identification is confirmed by
#: bytes-per-entry (the `per` column of `Metadata.report()`) and by content.
(
    T_STRING_LITERAL, T_STRING_LITERAL_DATA, T_STRING, T_EVENTS, T_PROPERTIES, T_METHODS,
    T_PARAM_DEFAULTS, T_FIELD_DEFAULTS, T_DEFAULT_VALUE_DATA, T_FIELD_MARSHALED_SIZES,
    T_PARAMETERS, T_FIELDS, T_GENERIC_PARAMS, T_GENERIC_PARAM_CONSTRAINTS,
    T_GENERIC_CONTAINERS, T_NESTED_TYPES, T_INTERFACES, T_VTABLE_METHODS,
    T_INTERFACE_OFFSETS, T_TYPE_DEFINITIONS, T_IMAGES, T_ASSEMBLIES, T_FIELD_REFS,
    T_REFERENCED_ASSEMBLIES, T_ATTRIBUTE_DATA, T_ATTRIBUTE_DATA_RANGE,
) = range(26)

#: `Il2CppTypeDefinition`, 82 bytes. `u16` where upstream has `u32` is noted.
TYPE_DEF_SIZE = 82
TD_NAME = 0            # u32 -> T_STRING
TD_NAMESPACE = 4       # u32 -> T_STRING
TD_BYVAL_TYPE = 8      # u32
TD_DECLARING_TYPE = 12  # u32, 0xFFFFFFFF when top level
TD_PARENT = 16         # u32
TD_ELEMENT_TYPE = 20   # u16 (narrowed)
TD_GENERIC_CONTAINER = 22  # u16 (narrowed)
TD_FLAGS = 24          # u16 (narrowed, low half of TypeAttributes)
TD_FIELD_START = 26    # u32, unaligned
TD_METHOD_START = 30   # u32
TD_EVENT_START = 34    # u32
TD_PROPERTY_START = 38  # u32
TD_NESTED_START = 42   # u32
TD_INTERFACES_START = 46  # u32
TD_VTABLE_START = 50   # u32
TD_INTERFACE_OFFSETS_START = 54  # u32
TD_METHOD_COUNT = 58   # u16
TD_PROPERTY_COUNT = 60  # u16
TD_FIELD_COUNT = 62    # u16
TD_EVENT_COUNT = 64    # u16
TD_NESTED_COUNT = 66   # u16
TD_VTABLE_COUNT = 68   # u16
TD_INTERFACES_COUNT = 70  # u16
TD_INTERFACE_OFFSETS_COUNT = 72  # u16
TD_BITFIELD = 74       # u32
TD_TOKEN = 78          # u32, 0x02000000 | row

#: `Il2CppMethodDefinition`, 32 bytes (upstream 36).
METHOD_SIZE = 32
MD_NAME = 0            # u32 -> T_STRING
MD_DECLARING_TYPE = 4  # u32 -> T_TYPE_DEFINITIONS
MD_RETURN_TYPE = 8     # u32
MD_RETURN_PARAM_TOKEN = 12  # u16 (narrowed)
MD_PARAM_START = 14    # u32, unaligned
MD_GENERIC_CONTAINER = 18  # u16 (narrowed)
MD_TOKEN = 20          # u32, 0x06000000 | row
MD_FLAGS = 24          # u16
MD_IFLAGS = 26         # u16
MD_SLOT = 28           # u16
MD_PARAM_COUNT = 30    # u16

#: `Il2CppFieldDefinition` / `Il2CppParameterDefinition`, 12 bytes each.
FIELD_SIZE = 12
FD_NAME = 0            # u32 -> T_STRING
FD_TYPE = 4            # u32
FD_TOKEN = 8           # u32, 0x04000000 | row

PARAM_SIZE = 12
PD_NAME = 0
PD_TOKEN = 4
PD_TYPE = 8

#: `Il2CppFieldDefaultValue`, 12 bytes: which field, its type, where the blob is.
FIELD_DEFAULT_SIZE = 12
FDV_FIELD = 0          # u32 -> T_FIELDS
FDV_TYPE = 4           # u32
FDV_DATA = 8           # i32 offset into T_DEFAULT_VALUE_DATA, -1 when none


@dataclass(frozen=True)
class Table:
    offset: int
    size: int
    count: int

    @property
    def per_entry(self) -> float:
        return self.size / self.count if self.count else 0.0


class Metadata:
    """Random-access reader. Nothing is decoded until it is asked for."""

    def __init__(self, client_root: Path = DEFAULT_CLIENT):
        path = Path(client_root)
        self.path = path if path.is_file() else path / METADATA_RELATIVE
        self.data = self.path.read_bytes()
        sanity, version = struct.unpack_from("<II", self.data, 0)
        if sanity != SANITY:
            raise ValueError(f"{self.path.name}: sanity {sanity:#x}, expected {SANITY:#x}")
        if version != VERSION:
            raise ValueError(
                f"{self.path.name}: metadata version {version}, this reader was proved against {VERSION}"
            )
        self.version = version
        self.tables = self._read_header()

    def _read_header(self) -> list[Table]:
        """Read triples until they run off the end of the file.

        The tables are contiguous, so the loop stops on the one whose end
        reaches the file end; `report()` re-checks that the tiling is exact
        rather than trusting the stop condition."""
        out: list[Table] = []
        word = 2
        limit = len(self.data)
        while True:
            offset, size, count = struct.unpack_from("<3I", self.data, word * 4)
            if offset > limit or offset + size > limit:
                break
            out.append(Table(offset, size, count))
            word += 3
            if offset + size >= limit:
                break
        return out

    # ---- primitives -----------------------------------------------------

    def u32(self, at: int) -> int:
        return struct.unpack_from("<I", self.data, at)[0]

    def u16(self, at: int) -> int:
        return struct.unpack_from("<H", self.data, at)[0]

    def i32(self, at: int) -> int:
        return struct.unpack_from("<i", self.data, at)[0]

    def _entry(self, table: int, index: int, stride: int) -> int:
        t = self.tables[table]
        if not 0 <= index < t.count:
            raise IndexError(f"table {table}: index {index} of {t.count}")
        return t.offset + index * stride

    def report(self) -> str:
        """Human-readable table map, and the proof that the tiling is exact."""
        lines = [f"{self.path.name}: version {self.version}, {len(self.tables)} tables"]
        end = None
        for i, t in enumerate(self.tables):
            gap = "" if end is None else f" gap={t.offset - end}"
            lines.append(f"  t{i:<2d} off={t.offset:<9d} size={t.size:<9d} count={t.count:<8d} per={t.per_entry:>7.2f}{gap}")
            end = t.offset + t.size
        lines.append(f"  tiling ends at {end} / file {len(self.data)}: {'exact' if end == len(self.data) else 'MISMATCH'}")
        return "\n".join(lines)

    # ---- strings --------------------------------------------------------

    def name(self, index: int) -> str:
        """A name out of the `T_STRING` blob (types, methods, fields, params)."""
        t = self.tables[T_STRING]
        if not 0 <= index < t.size:
            raise IndexError(f"name index {index} outside the {t.size}-byte blob")
        start = t.offset + index
        return self.data[start:self.data.index(b"\x00", start)].decode("utf-8", "replace")

    def name_index(self, text: str) -> int:
        """Reverse lookup, for anchoring on a name known from the outside."""
        t = self.tables[T_STRING]
        blob = self.data[t.offset:t.offset + t.size]
        needle = b"\x00" + text.encode() + b"\x00"
        at = blob.find(needle)
        if at < 0:
            if blob.startswith(text.encode() + b"\x00"):
                return 0
            raise LookupError(f"no name {text!r} in the metadata")
        return at + 1

    def literal(self, index: int) -> bytes:
        """A C# string literal.

        `T_STRING_LITERAL` is not upstream's array of {length, dataIndex}
        structs: it is a plain u32 offset array with a trailing sentinel equal
        to the data size, so literal `i` is the slice between offset `i` and
        offset `i + 1`."""
        idx, blob = self.tables[T_STRING_LITERAL], self.tables[T_STRING_LITERAL_DATA]
        if not 0 <= index < idx.count - 1:
            raise IndexError(f"literal {index} of {idx.count - 1}")
        start = self.u32(idx.offset + index * 4)
        end = self.u32(idx.offset + (index + 1) * 4)
        return self.data[blob.offset + start:blob.offset + end]

    @cached_property
    def literals(self) -> list[bytes]:
        idx = self.tables[T_STRING_LITERAL]
        return [self.literal(i) for i in range(idx.count - 1)]

    def find_literal(self, text: str | bytes) -> list[int]:
        """Every literal index whose bytes equal `text`."""
        want = text.encode() if isinstance(text, str) else text
        return [i for i, value in enumerate(self.literals) if value == want]

    # ---- types, fields, methods -----------------------------------------

    @property
    def type_count(self) -> int:
        return self.tables[T_TYPE_DEFINITIONS].count

    def type_def(self, index: int) -> "TypeDef":
        return TypeDef(self, index)

    @cached_property
    def _type_by_name_index(self) -> dict[int, list[int]]:
        base = self.tables[T_TYPE_DEFINITIONS].offset
        out: dict[int, list[int]] = {}
        for e in range(self.type_count):
            out.setdefault(self.u32(base + e * TYPE_DEF_SIZE + TD_NAME), []).append(e)
        return out

    def types_named(self, text: str) -> list["TypeDef"]:
        try:
            index = self.name_index(text)
        except LookupError:
            return []
        return [self.type_def(e) for e in self._type_by_name_index.get(index, [])]

    def field_name(self, index: int) -> str:
        return self.name(self.u32(self._entry(T_FIELDS, index, FIELD_SIZE) + FD_NAME))

    def method_name(self, index: int) -> str:
        return self.name(self.u32(self._entry(T_METHODS, index, METHOD_SIZE) + MD_NAME))

    def method_token(self, index: int) -> int:
        return self.u32(self._entry(T_METHODS, index, METHOD_SIZE) + MD_TOKEN)

    def method_declaring_type(self, index: int) -> int:
        return self.u32(self._entry(T_METHODS, index, METHOD_SIZE) + MD_DECLARING_TYPE)

    # ---- enum values ----------------------------------------------------

    @cached_property
    def field_defaults(self) -> dict[int, tuple[int, int]]:
        """fieldIndex -> (typeIndex, data offset into `T_DEFAULT_VALUE_DATA`)."""
        t = self.tables[T_FIELD_DEFAULTS]
        out: dict[int, tuple[int, int]] = {}
        for e in range(t.count):
            base = t.offset + e * FIELD_DEFAULT_SIZE
            out[self.u32(base + FDV_FIELD)] = (self.u32(base + FDV_TYPE), self.i32(base + FDV_DATA))
        return out

    def compressed_u32(self, at: int) -> tuple[int, int]:
        """Unity's variable-width uint. Returns `(value, next offset)`.

        Version 39 does not store a field's constant raw: the default-value
        blob holds compressed integers, which is why the byte deltas between
        consecutive enum members are 1 or 2 and not the 4 an `int` enum would
        take. The prefix says the width: 0xxxxxxx is one byte, 10xxxxxx two,
        110xxxxx three, 0xF0 a full u32, and 0xFE / 0xFF are the two sentinels
        near uint.MaxValue."""
        first = self.data[at]
        if not first & 0x80:
            return first, at + 1
        if first & 0xC0 == 0x80:
            return ((first & 0x3F) << 8) | self.data[at + 1], at + 2
        if first & 0xE0 == 0xC0:
            return ((first & 0x1F) << 16) | (self.data[at + 1] << 8) | self.data[at + 2], at + 3
        if first == 0xF0:
            return int.from_bytes(self.data[at + 1:at + 5], "little"), at + 5
        return (0xFFFFFFFE if first == 0xFE else 0xFFFFFFFF), at + 1

    def compressed_i32(self, at: int) -> tuple[int, int]:
        """Zigzag on top of `compressed_u32`: 0,2,4,… are 0,1,2,… and the odd
        encodings are the negatives, so an ordinary enum comes out contiguous."""
        value, nxt = self.compressed_u32(at)
        if value == 0xFFFFFFFF:
            return -(2 ** 31), nxt
        negative = value & 1
        value >>= 1
        return (-(value + 1) if negative else value), nxt

    def default_int(self, field_index: int) -> int | None:
        """An enum member's constant, or None when the field has no default."""
        entry = self.field_defaults.get(field_index)
        if not entry or entry[1] < 0:
            return None
        return self.compressed_i32(self.tables[T_DEFAULT_VALUE_DATA].offset + entry[1])[0]


class TypeDef:
    """One `Il2CppTypeDefinition`, with its members resolved lazily."""

    def __init__(self, md: Metadata, index: int):
        self.md = md
        self.index = index
        self.base = md.tables[T_TYPE_DEFINITIONS].offset + index * TYPE_DEF_SIZE

    def _u32(self, at: int) -> int:
        return self.md.u32(self.base + at)

    def _u16(self, at: int) -> int:
        return self.md.u16(self.base + at)

    @property
    def name(self) -> str:
        return self.md.name(self._u32(TD_NAME))

    @property
    def namespace(self) -> str:
        return self.md.name(self._u32(TD_NAMESPACE))

    @property
    def full_name(self) -> str:
        ns = self.namespace
        return f"{ns}.{self.name}" if ns else self.name

    @property
    def token(self) -> int:
        return self._u32(TD_TOKEN)

    @property
    def field_range(self) -> range:
        start = self._u32(TD_FIELD_START)
        return range(0) if start == 0xFFFFFFFF else range(start, start + self._u16(TD_FIELD_COUNT))

    @property
    def method_range(self) -> range:
        start = self._u32(TD_METHOD_START)
        return range(0) if start == 0xFFFFFFFF else range(start, start + self._u16(TD_METHOD_COUNT))

    @property
    def fields(self) -> list[tuple[int, str]]:
        return [(i, self.md.field_name(i)) for i in self.field_range]

    @property
    def methods(self) -> list[tuple[int, str]]:
        return [(i, self.md.method_name(i)) for i in self.method_range]

    def enum_members(self) -> list[tuple[str, int | None]]:
        """`(name, value)` for every field that carries a constant.

        An enum's storage field `value__` has no default and is skipped, so the
        result is the members in declaration order — which is what an `int` in
        compiled code refers to."""
        out = []
        for index, name in self.fields:
            if name == "value__":
                continue
            out.append((name, self.md.default_int(index)))
        return out

    def __repr__(self) -> str:
        return f"<TypeDef {self.index} {self.full_name} fields={len(self.field_range)} methods={len(self.method_range)}>"

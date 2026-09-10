"""Reader for `GameAssembly.dylib`: turns a metadata method into an address.

The pieces, in the order they depend on each other:

* the fat binary carries x86_64 and arm64; the client runs the arm64 slice, and
  every section file offset is relative to that slice's start (reading them
  against the file start silently gives you the other architecture's bytes);
* data pointers are chained fixups, so a slot does not hold an address. For
  `DYLD_CHAINED_PTR_64` the low 36 bits are the unslid target and bits 51..62
  are the distance to the next slot in 4-byte units;
* `Il2CppMetadataRegistration` is found by its two counts that have to equal the
  metadata's type count (`fieldOffsetsCount` and `typeDefinitionsSizesCount`,
  16 bytes apart);
* an `Il2CppCodeGenModule` is found by its first field pointing at a `*.dll`
  name, and its `methodPointers` array is indexed by a method's token row minus
  one — so a metadata method reaches its code through its own assembly's module.

See `docs/IL2CPP.md` for how each of those was pinned down.
"""

from __future__ import annotations

import struct
from bisect import bisect_right
from functools import cached_property
from pathlib import Path

from extractor.unity_loader import DEFAULT_CLIENT

BINARY_RELATIVE = Path("Dofus.app") / "Contents" / "Frameworks" / "GameAssembly.dylib"

FAT_MAGIC = 0xCAFEBABE
MH_MAGIC_64 = 0xFEEDFACF
CPU_TYPE_ARM64 = 0x0100000C
LC_SEGMENT_64 = 0x19
LC_FUNCTION_STARTS = 0x26

#: `DYLD_CHAINED_PTR_64`: target in the low 36 bits, `next` in bits 51..62
#: counted in 4-byte steps.
CHAINED_TARGET_MASK = 0xFFFFFFFFF


class Binary:
    def __init__(self, client_root: Path = DEFAULT_CLIENT, cpu: int = CPU_TYPE_ARM64):
        path = Path(client_root)
        self.path = path if path.is_file() else path / BINARY_RELATIVE
        self.blob = self.path.read_bytes()
        self.slice_at = self._find_slice(cpu)
        self.segments: list[tuple[str, int, int, int, int]] = []
        self.sections: list[tuple[str, str, int, int, int]] = []
        self._function_starts_cmd: tuple[int, int] | None = None
        self._read_commands()

    def _find_slice(self, cpu: int) -> int:
        (magic,) = struct.unpack_from(">I", self.blob, 0)
        if magic != FAT_MAGIC:
            return 0
        (count,) = struct.unpack_from(">I", self.blob, 4)
        for i in range(count):
            cputype, _, offset, _, _ = struct.unpack_from(">5I", self.blob, 8 + i * 20)
            if cputype == cpu:
                return offset
        raise LookupError(f"{self.path.name}: no slice for cpu {cpu:#x}")

    def _read_commands(self) -> None:
        base = self.slice_at
        (magic,) = struct.unpack_from("<I", self.blob, base)
        if magic != MH_MAGIC_64:
            raise ValueError(f"{self.path.name}: slice magic {magic:#x}")
        (ncmds,) = struct.unpack_from("<I", self.blob, base + 16)
        at = base + 32
        for _ in range(ncmds):
            cmd, size = struct.unpack_from("<2I", self.blob, at)
            if cmd == LC_SEGMENT_64:
                name = self.blob[at + 8:at + 24].rstrip(b"\0").decode()
                vmaddr, vmsize, fileoff, filesize = struct.unpack_from("<4Q", self.blob, at + 24)
                (nsects,) = struct.unpack_from("<I", self.blob, at + 64)
                self.segments.append((name, vmaddr, vmsize, fileoff, filesize))
                cursor = at + 72
                for _ in range(nsects):
                    sect = self.blob[cursor:cursor + 16].rstrip(b"\0").decode()
                    seg = self.blob[cursor + 16:cursor + 32].rstrip(b"\0").decode()
                    addr, sect_size = struct.unpack_from("<2Q", self.blob, cursor + 32)
                    (offset,) = struct.unpack_from("<I", self.blob, cursor + 48)
                    self.sections.append((seg, sect, addr, sect_size, base + offset))
                    cursor += 80
            elif cmd == LC_FUNCTION_STARTS:
                dataoff, datasize = struct.unpack_from("<2I", self.blob, at + 8)
                self._function_starts_cmd = (base + dataoff, datasize)
            at += size

    # ---- address translation --------------------------------------------

    def offset_of(self, vaddr: int) -> int | None:
        for _, vmaddr, _, fileoff, filesize in self.segments:
            if vmaddr <= vaddr < vmaddr + filesize:
                return self.slice_at + fileoff + (vaddr - vmaddr)
        return None

    def u64(self, vaddr: int) -> int | None:
        at = self.offset_of(vaddr)
        return None if at is None else struct.unpack_from("<Q", self.blob, at)[0]

    def u32(self, vaddr: int) -> int | None:
        at = self.offset_of(vaddr)
        return None if at is None else struct.unpack_from("<I", self.blob, at)[0]

    def pointer(self, vaddr: int) -> int:
        """A data slot, decoded as a chained fixup rebase."""
        raw = self.u64(vaddr)
        return 0 if not raw else raw & CHAINED_TARGET_MASK

    def cstring(self, vaddr: int, limit: int = 200) -> str | None:
        at = self.offset_of(vaddr)
        if at is None:
            return None
        end = self.blob.find(b"\0", at, at + limit)
        return None if end < 0 else self.blob[at:end].decode("utf-8", "replace")

    def data_sections(self):
        for seg, sect, addr, size, offset in self.sections:
            if seg in ("__DATA", "__DATA_CONST") and sect not in ("__bss", "__common"):
                yield seg, sect, addr, size, offset

    # ---- function boundaries --------------------------------------------

    @cached_property
    def function_starts(self) -> list[int]:
        """Sorted function entry points, from the ULEB128 deltas of the command."""
        if not self._function_starts_cmd:
            return []
        offset, size = self._function_starts_cmd
        text = min(vmaddr for name, vmaddr, _, _, _ in self.segments if name == "__TEXT")
        out: list[int] = []
        addr, at, end = text, offset, offset + size
        while at < end:
            shift = delta = 0
            while True:
                byte = self.blob[at]
                at += 1
                delta |= (byte & 0x7F) << shift
                shift += 7
                if not byte & 0x80:
                    break
            if delta == 0:
                break
            addr += delta
            out.append(addr)
        return out

    def function_extent(self, entry: int) -> tuple[int, int]:
        """`(start, end)` of the function at `entry`, end being the next start."""
        starts = self.function_starts
        index = bisect_right(starts, entry)
        return entry, starts[index] if index < len(starts) else entry + 0x400

    # ---- IL2CPP registration --------------------------------------------

    def find_metadata_registration(self, type_count: int) -> int:
        """`Il2CppMetadataRegistration`, anchored on its two type counts.

        `fieldOffsetsCount` and `typeDefinitionsSizesCount` both equal the
        metadata's type count and sit 16 bytes apart at +0x50 and +0x60, which
        is a signature no other structure in the data sections matches."""
        needle = struct.pack("<I", type_count)
        for _, _, addr, size, offset in self.data_sections():
            blob = self.blob[offset:offset + size]
            at = blob.find(needle)
            while at >= 0:
                if at % 8 == 0 and blob[at + 16:at + 20] == needle:
                    return addr + at - 0x50
                at = blob.find(needle, at + 1)
        raise LookupError("no Il2CppMetadataRegistration with that type count")

    def metadata_registration(self, type_count: int) -> dict[str, int]:
        base = self.find_metadata_registration(type_count)
        names = [
            "genericClasses", "genericInsts", "genericMethodTable", "types",
            "methodSpecs", "fieldOffsets", "typeDefinitionsSizes",
        ]
        out = {"_base": base}
        for i, name in enumerate(names):
            out[f"{name}Count"] = (self.u64(base + i * 16) or 0) & 0xFFFFFFFF
            out[name] = self.pointer(base + i * 16 + 8)
        return out

    @cached_property
    def code_gen_modules(self) -> dict[str, dict[str, int]]:
        """`assembly name -> {methodPointerCount, methodPointers}`.

        Located by content: the struct's first field points at the module's
        `*.dll` name and the next word is a plausible method count. Modules with
        no method at all are not reported, which is why this can come back with
        slightly fewer entries than the metadata has assemblies."""
        out: dict[str, dict[str, int]] = {}
        for _, _, addr, size, _ in self.data_sections():
            for at in range(addr, addr + size - 24, 8):
                target = self.pointer(at)
                if not target:
                    continue
                name = self.cstring(target, 64)
                if not name or not name.endswith(".dll") or not name.isprintable():
                    continue
                count = (self.u64(at + 8) or 0) & 0xFFFFFFFF
                if not 0 < count < 500_000:
                    continue
                out.setdefault(name, {
                    "struct": at,
                    "methodPointerCount": count,
                    "methodPointers": self.pointer(at + 16),
                })
        return out

    def method_address(self, module: dict[str, int], token: int) -> int:
        """`methodPointers[row - 1]` for a `0x06......` method token."""
        row = token & 0xFFFFFF
        if not 1 <= row <= module["methodPointerCount"]:
            return 0
        return self.pointer(module["methodPointers"] + (row - 1) * 8)

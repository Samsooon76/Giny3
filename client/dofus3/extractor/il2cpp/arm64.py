"""Minimal arm64 decoder: the handful of forms needed to read IL2CPP code.

Not a disassembler. It recognises the instructions that carry the information
this project is after — call targets, page-relative data references, immediates
— and reports everything else as unknown rather than guessing."""
import struct


def sx(value, bits):
    sign = 1 << (bits - 1)
    return (value ^ sign) - sign


def decode(insn, pc):
    """-> (mnemo, dict) pour les formes qui nous interessent, sinon (None, {})."""
    op = insn >> 24
    # BL / B
    if insn >> 26 == 0b100101:
        return "BL", {"target": pc + sx(insn & 0x3FFFFFF, 26) * 4}
    if insn >> 26 == 0b000101:
        return "B", {"target": pc + sx(insn & 0x3FFFFFF, 26) * 4}
    # ADRP  1 immlo 10000 immhi Rd
    if insn & 0x9F000000 == 0x90000000:
        immlo = (insn >> 29) & 3
        immhi = (insn >> 5) & 0x7FFFF
        imm = sx((immhi << 2) | immlo, 21) << 12
        return "ADRP", {"rd": insn & 31, "page": (pc & ~0xFFF) + imm}
    # ADD (immediate) 32/64
    if insn & 0x7F800000 == 0x11000000 or insn & 0x7F800000 == 0x91000000:
        shift = (insn >> 22) & 3
        imm = (insn >> 10) & 0xFFF
        return "ADD", {"rd": insn & 31, "rn": (insn >> 5) & 31, "imm": imm << (12 if shift == 1 else 0)}
    # LDR (immediate, unsigned offset), 64-bit: 1111100101 imm12 Rn Rt
    if insn & 0xFFC00000 == 0xF9400000:
        return "LDR", {"rt": insn & 31, "rn": (insn >> 5) & 31, "imm": ((insn >> 10) & 0xFFF) * 8}
    if insn & 0xFFC00000 == 0xB9400000:
        return "LDRW", {"rt": insn & 31, "rn": (insn >> 5) & 31, "imm": ((insn >> 10) & 0xFFF) * 4}
    # MOVZ / MOVK / MOVN (32 et 64)
    if insn & 0x7F800000 == 0x52800000:
        return "MOVZ", {"rd": insn & 31, "imm": ((insn >> 5) & 0xFFFF) << (((insn >> 21) & 3) * 16)}
    if insn & 0x7F800000 == 0x72800000:
        return "MOVK", {"rd": insn & 31, "imm": ((insn >> 5) & 0xFFFF) << (((insn >> 21) & 3) * 16)}
    if insn == 0xD65F03C0:
        return "RET", {}
    if insn & 0xFF000000 == 0x34000000:
        return "CBZ", {"target": pc + sx((insn >> 5) & 0x7FFFF, 19) * 4}
    if insn & 0xFF000000 == 0x35000000:
        return "CBNZ", {"target": pc + sx((insn >> 5) & 0x7FFFF, 19) * 4}
    return None, {}


def walk(binary, start, end):
    """Yield `(pc, insn, mnemo, args)`, following ADRP/ADD and ADRP/LDR pairs.

    A page-relative reference is split across two instructions, so the walker
    remembers the last ADRP per register and adds `addr` to the second half."""
    off = binary.offset_of(start)
    pages = {}
    for k in range((end - start) // 4):
        pc = start + k * 4
        (insn,) = struct.unpack_from("<I", binary.blob, off + k * 4)
        mnemo, args = decode(insn, pc)
        if mnemo == "ADRP":
            pages[args["rd"]] = args["page"]
        elif mnemo in ("ADD", "LDR", "LDRW") and args.get("rn") in pages:
            args = dict(args, addr=pages[args["rn"]] + args["imm"])
        yield pc, insn, mnemo, args

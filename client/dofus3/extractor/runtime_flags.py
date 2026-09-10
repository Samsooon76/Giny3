"""Recover DataCenter boolean masks from the installed ARM64 getters.

Enum metadata uses several integer widths; never infer masks from enum order.
Only the proven load / single-bit extraction / return pattern is accepted.
"""
import argparse
import hashlib
from pathlib import Path
import re

from extractor.official_catalog import write_json
from extractor.unity_loader import DEFAULT_CLIENT, client_version


def decode_getter(instructions):
    if len(instructions) != 3 or instructions[2] != ("ret", ""):
        return None
    load, extract, _ = instructions
    if load[0] not in ("ldr", "ldrh", "ldrb"):
        return None
    match = re.fullmatch(r"w8, \[x0, #(0x[0-9a-f]+|[0-9]+)\]", load[1])
    if not match:
        return None
    byte_offset = int(match[1], 0) - 16
    if byte_offset not in range(4):
        return None
    if extract == ("and", "w0, w8, #1"):
        bit = 0
    elif extract[0] == "ubfx":
        match = re.fullmatch(r"w0, w8, #(0x[0-9a-f]+|[0-9]+), #1", extract[1])
        if not match:
            return None
        bit = int(match[1], 0)
    elif extract[0] == "lsr":
        match = re.fullmatch(r"w0, w8, #(0x[0-9a-f]+|[0-9]+)", extract[1])
        if not match:
            return None
        bit = int(match[1], 0)
        if bit != {"ldrb": 7, "ldrh": 15, "ldr": 31}[load[0]]:
            return None
    else:
        return None
    return 1 << (byte_offset * 8 + bit)


def extract_flags(client):
    from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM
    from extractor.il2cpp.metadata import Metadata
    from extractor.il2cpp.binary import Binary
    metadata, binary = Metadata(client), Binary(client)
    decoder = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    module = binary.code_gen_modules['Ankama.Dofus.Core.DataCenter.dll']
    classes = {}
    for name in ['ItemData', 'MonsterData', 'SpellData', 'SpellLevelData', 'EffectInstanceData']:
        typedef = next(t for t in metadata.types_named(name) if t.namespace.startswith('Core.DataCenter.Metadata.'))
        flags = {}
        for index, method in typedef.methods:
            if not method.startswith('get_'):
                continue
            address = binary.method_address(module, metadata.method_token(index))
            offset = binary.offset_of(address)
            if offset is None:
                continue
            code = list(decoder.disasm(binary.blob[offset:offset+12], address))
            mask = decode_getter([(i.mnemonic, i.op_str) for i in code])
            if mask is not None:
                flags[method[4:]] = {"mask": mask, "address": hex(address),
                                    "instructions": [f"{i.mnemonic} {i.op_str}".strip() for i in code]}
        if not flags:
            raise ValueError(f"No supported getters found for {name}")
        classes[name] = flags
    return {"format": "giny.runtime-flags.v1", "clientVersion": client_version(client),
            "binarySha256": hashlib.sha256(binary.blob).hexdigest(),
            "metadataSha256": hashlib.sha256(metadata.data).hexdigest(), "classes": classes}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', type=Path, default=DEFAULT_CLIENT)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = extract_flags(args.client)
    write_json(args.output, result)
    print({name: len(flags) for name, flags in result['classes'].items()})

"""Trace direct ARM64 references to AleCoreHelper in the installed official client.

Read-only native-code audit. This is not a map classifier. Reflection, dynamic
code and other architectures are outside the scope of this direct-reference scan.
"""
import bisect
import hashlib
import json
import struct
from pathlib import Path

from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM
from extractor.il2cpp.metadata import Metadata, T_IMAGES, TD_BYVAL_TYPE
from extractor.il2cpp.binary import Binary
from extractor.il2cpp.arm64 import walk
from extractor.unity_loader import client_version

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/audits/official-is-fight-map-xrefs.json'


def main():
    metadata, binary = Metadata(), Binary()
    decoder = Cs(CS_ARCH_ARM64, CS_MODE_ARM)
    helper = metadata.types_named('AleCoreHelper')[0]
    registration = binary.metadata_registration(metadata.type_count)
    offsets = binary.pointer(registration['fieldOffsets'] + 8 * helper.index)
    fields = [{'index': index, 'name': name, 'offset': binary.u32(offsets + 4 * i)}
              for i, (index, name) in enumerate(helper.fields)]

    # Encoded TypeInfo usages carry the Il2CppType index, not the TypeDef index.
    type_index = helper._u32(TD_BYVAL_TYPE)
    encoded = 0x20000001 | (type_index << 1)
    needle = struct.pack('<Q', encoded)
    slots = set()
    for _, _, address, size, offset in binary.data_sections():
        at = binary.blob.find(needle, offset, offset + size)
        while at >= 0:
            if (at - offset) % 8 == 0:
                slots.add(address + at - offset)
            at = binary.blob.find(needle, at + 8, offset + size)
    if not slots:
        raise RuntimeError('No TypeInfo slot found; do not infer absence of use.')
    print('Helper TypeInfo slots:', [hex(s) for s in sorted(slots)], flush=True)

    modules, names, image_index, module = binary.code_gen_modules, {}, -1, None
    for index in range(metadata.type_count):
        typedef = metadata.type_def(index)
        if typedef.token & 0xffffff == 1:
            image_index += 1
            image = metadata.name(metadata.u32(metadata.tables[T_IMAGES].offset + image_index * 36))
            module = modules.get(image)
        if module:
            for method_index, name in typedef.methods:
                address = binary.method_address(module, metadata.method_token(method_index))
                if address:
                    names.setdefault(address, []).append(typedef.full_name + '::' + name)

    references, scanned = {}, []
    for segment, section, address, size, _ in binary.sections:
        if section not in ('__text', 'il2cpp'):
            continue
        scanned.append({'segment': segment, 'section': section, 'address': hex(address), 'bytes': size})
        for pc, _, _, args in walk(binary, address, address + size):
            if args.get('addr') in slots:
                i = bisect.bisect_right(binary.function_starts, pc) - 1
                start = binary.function_starts[i]
                references.setdefault(start, []).append(hex(pc))

    functions = []
    for start, refs in sorted(references.items()):
        end = binary.function_extent(start)[1]
        offset = binary.offset_of(start)
        lines = []
        for ins in decoder.disasm(binary.blob[offset:offset + end - start], start):
            suffix = ''
            if ins.mnemonic in ('bl', 'b'):
                target = int(ins.op_str.removeprefix('#'), 16)
                if target in names:
                    suffix = ' ; ' + ', '.join(names[target])
            lines.append(f'{ins.address:#x}: {ins.mnemonic} {ins.op_str}' + suffix)
        functions.append({'address': hex(start), 'names': names.get(start, []), 'reference_sites': refs, 'asm': lines})

    result = {'client_version': client_version(), 'architecture': 'ARM64',
              'binary_sha256': hashlib.sha256(binary.blob).hexdigest(),
              'metadata_sha256': hashlib.sha256(metadata.data).hexdigest(),
              'type': helper.full_name, 'type_definition_index': helper.index,
              'byval_type_index': type_index, 'encoded_type_info': hex(encoded),
              'type_info_slots': [hex(s) for s in sorted(slots)], 'fields': fields,
              'scanned_sections': scanned, 'functions': functions,
              'scope': 'Direct ADRP+ADD/LDR references; manually inspect disassembly to follow the static-fields pointer. Not proof against reflection or dynamic assignment.'}
    OUT.write_text(json.dumps(result, indent=2) + '\n')
    print([(f['address'], f['names']) for f in functions], flush=True)


if __name__ == '__main__':
    main()

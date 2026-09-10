"""The build's `MonoManager` script table: real class names, in clear text.

`global-metadata.dat` is obfuscated where Ankama's own code lives, so half of
`Core` reaches the reader as two-letter types. But Unity's scripting backend
needs a name for every script compiled into the player, and it stores those in
the `MonoScript` records of `globalgamemanagers.assets`, untouched: assembly,
namespace and class name as the developer wrote them.

That makes the file a name table the metadata cannot give. `dofus_unity_
monoscripts.bundle` — the one previously read — holds 55 records, and only
those an Addressable asset points at. This one holds 7 404.

Every class name is looked up in the metadata string blob, and the rows whose
name is **absent** are the interesting ones: the metadata does not spell that
name anywhere. Two different things produce that, and this module does not
pretend to tell them apart:

renamed
    the type is in the build under an obfuscated name. Certain for
    `Ankama.Dofus.Protocol.Game`, where 95 of 102 names are absent and none
    resolves to a typedef — yet the client plainly speaks the protocol, so the
    types exist. For those rows the real name is genuinely recovered here.
stripped
    the managed linker dropped the type before conversion, so no name is owed.
    This is what `Unity.InputSystem`'s absences are: Unity's own assemblies are
    not obfuscated (the metadata spells `mscorlib` at 99 %), and `link.xml`
    exists precisely because stripping is on.

The `typed` rate per assembly is the usable signal: an assembly whose scripts
mostly resolve by namespace+name is readable and its absences are strippage; an
assembly at 0 % is renamed wholesale. Nothing here guesses which side a single
row falls on.

The mapping from a recovered name to the obfuscated type implementing it is
also out of scope. `properties_hash` is kept for it: Unity derives that from
the type's serialized fields, so it is the one value a later pass can match
against a candidate `Il2CppTypeDefinition`.

Every count is true of one build. `client_version` dates the dump, because the
next patch reshuffles the obfuscated names it is measured against.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

from extractor.il2cpp.metadata import T_STRING, Metadata
from extractor.unity_loader import DEFAULT_CLIENT, client_version, load_bundle, player_data_root

FORMAT = "giny.dofus3.monoscripts.v1"

#: The player's own serialized file. It is not an Addressable, so no bundle
#: catalog points at it and enumerating bundles never reaches it.
PLAYER_FILE = "globalgamemanagers.assets"


def source_path(client_root: Path = DEFAULT_CLIENT) -> Path:
    return player_data_root(client_root) / PLAYER_FILE


def _hash_hex(value: Any) -> str | None:
    """`m_PropertiesHash` is serialized as 16 separate `bytes[i]` fields."""
    if not isinstance(value, dict):
        return None
    try:
        raw = bytes(value[f"bytes[{i}]"] for i in range(16))
    except KeyError:
        return None
    return raw.hex()


def _assembly(raw: str) -> str:
    """`Core.dll` and `Core` both occur; group on the assembly name."""
    return raw[:-4] if raw.endswith(".dll") else raw


def iter_scripts(client_root: Path = DEFAULT_CLIENT) -> Iterator[dict]:
    """Every `MonoScript` record, in the order the file declares it."""
    env = load_bundle(source_path(client_root))
    for obj in env.objects:
        if obj.type.name != "MonoScript":
            continue
        tree = obj.read_typetree()
        yield {
            "assembly": _assembly(tree.get("m_AssemblyName") or ""),
            "namespace": tree.get("m_Namespace") or "",
            "class": tree.get("m_ClassName") or "",
            "properties_hash": _hash_hex(tree.get("m_PropertiesHash")),
        }


def metadata_names(md: Metadata | None = None) -> set[str]:
    """Every NUL-terminated string of the metadata `T_STRING` blob.

    A superset of the type names, which is what keeps `absent` a floor: a class
    name is only reported as absent when *nothing* in the metadata spells it,
    not merely when no type does."""
    md = md or Metadata()
    table = md.tables[T_STRING]
    blob = md.data[table.offset:table.offset + table.size]
    return {chunk.decode("utf-8", "replace") for chunk in blob.split(b"\x00") if chunk}


def typedef_full_names(md: Metadata | None = None) -> set[str]:
    """`namespace.name` of every typedef, for the per-row resolution check."""
    md = md or Metadata()
    return {md.type_def(i).full_name for i in range(md.type_count)}


def collect(client_root: Path = DEFAULT_CLIENT) -> dict:
    """The script table, each row marked against what the metadata still names."""
    md = Metadata(client_root)
    names = metadata_names(md)
    full_names = typedef_full_names(md)

    scripts: list[dict] = []
    per_assembly: dict[str, Counter] = {}
    for row in iter_scripts(client_root):
        cls, ns = row["class"], row["namespace"]
        named = cls in names
        row = {
            **row,
            "in_metadata": named,
            "in_typedefs": (f"{ns}.{cls}" if ns else cls) in full_names,
            "absent": not named,
        }
        scripts.append(row)
        counts = per_assembly.setdefault(row["assembly"], Counter())
        counts["total"] += 1
        counts["absent"] += row["absent"]
        counts["typed"] += row["in_typedefs"]

    assemblies = {
        name: {**dict(sorted(counts.items())), "typed_rate": round(counts["typed"] / counts["total"], 3)}
        for name, counts in sorted(per_assembly.items(), key=lambda kv: -kv[1]["total"])
    }
    return {
        "format": FORMAT,
        "source": f"Dofus.app/Contents/Resources/Data/{PLAYER_FILE}",
        "client_version": client_version(client_root),
        "counts": {
            "scripts": len(scripts),
            "assemblies": len(assemblies),
            "absent_from_metadata": sum(1 for s in scripts if s["absent"]),
            "in_typedefs": sum(1 for s in scripts if s["in_typedefs"]),
            "metadata_strings": len(names),
        },
        "assemblies": assemblies,
        "scripts": scripts,
    }


def namespaces(table: dict, assembly: str | None = None, absent_only: bool = False) -> Counter:
    """Namespace histogram — which subsystems the table actually describes."""
    out: Counter = Counter()
    for row in table["scripts"]:
        if assembly is not None and row["assembly"] != assembly:
            continue
        if absent_only and not row["absent"]:
            continue
        out[row["namespace"]] += 1
    return out


def write_monoscripts(dest_root: Path, client_root: Path = DEFAULT_CLIENT) -> Path:
    """Write `monoScripts.json` — the whole table, one row per script."""
    table = collect(client_root)
    dest = Path(dest_root) / "monoScripts.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(table, indent=1) + "\n")
    return dest


def format_summary(table: dict, limit: int = 12) -> str:
    counts = table["counts"]
    lines = [
        f"{PLAYER_FILE}: {counts['scripts']} MonoScript, {counts['assemblies']} assemblies,"
        f" client {table['client_version']}",
        f"  {counts['absent_from_metadata']} class names the metadata does not spell"
        f" (renamed or stripped — see module docstring)",
        f"  {counts['in_typedefs']} resolve to a typedef by namespace+name",
    ]
    for name, c in list(table["assemblies"].items())[:limit]:
        lines.append(
            f"    {c['total']:6d} {name:38s} absent={c['absent']:<6d} typed={c['typed_rate']:.0%}"
        )
    return "\n".join(lines)
